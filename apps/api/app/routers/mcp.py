"""External MCP endpoint for Claude Desktop and other MCP clients.

Mounts a FastMCP Streamable-HTTP sub-application at ``/mcp`` that is
protected by BeeBuddy's existing HS256 JWT tokens.  MCP clients obtain
tokens via the OAuth2 PKCE flow (see ``oauth2_server.py``).

Architecture
------------
* A *single* ``FastMCP`` instance is created at import time with a
  ``JWTVerifier`` configured for BeeBuddy's shared ``secret_key``.
* Each tool call retrieves ``user_id`` from the verified JWT claims via
  FastMCP's request context and opens a fresh async DB session.
* The resulting Starlette ASGI app is exposed as ``mcp_app`` for mounting
  in ``main.py``.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastmcp import FastMCP
from fastmcp.server.auth.providers.jwt import JWTVerifier
from sqlalchemy import func, select

from app.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.apiary import Apiary
from app.models.harvest import Harvest
from app.models.hive import Hive
from app.services import (
    apiary_service,
    event_service,
    harvest_service,
    hive_service,
    inspection_service,
    queen_service,
    task_service,
    treatment_service,
)

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_RESULTS = 50


# ---------------------------------------------------------------------------
# Auth: reuse BeeBuddy's HS256 secret for token verification
# ---------------------------------------------------------------------------

_jwt_verifier = JWTVerifier(
    public_key=settings.secret_key,
    algorithm="HS256",
    required_scopes=["mcp:read"],
)

# ---------------------------------------------------------------------------
# FastMCP server
# ---------------------------------------------------------------------------

mcp_server = FastMCP(
    "BeeBuddy",
    instructions=(
        "You have access to a beekeeper's hive-management data. "
        "Use these tools to answer questions about apiaries, hives, "
        "inspections, harvests, treatments, queens, events, and tasks."
    ),
    auth=_jwt_verifier,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _cap(limit: int | None) -> int:
    if limit is None or limit < 1:
        return MAX_RESULTS
    return min(limit, MAX_RESULTS)


def _uuid(val: str | None) -> UUID | None:
    if not val:
        return None
    try:
        return UUID(val)
    except ValueError:
        return None


def _ser(val: datetime | None) -> str | None:
    return val.isoformat() if val else None


async def _user_id_from_context(ctx) -> UUID:
    """Extract user_id from the verified access token in request context."""
    token = ctx.access_token
    sub = token.claims.get("sub") if token else None
    if not sub:
        raise ValueError("Missing sub claim in access token")
    return UUID(sub)


# ---------------------------------------------------------------------------
# Record serializers (kept flat to avoid nesting inside tool functions)
# ---------------------------------------------------------------------------


def _apiary_row(a) -> dict:
    return {
        "id": str(a.id),
        "name": a.name,
        "hive_count": getattr(a, "hive_count", 0),
        "city": a.city,
        "country_code": a.country_code,
        "notes": a.notes,
        "created_at": _ser(a.created_at),
    }


def _hive_row(h) -> dict:
    return {
        "id": str(h.id),
        "apiary_id": str(h.apiary_id),
        "name": h.name,
        "hive_type": str(h.hive_type.value) if h.hive_type else None,
        "status": str(h.status.value) if h.status else None,
        "source": str(h.source.value) if h.source else None,
        "installation_date": str(h.installation_date) if h.installation_date else None,
        "notes": h.notes,
    }


def _inspection_row(i) -> dict:
    return {
        "id": str(i.id),
        "hive_id": str(i.hive_id),
        "inspected_at": _ser(i.inspected_at),
        "duration_minutes": i.duration_minutes,
        "observations": i.observations,
        "weather": i.weather,
        "impression": i.impression,
        "attention": i.attention,
        "notes": i.notes,
        "ai_summary": i.ai_summary,
    }


def _harvest_row(h) -> dict:
    return {
        "id": str(h.id),
        "hive_id": str(h.hive_id),
        "harvested_at": _ser(h.harvested_at),
        "weight_kg": h.weight_kg,
        "moisture_percent": h.moisture_percent,
        "honey_type": h.honey_type,
        "flavor_notes": h.flavor_notes,
        "frames_harvested": h.frames_harvested,
        "notes": h.notes,
    }


def _treatment_row(t) -> dict:
    return {
        "id": str(t.id),
        "hive_id": str(t.hive_id),
        "treatment_type": t.treatment_type,
        "product_name": t.product_name,
        "method": t.method,
        "started_at": _ser(t.started_at),
        "ended_at": _ser(t.ended_at),
        "dosage": t.dosage,
        "effectiveness_notes": t.effectiveness_notes,
    }


def _queen_row(q) -> dict:
    return {
        "id": str(q.id),
        "hive_id": str(q.hive_id),
        "marking_color": q.marking_color,
        "marking_year": q.marking_year,
        "origin": str(q.origin.value) if q.origin else None,
        "status": str(q.status.value) if q.status else None,
        "race": q.race,
        "quality": q.quality,
        "fertilized": q.fertilized,
        "clipped": q.clipped,
        "birth_date": str(q.birth_date) if q.birth_date else None,
        "introduced_date": str(q.introduced_date) if q.introduced_date else None,
        "notes": q.notes,
    }


def _event_row(e) -> dict:
    return {
        "id": str(e.id),
        "hive_id": str(e.hive_id),
        "event_type": str(e.event_type.value) if e.event_type else None,
        "occurred_at": _ser(e.occurred_at),
        "details": e.details,
        "notes": e.notes,
    }


def _task_row(t) -> dict:
    return {
        "id": str(t.id),
        "title": t.title,
        "description": t.description,
        "due_date": str(t.due_date) if t.due_date else None,
        "priority": str(t.priority.value) if t.priority else None,
        "completed_at": _ser(t.completed_at),
        "hive_id": str(t.hive_id) if t.hive_id else None,
        "apiary_id": str(t.apiary_id) if t.apiary_id else None,
    }


def _health_row(h, last_insp, queen) -> dict:
    return {
        "hive_id": str(h.id),
        "hive_name": h.name,
        "status": str(h.status.value) if h.status else None,
        "last_inspection_date": _ser(last_insp.inspected_at) if last_insp else None,
        "last_impression": last_insp.impression if last_insp else None,
        "attention_needed": last_insp.attention if last_insp else None,
        "queen_status": str(queen.status.value) if queen else "unknown",
        "queen_origin": str(queen.origin.value) if queen and queen.origin else None,
    }


# ---------------------------------------------------------------------------
# Tools (mirror the per-request tools in mcp_tools.py)
# ---------------------------------------------------------------------------


@mcp_server.tool()
async def list_apiaries(ctx) -> list[dict]:
    """List all of the beekeeper's apiaries with hive counts."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        apiaries = await apiary_service.get_apiaries(db, uid)
    return [_apiary_row(a) for a in apiaries]


