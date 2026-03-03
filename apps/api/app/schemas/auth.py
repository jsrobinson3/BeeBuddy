"""Auth request and response schemas."""

from pydantic import EmailStr, Field

from app.schemas.common import CamelBase


class RegisterRequest(CamelBase):
    """Registration payload."""

    name: str | None = None
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(CamelBase):
    """Email + password login payload."""

    email: EmailStr
    password: str


class TokenResponse(CamelBase):
    """JWT token pair returned after login or refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(CamelBase):
    """Refresh-token rotation payload."""

    refresh_token: str


class LogoutRequest(CamelBase):
    """Logout payload for native clients that send tokens in the body."""

    access_token: str | None = None
    refresh_token: str | None = None


class OAuthTokenRequest(CamelBase):
    """Native OAuth ID token payload sent from mobile app."""

    id_token: str
    name: str | None = None
    email: str | None = None
