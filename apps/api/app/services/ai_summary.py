"""Non-streaming LLM summary generation for inspections."""

import json

import httpx

from app.config import LLMProvider, get_settings

settings = get_settings()

ANTHROPIC_VERSION = "2023-06-01"


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Separate system message from chat messages for Anthropic API."""
    system = ""
    chat: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            chat.append(m)
    return system, chat


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
        return await _generate_anthropic(messages)
    return await _generate_openai_compat(messages)


async def _generate_openai_compat(messages: list[dict]) -> str:
    """Non-streaming completion via OpenAI-compatible endpoint."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            json={"model": settings.llm_model, "messages": messages, "stream": False},
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        )
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
        resp.raise_for_status()
        data = resp.json()
    return data["content"][0]["text"]
