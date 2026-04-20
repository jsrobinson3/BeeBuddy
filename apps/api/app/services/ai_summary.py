"""Non-streaming LLM summary generation for inspections."""

import asyncio
import json
import logging

import httpx

from app.config import LLMProvider, get_settings
from app.services._llm_utils import _split_system
from app.services.tool_executor import ColdStartError

logger = logging.getLogger(__name__)
settings = get_settings()

ANTHROPIC_VERSION = "2023-06-01"

# Matches the streaming path in ai_service.py — ~120s total budget for
# HF Inference Endpoints that scale to zero and return 503 on cold start.
_COLD_START_DELAYS = [5, 5, 10, 10, 15, 15, 20, 20, 20]


async def generate_summary(
    observations: dict | None,
    weather: dict | None,
    notes: str | None,
) -> str:
    """Generate a text summary of an inspection (non-streaming)."""
    prompt = "Summarize this hive inspection concisely:\n"
    if observations:
        prompt += f"Observations: {json.dumps(observations)}\n"
    if weather:
        prompt += f"Weather: {json.dumps(weather)}\n"
    if notes:
        prompt += f"Notes: {notes}\n"

    messages = [
        {"role": "system", "content": "You are a beekeeping assistant. Summarize concisely."},
        {"role": "user", "content": prompt},
    ]

    if settings.llm_provider == LLMProvider.ANTHROPIC:
        call = _generate_anthropic
    else:
        call = _generate_openai_compat
    return await _with_cold_start_retry(call, messages)


async def _with_cold_start_retry(call, messages: list[dict]) -> str:
    """Invoke an LLM call, retrying on 503 cold-start errors."""
    for attempt in range(len(_COLD_START_DELAYS) + 1):
        try:
            return await call(messages)
        except ColdStartError:
            if attempt >= len(_COLD_START_DELAYS):
                raise
            delay = _COLD_START_DELAYS[attempt]
            logger.info(
                "LLM endpoint cold-starting, retry %d in %ds", attempt + 1, delay,
            )
            await asyncio.sleep(delay)
    # Unreachable — the loop either returns or raises.
    raise RuntimeError("cold-start retry loop exited unexpectedly")


async def _generate_openai_compat(messages: list[dict]) -> str:
    """Non-streaming completion via OpenAI-compatible endpoint."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            json={"model": settings.llm_model, "messages": messages, "stream": False},
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        )
        if resp.status_code == 503:
            raise ColdStartError("Endpoint is scaled to zero")
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _generate_anthropic(messages: list[dict]) -> str:
    """Non-streaming completion via Anthropic Messages API."""
    system, chat = _split_system(messages)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/messages",
            json={
                "model": settings.llm_model,
                "max_tokens": 1024,
                "system": system,
                "messages": chat,
            },
            headers={
                "x-api-key": settings.llm_api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
        )
        if resp.status_code == 503:
            raise ColdStartError("Endpoint is scaled to zero")
        resp.raise_for_status()
        data = resp.json()
    return data["content"][0]["text"]
