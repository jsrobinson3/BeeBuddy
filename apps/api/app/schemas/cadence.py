"""Cadence schemas for request/response validation."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CadenceTemplateResponse(BaseModel):
    """A single cadence template from the catalog (read-only)."""

    key: str
    title: str
    description: str
    category: str
    season: str
    priority: str
    interval_days: int | None = None
    season_month: int | None = None
    season_day: int = 1


class CadenceResponse(BaseModel):
    """Response model for a user's cadence subscription."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    cadence_key: str
    is_active: bool
    last_generated_at: datetime | None = None
    next_due_date: date | None = None
    created_at: datetime


class CadenceUpdate(BaseModel):
    """Request model for toggling or updating a cadence."""

    is_active: bool | None = None
