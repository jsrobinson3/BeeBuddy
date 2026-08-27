"""Tool-use guard — classify whether a question requires a tool call.

The fine-tuned model often answers knowledge questions from training rather
than calling ``search_knowledge_base``. This guard flags those cases so the
caller can either force a retry with ``tool_choice`` or log for audit.

All functions are pure (no side effects, no I/O).
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.guardrails.topic import classify_question_intent

KNOWLEDGE_TOOL = "search_knowledge_base"

_DATA_INTENTS = frozenset({"data"})
_KNOWLEDGE_INTENTS = frozenset({"knowledge"})
_TOOL_OPTIONAL_INTENTS = frozenset({"conversational", "opinion"})


@dataclass
class ToolRequirement:
    """What kind of tool call (if any) the user's message demands."""

    intent: str  # "knowledge" | "data" | "conversational" | "opinion"
    required_tool: str | None  # Specific tool to force, or None
    must_call_any_tool: bool  # True for data questions where any data tool fits


def classify_tool_requirement(user_message: str) -> ToolRequirement:
    """Decide whether the user's message requires a tool call.

    - Knowledge questions ("why does X happen?") require ``search_knowledge_base``.
    - Data questions ("how many hives do I have?") require *some* data tool.
    - Conversational/opinion intents don't require tools.
    """
    intent = classify_question_intent(user_message)

    if intent in _KNOWLEDGE_INTENTS:
        return ToolRequirement(
            intent=intent, required_tool=KNOWLEDGE_TOOL, must_call_any_tool=False,
        )
    if intent in _DATA_INTENTS:
        return ToolRequirement(
            intent=intent, required_tool=None, must_call_any_tool=True,
        )
    return ToolRequirement(
        intent=intent, required_tool=None, must_call_any_tool=False,
    )


@dataclass
class ToolUseResult:
    """Whether the model satisfied the tool requirement on this turn."""

    passed: bool
    requirement: ToolRequirement
    tools_called: list[str]
    flag: str  # Empty when passed; otherwise human-readable for audit


def check_tool_use(
    user_message: str,
    tools_called: list[str] | None,
) -> ToolUseResult:
    """Verify that the model called the right tool (or any tool, for data).

    Returns a result dataclass with a flag string suitable for audit logging.
    """
    tools_called = list(tools_called or [])
    requirement = classify_tool_requirement(user_message)

    if requirement.intent in _TOOL_OPTIONAL_INTENTS:
        return ToolUseResult(
            passed=True,
            requirement=requirement,
            tools_called=tools_called,
            flag="",
        )

    if not tools_called:
        expected = requirement.required_tool or "any data tool"
        return ToolUseResult(
            passed=False,
            requirement=requirement,
            tools_called=tools_called,
            flag=(
                f"missing_tool_call: intent={requirement.intent}, "
                f"expected={expected}"
            ),
        )

    if requirement.required_tool and requirement.required_tool not in tools_called:
        return ToolUseResult(
            passed=False,
            requirement=requirement,
            tools_called=tools_called,
            flag=(
                f"wrong_tool_call: intent={requirement.intent}, "
                f"expected={requirement.required_tool}, "
                f"got={tools_called}"
            ),
        )

    return ToolUseResult(
        passed=True,
        requirement=requirement,
        tools_called=tools_called,
        flag="",
    )
