"""HF Inference Endpoint pre-warming service.

Triggers scale-up of HF endpoints before the user reaches chat.
Uses Redis cooldown to prevent spamming the endpoint.
"""

from __future__ import annotations

import logging

import httpx
import redis.asyncio as aioredis

from app.config import LLMProvider, get_settings
from app.redis_utils import redis_kwargs

logger = logging.getLogger(__name__)

_WARMUP_KEY_PREFIX = "hf:warmup:"


async def warm_endpoints() -> dict:
    """Fire warm-up requests to all HF endpoints that need it.

    Returns a status dict, e.g.
    ``{"streaming": "warming", "tool": "cooldown", "skipped": False}``.

    Safe to call frequently — Redis cooldown prevents duplicate requests.
    """
    settings = get_settings()
    endpoints = _collect_hf_endpoints(settings)

    if not endpoints:
        return {"skipped": True}

    results: dict[str, str | bool] = {"skipped": False}

    try:
        async with aioredis.from_url(
            settings.redis_url, **redis_kwargs(),
        ) as r:
            await _warm_all(r, endpoints, settings, results)
    except Exception:
        logger.exception("Warmup Redis error")
        results["error"] = "redis_unavailable"

    return results


async def _warm_all(
    r: aioredis.Redis,
    endpoints: dict[str, tuple[str, str | None]],
    settings,
    results: dict,
) -> None:
    """Iterate endpoints and warm each one with cooldown."""
    cooldown = settings.hf_warmup_cooldown_seconds
    for label, (base_url, api_key) in endpoints.items():
        results[label] = await _warm_one(
            r, base_url, api_key, label, cooldown,
        )


async def _warm_one(
    r: aioredis.Redis,
    base_url: str, api_key: str | None, label: str, cooldown: int,
) -> str:
    """Check cooldown and warm a single endpoint."""
    cache_key = f"{_WARMUP_KEY_PREFIX}{base_url}"
    acquired = await r.set(cache_key, "1", ex=cooldown, nx=True)
    if not acquired:
        return "cooldown"
    return await _send_warmup_request(base_url, api_key, label)


def _collect_hf_endpoints(settings) -> dict[str, tuple[str, str | None]]:
    """Build a dict of unique HF endpoints to warm."""
    endpoints: dict[str, tuple[str, str | None]] = {}

    if settings.llm_provider == LLMProvider.HUGGINGFACE:
        endpoints["streaming"] = (
            settings.llm_base_url, settings.llm_api_key,
        )

    if settings.effective_tool_provider == LLMProvider.HUGGINGFACE:
        tool_url = settings.llm_tool_base_url
        # Don't duplicate if same endpoint
        if "streaming" not in endpoints or (
            endpoints["streaming"][0] != tool_url
        ):
            endpoints["tool"] = (tool_url, settings.llm_tool_api_key)

    return endpoints


async def _send_warmup_request(
    base_url: str, api_key: str | None, label: str,
) -> str:
    """Send a minimal completion request to wake the endpoint.

    Returns ``"already_warm"`` (200), ``"warming"`` (503/timeout),
    or ``"error"``.
    """
    settings = get_settings()
    model = (
        settings.llm_model
        if label == "streaming"
        else settings.effective_tool_model
    )
    url = f"{base_url}/chat/completions"
    body = {
        "model": model,
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=body, headers=headers)

        if resp.status_code == 200:
            logger.info("HF endpoint %s is already warm", label)
            return "already_warm"

        if resp.status_code == 503:
            logger.info("HF endpoint %s is cold-starting", label)
            return "warming"

        logger.warning(
            "HF warmup %s unexpected status %s: %s",
            label, resp.status_code, resp.text[:200],
        )
        return "error"

    except httpx.TimeoutException:
        # Timeout is expected — connection attempt triggers HF scale-up
        logger.info("HF warmup %s timed out (expected for cold start)", label)
        return "warming"
    except Exception:
        logger.exception("HF warmup %s failed", label)
        return "error"
