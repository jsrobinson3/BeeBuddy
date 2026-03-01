"""OAuth2 PKCE server integration tests.

Requires the API to be running (e.g. via docker compose up).
"""

import base64
import hashlib
import secrets
import uuid

from httpx import AsyncClient

PREFIX = "/api/v1"


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def register(client: AsyncClient, email: str | None = None):
    """Register a user, return (access_token, email)."""
    email = email or unique_email()
    resp = await client.post(
        f"{PREFIX}/auth/register",
        json={"name": "Test Beekeeper", "email": email, "password": "secret123"},
    )
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    return resp.json()["accessToken"], email


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _pkce_pair() -> tuple[str, str]:
    """Generate a PKCE code_verifier and S256 code_challenge."""
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


# -- Well-known metadata ------------------------------------------------------


class TestOAuthMetadata:
    async def test_metadata_returns_endpoints(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/oauth2/.well-known/oauth-authorization-server")
        assert resp.status_code == 200
        body = resp.json()
        assert "authorization_endpoint" in body
        assert "token_endpoint" in body
        assert "S256" in body["code_challenge_methods_supported"]
        assert "authorization_code" in body["grant_types_supported"]
        assert "refresh_token" in body["grant_types_supported"]


# -- Authorization endpoint ---------------------------------------------------


class TestAuthorize:
    async def test_unauthenticated_returns_401(self, client: AsyncClient):
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
            },
            follow_redirects=False,
        )
        assert resp.status_code == 401

    async def test_invalid_response_type_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "token",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 400

    async def test_success_redirects_with_code(self, client: AsyncClient):
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
                "state": "xyz",
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 302
        location = resp.headers["location"]
        assert "code=" in location
        assert "state=xyz" in location

    async def test_invalid_scope_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
                "scope": "admin:write",
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 400


# -- Redirect URI validation --------------------------------------------------


class TestRedirectUriValidation:
    async def test_unregistered_client_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "unknown-client",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 400
        assert "unknown" in resp.json()["detail"].lower()

    async def test_unregistered_redirect_uri_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "https://evil.example.com/steal",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 400
        assert "not registered" in resp.json()["detail"].lower()

    async def test_localhost_dynamic_port_allowed(self, client: AsyncClient):
        """MCP clients bind to random ports — localhost:*/callback should match."""
        token, _ = await register(client)
        _, challenge = _pkce_pair()
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost:49152/callback",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        assert resp.status_code == 302
        assert "code=" in resp.headers["location"]


# -- Token endpoint (authorization_code) --------------------------------------


class TestTokenExchange:
    async def _get_code(
        self, client: AsyncClient, token: str, verifier: str, challenge: str
    ) -> str:
        """Get an authorization code via the authorize endpoint."""
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        location = resp.headers["location"]
        # Extract code from query string
        from urllib.parse import parse_qs, urlparse

        query = parse_qs(urlparse(location).query)
        return query["code"][0]

    async def test_exchange_success(self, client: AsyncClient):
        token, _ = await register(client)
        verifier, challenge = _pkce_pair()
        code = await self._get_code(client, token, verifier, challenge)

        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": "http://localhost/callback",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        # OAuth2 token endpoint returns raw dict (not Pydantic), so snake_case
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"
        assert body["scope"] == "mcp:read"

    async def test_wrong_verifier_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        verifier, challenge = _pkce_pair()
        code = await self._get_code(client, token, verifier, challenge)

        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": "wrong-verifier-value",
                "redirect_uri": "http://localhost/callback",
            },
        )
        assert resp.status_code == 400
        assert "code_verifier" in resp.json()["detail"].lower()

    async def test_code_reuse_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        verifier, challenge = _pkce_pair()
        code = await self._get_code(client, token, verifier, challenge)

        # First exchange succeeds
        resp1 = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": "http://localhost/callback",
            },
        )
        assert resp1.status_code == 200

        # Second exchange fails (code already used)
        resp2 = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": "http://localhost/callback",
            },
        )
        assert resp2.status_code == 400

    async def test_redirect_uri_mismatch_returns_400(self, client: AsyncClient):
        token, _ = await register(client)
        verifier, challenge = _pkce_pair()
        code = await self._get_code(client, token, verifier, challenge)

        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": "http://evil.example.com/callback",
            },
        )
        assert resp.status_code == 400


# -- Token endpoint (refresh_token) -------------------------------------------


class TestRefreshGrant:
    async def test_refresh_returns_new_tokens(self, client: AsyncClient):
        token, _ = await register(client)
        verifier, challenge = _pkce_pair()

        # Get auth code
        resp = await client.get(
            f"{PREFIX}/oauth2/authorize",
            params={
                "response_type": "code",
                "client_id": "claude-desktop",
                "redirect_uri": "http://localhost/callback",
                "code_challenge": challenge,
            },
            headers=auth(token),
            follow_redirects=False,
        )
        from urllib.parse import parse_qs, urlparse

        code = parse_qs(urlparse(resp.headers["location"]).query)["code"][0]

        # Exchange for tokens
        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": "http://localhost/callback",
            },
        )
        # OAuth2 token endpoint returns raw dict, so snake_case
        refresh = resp.json()["refresh_token"]

        # Refresh
        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={"grant_type": "refresh_token", "refresh_token": refresh},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_invalid_refresh_token_returns_400(self, client: AsyncClient):
        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={"grant_type": "refresh_token", "refresh_token": "bad.token.value"},
        )
        assert resp.status_code == 400


# -- Unsupported grant type ---------------------------------------------------


class TestUnsupportedGrant:
    async def test_unsupported_grant_returns_400(self, client: AsyncClient):
        resp = await client.post(
            f"{PREFIX}/oauth2/token",
            data={"grant_type": "client_credentials"},
        )
        assert resp.status_code == 400
