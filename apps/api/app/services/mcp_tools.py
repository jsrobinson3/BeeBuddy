"""MCP tool server factory — per-request FastMCP with user-scoped data tools.

Each tool reuses existing service-layer functions with db + user_id captured
in closures so the LLM never sees or controls user_id.
"""

from datetime import UTC, datetime
from uuid import UUID

from fastmcp import FastMCP
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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

MAX_RESULTS = 50


def _cap(limit: int | None) -> int:
    """Cap limit to MAX_RESULTS."""
    if limit is None or limit < 1:
        return MAX_RESULTS
    return min(limit, MAX_RESULTS)


def _uuid(val: str | None) -> UUID | None:
    """Parse optional UUID string, returning None on invalid input."""
    if not val:
        return None
    try:
        return UUID(val)
    except ValueError:
        return None


def _serialize_date(val: datetime | None) -> str | None:
    if val is None:
        return None
    return val.isoformat()


def create_mcp_server(db: AsyncSession, user_id: UUID) -> FastMCP:
    """Create a user-scoped MCP server with data query tools."""
    server = FastMCP("BeeBuddyTools")

    @server.tool()
    async def list_apiaries() -> list[dict]:
        """List all of the beekeeper's apiaries with hive counts."""
        apiaries = await apiary_service.get_apiaries(db, user_id)
        return [
            {
                "id": str(a.id),
                "name": a.name,
                "hive_count": getattr(a, "hive_count", 0),
                "city": a.city,
                "country_code": a.country_code,
                "notes": a.notes,
                "created_at": _serialize_date(a.created_at),
            }
            for a in apiaries
        ]

    @server.tool()
    async def list_hives(apiary_id: str | None = None) -> list[dict]:
        """List hives, optionally filtered by apiary ID."""
        hives = await hive_service.get_hives(db, user_id, apiary_id=_uuid(apiary_id))
        return [
            {
                "id": str(h.id),
                "apiary_id": str(h.apiary_id),
                "name": h.name,
                "hive_type": str(h.hive_type.value) if h.hive_type else None,
                "status": str(h.status.value) if h.status else None,
                "source": str(h.source.value) if h.source else None,
                "installation_date": str(h.installation_date) if h.installation_date else None,
                "notes": h.notes,
            }
            for h in hives
        ]

    @server.tool()
    async def get_inspections(hive_id: str | None = None, limit: int = 10) -> list[dict]:
        """Get recent inspections, optionally filtered by hive ID."""
        inspections = await inspection_service.get_inspections(
            db, user_id, hive_id=_uuid(hive_id), limit=_cap(limit),
        )
        return [
            {
                "id": str(i.id),
                "hive_id": str(i.hive_id),
                "inspected_at": _serialize_date(i.inspected_at),
                "duration_minutes": i.duration_minutes,
                "observations": i.observations,
                "weather": i.weather,
                "impression": i.impression,
                "attention": i.attention,
                "notes": i.notes,
                "ai_summary": i.ai_summary,
            }
            for i in inspections
        ]

    @server.tool()
    async def get_harvests(hive_id: str | None = None, limit: int = 10) -> list[dict]:
        """Get harvest records, optionally filtered by hive ID."""
        harvests = await harvest_service.get_harvests(
            db, user_id, hive_id=_uuid(hive_id), limit=_cap(limit),
        )
        return [
            {
                "id": str(h.id),
                "hive_id": str(h.hive_id),
                "harvested_at": _serialize_date(h.harvested_at),
                "weight_kg": h.weight_kg,
                "moisture_percent": h.moisture_percent,
                "honey_type": h.honey_type,
                "flavor_notes": h.flavor_notes,
                "frames_harvested": h.frames_harvested,
                "notes": h.notes,
            }
            for h in harvests
        ]

    @server.tool()
    async def get_treatments(hive_id: str | None = None, limit: int = 10) -> list[dict]:
        """Get treatment records, optionally filtered by hive ID."""
        treatments = await treatment_service.get_treatments(
            db, user_id, hive_id=_uuid(hive_id), limit=_cap(limit),
        )
        return [
            {
                "id": str(t.id),
                "hive_id": str(t.hive_id),
                "treatment_type": t.treatment_type,
                "product_name": t.product_name,
                "method": t.method,
                "started_at": _serialize_date(t.started_at),
                "ended_at": _serialize_date(t.ended_at),
                "dosage": t.dosage,
                "effectiveness_notes": t.effectiveness_notes,
            }
            for t in treatments
        ]

    @server.tool()
    async def get_queens(hive_id: str | None = None) -> list[dict]:
        """Get queen records, optionally filtered by hive ID."""
        queens = await queen_service.get_queens(db, user_id, hive_id=_uuid(hive_id))
        return [
            {
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
            for q in queens
        ]

    @server.tool()
    async def get_events(hive_id: str | None = None, limit: int = 10) -> list[dict]:
        """Get hive events (swarms, splits, combines, etc.), optionally filtered by hive ID."""
        events = await event_service.get_events(
            db, user_id, hive_id=_uuid(hive_id), limit=_cap(limit),
        )
        return [
            {
                "id": str(e.id),
                "hive_id": str(e.hive_id),
                "event_type": str(e.event_type.value) if e.event_type else None,
                "occurred_at": _serialize_date(e.occurred_at),
                "details": e.details,
                "notes": e.notes,
            }
            for e in events
        ]

    @server.tool()
    async def get_tasks(pending_only: bool = False, hive_id: str | None = None) -> list[dict]:
        """Get the beekeeper's tasks, optionally filtered by hive or pending status."""
        tasks = await task_service.get_tasks(db, user_id, hive_id=_uuid(hive_id))
        result = []
        for t in tasks:
            if pending_only and t.completed_at is not None:
                continue
            result.append({
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "due_date": str(t.due_date) if t.due_date else None,
                "priority": str(t.priority.value) if t.priority else None,
                "completed_at": _serialize_date(t.completed_at),
                "hive_id": str(t.hive_id) if t.hive_id else None,
                "apiary_id": str(t.apiary_id) if t.apiary_id else None,
            })
        return result

    @server.tool()
    async def get_harvest_summary(year: int | None = None) -> dict:
        """Get aggregated harvest statistics: total weight, count, and average per harvest."""
        current_year = year or datetime.now(UTC).year
        start = datetime(current_year, 1, 1, tzinfo=UTC)
        end = datetime(current_year + 1, 1, 1, tzinfo=UTC)

        result = await db.execute(
            select(
                func.count(Harvest.id).label("count"),
                func.coalesce(func.sum(Harvest.weight_kg), 0).label("total_kg"),
                func.avg(Harvest.weight_kg).label("avg_kg"),
            )
            .join(Hive, Harvest.hive_id == Hive.id)
            .join(Apiary, Hive.apiary_id == Apiary.id)
            .where(Apiary.user_id == user_id)
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

    async def _build_hive_summary(h) -> dict:
        """Build health summary dict for a single hive."""
        last_inspections = await inspection_service.get_inspections(
            db, user_id, hive_id=h.id, limit=1,
        )
        last_insp = last_inspections[0] if last_inspections else None
        queens = await queen_service.get_queens(db, user_id, hive_id=h.id)
        queen = queens[0] if queens else None
        return {
            "hive_id": str(h.id),
            "hive_name": h.name,
            "status": str(h.status.value) if h.status else None,
            "last_inspection_date": _serialize_date(
                last_insp.inspected_at
            ) if last_insp else None,
            "last_impression": last_insp.impression if last_insp else None,
            "attention_needed": last_insp.attention if last_insp else None,
            "queen_status": str(queen.status.value) if queen else "unknown",
            "queen_origin": str(queen.origin.value) if queen and queen.origin else None,
        }

    @server.tool()
    async def get_hive_health_summary(hive_id: str | None = None) -> list[dict]:
        """Get health summary per hive: last inspection date, queen status, attention needed."""
        hives = await hive_service.get_hives(db, user_id, apiary_id=None)
        target_id = _uuid(hive_id)
        if target_id:
            hives = [h for h in hives if h.id == target_id]
        return [await _build_hive_summary(h) for h in hives]

    return server
