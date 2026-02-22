"""Harvest schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HarvestCreate(BaseModel):
    """Request model for creating a harvest record."""

    hive_id: UUID
    harvested_at: datetime | None = None
    weight_kg: float | None = None
    moisture_percent: float | None = None
    honey_type: str | None = None
    flavor_notes: str | None = None
    color: str | None = None
    frames_harvested: int | None = None
    notes: str | None = None


class HarvestUpdate(BaseModel):
    """Request model for updating a harvest record. All fields optional."""

    hive_id: UUID | None = None
    harvested_at: datetime | None = None
    weight_kg: float | None = None
    moisture_percent: float | None = None
    honey_type: str | None = None
    flavor_notes: str | None = None
    color: str | None = None
    frames_harvested: int | None = None
    notes: str | None = None


class HarvestResponse(BaseModel):
    """Response model for a harvest record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hive_id: UUID
    harvested_at: datetime | None = None
    weight_kg: float | None = None
    moisture_percent: float | None = None
    honey_type: str | None = None
    flavor_notes: str | None = None
    color: str | None = None
    frames_harvested: int | None = None
    notes: str | None = None
    created_at: datetime
