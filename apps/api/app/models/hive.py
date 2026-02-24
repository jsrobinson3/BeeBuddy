"""Hive model."""

import enum
import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class HiveType(enum.StrEnum):
    LANGSTROTH = "langstroth"
    TOP_BAR = "top_bar"
    WARRE = "warre"
    FLOW = "flow"
    OTHER = "other"


class HiveStatus(enum.StrEnum):
    ACTIVE = "active"
    DEAD = "dead"
    COMBINED = "combined"
    SOLD = "sold"


class HiveSource(enum.StrEnum):
    PACKAGE = "package"
    NUC = "nuc"
    SWARM = "swarm"
    SPLIT = "split"
    PURCHASED = "purchased"


class Hive(Base):
    __tablename__ = "hives"

    apiary_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("apiaries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hive_type: Mapped[HiveType] = mapped_column(
        SAEnum(HiveType, name="hive_type"),
        default=HiveType.LANGSTROTH,
        nullable=False,
    )
    status: Mapped[HiveStatus] = mapped_column(
        SAEnum(HiveStatus, name="hive_status"),
        default=HiveStatus.ACTIVE,
        nullable=False,
    )
    source: Mapped[HiveSource | None] = mapped_column(
        SAEnum(HiveSource, name="hive_source"), nullable=True
    )
    installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    apiary: Mapped["Apiary"] = relationship("Apiary", back_populates="hives")
    queen: Mapped["Queen | None"] = relationship(
        "Queen", back_populates="hive", uselist=False, cascade="all, delete-orphan"
    )
    inspections: Mapped[list["Inspection"]] = relationship(
        "Inspection", back_populates="hive", cascade="all, delete-orphan"
    )
    treatments: Mapped[list["Treatment"]] = relationship(
        "Treatment", back_populates="hive", cascade="all, delete-orphan"
    )
    harvests: Mapped[list["Harvest"]] = relationship(
        "Harvest", back_populates="hive", cascade="all, delete-orphan"
    )
    events: Mapped[list["Event"]] = relationship(
        "Event", back_populates="hive", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="hive")
    cadences: Mapped[list["TaskCadence"]] = relationship(
        "TaskCadence", back_populates="hive", cascade="all, delete-orphan"
    )
