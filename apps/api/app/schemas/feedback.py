"""Schemas for AI message feedback."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseResponse, CamelBase


class FeedbackCreate(CamelBase):
    """Input for submitting or updating feedback on an assistant message."""

    rating: int = Field(..., ge=-1, le=1)
    correction: str | None = Field(None, max_length=4000)


class FeedbackResponse(BaseResponse):
    """Single feedback entry."""

    id: UUID
    conversation_id: UUID
    message_index: int
    rating: int
    correction: str | None
    model_version: str | None
    created_at: datetime


class ConversationFeedbackResponse(CamelBase):
    """All feedback entries for a conversation."""

    feedback: list[FeedbackResponse]