@mcp_server.tool()
async def list_hives(ctx, apiary_id: str | None = None) -> list[dict]:
    """List hives, optionally filtered by apiary ID."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        hives = await hive_service.get_hives(db, uid, apiary_id=_uuid(apiary_id))
    return [_hive_row(h) for h in hives]


@mcp_server.tool()
async def get_inspections(
    ctx, hive_id: str | None = None, limit: int = 10
) -> list[dict]:
    """Get recent inspections, optionally filtered by hive ID."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        rows = await inspection_service.get_inspections(
            db, uid, hive_id=_uuid(hive_id), limit=_cap(limit)
        )
    return [_inspection_row(i) for i in rows]


@mcp_server.tool()
async def get_harvests(
    ctx, hive_id: str | None = None, limit: int = 10
) -> list[dict]:
    """Get harvest records, optionally filtered by hive ID."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        rows = await harvest_service.get_harvests(
            db, uid, hive_id=_uuid(hive_id), limit=_cap(limit)
        )
    return [_harvest_row(h) for h in rows]


@mcp_server.tool()
async def get_treatments(
    ctx, hive_id: str | None = None, limit: int = 10
) -> list[dict]:
    """Get treatment records, optionally filtered by hive ID."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        rows = await treatment_service.get_treatments(
            db, uid, hive_id=_uuid(hive_id), limit=_cap(limit)
        )
    return [_treatment_row(t) for t in rows]


