"""Queen model."""

import enum
import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class QueenOrigin(enum.StrEnum):
    PURCHASED = "purchased"
    RAISED = "raised"
    SWARM = "swarm"


class QueenStatus(enum.StrEnum):
    PRESENT = "present"
    MISSING = "missing"
    SUPERSEDED = "superseded"
    FAILED = "failed"


class Queen(Base):
    __tablename__ = "queens"

    hive_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hives.id", ondelete="CASCADE"), nullable=False, index=True
    )
    marking_color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    marking_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    origin: Mapped[QueenOrigin | None] = mapped_column(
        SAEnum(QueenOrigin, name="queen_origin"), nullable=True
    )
    status: Mapped[QueenStatus] = mapped_column(
        SAEnum(QueenStatus, name="queen_status"),
        default=QueenStatus.PRESENT,
        nullable=False,
    )
    race: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fertilized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    clipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    introduced_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    replaced_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    hive: Mapped["Hive"] = relationship("Hive", back_populates="queen")
