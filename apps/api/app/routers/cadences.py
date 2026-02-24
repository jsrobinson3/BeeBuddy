"""Cadence management endpoints.

Users can:
- View the cadence template catalog.
- List their personal cadence subscriptions.
- Initialize all cadences (idempotent — safe to call multiple times).
- Toggle individual cadences on/off.
- Trigger task generation for cadences that are due.

Hemisphere awareness:
  Seasonal cadences are offset by 6 months for southern-hemisphere users.
  The hemisphere is resolved from: user preference > first apiary latitude > "north".
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.cadence_catalog import CADENCE_CATALOG
from app.db.session import get_db
from app.models.user import User
from app.schemas.cadence import CadenceResponse, CadenceTemplateResponse, CadenceUpdate
from app.schemas.task import TaskResponse
from app.services import cadence_service

router = APIRouter(prefix="/cadences")


@router.get("/catalog", response_model=list[CadenceTemplateResponse])
async def list_catalog():
    """Return the full cadence template catalog (no auth required)."""
    return [
        CadenceTemplateResponse(
            key=t.key,
            title=t.title,
            description=t.description,
            category=t.category.value,
            season=t.season.value,
            priority=t.priority,
            interval_days=t.interval_days,
            season_month=t.season_month,
            season_day=t.season_day,
            scope=t.scope.value,
        )
        for t in CADENCE_CATALOG
    ]


@router.get("", response_model=list[CadenceResponse])
async def list_cadences(
    hive_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's cadence subscriptions, optionally filtered by hive."""
    return await cadence_service.get_cadences(db, user_id=current_user.id, hive_id=hive_id)


@router.post("/initialize", response_model=list[CadenceResponse], status_code=201)
async def initialize_cadences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed all catalog cadences for the current user.

    Idempotent — existing cadences are not duplicated.
    Seasonal cadences are adjusted for the user's hemisphere.
    """
    hemisphere = await cadence_service.resolve_hemisphere(db, current_user)
    return await cadence_service.initialize_cadences(
        db, user_id=current_user.id, hemisphere=hemisphere,
    )


@router.patch("/{cadence_id}", response_model=CadenceResponse)
async def update_cadence(
    cadence_id: UUID,
    data: CadenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a cadence (e.g. toggle active/inactive, customize schedule).

    When custom scheduling fields change, next_due_date is recalculated.
    """
    cadence = await cadence_service.get_cadence(db, cadence_id, user_id=current_user.id)
    if not cadence:
        raise HTTPException(status_code=404, detail="Cadence not found")

    changes = data.model_dump(exclude_unset=True)
    scheduling_keys = {"custom_interval_days", "custom_season_month", "custom_season_day"}
    schedule_changed = bool(changes.keys() & scheduling_keys)

    cadence = await cadence_service.update_cadence(db, cadence, changes)

    # Recalculate next_due_date when scheduling overrides changed
    if schedule_changed:
        hemisphere = await cadence_service.resolve_hemisphere(db, current_user)
        cadence.next_due_date = cadence_service._compute_next_due(
            cadence.cadence_key,
            hemisphere=hemisphere,
            custom_interval_days=cadence.custom_interval_days,
            custom_season_month=cadence.custom_season_month,
            custom_season_day=cadence.custom_season_day,
        )
        await db.commit()
        await db.refresh(cadence)

    return cadence


@router.post("/generate", response_model=list[TaskResponse])
async def generate_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate tasks for all cadences that are currently due.

    This is also called automatically by the daily Celery beat job,
    but users can trigger it manually.
    """
    hemisphere = await cadence_service.resolve_hemisphere(db, current_user)
    return await cadence_service.generate_due_tasks(
        db, user_id=current_user.id, hemisphere=hemisphere,
    )
