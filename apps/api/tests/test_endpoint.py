"""Tests for HF Inference Endpoint utilities and cold-start fallback."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.endpoint import (
    get_endpoint_status,
    load_buddy_system_prompt,
    query_anthropic,
    query_with_fallback,
    wait_until_ready,
    wake_endpoint,
)

# ---------------------------------------------------------------------------
# get_endpoint_status
# ---------------------------------------------------------------------------


class TestGetEndpointStatus:
    def test_returns_running(self):
        mock_ep = MagicMock()
        mock_ep.status = "running"
        with patch("huggingface_hub.HfApi.get_inference_endpoint", return_value=mock_ep):
            assert get_endpoint_status("ns", "ep", "tok") == "running"

    def test_returns_scaled_to_zero(self):
        mock_ep = MagicMock()
        mock_ep.status = "scaledToZero"
        with patch("huggingface_hub.HfApi.get_inference_endpoint", return_value=mock_ep):
            assert get_endpoint_status() == "scaledToZero"


# ---------------------------------------------------------------------------
# wake_endpoint
# ---------------------------------------------------------------------------


class TestWakeEndpoint:
    @pytest.mark.asyncio
    async def test_200_returns_already_warm(self):
        mock_ep = MagicMock()
        mock_ep.url = "https://ep.example.com"
        mock_resp = MagicMock()
        mock_resp.status_code = 200

        with (
            patch(
                "huggingface_hub.HfApi.get_inference_endpoint",
                return_value=mock_ep,
            ),
            patch("httpx.AsyncClient") as mock_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await wake_endpoint("ns", "ep", "tok")
            assert result == "already_warm"

    @pytest.mark.asyncio
    async def test_503_returns_warming(self):
        mock_ep = MagicMock()
        mock_ep.url = "https://ep.example.com"
        mock_resp = MagicMock()
        mock_resp.status_code = 503

        with (
            patch(
                "huggingface_hub.HfApi.get_inference_endpoint",
                return_value=mock_ep,
            ),
            patch("httpx.AsyncClient") as mock_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await wake_endpoint("ns", "ep", "tok")
            assert result == "warming"

    @pytest.mark.asyncio
    async def test_timeout_returns_warming(self):
        mock_ep = MagicMock()
        mock_ep.url = "https://ep.example.com"

        with (
            patch(
                "huggingface_hub.HfApi.get_inference_endpoint",
                return_value=mock_ep,
            ),
            patch("httpx.AsyncClient") as mock_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(
                side_effect=httpx.TimeoutException("timed out"),
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await wake_endpoint("ns", "ep", "tok")
            assert result == "warming"

    @pytest.mark.asyncio
    async def test_connection_error_returns_error(self):
        mock_ep = MagicMock()
        mock_ep.url = "https://ep.example.com"

        with (
            patch(
                "huggingface_hub.HfApi.get_inference_endpoint",
                return_value=mock_ep,
            ),
            patch("httpx.AsyncClient") as mock_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=ConnectionError("fail"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await wake_endpoint("ns", "ep", "tok")
            assert result == "error"


# ---------------------------------------------------------------------------
# wait_until_ready
# ---------------------------------------------------------------------------


class TestWaitUntilReady:
    @pytest.mark.asyncio
    async def test_returns_true_when_running(self):
        with patch(
            "app.services.endpoint.get_endpoint_status",
            side_effect=["scaledToZero", "initializing", "running"],
        ):
            result = await wait_until_ready(
                "ns", "ep", "tok", timeout=60, poll_interval=0,
            )
            assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_on_timeout(self):
        with patch(
            "app.services.endpoint.get_endpoint_status",
            return_value="scaledToZero",
        ):
            result = await wait_until_ready(
                "ns", "ep", "tok", timeout=0, poll_interval=0,
            )
            assert result is False


# ---------------------------------------------------------------------------
# load_buddy_system_prompt
# ---------------------------------------------------------------------------


class TestLoadBuddySystemPrompt:
    def test_includes_personality(self):
        # Clear lru_cache for isolation
        load_buddy_system_prompt.cache_clear()
        prompt = load_buddy_system_prompt()
        assert "Buddy" in prompt
        assert "beekeeping" in prompt.lower()

    def test_includes_tool_addendum(self):
        load_buddy_system_prompt.cache_clear()
        prompt = load_buddy_system_prompt()
        assert "tools" in prompt.lower()
        assert "search_knowledge_base" in prompt


# ---------------------------------------------------------------------------
# query_anthropic
# ---------------------------------------------------------------------------


class TestQueryAnthropic:
    @pytest.mark.asyncio
    async def test_without_system_prompt(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "content": [{"type": "text", "text": "Hello!"}],
        }

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await query_anthropic("hi", "sk-test")
            assert result == "Hello!"

            # Verify no "system" key in the request body
            call_kwargs = mock_client.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert "system" not in body

    @pytest.mark.asyncio
    async def test_with_system_prompt(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "content": [{"type": "text", "text": "I'm Buddy!"}],
        }

        with patch("httpx.AsyncClient") as mock_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await query_anthropic(
                "hi", "sk-test", system_prompt="You are Buddy.",
            )
            assert result == "I'm Buddy!"

            # Verify "system" key IS in the request body
            call_kwargs = mock_client.post.call_args
            body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
            assert body["system"] == "You are Buddy."


# ---------------------------------------------------------------------------
# query_with_fallback
# ---------------------------------------------------------------------------


class TestQueryWithFallback:
    @pytest.mark.asyncio
    async def test_running_returns_buddy_source(self):
        mock_ep = MagicMock()
        mock_ep.status = "running"
        mock_ep.url = "https://ep.example.com"

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "Bee advice!"}}],
        }

        with (
            patch(
                "huggingface_hub.HfApi.get_inference_endpoint",
                return_value=mock_ep,
            ),
            patch(
                "app.services.endpoint.get_endpoint_status",
                return_value="running",
            ),
            patch("httpx.AsyncClient") as mock_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_cls.return_value = mock_client

            result = await query_with_fallback(
                "How do I check for mites?",
                hf_token="hf_test",
                fallback_api_key="sk-test",
            )
            assert result["source"] == "buddy"
            assert result["response"] == "Bee advice!"
            assert "endpoint_status" not in result

    @pytest.mark.asyncio
    async def test_cold_returns_fallback_source(self):
        with (
            patch(
                "app.services.endpoint.get_endpoint_status",
                return_value="scaledToZero",
            ),
            patch(
                "app.services.endpoint.wake_endpoint",
                new_callable=AsyncMock,
                return_value="warming",
            ),
            patch(
                "app.services.endpoint.query_anthropic",
                new_callable=AsyncMock,
                return_value="Fallback bee advice!",
            ),
        ):
            result = await query_with_fallback(
                "How do I check for mites?",
                hf_token="hf_test",
                fallback_api_key="sk-test",
            )
            assert result["source"] == "fallback"
            assert result["endpoint_status"] == "waking"
            assert result["response"] == "Fallback bee advice!"

    @pytest.mark.asyncio
    async def test_cold_no_fallback_key_returns_placeholder(self):
        with (
            patch(
                "app.services.endpoint.get_endpoint_status",
                return_value="scaledToZero",
            ),
            patch(
                "app.services.endpoint.wake_endpoint",
                new_callable=AsyncMock,
                return_value="warming",
            ),
        ):
            result = await query_with_fallback(
                "How do I check for mites?",
                hf_token="hf_test",
            )
            assert result["source"] == "fallback"
            assert "waking up" in result["response"].lower()
