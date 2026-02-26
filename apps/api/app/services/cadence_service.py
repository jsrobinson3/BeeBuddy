"""Cadence service — manages user task cadences and auto-generates tasks."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cadence_catalog import (
    CADENCE_CATALOG,
    CadenceCategory,
    CadenceScope,
    CadenceTemplate,
    get_hive_templates,
    get_template,
)
from app.models.task import Task, TaskPriority, TaskSource
from app.models.task_cadence import TaskCadence
from app.models.user import User

logger = logging.getLogger(__name__)

# ── Hemisphere helpers ─────────────────────────────────────────────────────────

Hemisphere = str  # "north" | "south"


def detect_hemisphere(latitude: float | None) -> Hemisphere:
    """Derive hemisphere from latitude.  Defaults to north when unknown."""
    if latitude is not None and latitude < 0:
        return "south"
    return "north"


async def resolve_hemisphere(
    db: AsyncSession, user: User,
) -> Hemisphere:
    """Determine the user's hemisphere.

    Priority:
    1. Explicit preference (preferences.hemisphere = "north" | "south")
    2. Latitude of their first apiary that has coordinates
    3. Default: "north"
    """
    from app.models.apiary import Apiary  # avoid circular at module level

    prefs = user.preferences or {}
    explicit = prefs.get("hemisphere")
    if explicit in ("north", "south"):
        return explicit

    result = await db.execute(
        select(Apiary.latitude)
        .where(
            Apiary.user_id == user.id,
            Apiary.deleted_at.is_(None),
            Apiary.latitude.isnot(None),
        )
        .limit(1)
    )
    lat = result.scalar_one_or_none()
    return detect_hemisphere(lat)


def _offset_month(month: int, hemisphere: Hemisphere) -> int:
    """Shift a season month by 6 for the southern hemisphere.

    Maps Jan(1)->Jul(7), Mar(3)->Sep(9), Sep(9)->Mar(3), etc.
    """
    if hemisphere == "south":
        return ((month - 1 + 6) % 12) + 1
    return month


# ── Helpers ───────────────────────────────────────────────────────────────────


def _compute_next_due(
    cadence_key: str,
    from_date: date | None = None,
    hemisphere: Hemisphere = "north",
    *,
    custom_interval_days: int | None = None,
    custom_season_month: int | None = None,
    custom_season_day: int | None = None,
) -> date | None:
    """Compute the next due date for a cadence template.

    For recurring cadences: from_date + interval_days (or custom override).
    For seasonal cadences: the next occurrence of season_month/season_day
    (or custom overrides), offset by 6 months for the southern hemisphere.
    """
    tpl = get_template(cadence_key)
    if tpl is None:
        return None

    today = from_date or date.today()

    if tpl.category == CadenceCategory.RECURRING:
        interval = custom_interval_days or tpl.interval_days
        if interval:
            return today + timedelta(days=interval)

    if tpl.category == CadenceCategory.SEASONAL:
        month = custom_season_month or tpl.season_month
        day = custom_season_day or tpl.season_day
        if month:
            adjusted_month = _offset_month(month, hemisphere)
            candidate = date(today.year, adjusted_month, day)
            if candidate <= today:
                candidate = date(today.year + 1, adjusted_month, day)
            return candidate

    return None


# ── Read operations ───────────────────────────────────────────────────────────


async def get_cadences(
    db: AsyncSession,
    user_id: UUID,
    active_only: bool = False,
    hive_id: UUID | None = None,
) -> list[TaskCadence]:
    """Return non-deleted cadences for a user, optionally filtered by hive."""
    stmt = select(TaskCadence).where(
        TaskCadence.deleted_at.is_(None),
        TaskCadence.user_id == user_id,
    )
    if active_only:
        stmt = stmt.where(TaskCadence.is_active.is_(True))
    if hive_id is not None:
        stmt = stmt.where(TaskCadence.hive_id == hive_id)
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


async def initialize_cadences(
    db: AsyncSession,
    user_id: UUID,
    hemisphere: Hemisphere = "north",
) -> list[TaskCadence]:
    """Seed user-level catalog cadences for a newly registered user.

    Skips hive-scoped templates (those are created per-hive).
    Sets next_due_date = today so the first task generates immediately.
    Skips cadences that already exist for the user (idempotent).
    Seasonal cadences are offset by 6 months for southern-hemisphere users.
    """
    existing = await get_cadences(db, user_id)
    existing_keys = {c.cadence_key for c in existing if c.hive_id is None}

    created: list[TaskCadence] = []
    today = date.today()

    for tpl in CADENCE_CATALOG:
        if tpl.scope == CadenceScope.HIVE:
            continue
        if tpl.key in existing_keys:
            continue

        # Use today for recurring so tasks generate immediately;
        # use computed date for seasonal (next occurrence of the target month)
        if tpl.category == CadenceCategory.RECURRING:
            due = today
        else:
            due = _compute_next_due(tpl.key, today, hemisphere)

        cadence = TaskCadence(
            user_id=user_id,
            cadence_key=tpl.key,
            is_active=True,
            next_due_date=due,
        )
        db.add(cadence)
        created.append(cadence)

    if created:
        await db.commit()
        for c in created:
            await db.refresh(c)

    return created


async def initialize_hive_cadences(
    db: AsyncSession,
    user_id: UUID,
    hive_id: UUID,
    hemisphere: Hemisphere = "north",
) -> list[TaskCadence]:
    """Create hive-scoped cadences for a specific hive.

    Sets next_due_date = today so the first task generates immediately.
    Skips cadences that already exist for this hive (idempotent).
    """
    existing = await get_cadences(db, user_id, hive_id=hive_id)
    existing_keys = {c.cadence_key for c in existing}

    created: list[TaskCadence] = []
    today = date.today()

    for tpl in get_hive_templates():
        if tpl.key in existing_keys:
            continue

        cadence = TaskCadence(
            user_id=user_id,
            hive_id=hive_id,
            cadence_key=tpl.key,
            is_active=True,
            next_due_date=today,
        )
        db.add(cadence)
        created.append(cadence)

    if created:
        await db.commit()
        for c in created:
            await db.refresh(c)

    return created


async def ensure_hive_cadences(
    db: AsyncSession,
    user_id: UUID,
    hemisphere: Hemisphere = "north",
) -> list[TaskCadence]:
    """Ensure every non-deleted hive owned by the user has hive-scoped cadences.

    This is a catch-up mechanism for hives created via WatermelonDB sync (which
    bypasses the REST router and its initialize_hive_cadences call).
    """
    from app.models.apiary import Apiary  # avoid circular at module level
    from app.models.hive import Hive

    # Get all active hive IDs for the user
    result = await db.execute(
        select(Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Apiary.user_id == user_id,
            Hive.deleted_at.is_(None),
            Apiary.deleted_at.is_(None),
        )
    )
    hive_ids = [row[0] for row in result.all()]

    if not hive_ids:
        return []

    # Get all existing hive-scoped cadences for the user
    existing = await get_cadences(db, user_id)
    hives_with_cadences: set[UUID] = set()
    for c in existing:
        if c.hive_id is not None:
            hives_with_cadences.add(c.hive_id)

    created: list[TaskCadence] = []
    for hive_id in hive_ids:
        if hive_id in hives_with_cadences:
            continue
        new = await initialize_hive_cadences(db, user_id, hive_id, hemisphere)
        created.extend(new)

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


async def _resolve_hive_info(
    db: AsyncSession, hive_id: UUID,
) -> tuple[str, UUID | None]:
    """Return (hive_name, apiary_id) for a hive, used when generating tasks."""
    from app.models.hive import Hive  # avoid circular at module level

    result = await db.execute(
        select(Hive.name, Hive.apiary_id).where(Hive.id == hive_id)
    )
    row = result.one_or_none()
    if row is None:
        return ("Unknown hive", None)
    return (row.name, row.apiary_id)


def _build_task_from_cadence(
    user_id: UUID,
    cadence: TaskCadence,
    tpl: CadenceTemplate,
    hive_name: str | None = None,
    apiary_id: UUID | None = None,
) -> Task:
    """Create a Task object from a due cadence."""
    interval = cadence.custom_interval_days or tpl.interval_days
    title = f"{hive_name}: {tpl.title}" if hive_name else tpl.title
    return Task(
        user_id=user_id,
        hive_id=cadence.hive_id,
        apiary_id=apiary_id,
        title=title,
        description=tpl.description,
        due_date=cadence.next_due_date,
        recurring=tpl.category == CadenceCategory.RECURRING,
        recurrence_rule=f"every {interval} days" if interval else None,
        source=TaskSource.SYSTEM,
        priority=TaskPriority(tpl.priority),
    )


def _advance_cadence(cadence: TaskCadence, today: date, hemisphere: Hemisphere) -> None:
    """Stamp last_generated_at and advance next_due_date forward."""
    cadence.last_generated_at = datetime.now(UTC)
    cadence.next_due_date = _compute_next_due(
        cadence.cadence_key, today, hemisphere,
        custom_interval_days=cadence.custom_interval_days,
        custom_season_month=cadence.custom_season_month,
        custom_season_day=cadence.custom_season_day,
    )


LOOKAHEAD_DAYS = 30


async def generate_due_tasks(
    db: AsyncSession,
    user_id: UUID,
    as_of: date | None = None,
    hemisphere: Hemisphere = "north",
) -> list[Task]:
    """Generate Task records for all cadences due within the lookahead window.

    Tasks are created up to LOOKAHEAD_DAYS in advance so users can see
    upcoming seasonal and recurring tasks before they're due.
    """
    today = as_of or date.today()
    horizon = today + timedelta(days=LOOKAHEAD_DAYS)
    cadences = await get_cadences(db, user_id, active_only=True)
    hive_cache: dict[UUID, tuple[str, UUID | None]] = {}
    tasks_created: list[Task] = []

    for cadence in cadences:
        if cadence.next_due_date is None or cadence.next_due_date > horizon:
            continue
        tpl = get_template(cadence.cadence_key)
        if tpl is None:
            logger.warning("Unknown cadence key %s for user %s", cadence.cadence_key, user_id)
            continue

        hive_name, apiary_id = None, None
        if cadence.hive_id:
            if cadence.hive_id not in hive_cache:
                hive_cache[cadence.hive_id] = await _resolve_hive_info(db, cadence.hive_id)
            hive_name, apiary_id = hive_cache[cadence.hive_id]

        task = _build_task_from_cadence(user_id, cadence, tpl, hive_name, apiary_id)
        db.add(task)
        tasks_created.append(task)
        # Advance from the cadence's due date (not today) so next occurrence
        # is correctly computed even when generating tasks ahead of schedule.
        _advance_cadence(cadence, cadence.next_due_date, hemisphere)

    if tasks_created:
        await db.commit()
        for t in tasks_created:
            await db.refresh(t)
    return tasks_created
