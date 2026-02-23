"""Health check endpoints."""

import ssl
from importlib.metadata import PackageNotFoundError, version

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db

router = APIRouter()

try:
    _APP_VERSION = version("beebuddy-api")
except PackageNotFoundError:
    _APP_VERSION = "0.1.0-dev"


@router.get("/health")
async def health_check():
    """Basic health check endpoint."""
    return {"status": "healthy", "version": _APP_VERSION}


@router.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check that verifies DB and Redis connectivity."""
    postgres_status = await _check_postgres(db)
    redis_status = await _check_redis()
    return {"postgres": postgres_status, "redis": redis_status}


async def _check_postgres(db: AsyncSession) -> str:
    try:
        await db.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        return "error"


async def _check_redis() -> str:
    try:
        settings = get_settings()
        kwargs = {}
        if settings.redis_url.startswith("rediss://"):
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
            kwargs["ssl"] = ssl_ctx
        async with aioredis.from_url(settings.redis_url, **kwargs) as client:
            await client.ping()
        return "ok"
    except Exception:
        return "error"


@router.get("/")
async def root():
    """Root endpoint."""
    return {"message": "BeeBuddy API", "docs": "/docs"}
