"""Queen CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.queen import Queen


async def get_queens(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Queen]:
    """Return non-deleted queens owned by the user, optionally filtered by hive."""
    stmt = (
        select(Queen)
        .join(Hive, Queen.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Queen.deleted_at.is_(None), Apiary.user_id == user_id)
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Queen.hive_id == hive_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_queen(db: AsyncSession, data: dict) -> Queen:
    """Create a new queen."""
    queen = Queen(**data)
    db.add(queen)
    await db.commit()
    await db.refresh(queen)
    return queen


async def get_queen(db: AsyncSession, queen_id: UUID, user_id: UUID) -> Queen | None:
    """Get a single non-deleted queen owned by the user."""
    result = await db.execute(
        select(Queen)
        .join(Hive, Queen.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Queen.id == queen_id,
            Queen.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_queen(db: AsyncSession, queen: Queen, data: dict) -> Queen:
    """Update queen fields from a dict of changed values."""
    for key, value in data.items():
        setattr(queen, key, value)
    await db.commit()
    await db.refresh(queen)
    return queen


async def delete_queen(db: AsyncSession, queen: Queen) -> None:
    """Soft-delete a queen."""
    queen.deleted_at = datetime.now(UTC)
    await db.commit()
