"""Agricultural data service for runtime LLM context enrichment.

Fetches and caches data from USDA NASS and FAOSTAT for inclusion
in chat system prompts.
"""

import json
import logging

import httpx
import redis

from app.config import get_settings
from app.redis_utils import redis_kwargs

logger = logging.getLogger(__name__)
settings = get_settings()

CACHE_TTL_SECONDS = 86400  # 24 hours
NASS_BASE_URL = "https://quickstats.nass.usda.gov/api/api_GET/"


async def build_context_block(state: str | None = None) -> str:
    """Build a context block of relevant statistics for LLM prompts.

    Returns a formatted string to inject into the system prompt.
    """
    parts = []

    colony_stats = _get_cached("ag:us_colonies")
    if colony_stats:
        data = json.loads(colony_stats)
        parts.append(f"US honey bee colonies: {data.get('total', 'N/A')}")
        if state and state in data.get("by_state", {}):
            parts.append(f"{state} colonies: {data['by_state'][state]}")

    loss_stats = _get_cached("ag:loss_rate")
    if loss_stats:
        data = json.loads(loss_stats)
        parts.append(f"Annual colony loss rate: {data.get('rate', 'N/A')}%")

    if not parts:
        return ""

    return "Current beekeeping statistics:\n" + "\n".join(f"- {p}" for p in parts)


def refresh_usda_cache(api_key: str) -> None:
    """Fetch latest USDA NASS data and update the Redis cache.

    Intended to be called from a Celery periodic task.
    """
    try:
        data = _fetch_nass_colonies(api_key)
        _set_cached("ag:us_colonies", json.dumps(data))
        logger.info("Refreshed USDA colony cache: %s", data.get("total"))
    except Exception:
        logger.exception("Failed to refresh USDA colony cache")


def _fetch_nass_colonies(api_key: str) -> dict:
    """Fetch latest colony count data from USDA NASS."""
    params = {
        "key": api_key,
        "commodity_desc": "HONEY, BEE COLONIES",
        "statisticcat_desc": "INVENTORY",
        "agg_level_desc": "STATE",
        "format": "JSON",
    }
    with httpx.Client(timeout=30) as client:
        resp = client.get(NASS_BASE_URL, params=params)
        resp.raise_for_status()
        records = resp.json().get("data", [])

    by_state = {}
    for rec in records:
        state = rec.get("state_name", "")
        value = rec.get("Value", "").replace(",", "")
        if state and value and value not in ("(D)", "(Z)"):
            by_state[state] = value

    total = sum(int(v) for v in by_state.values() if v.isdigit())
    return {"total": f"{total:,}", "by_state": by_state}


def _get_cached(key: str) -> str | None:
    """Get a value from Redis cache."""
    try:
        r = redis.from_url(settings.redis_url, **redis_kwargs())
        value = r.get(key)
        r.close()
        return value.decode() if value else None
    except Exception:
        logger.debug("Redis cache miss for %s", key)
        return None


def _set_cached(key: str, value: str) -> None:
    """Set a value in Redis cache with TTL."""
    try:
        r = redis.from_url(settings.redis_url, **redis_kwargs())
        r.set(key, value, ex=CACHE_TTL_SECONDS)
        r.close()
    except Exception:
        logger.debug("Redis cache write failed for %s", key)
