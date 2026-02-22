"""Harvest CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.harvest import Harvest
from app.models.hive import Hive


async def get_harvests(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Harvest]:
    """Return non-deleted harvests owned by the user, optionally filtered by hive."""
    stmt = (
        select(Harvest)
        .join(Hive, Harvest.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Harvest.deleted_at.is_(None), Apiary.user_id == user_id)
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Harvest.hive_id == hive_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_harvest(db: AsyncSession, data: dict) -> Harvest:
    """Create a new harvest record."""
    if data.get("harvested_at") is None:
        data["harvested_at"] = datetime.now(UTC)
    harvest = Harvest(**data)
    db.add(harvest)
    await db.commit()
    await db.refresh(harvest)
    return harvest


async def get_harvest(
    db: AsyncSession, harvest_id: UUID, user_id: UUID
) -> Harvest | None:
    """Get a single non-deleted harvest owned by the user."""
    result = await db.execute(
        select(Harvest)
        .join(Hive, Harvest.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Harvest.id == harvest_id,
            Harvest.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_harvest(db: AsyncSession, harvest: Harvest, data: dict) -> Harvest:
    """Update harvest fields from a dict of changed values."""
    for key, value in data.items():
        setattr(harvest, key, value)
    await db.commit()
    await db.refresh(harvest)
    return harvest


async def delete_harvest(db: AsyncSession, harvest: Harvest) -> None:
    """Soft-delete a harvest."""
    harvest.deleted_at = datetime.now(UTC)
    await db.commit()
