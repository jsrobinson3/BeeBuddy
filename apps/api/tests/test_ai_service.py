"""Unit tests for app.services.ai_service — cold-start retry and streaming.

These tests mock httpx and the database so they run without any network
access, running API server, or LLM endpoint.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import LLMProvider
from app.services.ai_service import (
    ColdStartError,
    _parse_anthropic_sse,
    _parse_openai_sse,
    _stream_openai_compat,
    stream_chat,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sse_event(data: dict | str) -> str:
    """Format a value as an SSE data line."""
    payload = data if isinstance(data, str) else json.dumps(data)
    return f"data: {payload}"


def _fake_settings(**overrides) -> MagicMock:
    """Return a mock settings with sensible defaults."""
    defaults = {
        "llm_provider": LLMProvider.OPENAI,
        "llm_model": "gpt-4",
        "llm_base_url": "https://api.example.com/v1",
        "llm_api_key": "test-key",
    }
    defaults.update(overrides)
    mock = MagicMock()
    for k, v in defaults.items():
        setattr(mock, k, v)
    return mock


def _openai_chunk(content: str) -> str:
    """Build an OpenAI-format SSE line with a content delta."""
    obj = {"choices": [{"delta": {"content": content}}]}
    return f"data: {json.dumps(obj)}"


async def _async_lines(lines: list[str]):
    """Simulate httpx response.aiter_lines()."""
    for line in lines:
        yield line


def _mock_response(status_code: int = 200, lines: list[str] | None = None):
    """Build a mock httpx response that streams lines."""
    resp = AsyncMock()
    resp.status_code = status_code
    resp.aiter_lines = lambda: _async_lines(lines or [])
    resp.aclose = AsyncMock()
    return resp


# ---------------------------------------------------------------------------
# _parse_openai_sse
# ---------------------------------------------------------------------------


class TestParseOpenAiSSE:
    """Tests for the OpenAI SSE line parser."""

    def test_content_delta(self):
        line = _openai_chunk("Hello")
        assert _parse_openai_sse(line) == "Hello"

    def test_done_signal(self):
        assert _parse_openai_sse("data: [DONE]") is None

    def test_non_data_line_returns_empty(self):
        assert _parse_openai_sse("event: ping") == ""
        assert _parse_openai_sse("") == ""

    def test_empty_delta_returns_empty(self):
        obj = {"choices": [{"delta": {}}]}
        line = f"data: {json.dumps(obj)}"
        assert _parse_openai_sse(line) == ""


# ---------------------------------------------------------------------------
# _stream_openai_compat — cold start detection
# ---------------------------------------------------------------------------


class TestStreamOpenAiCompat:
    """Tests for the OpenAI-compatible streaming path."""

    @patch("app.services.ai_service.settings", _fake_settings())
    async def test_raises_cold_start_error_on_503(self):
        """A 503 response raises ColdStartError."""
        mock_resp = _mock_response(status_code=503)
        mock_client = AsyncMock()
        mock_client.build_request.return_value = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_resp)
        mock_client.aclose = AsyncMock()

        with (
            patch("app.services.ai_service.httpx.AsyncClient", return_value=mock_client),
            pytest.raises(ColdStartError),
        ):
            async for _ in _stream_openai_compat([{"role": "user", "content": "hi"}]):
                pass

    @patch("app.services.ai_service.settings", _fake_settings())
    async def test_streams_content_on_200(self):
        """A 200 response yields content tokens."""
        lines = [_openai_chunk("Hello"), _openai_chunk(" world"), "data: [DONE]"]
        mock_resp = _mock_response(status_code=200, lines=lines)
        mock_client = AsyncMock()
        mock_client.build_request.return_value = MagicMock()
        mock_client.send = AsyncMock(return_value=mock_resp)
        mock_client.aclose = AsyncMock()

        chunks: list[str] = []
        with patch("app.services.ai_service.httpx.AsyncClient", return_value=mock_client):
            async for chunk in _stream_openai_compat([{"role": "user", "content": "hi"}]):
                chunks.append(chunk)

        assert chunks == ["Hello", " world"]


# ---------------------------------------------------------------------------
# stream_chat — cold-start retry loop
# ---------------------------------------------------------------------------


@patch(
    "app.services.ai_service.tool_executor.try_tool_path",
    new_callable=AsyncMock,
    return_value=(None, [], {}),
)
class TestStreamChatColdStart:
    """Tests for the top-level stream_chat cold-start fallback logic.

    When the primary endpoint returns 503, stream_chat fires a background
    wake request and retries via the configured fallback provider.
    """

    async def _collect_events(self, gen) -> list[dict]:
        """Collect and parse SSE events from the generator."""
        events = []
        async for raw in gen:
            if not raw.startswith("data: "):
                continue
            payload = raw[6:].strip()
            if payload != "[DONE]":
                events.append(json.loads(payload))
        return events

    async def test_emits_waking_up_then_fallback_content(self, _mock_tool_path):
        """Primary 503 → waking_up event → fallback streams content."""
        call_count = 0

        async def mock_stream_llm(messages, usage_out=None, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ColdStartError()
            yield "Fallback reply!"

        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_request = MagicMock()
        mock_request.messages = [MagicMock(role="user", content="hi")]
        mock_request.conversation_id = None
        mock_request.hive_id = None

        with (
            patch("app.services.ai_service._stream_llm", side_effect=mock_stream_llm),
            patch("app.services.ai_service._fire_background_wake"),
            patch("app.services.ai_service.ag_data_service.build_context_block", return_value=""),
            patch("app.services.ai_service._save_conversation", new_callable=AsyncMock),
            patch("app.services.ai_service.record_chat_usage", new_callable=AsyncMock),
        ):
            events = await self._collect_events(stream_chat(mock_db, mock_user, mock_request))

        statuses = [e for e in events if "status" in e]
        content = [e for e in events if "content" in e]

        assert len(statuses) == 1
        assert statuses[0]["status"] == "waking_up"
        assert len(content) >= 1
        assert content[0]["content"] == "Fallback reply!"

    async def test_emits_error_when_fallback_also_fails(self, _mock_tool_path):
        """If both primary and fallback 503, client sees error event."""

        async def always_503(messages, usage_out=None, **kwargs):
            raise ColdStartError()
            yield  # unreachable — required to make this an async generator

        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_request = MagicMock()
        mock_request.messages = [MagicMock(role="user", content="hi")]
        mock_request.conversation_id = None
        mock_request.hive_id = None

        with (
            patch("app.services.ai_service._stream_llm", side_effect=always_503),
            patch("app.services.ai_service._fire_background_wake"),
            patch("app.services.ai_service.ag_data_service.build_context_block", return_value=""),
            patch("app.services.ai_service._save_conversation", new_callable=AsyncMock),
            patch("app.services.ai_service.record_chat_usage", new_callable=AsyncMock),
        ):
            events = await self._collect_events(stream_chat(mock_db, mock_user, mock_request))

        errors = [e for e in events if "error" in e]
        assert len(errors) == 1
        assert "try again" in errors[0]["error"].lower()

    async def test_no_cold_start_streams_normally(self, _mock_tool_path):
        """When the endpoint responds immediately, no waking_up event is emitted."""

        async def instant_response(messages, usage_out=None, **kwargs):
            yield "Instant reply"

        mock_db = AsyncMock()
        mock_user = MagicMock()
        mock_user.id = "user-123"
        mock_request = MagicMock()
        mock_request.messages = [MagicMock(role="user", content="hi")]
        mock_request.conversation_id = None
        mock_request.hive_id = None

        with (
            patch("app.services.ai_service._stream_llm", side_effect=instant_response),
            patch("app.services.ai_service.ag_data_service.build_context_block", return_value=""),
            patch("app.services.ai_service._save_conversation", new_callable=AsyncMock),
            patch("app.services.ai_service.record_chat_usage", new_callable=AsyncMock),
        ):
            events = await self._collect_events(stream_chat(mock_db, mock_user, mock_request))

        statuses = [e for e in events if "status" in e]
        content = [e for e in events if "content" in e]

        assert len(statuses) == 0
        assert content[0]["content"] == "Instant reply"


# ---------------------------------------------------------------------------
# _parse_openai_sse — usage_out capture
# ---------------------------------------------------------------------------


class TestParseOpenAiSSEUsage:
    """Tests for usage capture in the OpenAI SSE parser."""

    def test_captures_usage_from_final_chunk(self):
        """When the final chunk contains usage, it populates usage_out."""
        usage_chunk = {
            "usage": {
                "prompt_tokens": 100,
                "completion_tokens": 50,
                "total_tokens": 150,
            },
            "choices": [],
        }
        line = f"data: {json.dumps(usage_chunk)}"
        usage_out: dict = {}

        _parse_openai_sse(line, usage_out)

        assert usage_out["input_tokens"] == 100
        assert usage_out["output_tokens"] == 50
        assert usage_out["total_tokens"] == 150

    def test_no_usage_when_usage_out_is_none(self):
        """When usage_out is None, usage data is silently ignored."""
        usage_chunk = {
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
            "choices": [],
        }
        line = f"data: {json.dumps(usage_chunk)}"

        # Should not raise
        result = _parse_openai_sse(line, None)
        assert result == ""

    def test_content_chunk_does_not_set_usage(self):
        """Normal content chunks without usage don't touch usage_out."""
        usage_out: dict = {}
        line = _openai_chunk("Hello")

        _parse_openai_sse(line, usage_out)

        assert usage_out == {}

    def test_usage_with_missing_fields_defaults_to_zero(self):
        """Missing prompt_tokens or completion_tokens default to 0."""
        usage_chunk = {"usage": {"total_tokens": 42}, "choices": []}
        line = f"data: {json.dumps(usage_chunk)}"
        usage_out: dict = {}

        _parse_openai_sse(line, usage_out)

        assert usage_out["input_tokens"] == 0
        assert usage_out["output_tokens"] == 0
        assert usage_out["total_tokens"] == 42


