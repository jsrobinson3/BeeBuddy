"""Hive event schemas."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EventType(StrEnum):
    """Types of hive events."""

    SWARM = "swarm"
    SPLIT = "split"
    COMBINE = "combine"
    REQUEEN = "requeen"
    FEED = "feed"
    WINTER_PREP = "winter_prep"


class EventCreate(BaseModel):
    """Request model for creating a hive event."""

    hive_id: UUID
    event_type: EventType
    occurred_at: datetime | None = None
    details: dict | None = None
    notes: str | None = None


class EventUpdate(BaseModel):
    """Request model for updating a hive event. All fields optional."""

    hive_id: UUID | None = None
    event_type: EventType | None = None
    occurred_at: datetime | None = None
    details: dict | None = None
    notes: str | None = None


class EventResponse(BaseModel):
    """Response model for a hive event."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hive_id: UUID
    event_type: EventType
    occurred_at: datetime | None = None
    details: dict | None = None
    notes: str | None = None
    created_at: datetime
