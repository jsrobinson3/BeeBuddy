"""Dashboard endpoints — currently the at-a-glance AI summary."""

import json
import logging
from datetime import datetime

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.redis_utils import redis_kwargs
from app.services.dashboard_summary import generate_dashboard_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/dashboard")

# 8 hours — see plan: balances forecast freshness with LLM cost. Cache is
# also invalidated by the inspection-summary Celery task when a new
# inspection is created, so recent activity surfaces sooner.
CACHE_TTL_SECONDS = 8 * 60 * 60


def cache_key(user_id) -> str:
    return f"dashboard:summary:{user_id}"


class DashboardSummaryResponse(BaseModel):
    summary: str
    inspection_count: int
    generated_at: datetime


async def _get_redis() -> aioredis.Redis | None:
    settings = get_settings()
    try:
        return aioredis.from_url(settings.redis_url, **redis_kwargs())
    except Exception:
        logger.warning("Redis unavailable for dashboard summary cache", exc_info=True)
        return None


@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummaryResponse:
    """Return a cached AI summary across the user's recent inspections."""
    key = cache_key(current_user.id)
    redis = await _get_redis()
    try:
        if redis is not None:
            try:
                cached = await redis.get(key)
                if cached:
                    payload = json.loads(cached)
                    return DashboardSummaryResponse(**payload)
            except Exception:
                logger.warning("Failed to read dashboard summary cache", exc_info=True)

        result = await generate_dashboard_summary(db, user_id=current_user.id)
        response = DashboardSummaryResponse(
            summary=result.summary,
            inspection_count=result.inspection_count,
            generated_at=result.generated_at,
        )

        if redis is not None and result.inspection_count > 0:
            try:
                await redis.setex(
                    key,
                    CACHE_TTL_SECONDS,
                    response.model_dump_json(),
                )
            except Exception:
                logger.warning(
                    "Failed to write dashboard summary cache", exc_info=True
                )

        return response
    finally:
        if redis is not None:
            await redis.aclose()


async def invalidate_dashboard_summary(user_id) -> None:
    """Drop the cached summary for a user. Called when a new inspection lands."""
    redis = await _get_redis()
    if redis is None:
        return
    try:
        await redis.delete(cache_key(user_id))
    except Exception:
        logger.warning("Failed to invalidate dashboard summary cache", exc_info=True)
    finally:
        await redis.aclose()
