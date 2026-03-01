"""AI chat schemas."""

from datetime import datetime
from uuid import UUID

from app.schemas.common import BaseResponse, CamelBase


class ChatMessage(CamelBase):
    """A single message in a chat conversation."""

    role: str  # "user" | "assistant" | "tool_call" | "tool_result"
    content: str
    name: str | None = None  # Tool name (tool_call/tool_result)
    arguments: dict | None = None  # Tool arguments (tool_call only)
    tool_call_id: str | None = None  # Correlation ID


class ChatRequest(CamelBase):
    """Request to send a message to the AI assistant."""

    messages: list[ChatMessage]
    hive_id: UUID | None = None
    conversation_id: UUID | None = None


class ChatResponse(BaseResponse):
    """Non-streaming chat response."""

    message: ChatMessage
    conversation_id: UUID


class ConversationResponse(BaseResponse):
    """Summary of a conversation."""

    id: UUID
    title: str | None
    hive_id: UUID | None
    created_at: datetime
    updated_at: datetime


class ConversationDetailResponse(ConversationResponse):
    """Full conversation with message history."""

    messages: list[ChatMessage]
