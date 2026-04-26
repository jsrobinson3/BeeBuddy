"""Inspection schemas."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import field_validator

from app.schemas.common import BaseResponse, CamelBase

_VALID_BROOD_PATTERNS = frozenset({"excellent", "good", "spotty", "poor", "failing"})
_VALID_BROOD_SCORES = frozenset({1, 2, 3, 4, 5})


class ExperienceLevel(StrEnum):
    """Inspection template experience levels."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class InspectionObservations(CamelBase):
    """Flexible observation data captured during inspection."""

    # Population
    population_estimate: str | None = None  # weak/moderate/strong
    frames_of_bees: float | None = None
    temperament: str | None = None  # calm/nervous/aggressive

    # Queen status
    queen_seen: bool | None = None
    eggs_seen: bool | None = None
    larvae_seen: bool | None = None
    capped_brood: bool | None = None
    # Accepts new string values (excellent/good/spotty/poor/failing) or
    # legacy ints (1-5) from older clients.
    brood_pattern_score: str | int | None = None

    @field_validator("brood_pattern_score", mode="before")
    @classmethod
    def validate_brood_pattern(cls, v):  # noqa: N805
        if v is None:
            return v
        if isinstance(v, str) and v in _VALID_BROOD_PATTERNS:
            return v
        if isinstance(v, int) and v in _VALID_BROOD_SCORES:
            return v
        msg = f"Invalid brood_pattern_score: {v!r}"
        raise ValueError(msg)

    # Stores
    honey_stores: str | None = None  # low/adequate/abundant
    pollen_stores: str | None = None  # low/adequate/abundant

    # Health
    disease_signs: list[str] | None = None
    pest_signs: list[str] | None = None
    varroa_count: int | None = None

    # Equipment
    num_supers: int | None = None
    frames_of_brood: float | None = None


class WeatherSnapshot(CamelBase):
    """Weather conditions during inspection."""

    temp_c: float | None = None
    humidity_percent: float | None = None
    wind_speed_kmh: float | None = None
    # Multi-select tags: e.g. ["partly_cloudy", "windy"]. Legacy single-string
    # values are coerced to a one-element list for backward compatibility.
    conditions: list[str] | None = None

    @field_validator("conditions", mode="before")
    @classmethod
    def _coerce_conditions(cls, v):  # noqa: N805
        if v is None or v == "":
            return None
        if isinstance(v, str):
            return [v]
        return v


class InspectionCreate(CamelBase):
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


class InspectionUpdate(CamelBase):
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


class InspectionResponse(BaseResponse):
    """Response model for an inspection."""

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
