"""Integration tests for queens, treatments, harvests, events, and tasks CRUD.

Requires the API to be running (e.g. via docker compose up).
Each test class registers a fresh user and creates the FK chain:
  user -> apiary -> hive
"""

import uuid
from datetime import UTC, datetime

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


async def setup_hive(client: AsyncClient, headers: dict) -> tuple[str, str]:
    """Create an apiary and a hive, return (apiary_id, hive_id)."""
    resp = await client.post(
        f"{PREFIX}/apiaries", headers=headers,
        json={"name": "Test Apiary"},
    )
    assert resp.status_code == 201
    apiary_id = resp.json()["id"]

    resp = await client.post(
        f"{PREFIX}/hives", headers=headers,
        json={"apiary_id": apiary_id, "name": "Test Hive"},
    )
    assert resp.status_code == 201
    hive_id = resp.json()["id"]
    return apiary_id, hive_id


async def create_queen(client, headers, hive_id) -> str:
    """Create a queen and return its ID."""
    resp = await client.post(f"{PREFIX}/queens", headers=headers, json={
        "hive_id": hive_id, "marking_color": "blue", "status": "present",
    })
    assert resp.status_code == 201
    assert resp.json()["marking_color"] == "blue"
    return resp.json()["id"]


async def create_treatment(client, headers, hive_id) -> str:
    """Create a treatment and return its ID."""
    now = datetime.now(UTC).isoformat()
    resp = await client.post(f"{PREFIX}/treatments", headers=headers, json={
        "hive_id": hive_id, "treatment_type": "oxalic_acid", "started_at": now,
    })
    assert resp.status_code == 201
    assert resp.json()["treatment_type"] == "oxalic_acid"
    return resp.json()["id"]


async def create_harvest(client, headers, hive_id) -> str:
    """Create a harvest and return its ID."""
    resp = await client.post(f"{PREFIX}/harvests", headers=headers, json={
        "hive_id": hive_id,
        "harvested_at": datetime.now(UTC).isoformat(),
        "weight_kg": 12.5,
    })
    assert resp.status_code == 201
    return resp.json()["id"]


async def create_event(client, headers, hive_id) -> str:
    """Create an event and return its ID."""
    resp = await client.post(f"{PREFIX}/events", headers=headers, json={
        "hive_id": hive_id,
        "event_type": "swarm",
        "occurred_at": datetime.now(UTC).isoformat(),
    })
    assert resp.status_code == 201
    assert resp.json()["event_type"] == "swarm"
    return resp.json()["id"]


async def create_task(client, headers, hive_id, apiary_id) -> str:
    """Create a task and return its ID."""
    resp = await client.post(f"{PREFIX}/tasks", headers=headers, json={
        "title": "Check varroa mite count",
        "hive_id": hive_id,
        "apiary_id": apiary_id,
        "priority": "high",
    })
    assert resp.status_code == 201
    assert resp.json()["title"] == "Check varroa mite count"
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Queens
# ---------------------------------------------------------------------------


