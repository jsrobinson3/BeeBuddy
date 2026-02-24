"""FastAPI authentication dependencies (dual-mode: Bearer header + HttpOnly cookie)."""

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _extract_token(request: Request, bearer_token: str | None) -> str | None:
    """Return the access token from the cookie or Bearer header (cookie wins)."""
    cookie_token = request.cookies.get("access_token")
    return cookie_token or bearer_token


async def get_current_user(
    request: Request,
    bearer_token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from a JWT (cookie or Bearer)."""
    token = _extract_token(request, bearer_token)
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception

    try:
        payload = decode_token(token)
        user_id_str: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id_str is None or token_type != "access":
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    # Reject access tokens that were invalidated on logout
    from app.auth.token_blocklist import is_blocked

    jti = payload.get("jti")
    if jti and await is_blocked(jti):
        raise credentials_exception

    user = await db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise credentials_exception

    # Reject tokens issued before a password change
    if user.password_changed_at is not None:
        token_iat = payload.get("iat")
        if token_iat is not None and token_iat < user.password_changed_at.timestamp():
            raise credentials_exception

    return user
