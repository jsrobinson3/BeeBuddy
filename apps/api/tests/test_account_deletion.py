"""Account deletion (GDPR) integration tests.

Requires the API to be running (e.g. via docker compose up).
"""

import uuid

from httpx import AsyncClient

PREFIX = "/api/v1"


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def register(client: AsyncClient, email: str | None = None, password: str = "secret123"):
    return await client.post(f"{PREFIX}/auth/register", json={
        "name": "Test Beekeeper",
        "email": email or unique_email(),
        "password": password,
    })


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


class TestDeleteAccount:
    async def test_delete_with_correct_password(self, client: AsyncClient):
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123"},
        )
        assert resp.status_code == 200
        assert "scheduled" in resp.json()["detail"].lower()

    async def test_delete_with_wrong_password(self, client: AsyncClient):
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "wrongpassword"},
        )
        assert resp.status_code == 403

    async def test_token_rejected_after_deletion(self, client: AsyncClient):
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123"},
        )

        # Token should now be rejected (user is soft-deleted)
        resp = await client.get(f"{PREFIX}/users/me", headers=auth(token))
        assert resp.status_code == 401


class TestCancelDeletion:
    async def test_cancel_with_valid_token(self, client: AsyncClient):
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]
        me = await client.get(f"{PREFIX}/users/me", headers=auth(token))
        uid = me.json()["id"]

        # Delete
        await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123"},
        )

        # Create cancel token
        from uuid import UUID

        from app.services.auth_service import create_account_deletion_token
        cancel_token = create_account_deletion_token(UUID(uid))

        # Cancel
        resp = await client.post(f"{PREFIX}/users/me/cancel-deletion", json={
            "token": cancel_token,
        })
        assert resp.status_code == 200
        assert "cancelled" in resp.json()["detail"].lower()

        # User can log in again
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        assert resp.status_code == 200

    async def test_cancel_with_invalid_token(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/users/me/cancel-deletion", json={
            "token": "garbage.token.here",
        })
        assert resp.status_code == 400


class TestDataExport:
    async def test_export_returns_user_data(self, auth_client):
        client, headers = auth_client
        resp = await client.get(f"{PREFIX}/users/me/data-export", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "user" in body
        assert "apiaries" in body
        assert "tasks" in body
        assert body["user"]["email"].endswith("@beebuddy.dev")

    async def test_export_includes_created_apiary(self, auth_client):
        client, headers = auth_client
        # Create an apiary
        await client.post(
            f"{PREFIX}/apiaries",
            headers=headers,
            json={"name": "Export Test Apiary"},
        )

        resp = await client.get(f"{PREFIX}/users/me/data-export", headers=headers)
        assert resp.status_code == 200
        apiaries = resp.json()["apiaries"]
        assert len(apiaries) >= 1
        names = [a["name"] for a in apiaries]
        assert "Export Test Apiary" in names


class TestDeleteDataFlag:
    async def test_delete_stores_delete_data_false(self, client: AsyncClient):
        """Default delete_data flag should be false in preferences."""
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123"},
        )
        assert resp.status_code == 200

    async def test_delete_stores_delete_data_true(self, client: AsyncClient):
        """Explicit delete_data=true should be accepted."""
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123", "delete_data": True},
        )
        assert resp.status_code == 200
        assert "scheduled" in resp.json()["detail"].lower()

    async def test_delete_backward_compat(self, client: AsyncClient):
        """Omitting delete_data field should work (backward-compatible)."""
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "secret123"},
        )
        assert resp.status_code == 200

    async def test_wrong_password_rejected(self, client: AsyncClient):
        """Wrong password should be rejected with 403."""
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]

        resp = await client.request(
            "DELETE",
            f"{PREFIX}/users/me",
            headers=auth(token),
            json={"password": "wrongpassword", "delete_data": True},
        )
        assert resp.status_code == 403