class TestQueens:
    async def test_create_and_list(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        queen_id = await create_queen(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/queens", headers=headers, params={"hive_id": hive_id},
        )
        assert resp.status_code == 200
        assert queen_id in [q["id"] for q in resp.json()]

    async def test_get_by_id(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        queen_id = await create_queen(client, headers, hive_id)

        resp = await client.get(f"{PREFIX}/queens/{queen_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == queen_id

    async def test_update(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        queen_id = await create_queen(client, headers, hive_id)

        resp = await client.patch(
            f"{PREFIX}/queens/{queen_id}", headers=headers,
            json={"marking_color": "white", "fertilized": True},
        )
        assert resp.status_code == 200
        assert resp.json()["marking_color"] == "white"
        assert resp.json()["fertilized"] is True

    async def test_delete_then_404(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        queen_id = await create_queen(client, headers, hive_id)

        resp = await client.delete(f"{PREFIX}/queens/{queen_id}", headers=headers)
        assert resp.status_code == 204

        resp = await client.get(f"{PREFIX}/queens/{queen_id}", headers=headers)
        assert resp.status_code == 404

    async def test_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/queens")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Treatments
# ---------------------------------------------------------------------------


class TestTreatments:
    async def test_create_and_list(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        treatment_id = await create_treatment(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/treatments", headers=headers, params={"hive_id": hive_id},
        )
        assert resp.status_code == 200
        assert treatment_id in [t["id"] for t in resp.json()]

    async def test_get_by_id(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        treatment_id = await create_treatment(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/treatments/{treatment_id}", headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == treatment_id

    async def test_update(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        treatment_id = await create_treatment(client, headers, hive_id)

        resp = await client.patch(
            f"{PREFIX}/treatments/{treatment_id}", headers=headers,
            json={"product_name": "Api-Bioxal"},
        )
        assert resp.status_code == 200
        assert resp.json()["product_name"] == "Api-Bioxal"

    async def test_delete_then_404(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        treatment_id = await create_treatment(client, headers, hive_id)

        resp = await client.delete(
            f"{PREFIX}/treatments/{treatment_id}", headers=headers,
        )
        assert resp.status_code == 204

        resp = await client.get(
            f"{PREFIX}/treatments/{treatment_id}", headers=headers,
        )
        assert resp.status_code == 404

    async def test_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/treatments")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Harvests
# ---------------------------------------------------------------------------


class TestHarvests:
    async def test_create_and_list(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        harvest_id = await create_harvest(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/harvests", headers=headers, params={"hive_id": hive_id},
        )
        assert resp.status_code == 200
        assert harvest_id in [h["id"] for h in resp.json()]

    async def test_get_by_id(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        harvest_id = await create_harvest(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/harvests/{harvest_id}", headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == harvest_id

    async def test_update(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        harvest_id = await create_harvest(client, headers, hive_id)

        resp = await client.patch(
            f"{PREFIX}/harvests/{harvest_id}", headers=headers,
            json={"weight_kg": 15.0},
        )
        assert resp.status_code == 200
        assert resp.json()["weight_kg"] == 15.0

    async def test_delete_then_404(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        harvest_id = await create_harvest(client, headers, hive_id)

        resp = await client.delete(
            f"{PREFIX}/harvests/{harvest_id}", headers=headers,
        )
        assert resp.status_code == 204

        resp = await client.get(
            f"{PREFIX}/harvests/{harvest_id}", headers=headers,
        )
        assert resp.status_code == 404

    async def test_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/harvests")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class TestEvents:
    async def test_create_and_list(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        event_id = await create_event(client, headers, hive_id)

        resp = await client.get(
            f"{PREFIX}/events", headers=headers, params={"hive_id": hive_id},
        )
        assert resp.status_code == 200
        assert event_id in [e["id"] for e in resp.json()]

    async def test_get_by_id(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        event_id = await create_event(client, headers, hive_id)

        resp = await client.get(f"{PREFIX}/events/{event_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == event_id

    async def test_update(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        event_id = await create_event(client, headers, hive_id)

        resp = await client.patch(
            f"{PREFIX}/events/{event_id}", headers=headers,
            json={"notes": "Captured the swarm"},
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Captured the swarm"

    async def test_delete_then_404(self, client: AsyncClient):
        headers, _ = await register(client)
        _, hive_id = await setup_hive(client, headers)
        event_id = await create_event(client, headers, hive_id)

        resp = await client.delete(f"{PREFIX}/events/{event_id}", headers=headers)
        assert resp.status_code == 204

        resp = await client.get(f"{PREFIX}/events/{event_id}", headers=headers)
        assert resp.status_code == 404

    async def test_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/events")
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


class TestTasks:
    async def test_create_and_list(self, client: AsyncClient):
        headers, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers)
        task_id = await create_task(client, headers, hive_id, apiary_id)

        resp = await client.get(f"{PREFIX}/tasks", headers=headers)
        assert resp.status_code == 200
        assert task_id in [t["id"] for t in resp.json()]

    async def test_list_with_hive_filter(self, client: AsyncClient):
        headers, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers)
        task_id = await create_task(client, headers, hive_id, apiary_id)

        resp = await client.get(
            f"{PREFIX}/tasks", headers=headers, params={"hive_id": hive_id},
        )
        assert resp.status_code == 200
        assert task_id in [t["id"] for t in resp.json()]

    async def test_get_by_id(self, client: AsyncClient):
        headers, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers)
        task_id = await create_task(client, headers, hive_id, apiary_id)

        resp = await client.get(f"{PREFIX}/tasks/{task_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == task_id

    async def test_update(self, client: AsyncClient):
        headers, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers)
        task_id = await create_task(client, headers, hive_id, apiary_id)

        resp = await client.patch(
            f"{PREFIX}/tasks/{task_id}", headers=headers,
            json={"title": "Recount varroa"},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Recount varroa"

    async def test_delete_then_404(self, client: AsyncClient):
        headers, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers)
        task_id = await create_task(client, headers, hive_id, apiary_id)

        resp = await client.delete(f"{PREFIX}/tasks/{task_id}", headers=headers)
        assert resp.status_code == 204

        resp = await client.get(f"{PREFIX}/tasks/{task_id}", headers=headers)
        assert resp.status_code == 404

    async def test_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/tasks")
        assert resp.status_code == 401

    async def test_other_user_cannot_access(self, client: AsyncClient):
        """Tasks are scoped to the owning user."""
        headers_a, _ = await register(client)
        apiary_id, hive_id = await setup_hive(client, headers_a)
        task_id = await create_task(client, headers_a, hive_id, apiary_id)

        headers_b, _ = await register(client)
        resp = await client.get(f"{PREFIX}/tasks/{task_id}", headers=headers_b)
        assert resp.status_code == 404
