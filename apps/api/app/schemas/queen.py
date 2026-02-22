"""Queen schemas."""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class QueenOrigin(StrEnum):
    """How the queen was obtained."""

    PURCHASED = "purchased"
    RAISED = "raised"
    SWARM = "swarm"


class QueenStatus(StrEnum):
    """Current queen status."""

    PRESENT = "present"
    MISSING = "missing"
    SUPERSEDED = "superseded"
    FAILED = "failed"


class QueenCreate(BaseModel):
    """Request model for creating a queen record."""

    hive_id: UUID
    marking_color: str | None = None
    marking_year: int | None = None
    origin: QueenOrigin | None = None
    status: QueenStatus = QueenStatus.PRESENT
    race: str | None = None
    quality: int | None = None
    fertilized: bool = False
    clipped: bool = False
    birth_date: date | None = None
    introduced_date: date | None = None
    notes: str | None = None


class QueenUpdate(BaseModel):
    """Request model for updating a queen record. All fields optional."""

    hive_id: UUID | None = None
    marking_color: str | None = None
    marking_year: int | None = None
    origin: QueenOrigin | None = None
    status: QueenStatus | None = None
    race: str | None = None
    quality: int | None = None
    fertilized: bool | None = None
    clipped: bool | None = None
    birth_date: date | None = None
    introduced_date: date | None = None
    replaced_date: date | None = None
    notes: str | None = None


class QueenResponse(BaseModel):
    """Response model for a queen record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hive_id: UUID
    marking_color: str | None = None
    marking_year: int | None = None
    origin: QueenOrigin | None = None
    status: QueenStatus
    race: str | None = None
    quality: int | None = None
    fertilized: bool
    clipped: bool
    birth_date: date | None = None
    introduced_date: date | None = None
    replaced_date: date | None = None
    notes: str | None = None
    created_at: datetime
