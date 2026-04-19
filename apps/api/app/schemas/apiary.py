"""Apiary schemas."""

from datetime import datetime
from uuid import UUID

from app.schemas.common import BaseResponse, CamelBase


class ApiaryCreate(CamelBase):
    """Request model for creating an apiary."""

    name: str
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country_code: str | None = None
    hex_color: str | None = None
    notes: str | None = None


class ApiaryUpdate(CamelBase):
    """Request model for updating an apiary. All fields optional."""

    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    city: str | None = None
    country_code: str | None = None
    hex_color: str | None = None
    notes: str | None = None


class ApiaryResponse(BaseResponse):
    """Response model for an apiary."""

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
    my_role: str | None = None
    share_count: int = 0
    shared_by: str | None = None
