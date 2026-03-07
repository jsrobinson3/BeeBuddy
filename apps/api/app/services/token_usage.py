"""AI token usage recording — best-effort analytics tracking."""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import LLMProvider
from app.models.ai_token_usage import AITokenUsage

logger = logging.getLogger(__name__)


async def record_token_usage(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID | None,
    *,
    provider: str,
    model: str,
    usage: dict,
    request_type: str,
    estimated: bool = False,
) -> None:
    """Record token usage for analytics. Best-effort — failures are logged."""
    if not usage or not usage.get("total_tokens"):
        return
    try:
        db.add(AITokenUsage(
            user_id=user_id,
            conversation_id=conversation_id,
            provider=provider,
            model=model,
            input_tokens=usage.get("input_tokens", 0),
            output_tokens=usage.get("output_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            request_type=request_type,
            estimated=estimated,
        ))
        await db.commit()
    except Exception:
        logger.exception("Failed to record token usage")
        await db.rollback()


async def record_chat_usage(
    db: AsyncSession,
    user_id: UUID,
    conversation_id: UUID | None,
    usage: dict,
    provider: LLMProvider,
    model: str,
    request_type: str,
) -> None:
    """Record token usage for a chat request (best-effort)."""
    await record_token_usage(
        db, user_id, conversation_id,
        provider=str(provider), model=model, usage=usage,
        request_type=request_type,
        estimated=False,
    )
