"""HF Inference Endpoint status, wake, and fallback utilities.

Provides SDK-based status checks, wake/poll helpers, and a standalone
``query_with_fallback`` orchestrator that routes to a configurable
fallback LLM when the primary endpoint is cold.

All public functions accept explicit credentials so they work both
inside the FastAPI app (via ``get_settings()``) and from standalone
CLI scripts.
"""

from __future__ import annotations

import asyncio
import logging
import time
from functools import lru_cache

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_NAMESPACE = "jsrobinson3"
_DEFAULT_ENDPOINT = "beebuddy-bee-gguf-jjo"
_ANTHROPIC_VERSION = "2023-06-01"


# ---------------------------------------------------------------------------
# Status & wake helpers
# ---------------------------------------------------------------------------


def get_endpoint_status(
    namespace: str = _DEFAULT_NAMESPACE,
    name: str = _DEFAULT_ENDPOINT,
    hf_token: str | None = None,
) -> str:
    """Return the current HF Inference Endpoint status string.

    Uses ``huggingface_hub.HfApi.get_inference_endpoint()``.
    Possible values: ``"running"``, ``"scaledToZero"``, ``"paused"``,
    ``"failed"``, ``"initializing"``, etc.
    """
    from huggingface_hub import HfApi

    api = HfApi(token=hf_token)
    ep = api.get_inference_endpoint(name, namespace=namespace)
    return ep.status


async def wake_endpoint(
    namespace: str = _DEFAULT_NAMESPACE,
    name: str = _DEFAULT_ENDPOINT,
    hf_token: str | None = None,
) -> str:
    """Send a lightweight inference request to trigger endpoint scale-up.

    Returns ``"already_warm"`` (200), ``"warming"`` (503/timeout),
    or ``"error"``.
    """
    from huggingface_hub import HfApi

    api = HfApi(token=hf_token)
    ep = api.get_inference_endpoint(name, namespace=namespace)
    url = f"{ep.url}/v1/chat/completions"
    body = {
        "model": "tgi",
        "messages": [{"role": "user", "content": "hi"}],
        "max_tokens": 1,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {hf_token}"} if hf_token else {}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=body, headers=headers)
        if resp.status_code == 200:
            logger.info("Endpoint %s/%s is already warm", namespace, name)
            return "already_warm"
        if resp.status_code == 503:
            logger.info("Endpoint %s/%s is cold-starting", namespace, name)
            return "warming"
        logger.warning(
            "Endpoint %s/%s unexpected status %s",
            namespace, name, resp.status_code,
        )
        return "error"
    except httpx.TimeoutException:
        logger.info("Endpoint %s/%s wake timed out (expected for cold start)", namespace, name)
        return "warming"
    except Exception:
        logger.exception("Endpoint %s/%s wake failed", namespace, name)
        return "error"


async def wait_until_ready(
    namespace: str = _DEFAULT_NAMESPACE,
    name: str = _DEFAULT_ENDPOINT,
    hf_token: str | None = None,
    timeout: int = 360,
    poll_interval: int = 5,
) -> bool:
    """Poll endpoint status until ``"running"`` or *timeout* seconds elapsed."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status = get_endpoint_status(namespace, name, hf_token)
        if status == "running":
            return True
        logger.info("Endpoint status: %s — waiting %ds", status, poll_interval)
        await asyncio.sleep(poll_interval)
    return False


# ---------------------------------------------------------------------------
# System prompt loader
# ---------------------------------------------------------------------------


@lru_cache
def load_buddy_system_prompt() -> str:
    """Return Buddy's full system prompt (personality + tool addendum).

    Imports from ``ai_service`` to stay DRY. Context placeholder is filled
    with an empty string for standalone / CLI use.
    """
    from app.services.ai_service import SYSTEM_PROMPT_TEMPLATE, TOOL_SYSTEM_ADDENDUM

    return SYSTEM_PROMPT_TEMPLATE.format(context="") + TOOL_SYSTEM_ADDENDUM


# ---------------------------------------------------------------------------
# Standalone Anthropic query helper
# ---------------------------------------------------------------------------


async def query_anthropic(
    prompt: str,
    api_key: str,
    model: str = "claude-haiku-4-5-20251001",
    system_prompt: str | None = None,
) -> str:
    """Simple non-streaming Anthropic Messages API call.

    When *system_prompt* is provided, the ``"system"`` key is included in
    the request body. When ``None``, the key is omitted (backward-compatible).
    """
    body: dict = {
        "model": model,
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system_prompt is not None:
        body["system"] = system_prompt

    headers = {
        "x-api-key": api_key,
        "anthropic-version": _ANTHROPIC_VERSION,
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()

    data = resp.json()
    parts = [
        b.get("text", "")
        for b in data.get("content", [])
        if b.get("type") == "text"
    ]
    return "".join(parts)


# ---------------------------------------------------------------------------
# Standalone fallback orchestrator
# ---------------------------------------------------------------------------


async def query_with_fallback(
    prompt: str,
    *,
    namespace: str = _DEFAULT_NAMESPACE,
    name: str = _DEFAULT_ENDPOINT,
    hf_token: str | None = None,
    fallback_api_key: str | None = None,
    fallback_model: str = "claude-haiku-4-5-20251001",
) -> dict:
    """Query the HF endpoint, falling back to a configured LLM when cold.

    Returns a dict with keys:
    - ``response``: the generated text
    - ``source``: ``"buddy"`` or ``"fallback"``
    - ``endpoint_status`` (only when source is fallback): e.g. ``"waking"``
    """
    status = get_endpoint_status(namespace, name, hf_token)

    if status == "running":
        # Query the HF endpoint directly
        from huggingface_hub import HfApi

        api = HfApi(token=hf_token)
        ep = api.get_inference_endpoint(name, namespace=namespace)
        url = f"{ep.url}/v1/chat/completions"
        body = {
            "model": "tgi",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 4096,
            "stream": False,
        }
        headers = {"Authorization": f"Bearer {hf_token}"} if hf_token else {}

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=body, headers=headers)
            resp.raise_for_status()

        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return {"response": text, "source": "buddy"}

    # Endpoint is cold — fire wake and fall back
    asyncio.create_task(wake_endpoint(namespace, name, hf_token))

    if not fallback_api_key:
        return {
            "response": "Buddy is waking up. Please try again in a few minutes.",
            "source": "fallback",
            "endpoint_status": "waking",
        }

    system = load_buddy_system_prompt()
    text = await query_anthropic(
        prompt, fallback_api_key, model=fallback_model, system_prompt=system,
    )
    return {"response": text, "source": "fallback", "endpoint_status": "waking"}
