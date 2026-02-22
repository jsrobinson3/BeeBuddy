"""Treatment management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.treatment import TreatmentCreate, TreatmentResponse, TreatmentUpdate
from app.services import treatment_service

router = APIRouter(prefix="/treatments")


@router.get("", response_model=list[TreatmentResponse])
async def list_treatments(
    hive_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List treatments, optionally filtered by hive."""
    return await treatment_service.get_treatments(
        db, user_id=current_user.id, hive_id=hive_id, limit=limit, offset=offset
    )


@router.post("", response_model=TreatmentResponse, status_code=201)
async def create_treatment(
    data: TreatmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new treatment."""
    return await treatment_service.create_treatment(db, data.model_dump())


@router.get("/{treatment_id}", response_model=TreatmentResponse)
async def get_treatment(
    treatment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific treatment by ID."""
    treatment = await treatment_service.get_treatment(
        db, treatment_id, user_id=current_user.id
    )
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return treatment


@router.patch("/{treatment_id}", response_model=TreatmentResponse)
async def update_treatment(
    treatment_id: UUID,
    data: TreatmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing treatment."""
    treatment = await treatment_service.get_treatment(
        db, treatment_id, user_id=current_user.id
    )
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment not found")
    return await treatment_service.update_treatment(
        db, treatment, data.model_dump(exclude_unset=True)
    )


@router.delete("/{treatment_id}", status_code=204)
async def delete_treatment(
    treatment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a treatment."""
    treatment = await treatment_service.get_treatment(
        db, treatment_id, user_id=current_user.id
    )
    if not treatment:
        raise HTTPException(status_code=404, detail="Treatment not found")
    await treatment_service.delete_treatment(db, treatment)
