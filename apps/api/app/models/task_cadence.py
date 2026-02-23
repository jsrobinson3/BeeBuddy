"""TaskCadence model — tracks which cadence templates are active for a user."""

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class TaskCadence(Base):
    __tablename__ = "task_cadences"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    cadence_key: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )
    last_generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_due_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )

    # User overrides — when set, these take precedence over catalog defaults
    custom_interval_days: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    custom_season_month: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    custom_season_day: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="cadences")
