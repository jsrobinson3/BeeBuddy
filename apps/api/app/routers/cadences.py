"""Cadence management endpoints.

Users can:
- View the cadence template catalog.
- List their personal cadence subscriptions.
- Initialize all cadences (idempotent — safe to call multiple times).
- Toggle individual cadences on/off.
- Trigger task generation for cadences that are due.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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
        )
        for t in CADENCE_CATALOG
    ]


@router.get("", response_model=list[CadenceResponse])
async def list_cadences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's cadence subscriptions."""
    return await cadence_service.get_cadences(db, user_id=current_user.id)


@router.post("/initialize", response_model=list[CadenceResponse], status_code=201)
async def initialize_cadences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed all catalog cadences for the current user.

    Idempotent — existing cadences are not duplicated.
    """
    return await cadence_service.initialize_cadences(db, user_id=current_user.id)


@router.patch("/{cadence_id}", response_model=CadenceResponse)
async def update_cadence(
    cadence_id: UUID,
    data: CadenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a cadence (e.g. toggle active/inactive)."""
    cadence = await cadence_service.get_cadence(db, cadence_id, user_id=current_user.id)
    if not cadence:
        raise HTTPException(status_code=404, detail="Cadence not found")
    return await cadence_service.update_cadence(db, cadence, data.model_dump(exclude_unset=True))


@router.post("/generate", response_model=list[TaskResponse])
async def generate_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate tasks for all cadences that are currently due.

    This is also called automatically by the daily Celery beat job,
    but users can trigger it manually.
    """
    return await cadence_service.generate_due_tasks(db, user_id=current_user.id)
