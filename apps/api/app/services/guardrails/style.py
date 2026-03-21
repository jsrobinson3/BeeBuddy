"""Style guard — checks response verbosity, filler, and structure.

All functions are pure (no side effects) except `condense_response`
which makes an optional LLM call gated behind config.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.services.guardrails.patterns import (
    FILLER_ALWAYS,
    FILLER_CONTEXTUAL,
    HOW_TO_PATTERNS,
    YES_NO_STARTERS,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Question-type classification
# ---------------------------------------------------------------------------

def classify_question_type(message: str) -> str:
    """Classify a user message as yes_no, how_to, or explain.

    Returns one of: ``"yes_no"`` | ``"how_to"`` | ``"explain"``
    """
    stripped = message.strip()
    if not stripped:
        return "explain"

    first_word = stripped.split()[0].lower().rstrip("?")

    for pattern in HOW_TO_PATTERNS:
        if pattern.search(stripped):
            return "how_to"

    if first_word in YES_NO_STARTERS:
        return "yes_no"

    return "explain"


# ---------------------------------------------------------------------------
# Style check result
# ---------------------------------------------------------------------------

@dataclass
class StyleResult:
    """Result of a style check on a response."""

    passed: bool = True
    word_count: int = 0
    target_words: int = 0
    over_limit: bool = False
    filler_count: int = 0
    filler_flagged: bool = False
    fillers_found: list[str] = field(default_factory=list)
    needs_structure: bool = False
    question_type: str = "explain"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_DEFAULT_LIMITS = {"yes_no": 30, "how_to": 150, "explain": 250}


def _detect_fillers(
    response_lower: str, over_limit: bool,
) -> list[str]:
    """Find filler phrases using tiered detection."""
    found: list[str] = []

    # Always-filler: counted unconditionally
    for phrase in FILLER_ALWAYS:
        if phrase in response_lower:
            found.append(phrase)

    # Contextual filler: only counted when over word limit
    if over_limit:
        for phrase in FILLER_CONTEXTUAL:
            if phrase in response_lower:
                found.append(phrase)

    return found


def _needs_structure(response: str, word_count: int) -> bool:
    """Check if a long response lacks bullets or line breaks."""
    if word_count <= 80:
        return False
    has_bullets = any(
        line.strip().startswith(("-", "*", "•", "1.", "2."))
        for line in response.split("\n")
    )
    has_breaks = response.count("\n") >= 2
    return not has_bullets and not has_breaks


# ---------------------------------------------------------------------------
# Style checker
# ---------------------------------------------------------------------------

def check_style(
    response: str,
    user_message: str,
    limits: dict[str, int] | None = None,
    filler_threshold: int = 2,
) -> StyleResult:
    """Check a response for verbosity, filler, and structure.

    Args:
        response: The LLM response text.
        user_message: The original user message.
        limits: Word-count targets per question type.
        filler_threshold: Flag if total filler count exceeds this.
    """
    limits = limits or _DEFAULT_LIMITS
    q_type = classify_question_type(user_message)
    target = limits.get(q_type, 250)
    word_count = len(response.split())
    over_limit = word_count > target

    fillers_found = _detect_fillers(response.lower(), over_limit)
    filler_flagged = len(fillers_found) > filler_threshold
    structure_needed = _needs_structure(response, word_count)

    return StyleResult(
        passed=not over_limit and not filler_flagged and not structure_needed,
        word_count=word_count,
        target_words=target,
        over_limit=over_limit,
        filler_count=len(fillers_found),
        filler_flagged=filler_flagged,
        fillers_found=fillers_found,
        needs_structure=structure_needed,
        question_type=q_type,
    )
