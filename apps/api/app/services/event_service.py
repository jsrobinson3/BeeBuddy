"""Event CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.event import Event
from app.models.hive import Hive


async def get_events(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Event]:
    """Return non-deleted events owned by the user, optionally filtered by hive."""
    stmt = (
        select(Event)
        .join(Hive, Event.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Event.deleted_at.is_(None), Apiary.user_id == user_id)
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Event.hive_id == hive_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_event(db: AsyncSession, data: dict) -> Event:
    """Create a new event."""
    if data.get("occurred_at") is None:
        data["occurred_at"] = datetime.now(UTC)
    event = Event(**data)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def get_event(db: AsyncSession, event_id: UUID, user_id: UUID) -> Event | None:
    """Get a single non-deleted event owned by the user."""
    result = await db.execute(
        select(Event)
        .join(Hive, Event.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Event.id == event_id,
            Event.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_event(db: AsyncSession, event: Event, data: dict) -> Event:
    """Update event fields from a dict of changed values."""
    for key, value in data.items():
        setattr(event, key, value)
    await db.commit()
    await db.refresh(event)
    return event


async def delete_event(db: AsyncSession, event: Event) -> None:
    """Soft-delete an event."""
    event.deleted_at = datetime.now(UTC)
    await db.commit()
