"""Task model."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TaskSource(enum.StrEnum):
    MANUAL = "manual"
    AI_RECOMMENDED = "ai_recommended"
    SYSTEM = "system"


class TaskPriority(enum.StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    hive_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hives.id", ondelete="CASCADE"), nullable=True, index=True
    )
    apiary_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("apiaries.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[TaskSource] = mapped_column(
        SAEnum(TaskSource, name="task_source"),
        default=TaskSource.MANUAL,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="task_priority"),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="tasks")
    hive: Mapped["Hive | None"] = relationship("Hive", back_populates="tasks")
    apiary: Mapped["Apiary | None"] = relationship("Apiary", back_populates="tasks")
