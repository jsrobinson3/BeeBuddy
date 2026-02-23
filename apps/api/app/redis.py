"""Shared async Redis / Valkey connection pool."""

import redis.asyncio as aioredis

from app.config import get_settings

_pool: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return a lazily-initialised async Redis connection pool."""
    global _pool
    if _pool is None:
        settings = get_settings()
        kwargs: dict = {}
        if settings.redis_url.startswith("rediss://"):
            kwargs["ssl_cert_reqs"] = "none"
        _pool = aioredis.from_url(settings.redis_url, **kwargs)
    return _pool
