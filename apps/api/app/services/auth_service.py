"""Auth service layer — registration, login, token refresh, verification, reset."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import ALGORITHM, create_access_token, create_refresh_token, decode_token
from app.auth.password import hash_password, verify_password
from app.config import get_settings
from app.models.user import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Lookup a non-deleted user by email (case-insensitive)."""
    stmt = select(User).where(func.lower(User.email) == email.lower(), User.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> User | None:
    """Lookup a non-deleted user by ID."""
    stmt = select(User).where(User.id == user_id, User.deleted_at.is_(None))
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def register(db: AsyncSession, data: dict) -> User:
    """Create a new user with a hashed password and return the user."""
    user = User(
        email=data["email"].lower(),
        password_hash=hash_password(data["password"]),
        name=data.get("name"),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(db: AsyncSession, email: str, password: str) -> User | None:
    """Verify credentials and return the user, or None on failure."""
    user = await get_user_by_email(db, email)
    if user is None or user.password_hash is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def issue_tokens(user_id: UUID) -> tuple[str, str]:
    """Issue an access + refresh token pair for a user."""
    data = {"sub": str(user_id)}
    return create_access_token(data), create_refresh_token(data)


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> tuple[str, str]:
    """Decode a refresh token, verify the user exists, return new token pair.

    Raises JWTError if the token is invalid, not a refresh token, or blocklisted.
    """
    from app.auth.token_blocklist import is_blocked

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise
    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")

    # Reject tokens that were invalidated on logout
    jti = payload.get("jti")
    if jti and await is_blocked(jti):
        raise JWTError("Token has been revoked")

    user_id = payload.get("sub")
    if user_id is None:
        raise JWTError("Token missing subject")
    user = await get_user_by_id(db, UUID(user_id))
    if user is None:
        raise JWTError("User not found")
    return issue_tokens(user.id)


# -- Email verification tokens ------------------------------------------------


def create_email_verification_token(user_id: UUID, email: str) -> str:
    """Create a JWT for email verification. TTL=24h, type=email_verify."""
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=24)
    data = {"sub": str(user_id), "email": email, "type": "email_verify", "exp": expire}
    return jwt.encode(data, settings.secret_key, algorithm=ALGORITHM)


def create_password_reset_token(user_id: UUID) -> str:
    """Create a JWT for password reset. TTL=1h, type=password_reset."""
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=1)
    data = {"sub": str(user_id), "type": "password_reset", "exp": expire}
    return jwt.encode(data, settings.secret_key, algorithm=ALGORITHM)


def create_account_deletion_token(user_id: UUID) -> str:
    """Create a JWT for cancelling account deletion. TTL=30d, type=cancel_deletion."""
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(days=30)
    data = {"sub": str(user_id), "type": "cancel_deletion", "exp": expire}
    return jwt.encode(data, settings.secret_key, algorithm=ALGORITHM)


async def mark_email_verified(db: AsyncSession, user_id: UUID) -> User:
    """Set email_verified=True for the given user."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")
    user.email_verified = True
    await db.commit()
    await db.refresh(user)
    return user


async def reset_password(db: AsyncSession, user_id: UUID, new_password: str) -> User:
    """Hash new password, set password_changed_at to invalidate old tokens."""
    user = await get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")
    user.password_hash = hash_password(new_password)
    user.password_changed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(user)
    return user
