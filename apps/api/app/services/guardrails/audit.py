"""Audit guard — persists guardrail decisions to the database.

Provides ``log_guardrail`` for writing structured records and
``build_flags_json`` for serialising guard results into JSONB.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.guardrail_log import GuardrailLog

logger = logging.getLogger(__name__)


def build_flags_json(flags: list[str], extra: dict | None = None) -> dict:
    """Build a JSONB-safe dict from flag strings and optional extras."""
    result: dict = {"flags": flags}
    if extra:
        result.update(extra)
    return result


async def log_guardrail(
    db: AsyncSession,
    *,
    guard_name: str,
    phase: str,
    result: str,
    user_id: UUID | str | None = None,
    conversation_id: UUID | str | None = None,
    reason: str | None = None,
    flags_json: dict | None = None,
    user_message: str | None = None,
    response_text: str | None = None,
    message_index: int = 0,
) -> GuardrailLog:
    """Persist a guardrail decision to the database.

    This is fire-and-forget safe — callers should not await the commit
    if they want to avoid blocking the response path.
    """
    snippet = response_text[:500] if response_text else None
    uid = UUID(str(user_id)) if user_id else None
    cid = UUID(str(conversation_id)) if conversation_id else None

    log = GuardrailLog(
        user_id=uid,
        conversation_id=cid,
        guard_name=guard_name,
        phase=phase,
        result=result,
        reason=reason,
        flags_json=flags_json,
        user_message=user_message,
        response_snippet=snippet,
        message_index=message_index,
    )
    db.add(log)
    try:
        await db.flush()
    except Exception:
        logger.exception("Failed to persist guardrail log")
    return log
