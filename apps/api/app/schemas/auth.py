"""Auth request and response schemas."""

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Registration payload."""

    name: str | None = None
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Email + password login payload."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token pair returned after login or refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """Refresh-token rotation payload."""

    refresh_token: str


class LogoutRequest(BaseModel):
    """Logout payload for native clients that send tokens in the body."""

    access_token: str | None = None
    refresh_token: str | None = None


class OAuthTokenRequest(BaseModel):
    """Native OAuth ID token payload sent from mobile app."""

    id_token: str
    name: str | None = None
    email: str | None = None
