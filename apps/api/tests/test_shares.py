"""Integration tests for the sharing feature.

Tests the full share lifecycle: create, accept, cross-user access,
permission enforcement, and edge cases.

Requires the API to be running (e.g. via docker compose up).
Uses fresh httpx clients per request to avoid auth cookie bleed.
"""

import uuid

import httpx
import pytest

PREFIX = "/api/v1"
BASE_URL = "http://localhost:8000"


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def _req(method: str, path: str, headers: dict, json: dict | None = None):
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        return await c.request(method, f"{PREFIX}{path}", headers=headers, json=json)


async def register(email: str | None = None) -> tuple[dict, str]:
    """Register a user, return (headers, email)."""
    email = email or unique_email()
    async with httpx.AsyncClient(base_url=BASE_URL) as c:
        resp = await c.post(f"{PREFIX}/auth/register", json={
            "name": "Test Beekeeper", "email": email, "password": "secret123",
        })
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    token = resp.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}, email


async def create_apiary(headers: dict) -> str:
    resp = await _req("POST", "/apiaries", headers, {"name": f"Apiary {uuid.uuid4().hex[:6]}"})
    assert resp.status_code == 201
    return resp.json()["id"]


async def create_hive(headers: dict, apiary_id: str) -> str:
    resp = await _req("POST", "/hives", headers, {
        "apiaryId": apiary_id, "name": f"Hive {uuid.uuid4().hex[:6]}",
    })
    assert resp.status_code == 201
    return resp.json()["id"]


async def create_share(owner_h: dict, email: str, apiary_id: str, role: str) -> dict:
    resp = await _req("POST", "/shares", owner_h, {
        "email": email, "apiaryId": apiary_id, "role": role,
    })
    assert resp.status_code == 201, f"Share create failed: {resp.text}"
    return resp.json()


async def accept_share(headers: dict, share_id: str) -> dict:
    resp = await _req("POST", f"/shares/{share_id}/accept", headers)
    assert resp.status_code == 200
    return resp.json()


# ---------------------------------------------------------------------------
# Share CRUD lifecycle
# ---------------------------------------------------------------------------


