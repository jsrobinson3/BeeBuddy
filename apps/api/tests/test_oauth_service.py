"""Unit tests for app.services.oauth_service — token verification functions.

These tests mock the JWKS resolution layer and settings so they run without
any network access or running API server.  Real RS256 JWTs are generated
with a throwaway RSA key pair so that ``jose_jwt.decode`` exercises the full
signature-verification path.
"""

import base64
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwt as jose_jwt

# ---------------------------------------------------------------------------
# Test RSA key material (generated once per module for speed)
# ---------------------------------------------------------------------------

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_private_pem = _private_key.private_bytes(
    serialization.Encoding.PEM,
    serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption(),
).decode()

_public_numbers = _private_key.public_key().public_numbers()


def _int_to_base64url(n: int, length: int) -> str:
    return base64.urlsafe_b64encode(n.to_bytes(length, byteorder="big")).rstrip(b"=").decode()


TEST_KID = "test-kid-1"
TEST_JWK = {
    "kty": "RSA",
    "kid": TEST_KID,
    "n": _int_to_base64url(_public_numbers.n, 256),
    "e": _int_to_base64url(_public_numbers.e, 3),
    "alg": "RS256",
    "use": "sig",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

APPLE_ISSUER = "https://appleid.apple.com"
GOOGLE_ISSUER = "https://accounts.google.com"

NATIVE_CLIENT_ID = "com.beebuddy.app"
WEB_CLIENT_ID = "com.beebuddy.web"
GOOGLE_CLIENT_ID = "123-google.apps.googleusercontent.com"


def _make_apple_token(aud: str, sub: str = "apple-user-001", email: str = "bee@example.com") -> str:
    """Create a valid Apple-like RS256 JWT signed with the test key."""
    claims = {
        "iss": APPLE_ISSUER,
        "aud": aud,
        "sub": sub,
        "email": email,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
    }
    return jose_jwt.encode(claims, _private_pem, algorithm="RS256", headers={"kid": TEST_KID})


def _make_google_token(
    aud: str = GOOGLE_CLIENT_ID,
    sub: str = "google-user-001",
    email: str = "bee@example.com",
    email_verified: bool = True,
    include_email: bool = True,
) -> str:
    """Create a valid Google-like RS256 JWT signed with the test key."""
    claims: dict = {
        "iss": GOOGLE_ISSUER,
        "aud": aud,
        "sub": sub,
        "exp": int(time.time()) + 3600,
        "iat": int(time.time()),
        "email_verified": email_verified,
    }
    if include_email:
        claims["email"] = email
    return jose_jwt.encode(claims, _private_pem, algorithm="RS256", headers={"kid": TEST_KID})


def _fake_settings(**overrides) -> MagicMock:
    """Return a mock settings object with sensible defaults that can be overridden."""
    defaults = {
        "apple_client_id": None,
        "apple_web_client_id": None,
        "google_client_id": None,
    }
    defaults.update(overrides)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _clear_jwks_cache():
    """Ensure the module-level JWKS cache is empty before and after each test."""
    from app.services import oauth_service

    oauth_service._jwks_cache.clear()
    yield
    oauth_service._jwks_cache.clear()


# Common patches applied to every test that exercises the real decode path.
_PATCH_RESOLVE = patch(
    "app.services.oauth_service._resolve_signing_key",
    new_callable=AsyncMock,
    return_value=TEST_JWK,
)


# ===================================================================
# Apple ID token tests
# ===================================================================


class TestVerifyAppleIdToken:
    """Tests for verify_apple_id_token."""

    async def test_apple_raises_when_no_audiences_configured(self):
        """Both apple_client_id and apple_web_client_id are None -> ValueError."""
        settings = _fake_settings(apple_client_id=None, apple_web_client_id=None)
        token = _make_apple_token(aud=NATIVE_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            pytest.raises(ValueError, match="Apple OAuth is not configured"),
        ):
            from app.services.oauth_service import verify_apple_id_token

            await verify_apple_id_token(token)

    async def test_apple_accepts_native_audience(self):
        """Only apple_client_id is set; token audience matches it."""
        settings = _fake_settings(apple_client_id=NATIVE_CLIENT_ID)
        token = _make_apple_token(aud=NATIVE_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
        ):
            from app.services.oauth_service import verify_apple_id_token

            payload = await verify_apple_id_token(token)

        assert payload["sub"] == "apple-user-001"
        assert payload["email"] == "bee@example.com"
        assert payload["aud"] == NATIVE_CLIENT_ID

    async def test_apple_accepts_web_audience(self):
        """Only apple_web_client_id is set; token audience matches it."""
        settings = _fake_settings(apple_web_client_id=WEB_CLIENT_ID)
        token = _make_apple_token(aud=WEB_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
        ):
            from app.services.oauth_service import verify_apple_id_token

            payload = await verify_apple_id_token(token)

        assert payload["sub"] == "apple-user-001"
        assert payload["aud"] == WEB_CLIENT_ID

    async def test_apple_accepts_both_audiences_native(self):
        """Both audiences configured; token with native aud is accepted."""
        settings = _fake_settings(
            apple_client_id=NATIVE_CLIENT_ID, apple_web_client_id=WEB_CLIENT_ID
        )
        token = _make_apple_token(aud=NATIVE_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
        ):
            from app.services.oauth_service import verify_apple_id_token

            payload = await verify_apple_id_token(token)

        assert payload["aud"] == NATIVE_CLIENT_ID

    async def test_apple_accepts_both_audiences_web(self):
        """Both audiences configured; token with web aud is accepted."""
        settings = _fake_settings(
            apple_client_id=NATIVE_CLIENT_ID, apple_web_client_id=WEB_CLIENT_ID
        )
        token = _make_apple_token(aud=WEB_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
        ):
            from app.services.oauth_service import verify_apple_id_token

            payload = await verify_apple_id_token(token)

        assert payload["aud"] == WEB_CLIENT_ID

    async def test_apple_rejects_wrong_audience(self):
        """Token with an unrecognized audience is rejected."""
        settings = _fake_settings(apple_client_id=NATIVE_CLIENT_ID)
        token = _make_apple_token(aud="com.evil.app")

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
            pytest.raises(ValueError, match="Apple ID token verification failed"),
        ):
            from app.services.oauth_service import verify_apple_id_token

            await verify_apple_id_token(token)

    async def test_apple_malformed_token_raises(self):
        """Garbage input raises ValueError (via _extract_kid)."""
        settings = _fake_settings(apple_client_id=NATIVE_CLIENT_ID)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            pytest.raises(ValueError, match="Apple ID token is malformed"),
        ):
            from app.services.oauth_service import verify_apple_id_token

            await verify_apple_id_token("not.a.jwt")


