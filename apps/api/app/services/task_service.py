"""Task CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.share import Share, ShareStatus
from app.models.task import Task


def _shared_task_filter(user_id: UUID):
    """Tasks the user can see via shared apiaries/hives."""
    shared_apiary_subq = (
        select(Share.apiary_id)
        .where(
            Share.shared_with_user_id == user_id,
            Share.status == ShareStatus.ACCEPTED,
            Share.apiary_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .correlate_except(Share)
    )
    shared_hive_subq = (
        select(Share.hive_id)
        .where(
            Share.shared_with_user_id == user_id,
            Share.status == ShareStatus.ACCEPTED,
            Share.hive_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .correlate_except(Share)
    )
    return or_(
        Task.user_id == user_id,
        and_(Task.apiary_id.isnot(None), Task.apiary_id.in_(shared_apiary_subq)),
        and_(Task.hive_id.isnot(None), Task.hive_id.in_(shared_hive_subq)),
    )


async def get_tasks(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    apiary_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Task]:
    """Return non-deleted tasks the user owns or can see via shared resources."""
    stmt = (
        select(Task)
        .where(Task.deleted_at.is_(None), _shared_task_filter(user_id))
        .offset(offset)
        .limit(limit)
    )
    if hive_id is not None:
        stmt = stmt.where(Task.hive_id == hive_id)
    if apiary_id is not None:
        stmt = stmt.where(Task.apiary_id == apiary_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_task(db: AsyncSession, data: dict, user_id: UUID) -> Task:
    """Create a new task."""
    data["user_id"] = user_id
    task = Task(**data)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def get_task(db: AsyncSession, task_id: UUID, user_id: UUID) -> Task | None:
    """Get a single non-deleted task the user owns or can see via sharing."""
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.deleted_at.is_(None),
            _shared_task_filter(user_id),
        )
    )
    return result.scalar_one_or_none()


async def update_task(db: AsyncSession, task: Task, data: dict) -> Task:
    """Update task fields from a dict of changed values."""
    for key, value in data.items():
        setattr(task, key, value)
    await db.commit()
    await db.refresh(task)
    return task


async def delete_task(db: AsyncSession, task: Task) -> None:
    """Soft-delete a task."""
    task.deleted_at = datetime.now(UTC)
    await db.commit()