class TestShareLifecycle:

    @pytest.fixture(autouse=True)
    async def setup(self):
        self.owner_h, self.owner_email = await register()
        self.viewer_email = unique_email()
        self.viewer_h, _ = await register(self.viewer_email)
        self.apiary_id = await create_apiary(self.owner_h)

    async def test_create_share_and_accept(self):
        share = await create_share(self.owner_h, self.viewer_email, self.apiary_id, "editor")
        assert share["status"] == "pending"
        assert share["role"] == "editor"

        result = await accept_share(self.viewer_h, share["id"])
        assert result["status"] == "accepted"

    async def test_create_share_and_decline(self):
        share = await create_share(self.owner_h, self.viewer_email, self.apiary_id, "viewer")
        resp = await _req("POST", f"/shares/{share['id']}/decline", self.viewer_h)
        assert resp.status_code == 200
        assert resp.json()["status"] == "declined"

    async def test_list_shares(self):
        await create_share(self.owner_h, self.viewer_email, self.apiary_id, "editor")

        resp = await _req("GET", "/shares?direction=outgoing", self.owner_h)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

        resp = await _req("GET", "/shares?direction=incoming", self.viewer_h)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_revoke_share(self):
        share = await create_share(self.owner_h, self.viewer_email, self.apiary_id, "editor")
        await accept_share(self.viewer_h, share["id"])

        resp = await _req("DELETE", f"/shares/{share['id']}", self.owner_h)
        assert resp.status_code == 204

    async def test_update_role(self):
        share = await create_share(self.owner_h, self.viewer_email, self.apiary_id, "viewer")
        resp = await _req("PATCH", f"/shares/{share['id']}", self.owner_h, {"role": "editor"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "editor"

    async def test_self_share_rejected(self):
        resp = await _req("POST", "/shares", self.owner_h, {
            "email": self.owner_email, "apiaryId": self.apiary_id, "role": "editor",
        })
        assert resp.status_code == 400
        assert "yourself" in resp.json()["detail"].lower()

    async def test_duplicate_share_rejected(self):
        await create_share(self.owner_h, self.viewer_email, self.apiary_id, "editor")
        resp = await _req("POST", "/shares", self.owner_h, {
            "email": self.viewer_email, "apiaryId": self.apiary_id, "role": "viewer",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Cross-user access
# ---------------------------------------------------------------------------


class TestCrossUserAccess:

    @pytest.fixture(autouse=True)
    async def setup(self):
        self.owner_h, _ = await register()
        self.editor_email = unique_email()
        self.editor_h, _ = await register(self.editor_email)
        self.viewer_email = unique_email()
        self.viewer_h, _ = await register(self.viewer_email)

        self.apiary_id = await create_apiary(self.owner_h)
        self.hive_id = await create_hive(self.owner_h, self.apiary_id)

        editor_share = await create_share(self.owner_h, self.editor_email, self.apiary_id, "editor")
        await accept_share(self.editor_h, editor_share["id"])

        viewer_share = await create_share(self.owner_h, self.viewer_email, self.apiary_id, "viewer")
        await accept_share(self.viewer_h, viewer_share["id"])

    async def test_editor_can_list_shared_apiaries(self):
        resp = await _req("GET", "/apiaries", self.editor_h)
        assert resp.status_code == 200
        assert self.apiary_id in [a["id"] for a in resp.json()]

    async def test_viewer_can_list_shared_apiaries(self):
        resp = await _req("GET", "/apiaries", self.viewer_h)
        assert resp.status_code == 200
        assert self.apiary_id in [a["id"] for a in resp.json()]

    async def test_editor_can_list_hives(self):
        resp = await _req("GET", f"/hives?apiaryId={self.apiary_id}", self.editor_h)
        assert resp.status_code == 200
        assert self.hive_id in [h["id"] for h in resp.json()]

    async def test_editor_can_create_inspection(self):
        resp = await _req("POST", "/inspections", self.editor_h, {
            "hiveId": self.hive_id, "notes": "Editor inspection",
        })
        assert resp.status_code == 201

    async def test_viewer_cannot_create_inspection(self):
        resp = await _req("POST", "/inspections", self.viewer_h, {
            "hiveId": self.hive_id, "notes": "Viewer attempt",
        })
        assert resp.status_code == 403

    async def test_editor_cannot_delete_apiary(self):
        resp = await _req("DELETE", f"/apiaries/{self.apiary_id}", self.editor_h)
        assert resp.status_code == 403

    async def test_viewer_cannot_delete_apiary(self):
        resp = await _req("DELETE", f"/apiaries/{self.apiary_id}", self.viewer_h)
        assert resp.status_code == 403

    async def test_editor_can_update_hive(self):
        resp = await _req("PATCH", f"/hives/{self.hive_id}", self.editor_h, {"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed"

    async def test_viewer_cannot_update_hive(self):
        resp = await _req("PATCH", f"/hives/{self.hive_id}", self.viewer_h, {"name": "Nope"})
        assert resp.status_code == 403

    async def test_unshared_user_cannot_see_apiary(self):
        outsider_h, _ = await register()
        resp = await _req("GET", f"/apiaries/{self.apiary_id}", outsider_h)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Email invitation to non-user
# ---------------------------------------------------------------------------


class TestEmailInvitation:

    @pytest.fixture(autouse=True)
    async def setup(self):
        self.owner_h, _ = await register()
        self.apiary_id = await create_apiary(self.owner_h)
        self.invitee_email = unique_email()

    async def test_invite_non_user_and_claim_on_register(self):
        share = await create_share(self.owner_h, self.invitee_email, self.apiary_id, "editor")
        assert share["sharedWithUserId"] is None
        assert share["inviteEmail"] == self.invitee_email.lower()

        # Invitee registers — claim_pending_shares runs automatically
        invitee_h, _ = await register(self.invitee_email)

        # The pending share should now be linked to the new user
        resp = await _req("GET", "/shares?direction=incoming", invitee_h)
        assert resp.status_code == 200
        matching = [s for s in resp.json() if s["id"] == share["id"]]
        assert len(matching) == 1
        assert matching[0]["sharedWithUserId"] is not None
