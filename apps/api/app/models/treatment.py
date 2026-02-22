"""Treatment model."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Treatment(Base):
    __tablename__ = "treatments"

    hive_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hives.id", ondelete="CASCADE"), nullable=False, index=True
    )
    treatment_type: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    ended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    effectiveness_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    hive: Mapped["Hive"] = relationship("Hive", back_populates="treatments")
