"""Guardrail audit log — persists every guardrail decision for monitoring."""

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class GuardrailLog(Base):
    """One row per guardrail check (input, output, or audit)."""

    __tablename__ = "guardrail_logs"
    __table_args__ = (
        Index("ix_guardrail_logs_user_created", "user_id", "created_at"),
        Index("ix_guardrail_logs_guard_result", "guard_name", "result"),
    )

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="SET NULL"),
        nullable=True,
    )
    guard_name: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True,
    )
    phase: Mapped[str] = mapped_column(
        String(20), nullable=False,
    )  # "input" | "output" | "audit"
    result: Mapped[str] = mapped_column(
        String(20), nullable=False,
    )  # "pass" | "flag" | "block"
    reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    flags_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    user_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_snippet: Mapped[str | None] = mapped_column(
        Text, nullable=True,
    )  # First 500 chars of response
    message_index: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0",
    )