@mcp_server.tool()
async def get_queens(ctx, hive_id: str | None = None) -> list[dict]:
    """Get queen records, optionally filtered by hive ID."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        queens = await queen_service.get_queens(db, uid, hive_id=_uuid(hive_id))
    return [_queen_row(q) for q in queens]


@mcp_server.tool()
async def get_events(
    ctx, hive_id: str | None = None, limit: int = 10
) -> list[dict]:
    """Get hive events (swarms, splits, combines, etc.)."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        rows = await event_service.get_events(
            db, uid, hive_id=_uuid(hive_id), limit=_cap(limit)
        )
    return [_event_row(e) for e in rows]


@mcp_server.tool()
async def get_tasks(
    ctx, pending_only: bool = False, hive_id: str | None = None
) -> list[dict]:
    """Get the beekeeper's tasks, optionally filtered by hive or status."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        tasks = await task_service.get_tasks(db, uid, hive_id=_uuid(hive_id))
    rows = tasks if not pending_only else [t for t in tasks if t.completed_at is None]
    return [_task_row(t) for t in rows]


@mcp_server.tool()
async def get_harvest_summary(ctx, year: int | None = None) -> dict:
    """Get aggregated harvest stats: total weight, count, average."""
    uid = await _user_id_from_context(ctx)
    current_year = year or datetime.now(UTC).year
    start = datetime(current_year, 1, 1, tzinfo=UTC)
    end = datetime(current_year + 1, 1, 1, tzinfo=UTC)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(
                func.count(Harvest.id).label("count"),
                func.coalesce(func.sum(Harvest.weight_kg), 0).label("total_kg"),
                func.avg(Harvest.weight_kg).label("avg_kg"),
            )
            .join(Hive, Harvest.hive_id == Hive.id)
            .join(Apiary, Hive.apiary_id == Apiary.id)
            .where(Apiary.user_id == uid)
            .where(Harvest.deleted_at.is_(None))
            .where(Harvest.harvested_at >= start)
            .where(Harvest.harvested_at < end)
        )
        row = result.one()
    return {
        "year": current_year,
        "harvest_count": row.count,
        "total_weight_kg": round(float(row.total_kg), 2),
        "avg_weight_kg": round(float(row.avg_kg), 2) if row.avg_kg else 0,
    }


@mcp_server.tool()
async def get_hive_health_summary(
    ctx, hive_id: str | None = None
) -> list[dict]:
    """Get health summary per hive: last inspection, queen status, attention."""
    uid = await _user_id_from_context(ctx)
    async with AsyncSessionLocal() as db:
        hives = await hive_service.get_hives(db, uid, apiary_id=None)
        target_id = _uuid(hive_id)
        if target_id:
            hives = [h for h in hives if h.id == target_id]

        summaries = []
        for h in hives:
            last_inspections = await inspection_service.get_inspections(
                db, uid, hive_id=h.id, limit=1
            )
            last_insp = last_inspections[0] if last_inspections else None
            queens = await queen_service.get_queens(db, uid, hive_id=h.id)
            queen = queens[0] if queens else None
            summaries.append(_health_row(h, last_insp, queen))
    return summaries


# ---------------------------------------------------------------------------
# ASGI app for mounting in main.py
# ---------------------------------------------------------------------------

mcp_app = mcp_server.http_app(
    path="/mcp",
    transport="streamable-http",
    stateless_http=True,
)
