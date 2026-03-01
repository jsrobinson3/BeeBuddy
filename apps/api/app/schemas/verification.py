"""Email verification and password reset schemas."""

from pydantic import EmailStr, Field

from app.schemas.common import CamelBase


class ResendVerificationRequest(CamelBase):
    """Request to resend the verification email."""

    email: EmailStr


class VerifyEmailRequest(CamelBase):
    """Request to verify an email via token."""

    token: str


class ForgotPasswordRequest(CamelBase):
    """Request to start the password reset flow."""

    email: EmailStr


class ResetPasswordRequest(CamelBase):
    """Request to reset password with a token."""

    token: str
    new_password: str = Field(min_length=8)
