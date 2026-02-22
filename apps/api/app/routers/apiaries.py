"""Apiary management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.apiary import ApiaryCreate, ApiaryResponse, ApiaryUpdate
from app.services import apiary_service

router = APIRouter(prefix="/apiaries")


@router.get("", response_model=list[ApiaryResponse])
async def list_apiaries(
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all apiaries for the current user."""
    return await apiary_service.get_apiaries(
        db, user_id=current_user.id, limit=limit, offset=offset
    )


@router.post("", response_model=ApiaryResponse, status_code=201)
async def create_apiary(
    data: ApiaryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new apiary."""
    return await apiary_service.create_apiary(db, data.model_dump(), user_id=current_user.id)


@router.get("/{apiary_id}", response_model=ApiaryResponse)
async def get_apiary(
    apiary_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific apiary by ID."""
    apiary = await apiary_service.get_apiary(db, apiary_id)
    if not apiary or apiary.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Apiary not found")
    return apiary


@router.patch("/{apiary_id}", response_model=ApiaryResponse)
async def update_apiary(
    apiary_id: UUID,
    data: ApiaryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing apiary."""
    apiary = await apiary_service.get_apiary(db, apiary_id)
    if not apiary or apiary.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Apiary not found")
    return await apiary_service.update_apiary(db, apiary, data.model_dump(exclude_unset=True))


@router.delete("/{apiary_id}", status_code=204)
async def delete_apiary(
    apiary_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an apiary."""
    apiary = await apiary_service.get_apiary(db, apiary_id)
    if not apiary or apiary.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Apiary not found")
    await apiary_service.delete_apiary(db, apiary)
