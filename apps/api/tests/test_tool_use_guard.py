"""Unit tests for the tool-use guard.

Covers:
- ``classify_tool_requirement`` correctly maps user messages to required tools.
- ``check_tool_use`` flags missing or wrong tool calls.
- The drone/DCA regression case from 2026-04-25 — a knowledge question that
  mentions "my hive" must classify as ``knowledge`` (not ``data``) so the
  guard forces ``search_knowledge_base``.
"""

import pytest

from app.services.guardrails.tools import (
    KNOWLEDGE_TOOL,
    ToolRequirement,
    ToolUseResult,
    check_tool_use,
    classify_tool_requirement,
)

# ===================================================================
# classify_tool_requirement
# ===================================================================


class TestClassifyToolRequirement:
    """Tests that map user messages to ToolRequirement."""

    @pytest.mark.parametrize(
        "msg",
        [
            "Why are drones flying around my hive?",
            "Why does varroa multiply so fast?",
            "Is it normal to see drones in spring?",
            "Is that good?",
            "What causes EFB?",
            "How do I treat varroa?",
            "How long until my queen starts laying?",
        ],
    )
    def test_knowledge_questions_route_to_search_knowledge_base(self, msg):
        req = classify_tool_requirement(msg)
        assert req.intent == "knowledge"
        assert req.required_tool == KNOWLEDGE_TOOL
        assert req.must_call_any_tool is False

    @pytest.mark.parametrize(
        "msg",
        [
            "How many hives do I have?",
            "When was my last inspection?",
            "Show me my harvests this year",
            "List my apiaries",
            "I have 3 hives",
        ],
    )
    def test_data_questions_require_any_data_tool(self, msg):
        req = classify_tool_requirement(msg)
        assert req.intent == "data"
        assert req.required_tool is None
        assert req.must_call_any_tool is True

    @pytest.mark.parametrize(
        "msg",
        [
            "What do you think about oxalic acid?",
            "What's your opinion on top-bar hives?",
            "Which is better, Langstroth or top-bar?",
        ],
    )
    def test_opinion_questions_do_not_require_tools(self, msg):
        req = classify_tool_requirement(msg)
        assert req.intent == "opinion"
        assert req.required_tool is None
        assert req.must_call_any_tool is False

    def test_drone_dca_regression_classifies_as_knowledge(self):
        """2026-04-25: 'drones around my hive' was misrouted as data.

        The phrase "my hive" matches the data pattern, but the question stem
        ("is that good?") is asking about bee biology. After fix the
        knowledge pattern should win.
        """
        req = classify_tool_requirement(
            "I am seeing drones flying around my Hive after installing the "
            "nuc 5 days ago. Is that good?"
        )
        assert req.intent == "knowledge"
        assert req.required_tool == KNOWLEDGE_TOOL


# ===================================================================
# check_tool_use
# ===================================================================


class TestCheckToolUse:
    """Tests that flag missing or wrong tool calls."""

    def test_knowledge_question_with_search_call_passes(self):
        result = check_tool_use(
            "Why are drones around my hive?",
            tools_called=[KNOWLEDGE_TOOL],
        )
        assert result.passed is True
        assert result.flag == ""

    def test_knowledge_question_without_any_tool_call_fails(self):
        """The drone/DCA failure mode — a knowledge question got no tool call.

        This is exactly what slipped past every existing guard yesterday.
        """
        result = check_tool_use(
            "Why are drones around my hive?",
            tools_called=[],
        )
        assert result.passed is False
        assert "missing_tool_call" in result.flag
        assert KNOWLEDGE_TOOL in result.flag

    def test_knowledge_question_with_wrong_tool_fails(self):
        result = check_tool_use(
            "Why are drones around my hive?",
            tools_called=["list_hives"],
        )
        assert result.passed is False
        assert "wrong_tool_call" in result.flag
        assert KNOWLEDGE_TOOL in result.flag

    def test_data_question_with_any_data_tool_passes(self):
        """Any data tool satisfies a data question (no specific required_tool)."""
        result = check_tool_use(
            "How many hives do I have?",
            tools_called=["list_hives"],
        )
        assert result.passed is True

    def test_data_question_without_tool_call_fails(self):
        result = check_tool_use(
            "How many hives do I have?",
            tools_called=[],
        )
        assert result.passed is False
        assert "missing_tool_call" in result.flag

    def test_opinion_question_passes_without_tools(self):
        result = check_tool_use(
            "What do you think about oxalic acid?",
            tools_called=[],
        )
        assert result.passed is True
        assert result.flag == ""

    def test_conversational_passes_without_tools(self):
        result = check_tool_use("thanks", tools_called=[])
        assert result.passed is True
        assert result.flag == ""

    def test_none_tools_called_treated_as_empty(self):
        """Passing tools_called=None (rather than []) is still well-defined."""
        result = check_tool_use("Why does X?", tools_called=None)
        assert result.passed is False
        assert isinstance(result, ToolUseResult)
        assert isinstance(result.requirement, ToolRequirement)
