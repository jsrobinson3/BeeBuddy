"""Auth endpoints — register, login, refresh, logout, verify, reset, OAuth stub."""

import logging
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from jose import JWTError
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.blocklist import blocklist_user_tokens
from app.auth.cookies import clear_auth_cookies, set_auth_cookies
from app.auth.jwt import decode_token
from app.db.session import get_db
from app.schemas.auth import (
    LoginRequest,
    OAuthCallback,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.verification import (
    ForgotPasswordRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services import auth_service
from app.tasks import send_email_task

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth")


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user and return tokens."""
    existing = await auth_service.get_user_by_email(db, data.email)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await auth_service.register(db, data.model_dump())
    # Enqueue verification email
    verify_token = auth_service.create_email_verification_token(user.id, user.email)
    send_email_task.delay(
        user.email,
        "Verify your email",
        "verify_email.html",
        {"token": verify_token, "name": user.name or "Beekeeper"},
    )
    access, refresh = auth_service.issue_tokens(user.id)
    set_auth_cookies(response, access, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request,
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate with email and password."""
    user = await auth_service.authenticate(db, data.email, data.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    access, refresh = auth_service.issue_tokens(user.id)
    set_auth_cookies(response, access, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
    response: Response = None,  # type: ignore[assignment]
):
    """Exchange a refresh token for a new token pair.

    Web clients send the refresh token via HttpOnly cookie.
    Native clients send it in the JSON body.
    """
    token = (data.refresh_token if data else None) or refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
    try:
        access, new_refresh = await auth_service.refresh_tokens(db, token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    set_auth_cookies(response, access, new_refresh)
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    """Clear auth cookies and invalidate tokens server-side."""
    # Try to extract user_id so we can revoke all outstanding tokens.
    access_token = request.cookies.get("access_token")
    if access_token:
        try:
            payload = decode_token(access_token)
            user_id = payload.get("sub")
            if user_id:
                await blocklist_user_tokens(user_id)
        except JWTError:
            pass  # Token already expired — just clear cookies
    clear_auth_cookies(response)
    return None


@router.post("/verify-email", status_code=200)
async def verify_email(
    data: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify a user's email using the token from the verification email."""
    try:
        payload = decode_token(data.token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    if payload.get("type") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid token type")
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    try:
        user = await auth_service.mark_email_verified(db, UUID(user_id_str))
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    return {"detail": "Email verified", "email": user.email}


@router.post("/resend-verification", status_code=200)
@limiter.limit("3/minute")
async def resend_verification(
    request: Request,
    data: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Re-send the verification email. Always returns 200 (no enumeration)."""
    user = await auth_service.get_user_by_email(db, data.email)
    if user is not None and not user.email_verified:
        token = auth_service.create_email_verification_token(user.id, user.email)
        send_email_task.delay(
            user.email,
            "Verify your email",
            "verify_email.html",
            {"token": token, "name": user.name or "Beekeeper"},
        )
    return {"detail": "If that email exists and is unverified, a verification email has been sent"}


@router.post("/forgot-password", status_code=200)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send a password-reset email. Always returns 200 (no enumeration)."""
    user = await auth_service.get_user_by_email(db, data.email)
    if user is not None:
        token = auth_service.create_password_reset_token(user.id)
        send_email_task.delay(
            user.email,
            "Reset your password",
            "password_reset.html",
            {"token": token, "name": user.name or "Beekeeper"},
        )
    return {"detail": "If that email exists, a password reset email has been sent"}


@router.post("/reset-password", status_code=200)
async def reset_password(
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset the user's password using a token from the reset email."""
    try:
        payload = decode_token(data.token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid token type")
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=400, detail="Invalid token")
    try:
        await auth_service.reset_password(db, UUID(user_id_str), data.new_password)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    return {"detail": "Password has been reset"}


@router.post("/oauth/{provider}", response_model=TokenResponse, status_code=501)
async def oauth_callback(
    provider: str, data: OAuthCallback, db: AsyncSession = Depends(get_db)
):
    """OAuth callback stub — not yet implemented."""
    raise HTTPException(status_code=501, detail="OAuth not implemented")
