"""HttpOnly cookie helpers for web-based auth."""

from fastapi import Response

from app.config import get_settings


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set HttpOnly auth cookies on the response."""
    settings = get_settings()

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
        max_age=settings.access_token_expire_minutes * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/api/v1/auth",
        max_age=settings.refresh_token_expire_days * 86400,
    )


def clear_auth_cookies(response: Response) -> None:
    """Delete auth cookies from the response."""
    settings = get_settings()

    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path=settings.cookie_path,
    )
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/api/v1/auth",
    )
