"""Hive event management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.event import EventCreate, EventResponse, EventUpdate
from app.services import event_service

router = APIRouter(prefix="/events")


@router.get("", response_model=list[EventResponse])
async def list_events(
    hive_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List events, optionally filtered by hive."""
    return await event_service.get_events(
        db, user_id=current_user.id, hive_id=hive_id, limit=limit, offset=offset
    )


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new hive event."""
    return await event_service.create_event(db, data.model_dump())


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific event by ID."""
    event = await event_service.get_event(
        db, event_id, user_id=current_user.id
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    data: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing event."""
    event = await event_service.get_event(
        db, event_id, user_id=current_user.id
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return await event_service.update_event(db, event, data.model_dump(exclude_unset=True))


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an event."""
    event = await event_service.get_event(
        db, event_id, user_id=current_user.id
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await event_service.delete_event(db, event)
