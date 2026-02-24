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
    scope: str = "user"


class CadenceResponse(BaseModel):
    """Response model for a user's cadence subscription."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    hive_id: UUID | None = None
    cadence_key: str
    is_active: bool
    last_generated_at: datetime | None = None
    next_due_date: date | None = None
    custom_interval_days: int | None = None
    custom_season_month: int | None = None
    custom_season_day: int | None = None
    created_at: datetime


class CadenceUpdate(BaseModel):
    """Request model for toggling or updating a cadence.

    Users can override scheduling by setting custom_interval_days (for recurring)
    or custom_season_month/custom_season_day (for seasonal).
    Set to null to revert to catalog defaults.
    """

    is_active: bool | None = None
    custom_interval_days: int | None = None
    custom_season_month: int | None = None
    custom_season_day: int | None = None
