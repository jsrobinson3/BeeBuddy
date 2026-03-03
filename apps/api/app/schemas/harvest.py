"""Harvest schemas."""

from datetime import datetime
from uuid import UUID

from app.schemas.common import BaseResponse, CamelBase


class HarvestCreate(CamelBase):
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


class HarvestUpdate(CamelBase):
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


class HarvestResponse(BaseResponse):
    """Response model for a harvest record."""

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
