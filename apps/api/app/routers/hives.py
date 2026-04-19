"""Hive management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import (
    Permission,
    check_apiary_permission,
    check_hive_permission,
    require_permission,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.hive import HiveCreate, HiveResponse, HiveUpdate
from app.services import cadence_service, hive_service

router = APIRouter(prefix="/hives")


@router.get("", response_model=list[HiveResponse])
async def list_hives(
    apiary_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List hives, optionally filtered by apiary."""
    return await hive_service.get_hives(
        db, user_id=current_user.id, apiary_id=apiary_id, limit=limit, offset=offset
    )


@router.post("", response_model=HiveResponse, status_code=201)
async def create_hive(
    data: HiveCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new hive. Requires editor+ on the parent apiary."""
    perm = await check_apiary_permission(db, data.apiary_id, current_user.id)
    require_permission(perm, Permission.EDITOR, "Apiary not found")
    hive = await hive_service.create_hive(db, data.model_dump())
    hemisphere = await cadence_service.resolve_hemisphere(db, current_user)

    # Auto-initialize user-level cadences on first hive creation
    existing_cadences = await cadence_service.get_cadences(db, user_id=current_user.id)
    if not existing_cadences:
        await cadence_service.initialize_cadences(
            db, user_id=current_user.id, hemisphere=hemisphere,
        )

    # Always initialize hive-scoped cadences for the new hive
    await cadence_service.initialize_hive_cadences(
        db, user_id=current_user.id, hive_id=hive.id, hemisphere=hemisphere,
    )

    # Generate tasks for any cadences that are now due
    await cadence_service.generate_due_tasks(
        db, user_id=current_user.id, hemisphere=hemisphere,
    )

    return hive


@router.get("/{hive_id}", response_model=HiveResponse)
async def get_hive(
    hive_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific hive by ID."""
    hive = await hive_service.get_hive(db, hive_id, user_id=current_user.id)
    if not hive:
        raise HTTPException(status_code=404, detail="Hive not found")
    return hive


@router.patch("/{hive_id}", response_model=HiveResponse)
async def update_hive(
    hive_id: UUID,
    data: HiveUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing hive. Requires editor+."""
    perm = await check_hive_permission(db, hive_id, current_user.id)
    require_permission(perm, Permission.EDITOR, "Hive not found")
    hive = await hive_service.get_hive(db, hive_id, user_id=current_user.id)
    return await hive_service.update_hive(db, hive, data.model_dump(exclude_unset=True))


@router.delete("/{hive_id}", status_code=204)
async def delete_hive(
    hive_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a hive. Owner only."""
    perm = await check_hive_permission(db, hive_id, current_user.id)
    require_permission(perm, Permission.OWNER, "Hive not found")
    hive = await hive_service.get_hive(db, hive_id, user_id=current_user.id)
    await hive_service.delete_hive(db, hive)


@router.get("/{hive_id}/timeline")
async def get_hive_timeline(
    hive_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the timeline of events for a hive."""
    hive = await hive_service.get_hive(db, hive_id, user_id=current_user.id)
    if not hive:
        raise HTTPException(status_code=404, detail="Hive not found")
    # TODO: Aggregate inspections, treatments, events
    return {"hive_id": hive_id, "events": []}
