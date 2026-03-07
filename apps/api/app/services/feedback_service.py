"""Service layer for AI message feedback."""

import logging
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.ai_conversation import AIConversation
from app.models.message_feedback import MessageFeedback

logger = logging.getLogger(__name__)


async def _get_owned_conversation(
    db: AsyncSession, conversation_id: UUID, user_id: UUID,
) -> AIConversation | None:
    """Fetch a conversation owned by the user."""
    result = await db.execute(
        select(AIConversation).where(
            AIConversation.id == conversation_id,
            AIConversation.user_id == user_id,
            AIConversation.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _validate_assistant_message(
    db: AsyncSession, conversation_id: UUID, user_id: UUID, message_index: int,
) -> AIConversation | None:
    """Validate conversation ownership and that message_index is an assistant msg."""
    conv = await _get_owned_conversation(db, conversation_id, user_id)
    if conv is None:
        return None
    messages = conv.messages or []
    if message_index < 0 or message_index >= len(messages):
        return None
    if messages[message_index].get("role") != "assistant":
        return None
    return conv


async def upsert_feedback(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID,
    message_index: int,
    rating: int,
    correction: str | None = None,
) -> MessageFeedback | None:
    """Create or update feedback on a specific assistant message.

    Returns None if validation fails (bad conversation, index, or role).
    """
    conv = await _validate_assistant_message(db, conversation_id, user_id, message_index)
    if conv is None:
        return None

    result = await db.execute(
        select(MessageFeedback).where(
            MessageFeedback.conversation_id == conversation_id,
            MessageFeedback.message_index == message_index,
        )
    )
    existing = result.scalar_one_or_none()
    model_version = get_settings().llm_model

    if existing:
        existing.rating = rating
        existing.correction = correction
        existing.model_version = model_version
    else:
        existing = MessageFeedback(
            conversation_id=conversation_id,
            user_id=user_id,
            message_index=message_index,
            rating=rating,
            correction=correction,
            model_version=model_version,
        )
        db.add(existing)

    await db.commit()
    await db.refresh(existing)
    return existing


async def get_conversation_feedback(
    db: AsyncSession, user_id: UUID, conversation_id: UUID,
) -> list[MessageFeedback]:
    """Return all feedback for a conversation owned by the user."""
    conv = await _get_owned_conversation(db, conversation_id, user_id)
    if conv is None:
        return []

    result = await db.execute(
        select(MessageFeedback)
        .where(MessageFeedback.conversation_id == conversation_id)
        .order_by(MessageFeedback.message_index)
    )
    return list(result.scalars().all())


async def delete_feedback(
    db: AsyncSession, user_id: UUID, conversation_id: UUID, message_index: int,
) -> bool:
    """Delete feedback for a specific message. Returns True if deleted."""
    conv = await _get_owned_conversation(db, conversation_id, user_id)
    if conv is None:
        return False

    result = await db.execute(
        delete(MessageFeedback).where(
            MessageFeedback.conversation_id == conversation_id,
            MessageFeedback.message_index == message_index,
        )
    )
    await db.commit()
    return result.rowcount > 0
