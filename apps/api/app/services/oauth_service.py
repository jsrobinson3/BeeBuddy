"""OAuth ID token verification and user resolution for Google and Apple SSO."""

import logging
import time

import httpx
from jose import JWTError
from jose import jwt as jose_jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.user import User

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# JWKS caching — avoids fetching provider public keys on every request
# ---------------------------------------------------------------------------

_jwks_cache: dict[str, dict] = {}  # url -> {"keys": [...], "fetched_at": float}
_JWKS_TTL_SECONDS = 3600  # 1 hour


async def _fetch_jwks(url: str) -> list[dict]:
    """Fetch and cache JWKS from a provider URL."""
    now = time.monotonic()
    cached = _jwks_cache.get(url)
    if cached and (now - cached["fetched_at"]) < _JWKS_TTL_SECONDS:
        return cached["keys"]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        keys = resp.json()["keys"]

    _jwks_cache[url] = {"keys": keys, "fetched_at": now}
    return keys


def _find_key(keys: list[dict], kid: str) -> dict:
    """Find a JWK by key ID in a JWKS key set."""
    for key in keys:
        if key.get("kid") == kid:
            return key
    raise ValueError(f"Signing key {kid!r} not found in JWKS")


async def _resolve_signing_key(jwks_url: str, kid: str, provider: str) -> dict:
    """Fetch the signing key for a token, retrying once on cache miss."""
    try:
        keys = await _fetch_jwks(jwks_url)
    except httpx.HTTPError as e:
        logger.error("Failed to fetch %s JWKS: %s", provider, e)
        raise ValueError("Could not verify token: identity provider unavailable")

    try:
        return _find_key(keys, kid)
    except ValueError:
        pass

    # Key not found — may have rotated. Force refresh and retry once.
    _jwks_cache.pop(jwks_url, None)
    try:
        keys = await _fetch_jwks(jwks_url)
        return _find_key(keys, kid)
    except (httpx.HTTPError, ValueError) as e:
        raise ValueError(f"{provider} token signing key not found: {e}")


def _extract_kid(id_token: str, provider: str) -> str:
    """Extract the key ID from an unverified JWT header."""
    try:
        header = jose_jwt.get_unverified_header(id_token)
    except JWTError as e:
        raise ValueError(f"{provider} ID token is malformed: {e}")
    kid = header.get("kid")
    if not kid:
        raise ValueError(f"{provider} ID token missing key ID")
    return kid


# ---------------------------------------------------------------------------
# Google ID token verification
# ---------------------------------------------------------------------------

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}


async def verify_google_id_token(id_token: str) -> dict:
    """Verify a Google ID token and return the decoded payload.

    Returns dict with: sub, email, email_verified, name (optional), picture (optional).
    Raises ValueError on any verification failure.
    """
    settings = get_settings()
    if not settings.google_client_id:
        raise ValueError("Google OAuth is not configured")

    kid = _extract_kid(id_token, "Google")
    rsa_key = await _resolve_signing_key(GOOGLE_JWKS_URL, kid, "Google")

    try:
        payload = jose_jwt.decode(
            id_token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=list(GOOGLE_ISSUERS),
        )
    except JWTError as e:
        raise ValueError(f"Google ID token verification failed: {e}")

    if not payload.get("email_verified", False):
        raise ValueError("Google email not verified")
    if not payload.get("email"):
        raise ValueError("Google ID token missing email claim")

    return payload


# ---------------------------------------------------------------------------
# Apple ID token verification
# ---------------------------------------------------------------------------

APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"


async def verify_apple_id_token(id_token: str) -> dict:
    """Verify an Apple ID token and return the decoded payload.

    Returns dict with: sub, email (first login only), email_verified.
    Apple only sends email/name on the FIRST authentication.
    Raises ValueError on any verification failure.
    """
    settings = get_settings()
    if not settings.apple_client_id:
        raise ValueError("Apple OAuth is not configured")

    kid = _extract_kid(id_token, "Apple")
    rsa_key = await _resolve_signing_key(APPLE_JWKS_URL, kid, "Apple")

    try:
        payload = jose_jwt.decode(
            id_token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.apple_client_id,
            issuer=APPLE_ISSUER,
        )
    except JWTError as e:
        raise ValueError(f"Apple ID token verification failed: {e}")

    return payload


# ---------------------------------------------------------------------------
# User resolution — shared by both providers
# ---------------------------------------------------------------------------


async def _find_by_oauth(
    db: AsyncSession, provider: str, oauth_sub: str
) -> User | None:
    """Find a non-deleted user by OAuth identity."""
    stmt = select(User).where(
        User.oauth_provider == provider,
        User.oauth_sub == oauth_sub,
        User.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _find_by_email(db: AsyncSession, email: str) -> User | None:
    """Find a non-deleted user by email (case-insensitive)."""
    stmt = select(User).where(func.lower(User.email) == email.lower(), User.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _link_oauth_to_existing(
    db: AsyncSession,
    existing: User,
    provider: str,
    oauth_sub: str,
    name: str | None,
) -> User:
    """Link an OAuth identity to an existing email/password user."""
    if existing.oauth_provider is not None and existing.oauth_provider != provider:
        raise ValueError(
            f"Email already associated with {existing.oauth_provider} login"
        )
    existing.oauth_provider = provider
    existing.oauth_sub = oauth_sub
    existing.email_verified = True
    if name and not existing.name:
        existing.name = name
    await db.commit()
    await db.refresh(existing)
    return existing


async def resolve_oauth_user(
    db: AsyncSession,
    provider: str,
    oauth_sub: str,
    email: str | None,
    name: str | None,
) -> User:
    """Find or create a user for the given OAuth identity.

    Resolution order:
    1. Exact match on (oauth_provider, oauth_sub) → return existing user
    2. Match on email → link OAuth identity to existing account
    3. No match → create new user (password_hash=None, email_verified=True)
    """
    user = await _find_by_oauth(db, provider, oauth_sub)
    if user is not None:
        return user

    if email:
        existing = await _find_by_email(db, email)
        if existing is not None:
            return await _link_oauth_to_existing(
                db, existing, provider, oauth_sub, name
            )

    if not email:
        raise ValueError("Email required for first-time OAuth registration")

    new_user = User(
        email=email.lower(),
        name=name,
        oauth_provider=provider,
        oauth_sub=oauth_sub,
        email_verified=True,
        password_hash=None,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user
