"""Auth endpoint integration tests.

Requires the API to be running (e.g. via docker compose up).
Each test registers a unique user to avoid cross-test interference.
"""

import uuid

from httpx import AsyncClient

PREFIX = "/api/v1"


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def register(client: AsyncClient, email: str | None = None, password: str = "secret123"):
    """Register a user, return response."""
    return await client.post(f"{PREFIX}/auth/register", json={
        "name": "Test Beekeeper",
        "email": email or unique_email(),
        "password": password,
    })


async def get_tokens(client: AsyncClient, email: str | None = None):
    """Register and return (access_token, refresh_token, email)."""
    email = email or unique_email()
    resp = await register(client, email)
    body = resp.json()
    return body["access_token"], body["refresh_token"], email


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# -- Registration -------------------------------------------------------------


class TestRegister:
    async def test_success(self, client: AsyncClient):
        resp = await register(client)
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    async def test_duplicate_email_returns_409(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await register(client, email)
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    async def test_invalid_email_returns_422(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/register", json={
            "email": "not-an-email",
            "password": "secret123",
        })
        assert resp.status_code == 422


# -- Login --------------------------------------------------------------------


class TestLogin:
    async def test_success(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_wrong_password_returns_401(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert resp.json()["detail"] == "Invalid credentials"

    async def test_nonexistent_email_returns_401(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": "nobody@beebuddy.dev",
            "password": "secret123",
        })
        assert resp.status_code == 401
        # Same message — no email enumeration
        assert resp.json()["detail"] == "Invalid credentials"


# -- Token refresh ------------------------------------------------------------


class TestRefresh:
    async def test_success(self, client: AsyncClient):
        _, refresh, _ = await get_tokens(client)
        resp = await client.post(f"{PREFIX}/auth/refresh", json={
            "refresh_token": refresh,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_access_token_rejected_as_refresh(self, client: AsyncClient):
        access, _, _ = await get_tokens(client)
        resp = await client.post(f"{PREFIX}/auth/refresh", json={
            "refresh_token": access,
        })
        assert resp.status_code == 401

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/refresh", json={
            "refresh_token": "garbage.token.here",
        })
        assert resp.status_code == 401


# -- OAuth stub ---------------------------------------------------------------


class TestOAuth:
    async def test_returns_501(self, client: AsyncClient):
        resp = await client.post(f"{PREFIX}/auth/oauth/google", json={
            "provider": "google",
            "code": "fake",
            "redirect_uri": "http://localhost",
        })
        assert resp.status_code == 501


# -- Protected endpoints ------------------------------------------------------


class TestProtectedEndpoints:
    async def test_no_token_returns_401(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/apiaries")
        assert resp.status_code == 401

    async def test_invalid_token_returns_401(self, client: AsyncClient):
        resp = await client.get(
            f"{PREFIX}/apiaries", headers=auth("invalid"),
        )
        assert resp.status_code == 401

    async def test_valid_token_returns_200(self, auth_client):
        client, headers = auth_client
        resp = await client.get(f"{PREFIX}/apiaries", headers=headers)
        assert resp.status_code == 200


# -- User endpoints -----------------------------------------------------------


class TestUserEndpoints:
    async def test_get_me(self, auth_client):
        client, headers = auth_client
        resp = await client.get(f"{PREFIX}/users/me", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Test Beekeeper"
        assert "@beebuddy.dev" in body["email"]

    async def test_patch_me(self, auth_client):
        client, headers = auth_client
        resp = await client.patch(
            f"{PREFIX}/users/me",
            headers=headers,
            json={"experience_level": "intermediate", "locale": "en-US"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["experience_level"] == "intermediate"
        assert body["locale"] == "en-US"


# -- Apiary ownership --------------------------------------------------------


class TestApiaryOwnership:
    async def test_create_and_list(self, auth_client):
        client, headers = auth_client
        resp = await client.post(
            f"{PREFIX}/apiaries",
            headers=headers,
            json={"name": "My Apiary", "city": "Portland"},
        )
        assert resp.status_code == 201
        apiary_id = resp.json()["id"]

        resp = await client.get(f"{PREFIX}/apiaries", headers=headers)
        assert resp.status_code == 200
        ids = [a["id"] for a in resp.json()]
        assert apiary_id in ids

    async def test_other_user_cannot_access(self, client: AsyncClient):
        # User A creates an apiary
        token_a, _, _ = await get_tokens(client)
        resp = await client.post(
            f"{PREFIX}/apiaries",
            headers=auth(token_a),
            json={"name": "A's Apiary"},
        )
        apiary_id = resp.json()["id"]

        # User B cannot see it
        token_b, _, _ = await get_tokens(client)
        resp = await client.get(
            f"{PREFIX}/apiaries/{apiary_id}",
            headers=auth(token_b),
        )
        assert resp.status_code == 404


# -- Cookie-based auth -------------------------------------------------------


class TestCookieAuth:
    async def test_login_sets_cookies(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        assert resp.status_code == 200
        raw_cookies = resp.headers.get_list("set-cookie")
        cookie_header_str = " ".join(raw_cookies).lower()
        assert "access_token" in cookie_header_str
        assert "refresh_token" in cookie_header_str
        assert "httponly" in cookie_header_str

    async def test_register_sets_cookies(self, client: AsyncClient):
        resp = await register(client)
        assert resp.status_code == 201
        raw_cookies = resp.headers.get_list("set-cookie")
        cookie_header_str = " ".join(raw_cookies).lower()
        assert "access_token" in cookie_header_str
        assert "refresh_token" in cookie_header_str

    async def test_cookie_auth_works(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        access_token = resp.cookies.get("access_token")
        assert access_token is not None

        # GET /apiaries using only the cookie — no Authorization header
        resp = await client.get(
            f"{PREFIX}/apiaries",
            cookies={"access_token": access_token},
        )
        assert resp.status_code == 200

    async def test_refresh_via_cookie(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        refresh_token = resp.cookies.get("refresh_token")
        assert refresh_token is not None

        # POST /auth/refresh with cookie only — no JSON body
        resp = await client.post(
            f"{PREFIX}/auth/refresh",
            cookies={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_logout_clears_cookies(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        access_token = resp.cookies.get("access_token")
        refresh_token = resp.cookies.get("refresh_token")

        resp = await client.post(
            f"{PREFIX}/auth/logout",
            cookies={
                "access_token": access_token,
                "refresh_token": refresh_token,
            },
        )
        # Verify cookies are cleared (max-age=0 or expires in past)
        raw_cookies = resp.headers.get_list("set-cookie")
        cookie_header_str = " ".join(raw_cookies).lower()
        assert "access_token" in cookie_header_str
        assert "refresh_token" in cookie_header_str
        assert "max-age=0" in cookie_header_str or 'expires=' in cookie_header_str


# -- CSRF middleware ----------------------------------------------------------


class TestCSRF:
    async def test_mutating_with_cookie_no_csrf_header_returns_403(
        self, client: AsyncClient,
    ):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        access_token = resp.cookies.get("access_token")

        # POST /apiaries with cookie but WITHOUT X-Requested-With header
        resp = await client.post(
            f"{PREFIX}/apiaries",
            cookies={"access_token": access_token},
            json={"name": "CSRF Test Apiary"},
        )
        assert resp.status_code == 403

    async def test_mutating_with_cookie_and_csrf_header_succeeds(
        self, client: AsyncClient,
    ):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        access_token = resp.cookies.get("access_token")

        # POST /apiaries with cookie AND X-Requested-With header
        resp = await client.post(
            f"{PREFIX}/apiaries",
            cookies={"access_token": access_token},
            headers={"X-Requested-With": "BeeBuddy"},
            json={"name": "CSRF OK Apiary"},
        )
        assert resp.status_code == 201

    async def test_bearer_skips_csrf(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)

        # POST /apiaries with Bearer token, no cookie, no X-Requested-With
        resp = await client.post(
            f"{PREFIX}/apiaries",
            headers=auth(token),
            json={"name": "Bearer Apiary"},
        )
        assert resp.status_code == 201

    async def test_get_skips_csrf(self, client: AsyncClient):
        email = unique_email()
        await register(client, email)
        resp = await client.post(f"{PREFIX}/auth/login", json={
            "email": email,
            "password": "secret123",
        })
        access_token = resp.cookies.get("access_token")

        # GET /apiaries with cookie but no X-Requested-With — should still work
        resp = await client.get(
            f"{PREFIX}/apiaries",
            cookies={"access_token": access_token},
        )
        assert resp.status_code == 200
