"""Unit tests for app.services.tool_executor — MCP↔LLM orchestration loop.

Tests mock the LLM provider and MCP client to verify format conversion,
tool-call parsing, and the execution loop.
"""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from app.config import LLMProvider
from app.services.tool_executor import (
    _convert_tools,
    _extract_anthropic_tool_calls,
    _extract_mcp_result,
    _extract_openai_tool_calls,
    _extract_text,
    try_tool_path,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _openai_response(content: str = "", tool_calls: list | None = None):
    """Build a mock OpenAI-format response dict."""
    message = {"role": "assistant", "content": content}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {"choices": [{"message": message}]}


def _openai_tool_call(name: str, arguments: dict, call_id: str = "call_1"):
    return {
        "id": call_id,
        "type": "function",
        "function": {"name": name, "arguments": json.dumps(arguments)},
    }


def _anthropic_response(
    text: str = "", tool_calls: list | None = None
):
    """Build a mock Anthropic-format response dict."""
    content = []
    if text:
        content.append({"type": "text", "text": text})
    for tc in tool_calls or []:
        content.append(tc)
    return {"content": content}


def _anthropic_tool_use(name: str, arguments: dict, call_id: str = "toolu_1"):
    return {
        "type": "tool_use",
        "id": call_id,
        "name": name,
        "input": arguments,
    }


def _mock_mcp_tool(name: str, description: str = "", schema: dict | None = None):
    tool = MagicMock()
    tool.name = name
    tool.description = description
    tool.inputSchema = schema or {"type": "object", "properties": {}}
    return tool


def _mock_mcp_result(text: str):
    result = MagicMock()
    item = MagicMock()
    item.text = text
    result.content = [item]
    return result


# ---------------------------------------------------------------------------
# Format conversion
# ---------------------------------------------------------------------------


class TestConvertTools:
    def test_openai_format(self):
        tool = _mock_mcp_tool("list_hives", "Get hives")
        result = _convert_tools([tool], LLMProvider.OPENAI)
        assert len(result) == 1
        assert result[0]["type"] == "function"
        assert result[0]["function"]["name"] == "list_hives"
        assert result[0]["function"]["description"] == "Get hives"

    def test_anthropic_format(self):
        tool = _mock_mcp_tool("list_hives", "Get hives")
        result = _convert_tools([tool], LLMProvider.ANTHROPIC)
        assert len(result) == 1
        assert result[0]["name"] == "list_hives"
        assert "input_schema" in result[0]

    def test_ollama_uses_openai_format(self):
        tool = _mock_mcp_tool("test")
        result = _convert_tools([tool], LLMProvider.OLLAMA)
        assert result[0]["type"] == "function"


# ---------------------------------------------------------------------------
# Tool call extraction
# ---------------------------------------------------------------------------


class TestExtractOpenAIToolCalls:
    def test_extracts_calls(self):
        resp = _openai_response(tool_calls=[
            _openai_tool_call("list_hives", {"apiary_id": "abc"}),
        ])
        calls = _extract_openai_tool_calls(resp)
        assert len(calls) == 1
        assert calls[0].name == "list_hives"
        assert calls[0].arguments == {"apiary_id": "abc"}

    def test_no_tools_returns_empty(self):
        resp = _openai_response(content="Just text")
        assert _extract_openai_tool_calls(resp) == []

    def test_invalid_json_args(self):
        resp = _openai_response(tool_calls=[{
            "id": "call_1",
            "function": {"name": "test", "arguments": "not-json"},
        }])
        calls = _extract_openai_tool_calls(resp)
        assert calls[0].arguments == {}


class TestExtractAnthropicToolCalls:
    def test_extracts_calls(self):
        resp = _anthropic_response(tool_calls=[
            _anthropic_tool_use("get_harvests", {"year": 2025}),
        ])
        calls = _extract_anthropic_tool_calls(resp)
        assert len(calls) == 1
        assert calls[0].name == "get_harvests"
        assert calls[0].arguments == {"year": 2025}

    def test_skips_text_blocks(self):
        resp = _anthropic_response(
            text="Let me check",
            tool_calls=[_anthropic_tool_use("list_apiaries", {})],
        )
        calls = _extract_anthropic_tool_calls(resp)
        assert len(calls) == 1
        assert calls[0].name == "list_apiaries"


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


class TestExtractText:
    def test_openai(self):
        resp = _openai_response(content="Hello")
        assert _extract_text(resp, LLMProvider.OPENAI) == "Hello"

    def test_anthropic(self):
        resp = _anthropic_response(text="Hello from Claude")
        assert _extract_text(resp, LLMProvider.ANTHROPIC) == "Hello from Claude"


# ---------------------------------------------------------------------------
# MCP result extraction
# ---------------------------------------------------------------------------


class TestExtractMCPResult:
    def test_extracts_text(self):
        result = _mock_mcp_result('[{"name": "Hive A"}]')
        assert "Hive A" in _extract_mcp_result(result)


# ---------------------------------------------------------------------------
# try_tool_path integration
# ---------------------------------------------------------------------------


def _fake_tool_settings():
    mock = MagicMock()
    mock.effective_tool_provider = LLMProvider.OPENAI
    mock.effective_tool_model = "gpt-4"
    mock.llm_tool_base_url = "https://api.example.com/v1"
    mock.llm_tool_api_key = "test-key"
    return mock


class TestTryToolPath:
    @patch("app.services.tool_executor.settings", _fake_tool_settings())
    @patch("app.services.tool_executor._call_llm_with_tools", new_callable=AsyncMock)
    @patch("app.services.tool_executor.create_mcp_server")
    async def test_returns_none_when_no_tools_called(
        self, mock_create, mock_call_llm
    ):
        """When LLM doesn't call tools, returns (None, [])."""
        mock_server = MagicMock()
        mock_create.return_value = mock_server

        mock_client = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[_mock_mcp_tool("test")])

        mock_call_llm.return_value = _openai_response(content="No tools needed")

        with patch("app.services.tool_executor.Client") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result, msgs = await try_tool_path(
                [{"role": "user", "content": "hi"}],
                AsyncMock(),
                uuid.uuid4(),
            )

        assert result is None
        assert msgs == []

    @patch("app.services.tool_executor.settings", _fake_tool_settings())
    @patch("app.services.tool_executor._call_llm_with_tools", new_callable=AsyncMock)
    @patch("app.services.tool_executor.create_mcp_server")
    async def test_executes_tool_and_returns_answer(
        self, mock_create, mock_call_llm
    ):
        """When LLM calls a tool, executes it and returns the final text."""
        mock_server = MagicMock()
        mock_create.return_value = mock_server

        mock_client = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[_mock_mcp_tool("list_hives")])
        mock_client.call_tool = AsyncMock(
            return_value=_mock_mcp_result('[{"name": "Hive A"}]')
        )

        # First call: LLM returns tool_call; second call: LLM returns text
        mock_call_llm.side_effect = [
            _openai_response(
                tool_calls=[_openai_tool_call("list_hives", {})],
            ),
            _openai_response(content="You have 1 hive called Hive A."),
        ]

        with patch("app.services.tool_executor.Client") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result, msgs = await try_tool_path(
                [{"role": "user", "content": "how many hives?"}],
                AsyncMock(),
                uuid.uuid4(),
            )

        assert result == "You have 1 hive called Hive A."
        assert len(msgs) == 2  # tool_call + tool_result
        assert msgs[0]["role"] == "tool_call"
        assert msgs[1]["role"] == "tool_result"

    @patch("app.services.tool_executor.settings", _fake_tool_settings())
    @patch("app.services.tool_executor._call_llm_with_tools", new_callable=AsyncMock)
    @patch("app.services.tool_executor.create_mcp_server")
    async def test_returns_none_when_no_mcp_tools(
        self, mock_create, mock_call_llm
    ):
        """When MCP server has no tools, returns (None, [])."""
        mock_server = MagicMock()
        mock_create.return_value = mock_server

        mock_client = AsyncMock()
        mock_client.list_tools = AsyncMock(return_value=[])

        with patch("app.services.tool_executor.Client") as MockClient:
            MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result, msgs = await try_tool_path(
                [{"role": "user", "content": "hi"}],
                AsyncMock(),
                uuid.uuid4(),
            )

        assert result is None
        assert msgs == []
        mock_call_llm.assert_not_called()
