"""Topic guard — input classification, injection/PII detection, drift check.

All functions are pure (no side effects, no I/O).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.services.guardrails.patterns import (
    CONVERSATIONAL_PATTERNS,
    DOMAIN_KEYWORDS,
    INJECTION_PATTERNS,
    PII_PATTERNS,
    RESPONSE_OFF_TOPIC,
    RESPONSE_PII_DETECTED,
    normalize_for_injection_check,
)

logger = logging.getLogger(__name__)

# Pre-compute multi-word domain terms for substring matching
_MULTI_WORD_TERMS = frozenset(
    kw for kw in DOMAIN_KEYWORDS if " " in kw
)


# ---------------------------------------------------------------------------
# Input classification
# ---------------------------------------------------------------------------

@dataclass
class InputClassification:
    """Result of classifying a user input message."""

    allowed: bool = True
    reason: str = ""
    canned_response: str = ""
    is_injection: bool = False
    is_pii: bool = False
    is_off_topic: bool = False
    is_conversational: bool = False
    intent: str = "knowledge"


def _check_pii(text: str) -> bool:
    """Return True if text contains PII patterns."""
    return any(p.search(text) for p in PII_PATTERNS)


def _check_injection(text: str) -> bool:
    """Return True if text matches prompt injection patterns.

    Checks both raw text and a normalized form (leetspeak/homoglyph stripped)
    to catch evasion attempts.
    """
    if any(p.search(text) for p in INJECTION_PATTERNS):
        return True
    normalized = normalize_for_injection_check(text)
    if normalized != text.lower():
        return any(p.search(normalized) for p in INJECTION_PATTERNS)
    return False


def _has_domain_keyword(text: str) -> bool:
    """Return True if text contains any beekeeping domain keyword."""
    text_lower = text.lower()
    words = set(re.findall(r"[a-z0-9'-]+", text_lower))
    if words & DOMAIN_KEYWORDS:
        return True
    return any(term in text_lower for term in _MULTI_WORD_TERMS)


def classify_input(message: str) -> InputClassification:
    """Classify a user message for safety and relevance.

    Priority: PII → injection → short-pass → conversational → topic.
    Short messages (<5 words) always pass (likely follow-ups).
    """
    result = InputClassification()
    stripped = message.strip()

    if not stripped:
        result.allowed = False
        result.reason = "empty_message"
        result.canned_response = RESPONSE_OFF_TOPIC
        return result

    # 1. PII — always block
    if _check_pii(stripped):
        result.allowed = False
        result.is_pii = True
        result.reason = "pii_detected"
        result.canned_response = RESPONSE_PII_DETECTED
        return result

    # 2. Injection — block with generic message (don't reveal)
    if _check_injection(stripped):
        result.allowed = False
        result.is_injection = True
        result.reason = "injection_detected"
        result.canned_response = RESPONSE_OFF_TOPIC
        return result

    # 3. Short messages pass (follow-ups: "and then?", "why?")
    if len(stripped.split()) < 5:
        result.intent = classify_question_intent(stripped)
        return result

    # 4. Conversational — always allowed
    if _is_conversational(stripped):
        result.is_conversational = True
        result.intent = "conversational"
        return result

    # 5. Topic relevance
    if not _has_domain_keyword(stripped):
        result.allowed = False
        result.is_off_topic = True
        result.reason = "off_topic"
        result.canned_response = RESPONSE_OFF_TOPIC
        return result

    result.intent = classify_question_intent(stripped)
    return result


def _is_conversational(text: str) -> bool:
    """Return True if text matches a conversational pattern."""
    return any(p.search(text) for p in CONVERSATIONAL_PATTERNS)


# ---------------------------------------------------------------------------
# Question intent classification
# ---------------------------------------------------------------------------

_DATA_PATTERNS = [
    re.compile(r"\bmy\s+(hive|apiary|queen|inspection|harvest|task)", re.I),
    re.compile(r"\bhow\s+many\b.*\b(do|did)\s+i\b", re.I),
    re.compile(r"\bwhen\s+(was|did)\s+(my|i)\b", re.I),
    re.compile(r"\bshow\s+me\s+my\b", re.I),
    re.compile(r"\blist\s+my\b", re.I),
    re.compile(r"\bi\s+have\b", re.I),
]

_OPINION_PATTERNS = [
    re.compile(r"\bbest\s+(type|kind|brand|way)\b", re.I),
    re.compile(r"\bwhat\s+do\s+you\s+(think|recommend|suggest)\b", re.I),
    re.compile(r"\bshould\s+i\b", re.I),
    re.compile(r"\bwhat('?s|\s+is)\s+your\s+(opinion|take|view)\b", re.I),
    re.compile(r"\bwhich\s+(is|are)\s+better\b", re.I),
]


def classify_question_intent(message: str) -> str:
    """Classify what kind of answer the question needs.

    Returns: ``"knowledge"`` | ``"data"`` | ``"conversational"``
    | ``"opinion"``
    """
    stripped = message.strip().lower()

    if _is_conversational(stripped):
        return "conversational"

    if any(p.search(stripped) for p in _DATA_PATTERNS):
        return "data"

    if any(p.search(stripped) for p in _OPINION_PATTERNS):
        return "opinion"

    return "knowledge"


# ---------------------------------------------------------------------------
# Output relevance check (log-only)
# ---------------------------------------------------------------------------

@dataclass
class OutputRelevanceResult:
    """Result of checking output relevance."""

    relevant: bool = True
    domain_keyword_count: int = 0
    flags: list[str] = field(default_factory=list)


def check_output_relevance(
    response: str,
    user_message: str,
) -> OutputRelevanceResult:
    """Check whether a response drifts off the beekeeping domain.

    This is a log-only check — it flags but never blocks.
    """
    result = OutputRelevanceResult()
    response_lower = response.lower()

    response_words = set(re.findall(r"[a-z0-9'-]+", response_lower))
    domain_matches = response_words & DOMAIN_KEYWORDS
    result.domain_keyword_count = len(domain_matches)

    word_count = len(response.split())
    if word_count > 50 and result.domain_keyword_count < 2:
        result.relevant = False
        result.flags.append(
            f"low_domain_density: {result.domain_keyword_count} "
            f"keywords in {word_count} words"
        )

    return result
