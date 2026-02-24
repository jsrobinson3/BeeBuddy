"""Hive CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.task_cadence import TaskCadence


async def get_hives(
    db: AsyncSession,
    user_id: UUID,
    apiary_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Hive]:
    """Return non-deleted hives owned by the user, optionally filtered by apiary."""
    stmt = (
        select(Hive)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Hive.deleted_at.is_(None), Apiary.user_id == user_id)
        .offset(offset)
        .limit(limit)
    )
    if apiary_id is not None:
        stmt = stmt.where(Hive.apiary_id == apiary_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_hive(db: AsyncSession, data: dict) -> Hive:
    """Create a new hive."""
    hive = Hive(**data)
    db.add(hive)
    await db.commit()
    await db.refresh(hive)
    return hive


async def get_hive(db: AsyncSession, hive_id: UUID, user_id: UUID) -> Hive | None:
    """Get a single non-deleted hive owned by the user."""
    result = await db.execute(
        select(Hive)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Hive.id == hive_id, Hive.deleted_at.is_(None), Apiary.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def update_hive(db: AsyncSession, hive: Hive, data: dict) -> Hive:
    """Update hive fields from a dict of changed values."""
    for key, value in data.items():
        setattr(hive, key, value)
    await db.commit()
    await db.refresh(hive)
    return hive


async def delete_hive(db: AsyncSession, hive: Hive) -> None:
    """Soft-delete a hive and its associated cadences."""
    now = datetime.now(UTC)
    hive.deleted_at = now
    # Soft-delete hive-scoped cadences (FK CASCADE only fires on hard delete)
    await db.execute(
        update(TaskCadence)
        .where(TaskCadence.hive_id == hive.id, TaskCadence.deleted_at.is_(None))
        .values(deleted_at=now)
    )
    await db.commit()
