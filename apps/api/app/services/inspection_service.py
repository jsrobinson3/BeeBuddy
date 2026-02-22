"""Inspection CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.inspection import Inspection


async def get_inspections(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Inspection]:
    """Return non-deleted inspections owned by the user, optionally filtered by hive."""
    stmt = (
        select(Inspection)
        .join(Hive, Inspection.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .options(selectinload(Inspection.photos))
        .where(Inspection.deleted_at.is_(None), Apiary.user_id == user_id)
        .order_by(Inspection.inspected_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Inspection.hive_id == hive_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_inspection(db: AsyncSession, data: dict) -> Inspection:
    """Create a new inspection."""
    if data.get("inspected_at") is None:
        data["inspected_at"] = datetime.now(UTC)
    inspection = Inspection(**data)
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)
    return inspection


async def get_inspection(
    db: AsyncSession, inspection_id: UUID, user_id: UUID
) -> Inspection | None:
    """Get a single non-deleted inspection owned by the user."""
    result = await db.execute(
        select(Inspection)
        .join(Hive, Inspection.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .options(selectinload(Inspection.photos))
        .where(
            Inspection.id == inspection_id,
            Inspection.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_inspection(
    db: AsyncSession, inspection: Inspection, data: dict
) -> Inspection:
    """Update inspection fields from a dict of changed values."""
    for key, value in data.items():
        setattr(inspection, key, value)
    await db.commit()
    await db.refresh(inspection)
    return inspection


async def delete_inspection(db: AsyncSession, inspection: Inspection) -> None:
    """Soft-delete an inspection."""
    inspection.deleted_at = datetime.now(UTC)
    await db.commit()
