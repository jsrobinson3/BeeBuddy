"""JWT token creation and decoding."""

from datetime import UTC, datetime, timedelta

from jose import jwt

from app.config import get_settings

ALGORITHM = "HS256"


def create_access_token(data: dict) -> str:
    """Create a short-lived access token."""
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        minutes=settings.access_token_expire_minutes,
    )
    to_encode.update({"exp": expire, "iat": datetime.now(UTC), "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    """Create a long-lived refresh token."""
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(
        days=settings.refresh_token_expire_days,
    )
    to_encode.update({"exp": expire, "iat": datetime.now(UTC), "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises JWTError on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
