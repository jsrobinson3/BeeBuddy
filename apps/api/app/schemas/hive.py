"""Hive schemas."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HiveType(StrEnum):
    """Types of beehives."""

    LANGSTROTH = "langstroth"
    TOP_BAR = "top_bar"
    WARRE = "warre"
    FLOW = "flow"
    OTHER = "other"


class HiveStatus(StrEnum):
    """Hive status options."""

    ACTIVE = "active"
    DEAD = "dead"
    COMBINED = "combined"
    SOLD = "sold"


class HiveSource(StrEnum):
    """How the hive was acquired."""

    PACKAGE = "package"
    NUC = "nuc"
    SWARM = "swarm"
    SPLIT = "split"
    PURCHASED = "purchased"


class HiveCreate(BaseModel):
    """Request model for creating a hive."""

    apiary_id: UUID
    name: str
    hive_type: HiveType = HiveType.LANGSTROTH
    source: HiveSource | None = None
    installation_date: datetime | None = None
    color: str | None = None
    order: int | None = None
    notes: str | None = None


class HiveUpdate(BaseModel):
    """Request model for updating a hive. All fields optional."""

    apiary_id: UUID | None = None
    name: str | None = None
    hive_type: HiveType | None = None
    status: HiveStatus | None = None
    source: HiveSource | None = None
    installation_date: datetime | None = None
    color: str | None = None
    order: int | None = None
    notes: str | None = None


class HiveResponse(BaseModel):
    """Response model for a hive."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    apiary_id: UUID
    name: str
    hive_type: HiveType
    status: HiveStatus
    source: HiveSource | None = None
    installation_date: datetime | None = None
    color: str | None = None
    order: int | None = None
    notes: str | None = None
    created_at: datetime
