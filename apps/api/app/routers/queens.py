"""Queen management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.queen import QueenCreate, QueenResponse, QueenUpdate
from app.services import queen_service

router = APIRouter(prefix="/queens")


@router.get("", response_model=list[QueenResponse])
async def list_queens(
    hive_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List queens, optionally filtered by hive."""
    return await queen_service.get_queens(
        db, user_id=current_user.id, hive_id=hive_id, limit=limit, offset=offset
    )


@router.post("", response_model=QueenResponse, status_code=201)
async def create_queen(
    data: QueenCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new queen."""
    return await queen_service.create_queen(db, data.model_dump())


@router.get("/{queen_id}", response_model=QueenResponse)
async def get_queen(
    queen_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific queen by ID."""
    queen = await queen_service.get_queen(db, queen_id, user_id=current_user.id)
    if not queen:
        raise HTTPException(status_code=404, detail="Queen not found")
    return queen


@router.patch("/{queen_id}", response_model=QueenResponse)
async def update_queen(
    queen_id: UUID,
    data: QueenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing queen."""
    queen = await queen_service.get_queen(db, queen_id, user_id=current_user.id)
    if not queen:
        raise HTTPException(status_code=404, detail="Queen not found")
    return await queen_service.update_queen(db, queen, data.model_dump(exclude_unset=True))


@router.delete("/{queen_id}", status_code=204)
async def delete_queen(
    queen_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a queen."""
    queen = await queen_service.get_queen(db, queen_id, user_id=current_user.id)
    if not queen:
        raise HTTPException(status_code=404, detail="Queen not found")
    await queen_service.delete_queen(db, queen)
