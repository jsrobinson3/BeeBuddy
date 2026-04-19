"""Dashboard endpoints — currently the at-a-glance AI summary."""

import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.redis_utils import redis_kwargs
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_summary import generate_dashboard_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard")

# 8 hours — see plan: balances forecast freshness with LLM cost. Cache is
# also invalidated by the inspection-summary Celery task when a new
# inspection is created, so recent activity surfaces sooner.
CACHE_TTL_SECONDS = 8 * 60 * 60


def _cache_key(user_id) -> str:
    return f"dashboard:summary:{user_id}"


async def _get_redis() -> aioredis.Redis | None:
    settings = get_settings()
    try:
        return aioredis.from_url(settings.redis_url, **redis_kwargs())
    except Exception:
        logger.warning("Redis unavailable for dashboard summary cache", exc_info=True)
        return None


async def _read_cached(redis: aioredis.Redis, key: str) -> DashboardSummaryResponse | None:
    """Return cached response or None."""
    try:
        cached = await redis.get(key)
        if cached:
            return DashboardSummaryResponse(**json.loads(cached))
    except Exception:
        logger.warning("Failed to read dashboard summary cache", exc_info=True)
    return None


async def _write_cache(redis: aioredis.Redis, key: str, response: DashboardSummaryResponse) -> None:
    """Write response to cache, swallowing errors."""
    try:
        await redis.setex(key, CACHE_TTL_SECONDS, response.model_dump_json())
    except Exception:
        logger.warning("Failed to write dashboard summary cache", exc_info=True)


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Return a cached AI summary across the user's recent inspections."""
    key = _cache_key(current_user.id)
    redis = await _get_redis()
    try:
        if redis is not None:
            hit = await _read_cached(redis, key)
            if hit is not None:
                return hit

        result = await generate_dashboard_summary(db, user_id=current_user.id)
        response = DashboardSummaryResponse(
            summary=result.summary,
            inspection_count=result.inspection_count,
            generated_at=result.generated_at,
        )

        # Only cache stable states: successful generation, or the
        # "no inspections" empty. Skip caching when generation failed
        # (inspections present but summary empty) so pull-to-refresh retries.
        should_cache = result.inspection_count == 0 or bool(result.summary)
        if redis is not None and should_cache:
            await _write_cache(redis, key, response)

        return response
    finally:
        if redis is not None:
            await redis.aclose()
