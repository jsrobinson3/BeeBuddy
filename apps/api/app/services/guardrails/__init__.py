"""Guardrails pipeline — orchestrates style and topic guards.

Usage::

    from app.services.guardrails import guardrail_pipeline

    # Input check (sync, <5ms)
    input_result = guardrail_pipeline.check_input(message)
    if not input_result.allowed:
        return input_result.canned_response

    # Output check (after tool path or streaming)
    output_result = await guardrail_pipeline.check_output(response, message)

    # Audit (post-stream, log-only)
    guardrail_pipeline.audit(response, message, user_id)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from uuid import UUID

from app.config import get_settings
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
    flags: list[str] = field(default_factory=list)


@dataclass
class AuditResult:
    """Post-stream audit result (always log-only)."""

    style: StyleResult | None = None
    relevance: OutputRelevanceResult | None = None
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
        """Run output guards (style + topic). Async for future LLM rewrite."""
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

        if result.flags:
            logger.info("Output guard flags: %s", result.flags)

        return result

    def audit(
        self,
        response: str,
        user_message: str,
        user_id: UUID | str,
    ) -> AuditResult:
        """Post-stream audit (always log-only, can't modify)."""
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

        if result.flags:
            logger.info(
                "Audit guard [user=%s]: %s", user_id, result.flags,
            )

        return result


# Module-level singleton
guardrail_pipeline = GuardrailPipeline()
