"""Aggregate AI summary across a user's recent inspections.

Powers the dashboard "What's going on" card. Pulls the most recent inspections
across all of a user's hives, fetches a short weather forecast for the user's
primary apiary, and asks the configured LLM for a short paragraph summarising
trends/concerns plus weather-aware suggestions.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import httpx
import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.apiary import Apiary
from app.models.hive import Hive
from app.redis_utils import redis_kwargs
from app.services import inspection_service
from app.services.ai_summary import generate_completion

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class DashboardSummaryResult:
    summary: str
    inspection_count: int
    generated_at: datetime


# ── Cache invalidation ───────────────────────────────────────────────────────


async def invalidate_dashboard_summary(user_id) -> None:
    """Drop the cached summary for a user. Called when a new inspection lands."""
    settings = get_settings()
    try:
        r = aioredis.from_url(settings.redis_url, **redis_kwargs())
    except Exception:
        logger.warning("Redis unavailable for dashboard cache invalidation", exc_info=True)
        return
    try:
        await r.delete(f"dashboard:summary:{user_id}")
    except Exception:
        logger.warning("Failed to invalidate dashboard summary cache", exc_info=True)
    finally:
        await r.aclose()


# ── Internal helpers ─────────────────────────────────────────────────────────


async def _primary_apiary_location(
    db: AsyncSession, user_id: UUID
) -> tuple[float, float] | None:
    """Return (lat, lng) for the user's most recently created apiary with coords."""
    stmt = (
        select(Apiary.latitude, Apiary.longitude)
        .where(
            Apiary.user_id == user_id,
            Apiary.deleted_at.is_(None),
            Apiary.archived_at.is_(None),
            Apiary.latitude.is_not(None),
            Apiary.longitude.is_not(None),
        )
        .order_by(Apiary.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.first()
    if row is None:
        return None
    return float(row[0]), float(row[1])


async def _fetch_forecast_summary(lat: float, lng: float) -> str | None:
    """Fetch a tiny 3-day forecast from open-meteo and format as a short string."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "temperature_2m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
        "timezone": "auto",
        "forecast_days": 3,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        logger.warning("Forecast fetch failed for %s,%s", lat, lng, exc_info=True)
        return None

    return _format_forecast(data)


def _format_forecast(data: dict) -> str | None:
    """Turn raw open-meteo response into a compact string for the LLM prompt."""
    days = data.get("daily", {})
    times = days.get("time", []) or []
    if not times:
        return None

    parts: list[str] = []
    current_t = data.get("current", {}).get("temperature_2m")
    if current_t is not None:
        parts.append(f"now ~{round(current_t)}\u00b0C")

    for i, date in enumerate(times):
        precip = (days.get("precipitation_sum") or [None] * len(times))[i]
        tmax = (days.get("temperature_2m_max") or [None] * len(times))[i]
        tmin = (days.get("temperature_2m_min") or [None] * len(times))[i]
        bits: list[str] = [date]
        if tmin is not None and tmax is not None:
            bits.append(f"{round(tmin)}-{round(tmax)}\u00b0C")
        if precip is not None:
            bits.append(f"{precip:.1f}mm rain")
        parts.append(" ".join(bits))
    return "; ".join(parts)


def _condense_inspection(insp, hive_name: str) -> dict:
    """Produce a compact dict for the LLM prompt."""
    return {
        "hive": hive_name,
        "inspected_at": insp.inspected_at.isoformat() if insp.inspected_at else None,
        "ai_summary": insp.ai_summary,
        "observations": insp.observations,
        "notes": insp.notes,
    }


def _build_prompt(condensed: list[dict], forecast: str | None) -> list[dict]:
    """Assemble the LLM messages list for the dashboard digest."""
    user_parts = [
        "Summarise what's been going on across this beekeeper's recent hive "
        "inspections. Surface trends, concerns, and what to keep an eye on. "
        "If a forecast is provided, weave in any actionable advice "
        "(e.g. inspection windows, feeding decisions). "
        "Keep it to 3-5 sentences, friendly and direct, no bullet lists.",
        f"\nRecent inspections (newest first):\n{json.dumps(condensed, default=str)}",
    ]
    if forecast:
        user_parts.append(f"\n3-day forecast: {forecast}")

    return [
        {
            "role": "system",
            "content": (
                "You are a beekeeping assistant writing a one-paragraph "
                "dashboard digest. Be concise and concrete."
            ),
        },
        {"role": "user", "content": "\n".join(user_parts)},
    ]


# ── Main entry point ─────────────────────────────────────────────────────────


async def generate_dashboard_summary(
    db: AsyncSession,
    user_id: UUID,
    limit: int = 5,
) -> DashboardSummaryResult:
    """Build the dashboard summary string. Returns empty string if no inspections."""
    inspections = await inspection_service.get_inspections(
        db, user_id=user_id, limit=limit
    )
    if not inspections:
        return DashboardSummaryResult(
            summary="", inspection_count=0, generated_at=datetime.now(UTC),
        )

    # Bulk load hive names so we don't trigger N lazy loads.
    hive_ids = {insp.hive_id for insp in inspections}
    hive_rows = await db.execute(
        select(Hive.id, Hive.name).where(Hive.id.in_(hive_ids))
    )
    hive_names = {hid: name for hid, name in hive_rows.all()}

    condensed = [
        _condense_inspection(insp, hive_names.get(insp.hive_id, "(hive)"))
        for insp in inspections
    ]

    location = await _primary_apiary_location(db, user_id)
    forecast = await _fetch_forecast_summary(*location) if location else None
    messages = _build_prompt(condensed, forecast)

    try:
        text = await generate_completion(messages)
    except (httpx.HTTPStatusError, httpx.RequestError) as exc:
        # HF Inference endpoint scales to zero; 503s and connect errors are
        # expected. Return an empty summary so the mobile tile hides itself —
        # the client will regenerate on pull-to-refresh.
        logger.info("Dashboard summary unavailable, returning empty: %s", exc)
        return DashboardSummaryResult(
            summary="",
            inspection_count=len(inspections),
            generated_at=datetime.now(UTC),
        )

    return DashboardSummaryResult(
        summary=text.strip(),
        inspection_count=len(inspections),
        generated_at=datetime.now(UTC),
    )