# ===================================================================
# Google ID token tests
# ===================================================================


class TestVerifyGoogleIdToken:
    """Tests for verify_google_id_token."""

    async def test_google_raises_when_not_configured(self):
        """google_client_id is None -> ValueError."""
        settings = _fake_settings(google_client_id=None)
        token = _make_google_token()

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            pytest.raises(ValueError, match="Google OAuth is not configured"),
        ):
            from app.services.oauth_service import verify_google_id_token

            await verify_google_id_token(token)

    async def test_google_rejects_unverified_email(self):
        """Token with email_verified=False is rejected."""
        settings = _fake_settings(google_client_id=GOOGLE_CLIENT_ID)
        token = _make_google_token(email_verified=False)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
            pytest.raises(ValueError, match="Google email not verified"),
        ):
            from app.services.oauth_service import verify_google_id_token

            await verify_google_id_token(token)

    async def test_google_rejects_missing_email(self):
        """Token without an email claim is rejected."""
        settings = _fake_settings(google_client_id=GOOGLE_CLIENT_ID)
        token = _make_google_token(include_email=False)

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
            pytest.raises(ValueError, match="Google ID token missing email claim"),
        ):
            from app.services.oauth_service import verify_google_id_token

            await verify_google_id_token(token)

    async def test_google_valid_token_returns_payload(self):
        """A well-formed, valid Google token returns the decoded payload."""
        settings = _fake_settings(google_client_id=GOOGLE_CLIENT_ID)
        token = _make_google_token()

        with (
            patch("app.services.oauth_service.get_settings", return_value=settings),
            _PATCH_RESOLVE,
        ):
            from app.services.oauth_service import verify_google_id_token

            payload = await verify_google_id_token(token)

        assert payload["sub"] == "google-user-001"
        assert payload["email"] == "bee@example.com"
        assert payload["email_verified"] is True
