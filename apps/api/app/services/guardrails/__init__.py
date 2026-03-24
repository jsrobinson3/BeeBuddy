"""Guardrails pipeline — orchestrates style, topic, safety, and audit guards.

Usage::

    from app.services.guardrails import guardrail_pipeline

    # Input check (sync, <5ms)
    input_result = guardrail_pipeline.check_input(message)
    if not input_result.allowed:
        return input_result.canned_response

    # Output check (after tool path or streaming)
    output_result = await guardrail_pipeline.check_output(response, message)

    # Audit (post-stream, persists to DB)
    await guardrail_pipeline.audit(db, response, message, user_id)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.services.guardrails.audit import build_flags_json, log_guardrail
from app.services.guardrails.safety import SafetyResult, check_safety
from app.services.guardrails.style import StyleResult, check_style
from app.services.guardrails.topic import (
    InputClassification,
    OutputRelevanceResult,
    check_output_relevance,
    classify_input,
)

logger = logging.getLogger(__name__)


@dataclass
class InputResult:
    """Combined result of input guards."""

    allowed: bool = True
    canned_response: str = ""
    classification: InputClassification | None = None


@dataclass
class OutputResult:
    """Combined result of output guards."""

    passed: bool = True
    style: StyleResult | None = None
    relevance: OutputRelevanceResult | None = None
    safety: SafetyResult | None = None
    flags: list[str] = field(default_factory=list)
    disclaimer: str = ""


@dataclass
class AuditResult:
    """Post-stream audit result (always log-only)."""

    style: StyleResult | None = None
    relevance: OutputRelevanceResult | None = None
    safety: SafetyResult | None = None
    flags: list[str] = field(default_factory=list)


def _style_flags(style: StyleResult) -> list[str]:
    """Extract flag strings from a failed StyleResult."""
    flags: list[str] = []
    if style.over_limit:
        flags.append(
            f"over_limit: {style.word_count}/{style.target_words}"
        )
    if style.filler_flagged:
        flags.append(f"filler: {style.fillers_found}")
    if style.needs_structure:
        flags.append("needs_structure")
    return flags


def _safety_flags(safety: SafetyResult) -> list[str]:
    """Extract flag strings from a failed SafetyResult."""
    return [
        f"safety_{f.category}: {f.substance} ({f.severity})"
        for f in safety.flags
    ]


def _should_append_disclaimer(safety: SafetyResult | None, settings) -> bool:
    """Return True if a safety disclaimer should be appended."""
    if safety is None or not safety.disclaimer_needed:
        return False
    return settings.guardrails_safety_append_disclaimer


def _get_word_limits() -> dict[str, int]:
    """Read word-limit settings into a dict."""
    settings = get_settings()
    return {
        "yes_no": settings.guardrails_max_words_yes_no,
        "how_to": settings.guardrails_max_words_how_to,
        "explain": settings.guardrails_max_words_explain,
    }


class GuardrailPipeline:
    """Orchestrates input, output, and audit guards."""

    def check_input(self, message: str) -> InputResult:
        """Run input guards (topic/safety). Sync, <5ms."""
        settings = get_settings()
        result = InputResult()

        if not settings.guardrails_enabled:
            return result
        if not settings.guardrails_topic_enabled:
            return result

        classification = classify_input(message)
        result.classification = classification

        if not classification.allowed:
            log_msg = (
                f"Input guard: {classification.reason} "
                f"(injection={classification.is_injection}, "
                f"pii={classification.is_pii}, "
                f"off_topic={classification.is_off_topic})"
            )
            if settings.guardrails_log_only:
                logger.info("LOG_ONLY %s", log_msg)
                result.allowed = True
            else:
                logger.warning("BLOCKED %s", log_msg)
                result.allowed = False
                result.canned_response = classification.canned_response
        else:
            logger.debug(
                "Input guard: allowed (intent=%s)",
                classification.intent,
            )

        return result

    async def check_output(
        self, response: str, user_message: str,
    ) -> OutputResult:
        """Run output guards (style + topic + safety)."""
        settings = get_settings()
        result = OutputResult()

        if not settings.guardrails_enabled:
            return result

        if settings.guardrails_style_enabled:
            limits = _get_word_limits()
            result.style = check_style(response, user_message, limits)
            if not result.style.passed:
                result.passed = False
                result.flags.extend(_style_flags(result.style))

        if settings.guardrails_topic_enabled:
            result.relevance = check_output_relevance(
                response, user_message,
            )
            if not result.relevance.relevant:
                result.flags.extend(result.relevance.flags)

        if settings.guardrails_safety_enabled:
            result.safety = check_safety(response)
            if not result.safety.passed:
                result.flags.extend(_safety_flags(result.safety))
            if _should_append_disclaimer(result.safety, settings):
                result.disclaimer = result.safety.disclaimer_text

        if result.flags:
            logger.info("Output guard flags: %s", result.flags)

        return result

    async def audit(
        self,
        db: AsyncSession | None,
        response: str,
        user_message: str,
        user_id: UUID | str,
        conversation_id: UUID | str | None = None,
    ) -> AuditResult:
        """Post-stream audit — logs and persists to DB."""
        settings = get_settings()
        result = AuditResult()

        if not settings.guardrails_enabled:
            return result

        if settings.guardrails_style_enabled:
            limits = _get_word_limits()
            result.style = check_style(response, user_message, limits)
            if not result.style.passed:
                result.flags.extend(_style_flags(result.style))

        if settings.guardrails_topic_enabled:
            result.relevance = check_output_relevance(
                response, user_message,
            )
            if not result.relevance.relevant:
                result.flags.extend(result.relevance.flags)

        if settings.guardrails_safety_enabled:
            result.safety = check_safety(response)
            if not result.safety.passed:
                result.flags.extend(_safety_flags(result.safety))

        if result.flags:
            logger.info(
                "Audit guard [user=%s]: %s", user_id, result.flags,
            )

        # Persist to DB
        await _maybe_persist_audit(
            db, settings, result, user_id, conversation_id,
            user_message, response,
        )

        return result


async def _maybe_persist_audit(
    db: AsyncSession | None,
    settings,
    result: AuditResult,
    user_id: UUID | str,
    conversation_id: UUID | str | None,
    user_message: str,
    response: str,
) -> None:
    """Persist audit to DB if enabled and there's something to log."""
    if not db or not settings.guardrails_audit_db_enabled:
        return
    if not result.flags and not settings.guardrails_audit_log_all:
        return
    await _persist_audit(
        db, result, user_id, conversation_id, user_message, response,
    )


async def _persist_audit(
    db: AsyncSession,
    result: AuditResult,
    user_id: UUID | str,
    conversation_id: UUID | str | None,
    user_message: str,
    response: str,
) -> None:
    """Write audit flags to the guardrail_logs table."""
    guard_names = set()
    if result.style and not result.style.passed:
        guard_names.add("style")
    if result.relevance and not result.relevance.relevant:
        guard_names.add("topic")
    if result.safety and not result.safety.passed:
        guard_names.add("safety")

    # One row per guard that flagged
    for name in guard_names or {"audit"}:
        await log_guardrail(
            db,
            guard_name=name,
            phase="audit",
            result="flag" if result.flags else "pass",
            user_id=user_id,
            conversation_id=conversation_id,
            reason="; ".join(result.flags[:3]),
            flags_json=build_flags_json(result.flags),
            user_message=user_message[:500],
            response_text=response,
        )


# Module-level singleton
guardrail_pipeline = GuardrailPipeline()
