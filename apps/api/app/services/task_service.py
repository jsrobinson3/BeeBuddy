"""Task CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task


async def get_tasks(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID | None = None,
    apiary_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Task]:
    """Return all non-deleted tasks for a user, optionally filtered by hive or apiary."""
    stmt = (
        select(Task)
        .where(Task.deleted_at.is_(None), Task.user_id == user_id)
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
    """Get a single non-deleted task owned by the user."""
    result = await db.execute(
        select(Task).where(
            Task.id == task_id,
            Task.deleted_at.is_(None),
            Task.user_id == user_id,
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
