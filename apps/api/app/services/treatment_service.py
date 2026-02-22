"""Treatment CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.treatment import Treatment


async def get_treatments(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Treatment]:
    """Return non-deleted treatments owned by the user, optionally filtered by hive."""
    stmt = (
        select(Treatment)
        .join(Hive, Treatment.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Treatment.deleted_at.is_(None), Apiary.user_id == user_id)
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Treatment.hive_id == hive_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_treatment(db: AsyncSession, data: dict) -> Treatment:
    """Create a new treatment."""
    if data.get("started_at") is None:
        data["started_at"] = datetime.now(UTC)
    treatment = Treatment(**data)
    db.add(treatment)
    await db.commit()
    await db.refresh(treatment)
    return treatment


async def get_treatment(
    db: AsyncSession, treatment_id: UUID, user_id: UUID
) -> Treatment | None:
    """Get a single non-deleted treatment owned by the user."""
    result = await db.execute(
        select(Treatment)
        .join(Hive, Treatment.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Treatment.id == treatment_id,
            Treatment.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_treatment(
    db: AsyncSession, treatment: Treatment, data: dict
) -> Treatment:
    """Update treatment fields from a dict of changed values."""
    for key, value in data.items():
        setattr(treatment, key, value)
    await db.commit()
    await db.refresh(treatment)
    return treatment


async def delete_treatment(db: AsyncSession, treatment: Treatment) -> None:
    """Soft-delete a treatment."""
    treatment.deleted_at = datetime.now(UTC)
    await db.commit()
