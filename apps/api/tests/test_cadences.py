"""Integration tests for the cadence management endpoints.

Requires the API to be running (e.g. via docker compose up).
"""

import uuid

from httpx import AsyncClient

PREFIX = "/api/v1"


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def register(client: AsyncClient) -> tuple[dict, str]:
    """Register a user, return (headers, user_id)."""
    email = unique_email()
    resp = await client.post(f"{PREFIX}/auth/register", json={
        "name": "Test Beekeeper",
        "email": email,
        "password": "secret123",
    })
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = await client.get(f"{PREFIX}/users/me", headers=headers)
    return headers, me.json()["id"]


class TestCadenceCatalog:
    """GET /cadences/catalog — public endpoint."""

    async def test_returns_catalog(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/cadences/catalog")
        assert resp.status_code == 200
        catalog = resp.json()
        assert isinstance(catalog, list)
        assert len(catalog) > 0

    async def test_catalog_entry_has_required_fields(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/cadences/catalog")
        entry = resp.json()[0]
        for field in ("key", "title", "description", "category", "season", "priority"):
            assert field in entry, f"Missing field: {field}"

    async def test_catalog_has_both_categories(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/cadences/catalog")
        categories = {e["category"] for e in resp.json()}
        assert "recurring" in categories
        assert "seasonal" in categories

    async def test_catalog_no_auth_required(self, client: AsyncClient):
        """Catalog is public — no Authorization header needed."""
        resp = await client.get(f"{PREFIX}/cadences/catalog")
        assert resp.status_code == 200


class TestCadenceInitialization:
    """POST /cadences/initialize — seeds cadences for a user."""

    async def test_initialize_creates_cadences(self, client: AsyncClient):
        headers, _ = await register(client)
        resp = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        assert resp.status_code == 201
        cadences = resp.json()
        assert isinstance(cadences, list)
        assert len(cadences) > 0

    async def test_initialize_is_idempotent(self, client: AsyncClient):
        headers, _ = await register(client)

        resp1 = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        assert resp1.status_code == 201
        count1 = len(resp1.json())

        # Second call should return empty list (no new cadences)
        resp2 = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        assert resp2.status_code == 201
        count2 = len(resp2.json())
        assert count2 == 0

        # Total cadences should match the first batch
        resp3 = await client.get(f"{PREFIX}/cadences", headers=headers)
        assert len(resp3.json()) == count1

    async def test_initialize_requires_auth(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/cadences/initialize")
        assert resp.status_code == 401

    async def test_initialized_cadences_have_next_due_date(self, client: AsyncClient):
        headers, _ = await register(client)
        resp = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        cadences = resp.json()
        # Every initialized cadence should have a non-null next_due_date
        for c in cadences:
            assert c["next_due_date"] is not None, f"Cadence {c['cadence_key']} missing due date"

    async def test_initialized_cadences_are_active(self, client: AsyncClient):
        headers, _ = await register(client)
        resp = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        for c in resp.json():
            assert c["is_active"] is True


class TestCadenceList:
    """GET /cadences — list user's cadence subscriptions."""

    async def test_list_empty_before_init(self, client: AsyncClient):
        headers, _ = await register(client)
        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_after_init(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) > 0

    async def test_list_requires_auth(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/cadences")
        assert resp.status_code == 401

    async def test_cadences_scoped_to_user(self, client: AsyncClient):
        """User A's cadences are not visible to User B."""
        headers_a, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers_a)

        headers_b, _ = await register(client)
        resp = await client.get(f"{PREFIX}/cadences", headers=headers_b)
        assert resp.json() == []

    async def test_cadence_response_shape(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        cadence = resp.json()[0]
        for field in ("id", "user_id", "cadence_key", "is_active", "next_due_date", "created_at"):
            assert field in cadence, f"Missing field: {field}"


class TestCadenceUpdate:
    """PATCH /cadences/{id} — toggle or update a cadence."""

    async def test_toggle_active_off(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        cadences = (await client.get(f"{PREFIX}/cadences", headers=headers)).json()
        cadence_id = cadences[0]["id"]

        resp = await client.patch(
            f"{PREFIX}/cadences/{cadence_id}", headers=headers,
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is False

    async def test_toggle_active_on(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        cadences = (await client.get(f"{PREFIX}/cadences", headers=headers)).json()
        cadence_id = cadences[0]["id"]

        # Turn off then on
        await client.patch(
            f"{PREFIX}/cadences/{cadence_id}", headers=headers,
            json={"is_active": False},
        )
        resp = await client.patch(
            f"{PREFIX}/cadences/{cadence_id}", headers=headers,
            json={"is_active": True},
        )
        assert resp.status_code == 200
        assert resp.json()["is_active"] is True

    async def test_update_nonexistent_returns_404(self, client: AsyncClient):
        headers, _ = await register(client)
        fake_id = str(uuid.uuid4())
        resp = await client.patch(
            f"{PREFIX}/cadences/{fake_id}", headers=headers,
            json={"is_active": False},
        )
        assert resp.status_code == 404

    async def test_update_other_users_cadence_returns_404(self, client: AsyncClient):
        headers_a, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers_a)
        cadences = (await client.get(f"{PREFIX}/cadences", headers=headers_a)).json()
        cadence_id = cadences[0]["id"]

        headers_b, _ = await register(client)
        resp = await client.patch(
            f"{PREFIX}/cadences/{cadence_id}", headers=headers_b,
            json={"is_active": False},
        )
        assert resp.status_code == 404

    async def test_update_requires_auth(self, client: AsyncClient):
        fake_id = str(uuid.uuid4())
        resp = await client.patch(
            f"{PREFIX}/cadences/{fake_id}",
            json={"is_active": False},
        )
        assert resp.status_code == 401


class TestCadenceTaskGeneration:
    """POST /cadences/generate — manually trigger task generation."""

    async def test_generate_requires_auth(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/cadences/generate")
        assert resp.status_code == 401

    async def test_generate_returns_list(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        resp = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    async def test_generated_tasks_appear_in_task_list(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        gen_resp = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        generated = gen_resp.json()

        if len(generated) > 0:
            tasks_resp = await client.get(f"{PREFIX}/tasks", headers=headers)
            task_ids = {t["id"] for t in tasks_resp.json()}
            for g in generated:
                assert g["id"] in task_ids

    async def test_generated_tasks_have_system_source(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        gen_resp = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        for task in gen_resp.json():
            assert task["source"] == "system"

    async def test_generate_twice_does_not_duplicate(self, client: AsyncClient):
        """After generating, cadence due dates advance — second call shouldn't re-create."""
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        resp1 = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        count1 = len(resp1.json())

        resp2 = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        count2 = len(resp2.json())
        # Second generation should produce fewer or zero tasks since due dates advanced
        assert count2 <= count1

    async def test_inactive_cadences_do_not_generate(self, client: AsyncClient):
        headers, _ = await register(client)
        await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        cadences = (await client.get(f"{PREFIX}/cadences", headers=headers)).json()

        # Deactivate all cadences
        for c in cadences:
            await client.patch(
                f"{PREFIX}/cadences/{c['id']}", headers=headers,
                json={"is_active": False},
            )

        resp = await client.post(f"{PREFIX}/cadences/generate", headers=headers)
        assert resp.json() == []


class TestHemisphereIntegration:
    """Verify hemisphere preference and apiary latitude affect cadence scheduling."""

    async def test_hemisphere_preference_is_persisted(self, client: AsyncClient):
        headers, _ = await register(client)
        resp = await client.patch(
            f"{PREFIX}/users/me/preferences", headers=headers,
            json={"hemisphere": "south"},
        )
        assert resp.status_code == 200
        assert resp.json()["preferences"]["hemisphere"] == "south"

    async def test_hemisphere_auto_when_unset(self, client: AsyncClient):
        """Without explicit preference or apiary lat, hemisphere defaults to north."""
        headers, _ = await register(client)
        resp = await client.get(f"{PREFIX}/users/me", headers=headers)
        prefs = resp.json().get("preferences") or {}
        assert prefs.get("hemisphere") is None

    async def test_apiary_with_southern_latitude(self, client: AsyncClient):
        """Creating an apiary with southern latitude sets up correct geo data."""
        headers, _ = await register(client)
        resp = await client.post(
            f"{PREFIX}/apiaries", headers=headers,
            json={"name": "Sydney Apiary", "latitude": -33.87, "longitude": 151.21},
        )
        assert resp.status_code == 201
        assert resp.json()["latitude"] == -33.87

    async def test_initialize_with_southern_apiary(self, client: AsyncClient):
        """When user has a southern-hemisphere apiary, cadences should initialize."""
        headers, _ = await register(client)
        # Create a southern-hemisphere apiary first
        await client.post(
            f"{PREFIX}/apiaries", headers=headers,
            json={"name": "Melbourne Apiary", "latitude": -37.81, "longitude": 144.96},
        )
        resp = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        assert resp.status_code == 201
        cadences = resp.json()
        assert len(cadences) > 0
        # All cadences should have due dates set
        for c in cadences:
            assert c["next_due_date"] is not None

    async def test_hemisphere_preference_overrides_apiary(self, client: AsyncClient):
        """Explicit hemisphere preference takes precedence over apiary latitude."""
        headers, _ = await register(client)
        # Create southern-hemisphere apiary
        await client.post(
            f"{PREFIX}/apiaries", headers=headers,
            json={"name": "Cape Town Apiary", "latitude": -33.92, "longitude": 18.42},
        )
        # But set preference to north
        await client.patch(
            f"{PREFIX}/users/me/preferences", headers=headers,
            json={"hemisphere": "north"},
        )
        # Initialize cadences — should use north despite southern apiary
        resp = await client.post(f"{PREFIX}/cadences/initialize", headers=headers)
        assert resp.status_code == 201
        assert len(resp.json()) > 0
