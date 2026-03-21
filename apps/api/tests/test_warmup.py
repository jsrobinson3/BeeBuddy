"""Tests for HF endpoint pre-warming service."""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.warmup_service import _send_warmup_request, warm_endpoints


def _mock_settings(**overrides):
    """Create a mock settings object with warmup defaults."""
    defaults = {
        "llm_provider": "ollama",
        "effective_tool_provider": "ollama",
        "redis_url": "redis://localhost:6379/0",
        "hf_warmup_cooldown_seconds": 300,
        "llm_base_url": "https://hf-endpoint.example.com/v1",
        "llm_api_key": "hf_test_token",
        "llm_tool_base_url": "https://hf-tool.example.com/v1",
        "llm_tool_api_key": "hf_test_token",
        "llm_model": "test-model",
        "effective_tool_model": "test-tool-model",
    }
    defaults.update(overrides)
    s = MagicMock()
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


class TestWarmEndpoints:
    """Tests for warm_endpoints orchestration."""

    @pytest.mark.asyncio
    async def test_skips_when_not_huggingface(self):
        with patch(
            "app.services.warmup_service.get_settings",
            return_value=_mock_settings(),
        ):
            result = await warm_endpoints()
            assert result["skipped"] is True

    @pytest.mark.asyncio
    async def test_warms_streaming_endpoint(self):
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=True)
        mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
        mock_redis.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(llm_provider="huggingface"),
            ),
            patch(
                "app.services.warmup_service.aioredis.from_url",
                return_value=mock_redis,
            ),
            patch(
                "app.services.warmup_service._send_warmup_request",
                new_callable=AsyncMock,
                return_value="already_warm",
            ) as mock_send,
        ):
            result = await warm_endpoints()
            assert result["skipped"] is False
            assert result["streaming"] == "already_warm"
            mock_send.assert_called_once()

    @pytest.mark.asyncio
    async def test_cooldown_prevents_duplicate(self):
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=False)  # Key exists
        mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
        mock_redis.__aexit__ = AsyncMock(return_value=False)

        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(llm_provider="huggingface"),
            ),
            patch(
                "app.services.warmup_service.aioredis.from_url",
                return_value=mock_redis,
            ),
            patch(
                "app.services.warmup_service._send_warmup_request",
                new_callable=AsyncMock,
            ) as mock_send,
        ):
            result = await warm_endpoints()
            assert result["streaming"] == "cooldown"
            mock_send.assert_not_called()


class TestSendWarmupRequest:
    """Tests for _send_warmup_request."""

    @pytest.mark.asyncio
    async def test_200_returns_already_warm(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 200

        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch("httpx.AsyncClient") as mock_client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await _send_warmup_request(
                "https://hf.example.com/v1", "token", "streaming",
            )
            assert result == "already_warm"

    @pytest.mark.asyncio
    async def test_503_returns_warming(self):
        mock_resp = MagicMock()
        mock_resp.status_code = 503

        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch("httpx.AsyncClient") as mock_client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await _send_warmup_request(
                "https://hf.example.com/v1", "token", "streaming",
            )
            assert result == "warming"

    @pytest.mark.asyncio
    async def test_timeout_returns_warming(self):
        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch("httpx.AsyncClient") as mock_client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(
                side_effect=httpx.TimeoutException("timed out"),
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await _send_warmup_request(
                "https://hf.example.com/v1", "token", "streaming",
            )
            assert result == "warming"

    @pytest.mark.asyncio
    async def test_other_error_returns_error(self):
        with (
            patch(
                "app.services.warmup_service.get_settings",
                return_value=_mock_settings(),
            ),
            patch("httpx.AsyncClient") as mock_client_cls,
        ):
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(
                side_effect=ConnectionError("fail"),
            )
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await _send_warmup_request(
                "https://hf.example.com/v1", "token", "streaming",
            )
            assert result == "error"
