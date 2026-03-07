"""Shared rate limiter for the application."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.auth.jwt import decode_token
from app.config import get_settings


def _get_user_or_ip(request: Request) -> str:
    """Extract user ID from JWT for per-user rate limiting, falling back to IP."""
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        token = request.cookies.get("access_token")
    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id and payload.get("type") == "access":
                return f"user:{user_id}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_user_or_ip,
    enabled=get_settings().rate_limit_enabled,
)
