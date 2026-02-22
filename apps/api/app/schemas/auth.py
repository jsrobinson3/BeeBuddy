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


class OAuthCallback(BaseModel):
    """OAuth2 authorization-code callback payload."""

    provider: str
    code: str
    redirect_uri: str
