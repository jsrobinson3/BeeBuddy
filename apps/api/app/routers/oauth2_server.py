"""OAuth2 authorization server for MCP client authentication (PKCE flow).

Implements the authorization code grant with PKCE (RFC 7636) so that
external MCP clients (e.g. Claude Desktop) can obtain scoped JWT tokens
on behalf of an authenticated BeeBuddy user.

Flow:
  1. Client redirects user to GET /authorize with code_challenge
  2. User authenticates (existing JWT), endpoint issues a short-lived code
  3. Client exchanges code + code_verifier at POST /token for JWT pair
  4. Client refreshes via POST /token with grant_type=refresh_token
"""

import base64
import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.db.session import get_db
from app.models.oauth2_client import OAuth2Client
from app.models.oauth2_code import OAuth2Code
from app.models.user import User

router = APIRouter(prefix="/oauth2", tags=["oauth2"])

CODE_TTL_MINUTES = 10
ALLOWED_SCOPES = {"mcp:read"}


def _verify_pkce(code_verifier: str, code_challenge: str) -> bool:
    """Verify PKCE S256 challenge against the original verifier."""
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return computed == code_challenge


def _create_scoped_jwt(user_id: UUID, scope: str) -> tuple[str, str]:
    """Create access + refresh token pair with an MCP scope claim."""
    from jose import jwt

    settings = get_settings()
    now = datetime.now(UTC)

    access_payload = {
        "sub": str(user_id),
        "type": "access",
        "scope": scope,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "iat": now,
    }
    refresh_payload = {
        "sub": str(user_id),
        "type": "refresh",
        "scope": scope,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
        "iat": now,
    }

    access = jwt.encode(access_payload, settings.secret_key, algorithm="HS256")
    refresh = jwt.encode(refresh_payload, settings.secret_key, algorithm="HS256")
    return access, refresh


# ------------------------------------------------------------------
# Authorization endpoint
# ------------------------------------------------------------------


def _validate_authorize_params(
    response_type: str, code_challenge_method: str, scope: str
) -> None:
    """Raise HTTPException if any authorize query params are invalid."""
    if response_type != "code":
        raise HTTPException(400, "Only response_type=code is supported")
    if code_challenge_method != "S256":
        raise HTTPException(400, "Only S256 code_challenge_method is supported")
    requested_scopes = set(scope.split())
    if not requested_scopes.issubset(ALLOWED_SCOPES):
        raise HTTPException(400, f"Invalid scope. Allowed: {ALLOWED_SCOPES}")


def _redirect_uri_matches(registered: str, requested: str) -> bool:
    """Check if a requested redirect URI matches a registered pattern.

    Supports exact match and localhost pattern matching — MCP clients like
    Claude Desktop use dynamic ports (e.g. http://localhost:12345/callback),
    so a registered URI of ``http://localhost/callback`` matches any port on
    the same host and path.
    """
    if registered == requested:
        return True
    from urllib.parse import urlparse

    reg = urlparse(registered)
    req = urlparse(requested)
    if reg.hostname == "localhost" and req.hostname == "localhost":
        return reg.scheme == req.scheme and reg.path == req.path
    return False


