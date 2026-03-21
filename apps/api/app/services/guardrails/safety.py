"""Safety guard — checks LLM output for harmful beekeeping advice.

Scans responses for:
- Banned/restricted substances recommended without warnings
- Specific dosage recommendations (should defer to product labels)
- Missing PPE warnings for chemical treatments
- Advice contradicting label compliance / withdrawal periods

All check functions are pure (no side effects, no I/O).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Substance lists
# ---------------------------------------------------------------------------

# Substances that should NEVER be recommended for hive use
BANNED_SUBSTANCES: dict[str, str] = {
    "chlorfenvinphos": "Banned organophosphate; toxic residues persist in wax",
    "dichlorvos": "Banned organophosphate (DDVP); highly toxic to bees and humans",
    "paradichlorobenzene": "Moth crystal fumigant; contaminates wax and honey",
    "naphthalene": "Moth ball chemical; contaminates hive products",
    "sevin": "Carbaryl; highly toxic to bees, never use in or near hives",
    "carbaryl": "Highly toxic to bees, never use in or near hives",
    "diazinon": "Banned organophosphate; toxic to bees",
    "chlorpyrifos": "Restricted organophosphate; toxic to bees",
    "fipronil": "Highly toxic to bees; linked to colony collapse",
    "imidacloprid": "Neonicotinoid; restricted in many jurisdictions for pollinator harm",
    "clothianidin": "Neonicotinoid; restricted for pollinator protection",
    "thiamethoxam": "Neonicotinoid; restricted for pollinator protection",
}

# Substances that require PPE warnings when discussed as treatments
REQUIRES_PPE: dict[str, str] = {
    "oxalic acid": "Corrosive; wear chemical-resistant gloves, safety goggles, and respirator",
    "formic acid": "Corrosive and volatile; wear respirator, goggles, and acid-resistant gloves",
    "thymol": "Skin and eye irritant; wear gloves and avoid skin contact",
    "amitraz": "Toxic if absorbed through skin; wear chemical-resistant gloves",
    "apivar": "Contains amitraz; wear gloves when handling strips",
    "apiguard": "Contains thymol; wear gloves when applying",
    "mite-away": "Contains formic acid; wear respirator and acid-resistant gloves",
    "hopguard": "Contains hop beta acids; wear gloves",
    "checkmite": "Contains coumaphos (organophosphate); wear chemical-resistant gloves",
    "coumaphos": "Organophosphate; wear chemical-resistant gloves, avoid skin contact",
}

# Withdrawal period keywords — flag if treatment discussed without mentioning these
WITHDRAWAL_KEYWORDS = frozenset({
    "withdrawal", "withdraw", "honey super", "supers off",
    "before harvest", "prior to harvest", "label", "follow the label",
    "manufacturer", "directions",
})


# ---------------------------------------------------------------------------
# Safety result
# ---------------------------------------------------------------------------

@dataclass
class SafetyFlag:
    """A single safety concern found in the response."""

    severity: str  # "high" | "medium" | "low"
    category: str  # "banned_substance" | "missing_ppe" | "dosage" | "withdrawal"
    substance: str
    detail: str


@dataclass
class SafetyResult:
    """Result of safety checking a response."""

    passed: bool = True
    flags: list[SafetyFlag] = field(default_factory=list)
    disclaimer_needed: bool = False
    disclaimer_text: str = ""

    @property
    def has_high_severity(self) -> bool:
        return any(f.severity == "high" for f in self.flags)


# ---------------------------------------------------------------------------
# Dosage patterns — flag specific numeric dosage recommendations
# ---------------------------------------------------------------------------

_DOSAGE_PATTERNS = [
    re.compile(
        r"\b(\d+\.?\d*)\s*(ml|cc|g|grams?|oz|ounces?|mg|milligrams?|percent|%)"
        r"\s+(of\s+|per\s+)?.*?(oxalic|formic|thymol|amitraz|apivar|coumaphos)",
        re.I,
    ),
    re.compile(
        r"\b(oxalic|formic|thymol|amitraz|coumaphos).*?"
        r"(\d+\.?\d*)\s*(ml|cc|g|grams?|oz|ounces?|mg|milligrams?|percent|%)",
        re.I,
    ),
]


# ---------------------------------------------------------------------------
# Check functions
# ---------------------------------------------------------------------------

_WARNING_WORDS = frozenset({
    "never", "don't", "do not", "avoid", "banned",
    "toxic", "illegal", "prohibited", "dangerous",
    "not recommended", "should not",
})


def _is_warning_context(text_lower: str, substance: str) -> bool:
    """Return True if the substance appears in a warning/negation context."""
    idx = text_lower.index(substance)
    context_start = max(0, idx - 80)
    context = text_lower[context_start:idx + len(substance) + 80]
    return any(w in context for w in _WARNING_WORDS)


def _check_banned_substances(text_lower: str) -> list[SafetyFlag]:
    """Flag any banned substances recommended in the response."""
    flags = []
    for substance, reason in BANNED_SUBSTANCES.items():
        if substance not in text_lower:
            continue
        if _is_warning_context(text_lower, substance):
            continue
        flags.append(SafetyFlag(
            severity="high",
            category="banned_substance",
            substance=substance,
            detail=reason,
        ))
    return flags


def _check_ppe_warnings(text_lower: str) -> list[SafetyFlag]:
    """Flag treatment mentions missing PPE warnings."""
    flags = []
    ppe_words = {"gloves", "goggles", "respirator", "protective", "ppe",
                 "safety glasses", "mask", "ventilat"}
    has_ppe_mention = any(w in text_lower for w in ppe_words)

    for substance, warning in REQUIRES_PPE.items():
        if substance in text_lower and not has_ppe_mention:
            flags.append(SafetyFlag(
                severity="medium",
                category="missing_ppe",
                substance=substance,
                detail=warning,
            ))
    return flags


def _check_dosage(text_lower: str) -> list[SafetyFlag]:
    """Flag specific dosage recommendations (should defer to labels)."""
    flags = []
    label_words = {"label", "manufacturer", "instructions", "directions",
                   "follow the", "package", "product label"}
    has_label_ref = any(w in text_lower for w in label_words)

    for pattern in _DOSAGE_PATTERNS:
        match = pattern.search(text_lower)
        if match and not has_label_ref:
            flags.append(SafetyFlag(
                severity="medium",
                category="dosage",
                substance=match.group(0)[:60],
                detail="Specific dosage given without label reference",
            ))
            break  # One dosage flag is enough
    return flags


_TREATMENT_WORDS = frozenset({
    "treat", "apply", "administer", "dose", "strip",
    "vaporize", "dribble", "sublimation",
})


def _check_withdrawal(text_lower: str) -> list[SafetyFlag]:
    """Flag treatment advice missing withdrawal period mentions."""
    flags = []
    if not any(w in text_lower for w in _TREATMENT_WORDS):
        return flags

    chemical_mentioned = any(sub in text_lower for sub in REQUIRES_PPE)
    if not chemical_mentioned:
        return flags

    has_withdrawal = any(w in text_lower for w in WITHDRAWAL_KEYWORDS)
    if not has_withdrawal:
        flags.append(SafetyFlag(
            severity="low",
            category="withdrawal",
            substance="(treatment discussion)",
            detail="Treatment advice without mention of withdrawal period or label compliance",
        ))
    return flags


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

_DISCLAIMER_TEMPLATE = (
    "\n\n⚠️ **Safety note**: Always follow product label directions for dosage, "
    "application method, and withdrawal periods. Wear appropriate PPE when "
    "handling chemical treatments. Consult your local extension service or "
    "apiary inspector for region-specific regulations."
)

_BANNED_DISCLAIMER = (
    "\n\n🚫 **Warning**: One or more substances mentioned above are banned or "
    "restricted for use in beehives. Never use unregistered chemicals in or "
    "near honey bee colonies."
)


def check_safety(response: str) -> SafetyResult:
    """Check a response for safety concerns.

    Returns a SafetyResult with flags and optional disclaimer text.
    Pure function — no I/O or side effects.
    """
    result = SafetyResult()
    text_lower = response.lower()

    result.flags.extend(_check_banned_substances(text_lower))
    result.flags.extend(_check_ppe_warnings(text_lower))
    result.flags.extend(_check_dosage(text_lower))
    result.flags.extend(_check_withdrawal(text_lower))

    if result.flags:
        result.passed = False
        if result.has_high_severity:
            result.disclaimer_needed = True
            result.disclaimer_text = _BANNED_DISCLAIMER
        elif any(f.severity == "medium" for f in result.flags):
            result.disclaimer_needed = True
            result.disclaimer_text = _DISCLAIMER_TEMPLATE

    return result
