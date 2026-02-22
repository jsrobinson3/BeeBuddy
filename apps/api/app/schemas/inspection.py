"""Inspection schemas."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ExperienceLevel(StrEnum):
    """Inspection template experience levels."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class InspectionObservations(BaseModel):
    """Flexible observation data captured during inspection."""

    # Population
    population_estimate: str | None = None  # weak/moderate/strong
    frames_of_bees: int | None = None
    temperament: str | None = None  # calm/nervous/aggressive

    # Queen status
    queen_seen: bool | None = None
    eggs_seen: bool | None = None
    larvae_seen: bool | None = None
    capped_brood: bool | None = None
    brood_pattern_score: int | None = None  # 1-5

    # Stores
    honey_stores: str | None = None  # low/adequate/abundant
    pollen_stores: str | None = None  # low/adequate/abundant

    # Health
    disease_signs: list[str] | None = None
    pest_signs: list[str] | None = None
    varroa_count: int | None = None

    # Equipment
    num_supers: int | None = None
    frames_of_brood: int | None = None


class WeatherSnapshot(BaseModel):
    """Weather conditions during inspection."""

    temp_c: float | None = None
    humidity_percent: float | None = None
    wind_speed_kmh: float | None = None
    conditions: str | None = None  # sunny/cloudy/overcast/rainy


class InspectionCreate(BaseModel):
    """Request model for creating an inspection."""

    hive_id: UUID
    inspected_at: datetime | None = None
    duration_minutes: int | None = None
    experience_template: ExperienceLevel = ExperienceLevel.BEGINNER
    observations: InspectionObservations | None = None
    weather: WeatherSnapshot | None = None
    impression: int | None = None
    attention: bool | None = None
    reminder: str | None = None
    reminder_date: datetime | None = None
    notes: str | None = None


class InspectionUpdate(BaseModel):
    """Request model for updating an inspection. All fields optional."""

    hive_id: UUID | None = None
    inspected_at: datetime | None = None
    duration_minutes: int | None = None
    experience_template: ExperienceLevel | None = None
    observations: InspectionObservations | None = None
    weather: WeatherSnapshot | None = None
    impression: int | None = None
    attention: bool | None = None
    reminder: str | None = None
    reminder_date: datetime | None = None
    notes: str | None = None


class InspectionResponse(BaseModel):
    """Response model for an inspection."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hive_id: UUID
    inspected_at: datetime
    duration_minutes: int | None = None
    experience_template: ExperienceLevel
    observations: InspectionObservations | None = None
    weather: WeatherSnapshot | None = None
    impression: int | None = None
    attention: bool | None = None
    reminder: str | None = None
    reminder_date: datetime | None = None
    notes: str | None = None
    ai_summary: str | None = None
    created_at: datetime
    photos: list["PhotoResponse"] = []


from app.schemas.photo import PhotoResponse  # noqa: E402

InspectionResponse.model_rebuild()