# ---------------------------------------------------------------------------
# _parse_anthropic_sse — usage_out capture
# ---------------------------------------------------------------------------


class TestParseAnthropicSSEUsage:
    """Tests for usage capture in the Anthropic SSE parser."""

    def test_captures_input_tokens_from_message_start(self):
        """message_start event populates input_tokens in usage_out."""
        event = {
            "type": "message_start",
            "message": {"usage": {"input_tokens": 200}},
        }
        line = f"data: {json.dumps(event)}"
        usage_out: dict = {}

        result = _parse_anthropic_sse(line, usage_out)

        assert result == ""
        assert usage_out["input_tokens"] == 200

    def test_captures_output_tokens_from_message_delta(self):
        """message_delta event populates output_tokens and total_tokens."""
        usage_out: dict = {"input_tokens": 100}
        event = {
            "type": "message_delta",
            "usage": {"output_tokens": 50},
        }
        line = f"data: {json.dumps(event)}"

        result = _parse_anthropic_sse(line, usage_out)

        assert result == ""
        assert usage_out["output_tokens"] == 50
        assert usage_out["total_tokens"] == 150

    def test_content_block_delta_returns_text(self):
        """content_block_delta events return the text content."""
        event = {
            "type": "content_block_delta",
            "delta": {"text": "Hello world"},
        }
        line = f"data: {json.dumps(event)}"
        usage_out: dict = {}

        result = _parse_anthropic_sse(line, usage_out)

        assert result == "Hello world"
        assert usage_out == {}

    def test_message_stop_returns_none(self):
        """message_stop event signals end of stream with None."""
        event = {"type": "message_stop"}
        line = f"data: {json.dumps(event)}"

        result = _parse_anthropic_sse(line)

        assert result is None

    def test_no_usage_when_usage_out_is_none(self):
        """When usage_out is None, message_start usage is ignored."""
        event = {
            "type": "message_start",
            "message": {"usage": {"input_tokens": 200}},
        }
        line = f"data: {json.dumps(event)}"

        # Should not raise
        result = _parse_anthropic_sse(line, None)
        assert result == ""

    def test_message_delta_without_usage_out(self):
        """message_delta with usage_out=None does not crash."""
        event = {
            "type": "message_delta",
            "usage": {"output_tokens": 50},
        }
        line = f"data: {json.dumps(event)}"

        result = _parse_anthropic_sse(line, None)
        assert result == ""

    def test_non_data_line_returns_empty(self):
        """Lines not starting with 'data: ' return empty string."""
        assert _parse_anthropic_sse("event: message_start") == ""
        assert _parse_anthropic_sse("") == ""

    def test_total_tokens_uses_stored_input(self):
        """total_tokens is computed from stored input_tokens + current output."""
        usage_out: dict = {"input_tokens": 75}
        event = {
            "type": "message_delta",
            "usage": {"output_tokens": 25},
        }
        line = f"data: {json.dumps(event)}"

        _parse_anthropic_sse(line, usage_out)

        assert usage_out["total_tokens"] == 100

    def test_total_tokens_defaults_input_to_zero(self):
        """If input_tokens was never set, total uses 0 for input."""
        usage_out: dict = {}
        event = {
            "type": "message_delta",
            "usage": {"output_tokens": 30},
        }
        line = f"data: {json.dumps(event)}"

        _parse_anthropic_sse(line, usage_out)

        assert usage_out["total_tokens"] == 30
