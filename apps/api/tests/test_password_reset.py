"""Password reset integration tests.

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


class TestForgotPassword:
    async def test_existing_email_returns_200(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/forgot-password", json={
            "email": email,
        })
        assert resp.status_code == 200

    async def test_nonexistent_email_returns_200(self, client: AsyncClient):
        """No email enumeration — always 200."""
        resp = await client.post(f"{PREFIX}/auth/forgot-password", json={
            "email": "nobody@beebuddy.dev",
        })
        assert resp.status_code == 200


class TestResetPassword:
    async def test_reset_password_success(self, client: AsyncClient):
        email = unique_email()
        resp = await register(client, email)
        token = resp.json()["access_token"]
        me = await client.get(f"{PREFIX}/users/me", headers=auth(token))
        uid = me.json()["id"]

        # Create a reset token
        from uuid import UUID

        from app.services.auth_service import create_password_reset_token
        reset_token = create_password_reset_token(UUID(uid))

        # Reset the password
        resp = await client.post(f"{PREFIX}/auth/reset-password", json={
            "token": reset_token,
            "new_password": "newpassword123",
        })
        assert resp.status_code == 200
        assert "reset" in resp.json()["detail"].lower()

        # Login with new password succeeds
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "newpassword123",
        })
        assert resp.status_code == 200

    async def test_reset_password_invalid_token(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/reset-password", json={
            "token": "garbage.token.here",
            "new_password": "newpassword123",
        })
        assert resp.status_code == 400

    async def test_reset_password_too_short(self, client: AsyncClient):
        """Password < 8 chars should be rejected by schema validation."""
        resp = await client.post(f"{PREFIX}/auth/reset-password", json={
            "token": "some.token",
            "new_password": "short",
        })
        assert resp.status_code == 422

    async def test_old_token_rejected_after_reset(self, client: AsyncClient):
        """After password reset, old access tokens should be invalid."""
        email = unique_email()
        resp = await register(client, email)
        old_token = resp.json()["access_token"]

        me = await client.get(f"{PREFIX}/users/me", headers=auth(old_token))
        uid = me.json()["id"]

        from uuid import UUID

        from app.services.auth_service import create_password_reset_token
        reset_token = create_password_reset_token(UUID(uid))

        await client.post(f"{PREFIX}/auth/reset-password", json={
            "token": reset_token,
            "new_password": "newpassword123",
        })

        # Old token should now be rejected
        resp = await client.get(f"{PREFIX}/users/me", headers=auth(old_token))
        assert resp.status_code == 401
