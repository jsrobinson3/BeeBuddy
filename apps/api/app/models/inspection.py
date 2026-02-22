"""Inspection model."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import ExperienceLevel


class Inspection(Base):
    __tablename__ = "inspections"

    hive_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hives.id", ondelete="CASCADE"), nullable=False, index=True
    )
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    experience_template: Mapped[ExperienceLevel] = mapped_column(
        SAEnum(ExperienceLevel, name="experience_level", create_constraint=False),
        default=ExperienceLevel.BEGINNER,
        nullable=False,
    )
    observations: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    weather: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    impression: Mapped[int | None] = mapped_column(Integer, nullable=True)
    attention: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    reminder: Mapped[str | None] = mapped_column(Text, nullable=True)
    reminder_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    hive: Mapped["Hive"] = relationship("Hive", back_populates="inspections")
    photos: Mapped[list["InspectionPhoto"]] = relationship(
        "InspectionPhoto", back_populates="inspection", cascade="all, delete-orphan"
    )
