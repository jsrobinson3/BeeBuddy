"""User service layer."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def update_user(db: AsyncSession, user: User, data: dict[str, Any]) -> User:
    """Update user profile fields from a dict of changed values."""
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def update_preferences(db: AsyncSession, user: User, prefs: dict[str, Any]) -> User:
    """Merge new keys into the user's JSONB preferences."""
    user.preferences = {**(user.preferences or {}), **prefs}
    await db.commit()
    await db.refresh(user)
    return user
