"""Redis-backed token blocklist for server-side token invalidation on logout."""

import logging

import redis.asyncio as aioredis

from app.config import get_settings
from app.redis_utils import redis_kwargs as _redis_kwargs

logger = logging.getLogger(__name__)

_PREFIX = "blocklist:"


async def block_token(jti: str, ttl_seconds: int) -> None:
    """Add a token JTI to the blocklist with a TTL matching the token's remaining lifetime."""
    if ttl_seconds <= 0:
        return
    settings = get_settings()
    try:
        async with aioredis.from_url(settings.redis_url, **_redis_kwargs()) as client:
            await client.setex(f"{_PREFIX}{jti}", ttl_seconds, "1")
    except Exception:
        logger.warning("Failed to blocklist token %s — Redis unavailable", jti, exc_info=True)


async def is_blocked(jti: str) -> bool:
    """Check whether a token JTI has been blocklisted."""
    settings = get_settings()
    try:
        async with aioredis.from_url(settings.redis_url, **_redis_kwargs()) as client:
            return await client.exists(f"{_PREFIX}{jti}") > 0
    except Exception:
        logger.warning("Failed to check blocklist for %s — Redis unavailable", jti, exc_info=True)
        return False
