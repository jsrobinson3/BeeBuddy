"""Harvest model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Harvest(Base):
    __tablename__ = "harvests"

    hive_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hives.id", ondelete="CASCADE"), nullable=False, index=True
    )
    harvested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    moisture_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    honey_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    flavor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    frames_harvested: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    hive: Mapped["Hive"] = relationship("Hive", back_populates="harvests")
