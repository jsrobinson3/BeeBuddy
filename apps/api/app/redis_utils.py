"""Centralized Redis and database SSL configuration."""

import ssl

from app.config import get_settings


def redis_kwargs() -> dict:
    """Extra kwargs for redis.asyncio / redis-py connections."""
    settings = get_settings()
    if not settings.redis_url.startswith("rediss://"):
        return {}
    if settings.redis_ca_cert:
        return {"ssl_cert_reqs": "required", "ssl_ca_certs": settings.redis_ca_cert}
    return {"ssl_cert_reqs": "none"}


def celery_broker_ssl() -> dict | None:
    """SSL config dict for Celery's broker_use_ssl, or None if not needed."""
    settings = get_settings()
    if not settings.redis_url.startswith("rediss://"):
        return None
    if settings.redis_ca_cert:
        return {
            "ssl_cert_reqs": ssl.CERT_REQUIRED,
            "ssl_ca_certs": settings.redis_ca_cert,
        }
    return {"ssl_cert_reqs": ssl.CERT_NONE}


def database_connect_args() -> dict:
    """SQLAlchemy connect_args for asyncpg with optional SSL."""
    settings = get_settings()
    if not settings.database_requires_ssl:
        return {}
    ctx = ssl.create_default_context()
    if settings.database_ca_cert:
        ctx.load_verify_locations(settings.database_ca_cert)
    else:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return {"ssl": ctx}
