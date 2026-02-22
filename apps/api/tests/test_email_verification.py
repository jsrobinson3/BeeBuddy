"""Email verification integration tests.

Requires the API to be running (e.g. via docker compose up).
Assumes email_suppress=True so no real emails are sent.
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


class TestEmailVerification:
    async def test_verify_email_success(self, client: AsyncClient):
        """Register, create a verification token server-side, then verify it."""
        email = unique_email()
        resp = await register(client, email)
        assert resp.status_code == 201
        token = resp.json()["access_token"]

        # Check that email_verified starts as False
        me = await client.get(f"{PREFIX}/users/me", headers=auth(token))
        assert me.status_code == 200
        assert me.json()["email_verified"] is False

        # Create a verification token using the service directly
        # (In production, this comes from the email link)
        from uuid import UUID

        from app.services.auth_service import create_email_verification_token
        user_id = UUID(me.json()["id"])
        verify_token = create_email_verification_token(user_id, email)

        # Verify
        resp = await client.post(f"{PREFIX}/auth/verify-email", json={
            "token": verify_token,
        })
        assert resp.status_code == 200
        assert resp.json()["detail"] == "Email verified"

        # Confirm email_verified is now True
        me = await client.get(f"{PREFIX}/users/me", headers=auth(token))
        assert me.json()["email_verified"] is True

    async def test_verify_email_invalid_token(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/verify-email", json={
            "token": "garbage.token.here",
        })
        assert resp.status_code == 400
        assert "invalid" in resp.json()["detail"].lower()

    async def test_resend_verification_returns_200(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/resend-verification", json={
            "email": email,
        })
        assert resp.status_code == 200

    async def test_resend_verification_nonexistent_email_returns_200(
        self, client: AsyncClient,
    ):
        """No email enumeration — always 200."""
        resp = await client.post(f"{PREFIX}/auth/resend-verification", json={
            "email": "nobody@beebuddy.dev",
        })
        assert resp.status_code == 200

    async def test_get_me_shows_email_verified_field(self, auth_client):
        client, headers = auth_client
        resp = await client.get(f"{PREFIX}/users/me", headers=headers)
        assert resp.status_code == 200
        assert "email_verified" in resp.json()
