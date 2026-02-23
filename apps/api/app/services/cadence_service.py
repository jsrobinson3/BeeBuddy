"""Cadence service — manages user task cadences and auto-generates tasks."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cadence_catalog import CADENCE_CATALOG, CadenceCategory, get_template
from app.models.task import Task, TaskPriority, TaskSource
from app.models.task_cadence import TaskCadence

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────


def _compute_next_due(cadence_key: str, from_date: date | None = None) -> date | None:
    """Compute the next due date for a cadence template.

    For recurring cadences: from_date + interval_days.
    For seasonal cadences: the next occurrence of season_month/season_day.
    """
    tpl = get_template(cadence_key)
    if tpl is None:
        return None

    today = from_date or date.today()

    if tpl.category == CadenceCategory.RECURRING and tpl.interval_days:
        return today + timedelta(days=tpl.interval_days)

    if tpl.category == CadenceCategory.SEASONAL and tpl.season_month:
        candidate = date(today.year, tpl.season_month, tpl.season_day)
        if candidate <= today:
            candidate = date(today.year + 1, tpl.season_month, tpl.season_day)
        return candidate

    return None


# ── Read operations ───────────────────────────────────────────────────────────


async def get_cadences(
    db: AsyncSession,
    user_id: UUID,
    active_only: bool = False,
) -> list[TaskCadence]:
    """Return all non-deleted cadences for a user."""
    stmt = select(TaskCadence).where(
        TaskCadence.deleted_at.is_(None),
        TaskCadence.user_id == user_id,
    )
    if active_only:
        stmt = stmt.where(TaskCadence.is_active.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_cadence(
    db: AsyncSession,
    cadence_id: UUID,
    user_id: UUID,
) -> TaskCadence | None:
    """Get a single non-deleted cadence owned by the user."""
    result = await db.execute(
        select(TaskCadence).where(
            TaskCadence.id == cadence_id,
            TaskCadence.deleted_at.is_(None),
            TaskCadence.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


# ── Initialize cadences for a new user ────────────────────────────────────────


async def initialize_cadences(db: AsyncSession, user_id: UUID) -> list[TaskCadence]:
    """Seed all catalog cadences for a newly registered user.

    Each cadence starts as active with its first due date computed from today.
    Skips cadences that already exist for the user (idempotent).
    """
    existing = await get_cadences(db, user_id)
    existing_keys = {c.cadence_key for c in existing}

    created: list[TaskCadence] = []
    today = date.today()

    for tpl in CADENCE_CATALOG:
        if tpl.key in existing_keys:
            continue

        cadence = TaskCadence(
            user_id=user_id,
            cadence_key=tpl.key,
            is_active=True,
            next_due_date=_compute_next_due(tpl.key, today),
        )
        db.add(cadence)
        created.append(cadence)

    if created:
        await db.commit()
        for c in created:
            await db.refresh(c)

    return created


# ── Toggle / update cadence ───────────────────────────────────────────────────


async def update_cadence(
    db: AsyncSession,
    cadence: TaskCadence,
    data: dict,
) -> TaskCadence:
    """Update cadence fields from a dict of changed values."""
    for key, value in data.items():
        setattr(cadence, key, value)
    await db.commit()
    await db.refresh(cadence)
    return cadence


async def delete_cadence(db: AsyncSession, cadence: TaskCadence) -> None:
    """Soft-delete a cadence."""
    cadence.deleted_at = datetime.now(UTC)
    await db.commit()


# ── Task generation ───────────────────────────────────────────────────────────


async def generate_due_tasks(
    db: AsyncSession,
    user_id: UUID,
    as_of: date | None = None,
) -> list[Task]:
    """Generate Task records for all cadences that are due on or before `as_of`.

    For each due cadence:
    1. Creates a new Task with source=SYSTEM.
    2. Advances the cadence's next_due_date.
    3. Stamps last_generated_at.

    Returns the list of newly created tasks.
    """
    today = as_of or date.today()
    cadences = await get_cadences(db, user_id, active_only=True)

    tasks_created: list[Task] = []

    for cadence in cadences:
        if cadence.next_due_date is None or cadence.next_due_date > today:
            continue

        tpl = get_template(cadence.cadence_key)
        if tpl is None:
            logger.warning("Unknown cadence key %s for user %s", cadence.cadence_key, user_id)
            continue

        task = Task(
            user_id=user_id,
            title=tpl.title,
            description=tpl.description,
            due_date=cadence.next_due_date,
            recurring=tpl.category == CadenceCategory.RECURRING,
            recurrence_rule=f"every {tpl.interval_days} days" if tpl.interval_days else None,
            source=TaskSource.SYSTEM,
            priority=TaskPriority(tpl.priority),
        )
        db.add(task)
        tasks_created.append(task)

        # Advance the cadence
        cadence.last_generated_at = datetime.now(UTC)
        cadence.next_due_date = _compute_next_due(cadence.cadence_key, today)

    if tasks_created:
        await db.commit()
        for t in tasks_created:
            await db.refresh(t)

    return tasks_created
