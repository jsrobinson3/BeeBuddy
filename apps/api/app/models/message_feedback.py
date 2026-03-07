"""Message feedback model for AI chat response ratings."""

import uuid

from sqlalchemy import ForeignKey, Integer, SmallInteger, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class MessageFeedback(Base):
    """Stores thumbs up/down feedback on individual AI assistant messages."""

    __tablename__ = "message_feedback"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_index: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        comment="1 = thumbs up, -1 = thumbs down",
    )
    correction: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_version: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "conversation_id", "message_index", name="uq_feedback_conv_msg"
        ),
    )