async def _validate_client_redirect(
    db: AsyncSession, client_id: str, redirect_uri: str
) -> None:
    """Verify that client_id is registered and redirect_uri is allowed."""
    result = await db.execute(
        select(OAuth2Client).where(
            OAuth2Client.client_id == client_id,
            OAuth2Client.is_active.is_(True),
        )
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(400, f"Unknown client_id: {client_id}")

    if not any(
        _redirect_uri_matches(uri, redirect_uri)
        for uri in client.redirect_uris
    ):
        raise HTTPException(400, "redirect_uri is not registered for this client")


@router.get("/authorize")
async def authorize(
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    code_challenge: str = Query(...),
    code_challenge_method: str = Query("S256"),
    scope: str = Query("mcp:read"),
    state: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Issue an authorization code to an authenticated user.

    The caller must already hold a valid BeeBuddy access token (cookie or
    Bearer header).  On success the user is redirected back to
    *redirect_uri* with a short-lived authorization code.
    """
    _validate_authorize_params(response_type, code_challenge_method, scope)
    await _validate_client_redirect(db, client_id, redirect_uri)

    code = secrets.token_urlsafe(48)
    auth_code = OAuth2Code(
        user_id=current_user.id,
        code=code,
        client_id=client_id,
        redirect_uri=redirect_uri,
        scope=scope,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        expires_at=datetime.now(UTC) + timedelta(minutes=CODE_TTL_MINUTES),
    )
    db.add(auth_code)
    await db.commit()

    separator = "&" if "?" in redirect_uri else "?"
    redirect = f"{redirect_uri}{separator}code={code}"
    if state:
        redirect += f"&state={state}"
    return RedirectResponse(redirect, status_code=302)


# ------------------------------------------------------------------
# Token endpoint
# ------------------------------------------------------------------


@router.post("/token")
async def token(
    grant_type: str = Form(...),
    code: str | None = Form(None),
    code_verifier: str | None = Form(None),
    refresh_token: str | None = Form(None),
    redirect_uri: str | None = Form(None),
    client_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """Exchange an authorization code or refresh token for a JWT pair.

    Supports two grant types:
    * ``authorization_code`` -- requires *code*, *code_verifier*, *redirect_uri*
    * ``refresh_token`` -- requires *refresh_token*
    """
    if grant_type == "authorization_code":
        return await _handle_auth_code_grant(code, code_verifier, redirect_uri, db)
    if grant_type == "refresh_token":
        return _handle_refresh_grant(refresh_token)
    raise HTTPException(400, "Unsupported grant_type")


# ------------------------------------------------------------------
# Well-known metadata (RFC 8414)
# ------------------------------------------------------------------


@router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata():
    """OAuth 2.0 Authorization Server Metadata (RFC 8414).

    MCP clients use this endpoint to discover the authorization and token
    URLs without hard-coding them.
    """
    settings = get_settings()
    base = settings.frontend_url.rstrip("/")
    prefix = settings.api_v1_prefix

    return {
        "issuer": base,
        "authorization_endpoint": f"{base}{prefix}/oauth2/authorize",
        "token_endpoint": f"{base}{prefix}/oauth2/token",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "scopes_supported": list(ALLOWED_SCOPES),
        "token_endpoint_auth_methods_supported": ["none"],
    }


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


async def _handle_auth_code_grant(
    code: str | None,
    code_verifier: str | None,
    redirect_uri: str | None,
    db: AsyncSession,
) -> dict:
    """Validate an authorization code and return a JWT pair."""
    if not code or not code_verifier or not redirect_uri:
        raise HTTPException(400, "code, code_verifier, and redirect_uri required")

    result = await db.execute(
        select(OAuth2Code)
        .where(OAuth2Code.code == code)
        .where(OAuth2Code.used.is_(False))
    )
    auth_code = result.scalar_one_or_none()

    if not auth_code:
        raise HTTPException(400, "Invalid or expired authorization code")
    if auth_code.expires_at < datetime.now(UTC):
        raise HTTPException(400, "Authorization code expired")
    if auth_code.redirect_uri != redirect_uri:
        raise HTTPException(400, "redirect_uri mismatch")
    if not _verify_pkce(code_verifier, auth_code.code_challenge):
        raise HTTPException(400, "Invalid code_verifier")

    auth_code.used = True
    await db.commit()

    settings = get_settings()
    access, refresh = _create_scoped_jwt(auth_code.user_id, auth_code.scope)
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "scope": auth_code.scope,
    }


def _handle_refresh_grant(refresh_token: str | None) -> dict:
    """Validate a refresh token and return a new JWT pair."""
    if not refresh_token:
        raise HTTPException(400, "refresh_token required")

    from jose import JWTError, jwt

    settings = get_settings()
    try:
        payload = jwt.decode(refresh_token, settings.secret_key, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise HTTPException(400, "Invalid token type")
        user_id = UUID(payload["sub"])
        scope = payload.get("scope", "mcp:read")
    except JWTError:
        raise HTTPException(400, "Invalid refresh token")

    access, new_refresh = _create_scoped_jwt(user_id, scope)
    return {
        "access_token": access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
        "scope": scope,
    }
