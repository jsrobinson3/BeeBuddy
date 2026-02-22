"""Email verification and password reset schemas."""

from pydantic import BaseModel, EmailStr, Field


class ResendVerificationRequest(BaseModel):
    """Request to resend the verification email."""

    email: EmailStr


class VerifyEmailRequest(BaseModel):
    """Request to verify an email via token."""

    token: str


class ForgotPasswordRequest(BaseModel):
    """Request to start the password reset flow."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Request to reset password with a token."""

    token: str
    new_password: str = Field(min_length=8)
