"""Email-verified user authentication dependency."""

from fastapi import Depends, HTTPException, status

from app.auth.dependencies import get_current_user
from app.models.user import User


async def get_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to have a verified email address."""
    if not current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required. Please verify your email to use AI features.",
        )
    return current_user
