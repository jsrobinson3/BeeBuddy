"""Harvest management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.harvest import HarvestCreate, HarvestResponse, HarvestUpdate
from app.services import harvest_service

router = APIRouter(prefix="/harvests")


@router.get("", response_model=list[HarvestResponse])
async def list_harvests(
    hive_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List harvests, optionally filtered by hive."""
    return await harvest_service.get_harvests(
        db, user_id=current_user.id, hive_id=hive_id, limit=limit, offset=offset
    )


@router.post("", response_model=HarvestResponse, status_code=201)
async def create_harvest(
    data: HarvestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new harvest record."""
    return await harvest_service.create_harvest(db, data.model_dump())


@router.get("/{harvest_id}", response_model=HarvestResponse)
async def get_harvest(
    harvest_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific harvest by ID."""
    harvest = await harvest_service.get_harvest(
        db, harvest_id, user_id=current_user.id
    )
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")
    return harvest


@router.patch("/{harvest_id}", response_model=HarvestResponse)
async def update_harvest(
    harvest_id: UUID,
    data: HarvestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing harvest."""
    harvest = await harvest_service.get_harvest(
        db, harvest_id, user_id=current_user.id
    )
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")
    return await harvest_service.update_harvest(db, harvest, data.model_dump(exclude_unset=True))


@router.delete("/{harvest_id}", status_code=204)
async def delete_harvest(
    harvest_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a harvest."""
    harvest = await harvest_service.get_harvest(
        db, harvest_id, user_id=current_user.id
    )
    if not harvest:
        raise HTTPException(status_code=404, detail="Harvest not found")
    await harvest_service.delete_harvest(db, harvest)
