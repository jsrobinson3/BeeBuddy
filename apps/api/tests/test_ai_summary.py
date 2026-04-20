"""Unit tests for app.services.ai_summary — cold-start retry on 503.

Regression coverage for Sentry BEEBUDDY-BACKEND-1A, where a 503 from a
scale-to-zero HuggingFace Inference Endpoint surfaced as an uncaught
HTTPStatusError. The non-streaming path now retries cold starts the way
the streaming path in ai_service already does.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.config import LLMProvider
from app.services import ai_summary
from app.services.tool_executor import ColdStartError


def _fake_settings(provider: LLMProvider = LLMProvider.OPENAI) -> MagicMock:
    mock = MagicMock()
    mock.llm_provider = provider
    mock.llm_model = "test-model"
    mock.llm_base_url = "https://example.invalid/v1"
    mock.llm_api_key = "test-key"
    return mock


def _mock_post_response(status_code: int, json_body: dict | None = None) -> MagicMock:
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_body or {}
    resp.raise_for_status = MagicMock()
    return resp


class TestColdStartRetry:
    """Cold-start retry behaviour on the non-streaming summary path."""

    @patch("app.services.ai_summary.settings", _fake_settings())
    async def test_503_then_200_returns_content(self):
        call_count = 0

        async def fake_call(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise ColdStartError()
            return "ok-summary"

        with patch("app.services.ai_summary.asyncio.sleep", new_callable=AsyncMock):
            result = await ai_summary._with_cold_start_retry(fake_call, [])

        assert result == "ok-summary"
        assert call_count == 2

    @patch("app.services.ai_summary.settings", _fake_settings())
    async def test_retries_exhausted_reraises_cold_start(self):
        async def always_fail(messages):
            raise ColdStartError()

        with (
            patch("app.services.ai_summary.asyncio.sleep", new_callable=AsyncMock),
            pytest.raises(ColdStartError),
        ):
            await ai_summary._with_cold_start_retry(always_fail, [])

    @patch("app.services.ai_summary.settings", _fake_settings())
    async def test_sleep_delays_match_schedule(self):
        async def always_fail(messages):
            raise ColdStartError()

        with (
            patch(
                "app.services.ai_summary.asyncio.sleep", new_callable=AsyncMock,
            ) as sleep_mock,
            pytest.raises(ColdStartError),
        ):
            await ai_summary._with_cold_start_retry(always_fail, [])

        called_delays = [c.args[0] for c in sleep_mock.call_args_list]
        assert called_delays == ai_summary._COLD_START_DELAYS


class TestOpenAiCompat503:
    """The OpenAI-compatible helper maps 503 to ColdStartError."""

    @patch("app.services.ai_summary.settings", _fake_settings())
    async def test_503_raises_cold_start_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=_mock_post_response(503))

        with (
            patch("app.services.ai_summary.httpx.AsyncClient", return_value=mock_client),
            pytest.raises(ColdStartError),
        ):
            await ai_summary._generate_openai_compat([])

    @patch("app.services.ai_summary.settings", _fake_settings())
    async def test_200_returns_message_content(self):
        body = {"choices": [{"message": {"content": "hello"}}]}
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=_mock_post_response(200, body))

        with patch("app.services.ai_summary.httpx.AsyncClient", return_value=mock_client):
            result = await ai_summary._generate_openai_compat([])

        assert result == "hello"


class TestAnthropic503:
    """The Anthropic helper maps 503 to ColdStartError."""

    @patch(
        "app.services.ai_summary.settings", _fake_settings(LLMProvider.ANTHROPIC),
    )
    async def test_503_raises_cold_start_error(self):
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.post = AsyncMock(return_value=_mock_post_response(503))

        with (
            patch("app.services.ai_summary.httpx.AsyncClient", return_value=mock_client),
            pytest.raises(ColdStartError),
        ):
            await ai_summary._generate_anthropic(
                [{"role": "system", "content": "s"}, {"role": "user", "content": "u"}],
            )
