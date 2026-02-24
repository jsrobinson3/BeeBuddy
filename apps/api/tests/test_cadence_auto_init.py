"""Tests for cadence auto-initialization, per-hive cadences, and task generation.

Requires the API to be running (e.g. via docker compose up).
Each test registers a fresh user to avoid cross-test interference.
"""

import uuid
from datetime import date

from httpx import AsyncClient

PREFIX = "/api/v1"

# Number of hive-scoped templates (regular_inspection, varroa_monitoring)
HIVE_CADENCE_COUNT = 2


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


async def create_apiary(
    client: AsyncClient, headers: dict, name: str = "Test Apiary",
) -> str:
    """Create an apiary, return its ID."""
    resp = await client.post(
        f"{PREFIX}/apiaries", headers=headers,
        json={"name": name},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def create_hive(
    client: AsyncClient, headers: dict, apiary_id: str,
    name: str = "Test Hive",
) -> dict:
    """Create a hive, return the full response body."""
    resp = await client.post(
        f"{PREFIX}/hives", headers=headers,
        json={"apiary_id": apiary_id, "name": name},
    )
    assert resp.status_code == 201
    return resp.json()


class TestCadenceAutoInit:
    """POST /hives — first hive triggers cadence auto-initialization."""

    async def test_first_hive_auto_initializes_cadences(
        self, client: AsyncClient,
    ):
        """Creating the first hive should auto-initialize cadences."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)

        # No cadences before first hive
        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

        # Create the first hive
        await create_hive(client, headers, apiary_id)

        # Cadences should now be initialized (user-level + hive-scoped)
        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        assert resp.status_code == 200
        cadences = resp.json()
        assert len(cadences) > 0

    async def test_second_hive_adds_its_own_hive_cadences(
        self, client: AsyncClient,
    ):
        """Creating a second hive adds hive-scoped cadences for that hive only."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)

        # Create first hive — triggers user-level + hive-scoped init
        hive1 = await create_hive(client, headers, apiary_id, name="Hive 1")

        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        cadences_after_first = resp.json()
        count_after_first = len(cadences_after_first)

        # Create second hive — should add exactly HIVE_CADENCE_COUNT more cadences
        hive2 = await create_hive(client, headers, apiary_id, name="Hive 2")

        resp = await client.get(f"{PREFIX}/cadences", headers=headers)
        cadences_after_second = resp.json()

        assert len(cadences_after_second) == count_after_first + HIVE_CADENCE_COUNT

        # The new cadences should belong to hive2
        hive2_cadences = [c for c in cadences_after_second if c["hive_id"] == hive2["id"]]
        assert len(hive2_cadences) == HIVE_CADENCE_COUNT

        # hive1 still has its own
        hive1_cadences = [c for c in cadences_after_second if c["hive_id"] == hive1["id"]]
        assert len(hive1_cadences) == HIVE_CADENCE_COUNT

    async def test_auto_init_generates_due_tasks(
        self, client: AsyncClient,
    ):
        """First hive creation should also generate tasks for due cadences."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)

        # No tasks before first hive
        resp = await client.get(f"{PREFIX}/tasks", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

        # Create the first hive
        await create_hive(client, headers, apiary_id)

        # Tasks should have been generated for due cadences
        resp = await client.get(f"{PREFIX}/tasks", headers=headers)
        assert resp.status_code == 200
        tasks = resp.json()
        # At least some cadences should be due today and produce tasks
        assert len(tasks) > 0
        for task in tasks:
            assert task["source"] == "system"


class TestHiveScopedCadences:
    """Per-hive cadence initialization and task generation."""

    async def test_hive_cadences_have_correct_keys(
        self, client: AsyncClient,
    ):
        """Hive-scoped cadences should be regular_inspection and varroa_monitoring."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)
        hive = await create_hive(client, headers, apiary_id)

        resp = await client.get(
            f"{PREFIX}/cadences", headers=headers,
            params={"hive_id": hive["id"]},
        )
        assert resp.status_code == 200
        cadences = resp.json()
        keys = {c["cadence_key"] for c in cadences}
        assert keys == {"regular_inspection", "varroa_monitoring"}

    async def test_hive_tasks_have_hive_id_and_prefixed_title(
        self, client: AsyncClient,
    ):
        """Tasks from hive cadences should have hive_id set and title prefixed with hive name."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)
        hive = await create_hive(client, headers, apiary_id, name="Queen Bee")

        resp = await client.get(f"{PREFIX}/tasks", headers=headers)
        tasks = resp.json()
        hive_tasks = [t for t in tasks if t["hive_id"] == hive["id"]]

        assert len(hive_tasks) >= HIVE_CADENCE_COUNT
        for task in hive_tasks:
            assert task["title"].startswith("Queen Bee:")
            assert task["apiary_id"] == apiary_id

    async def test_cadences_filter_by_hive_id(
        self, client: AsyncClient,
    ):
        """GET /cadences?hive_id=X should only return cadences for that hive."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)
        hive1 = await create_hive(client, headers, apiary_id, name="Hive A")
        hive2 = await create_hive(client, headers, apiary_id, name="Hive B")

        resp = await client.get(
            f"{PREFIX}/cadences", headers=headers,
            params={"hive_id": hive1["id"]},
        )
        cadences = resp.json()
        assert all(c["hive_id"] == hive1["id"] for c in cadences)
        assert len(cadences) == HIVE_CADENCE_COUNT

        resp = await client.get(
            f"{PREFIX}/cadences", headers=headers,
            params={"hive_id": hive2["id"]},
        )
        cadences = resp.json()
        assert all(c["hive_id"] == hive2["id"] for c in cadences)
        assert len(cadences) == HIVE_CADENCE_COUNT

    async def test_delete_hive_cascades_cadences(
        self, client: AsyncClient,
    ):
        """Deleting a hive should cascade-delete its cadences."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)
        hive = await create_hive(client, headers, apiary_id)

        # Confirm cadences exist
        resp = await client.get(
            f"{PREFIX}/cadences", headers=headers,
            params={"hive_id": hive["id"]},
        )
        assert len(resp.json()) == HIVE_CADENCE_COUNT

        # Delete the hive
        resp = await client.delete(f"{PREFIX}/hives/{hive['id']}", headers=headers)
        assert resp.status_code == 204

        # Cadences for that hive should be gone
        resp = await client.get(
            f"{PREFIX}/cadences", headers=headers,
            params={"hive_id": hive["id"]},
        )
        assert resp.json() == []

    async def test_freshly_initialized_cadences_generate_tasks_immediately(
        self, client: AsyncClient,
    ):
        """Cadences initialized today should produce tasks immediately (not next interval)."""
        headers, _ = await register(client)
        apiary_id = await create_apiary(client, headers)

        # Create hive — triggers cadence init + task generation
        await create_hive(client, headers, apiary_id)

        # All recurring cadences should have generated tasks
        resp = await client.get(f"{PREFIX}/tasks", headers=headers)
        tasks = resp.json()
        system_tasks = [t for t in tasks if t["source"] == "system"]

        # We expect at least hive-scoped recurring + user-level recurring
        # (equipment_check is user-level recurring, regular_inspection +
        # varroa_monitoring are hive-scoped recurring) = 3 minimum
        assert len(system_tasks) >= 3

        # All recurring tasks should share the same due_date (the server's "today")
        # and it should be a recent date (not pushed into the future by interval)
        recurring_tasks = [t for t in system_tasks if t["recurring"]]
        due_dates = {t["due_date"] for t in recurring_tasks}
        assert len(due_dates) == 1, f"Expected all recurring tasks due same day, got {due_dates}"
        due = date.fromisoformat(due_dates.pop())
        assert abs((due - date.today()).days) <= 1, "Due date should be today (allow UTC offset)"

    async def test_catalog_includes_scope(
        self, client: AsyncClient,
    ):
        """GET /cadences/catalog should include scope field."""
        resp = await client.get(f"{PREFIX}/cadences/catalog")
        assert resp.status_code == 200
        catalog = resp.json()
        for tpl in catalog:
            assert "scope" in tpl
            assert tpl["scope"] in ("user", "hive")

        hive_scoped = [t for t in catalog if t["scope"] == "hive"]
        assert len(hive_scoped) == HIVE_CADENCE_COUNT


class TestTaskDueDateSchema:
    """Verify task due_date accepts and returns date (not datetime) strings."""

    async def test_create_task_with_date_string(
        self, client: AsyncClient,
    ):
        """Task creation should accept a plain date string for due_date."""
        headers, _ = await register(client)

        today = date.today().isoformat()
        resp = await client.post(
            f"{PREFIX}/tasks", headers=headers,
            json={
                "title": "Test date task",
                "due_date": today,
                "priority": "medium",
            },
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["due_date"] == today

    async def test_task_response_due_date_is_date_format(
        self, client: AsyncClient,
    ):
        """TaskResponse.due_date should be a plain date, not a datetime."""
        headers, _ = await register(client)

        due = "2026-06-15"
        resp = await client.post(
            f"{PREFIX}/tasks", headers=headers,
            json={"title": "Date format check", "due_date": due},
        )
        assert resp.status_code == 201
        body = resp.json()
        # Should be exactly "2026-06-15", not "2026-06-15T00:00:00..."
        assert body["due_date"] == due
        assert "T" not in body["due_date"]

    async def test_update_task_due_date_with_date_string(
        self, client: AsyncClient,
    ):
        """Task update should accept a plain date string for due_date."""
        headers, _ = await register(client)

        resp = await client.post(
            f"{PREFIX}/tasks", headers=headers,
            json={"title": "Updatable task", "due_date": "2026-06-01"},
        )
        assert resp.status_code == 201
        task_id = resp.json()["id"]

        new_date = "2026-07-01"
        resp = await client.patch(
            f"{PREFIX}/tasks/{task_id}", headers=headers,
            json={"due_date": new_date},
        )
        assert resp.status_code == 200
        assert resp.json()["due_date"] == new_date
