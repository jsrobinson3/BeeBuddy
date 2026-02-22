"""Treatment schemas."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TreatmentCreate(BaseModel):
    """Request model for creating a treatment record."""

    hive_id: UUID
    treatment_type: str
    product_name: str | None = None
    method: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    dosage: str | None = None
    effectiveness_notes: str | None = None
    follow_up_date: date | None = None


class TreatmentUpdate(BaseModel):
    """Request model for updating a treatment record. All fields optional."""

    hive_id: UUID | None = None
    treatment_type: str | None = None
    product_name: str | None = None
    method: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    dosage: str | None = None
    effectiveness_notes: str | None = None
    follow_up_date: date | None = None


class TreatmentResponse(BaseModel):
    """Response model for a treatment record."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hive_id: UUID
    treatment_type: str
    product_name: str | None = None
    method: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    dosage: str | None = None
    effectiveness_notes: str | None = None
    follow_up_date: date | None = None
    created_at: datetime
