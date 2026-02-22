"""Apiary schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApiaryCreate(BaseModel):
    """Request model for creating an apiary."""

    name: str
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country_code: str | None = None
    hex_color: str | None = None
    notes: str | None = None


class ApiaryUpdate(BaseModel):
    """Request model for updating an apiary. All fields optional."""

    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country_code: str | None = None
    hex_color: str | None = None
    notes: str | None = None


class ApiaryResponse(BaseModel):
    """Response model for an apiary."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country_code: str | None = None
    hex_color: str | None = None
    notes: str | None = None
    created_at: datetime
    hive_count: int = 0
