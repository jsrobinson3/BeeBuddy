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
    pending_action_service,
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

    # ── Write Tools (confirm-before-write) ────────────────────────────────

    @server.tool()
    async def create_inspection(
        hive_id: str,
        notes: str = "",
        queen_seen: bool | None = None,
        temperament: str | None = None,
        brood_pattern: str | None = None,
    ) -> str:
        """Create a new hive inspection record. Requires user confirmation before saving."""
        hive_uid = _uuid(hive_id)
        if not hive_uid:
            return "Error: invalid hive_id format."
        hive = await hive_service.get_hive(db, hive_uid, user_id)
        if not hive:
            return "Error: hive not found or you don't have access."
        payload = {"hive_id": str(hive_uid)}
        if notes:
            payload["notes"] = notes
        observations: dict = {}
        if queen_seen is not None:
            observations["queen_seen"] = queen_seen
        if temperament:
            observations["temperament"] = temperament
        if brood_pattern:
            observations["brood_pattern"] = brood_pattern
        if observations:
            payload["observations"] = observations
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_inspection", "inspection", payload,
            summary=f"Create inspection for {hive.name}",
        )
        return (
            f"I've prepared an inspection for {hive.name}. "
            f"[PENDING:{action.id}] Please review and confirm to save it."
        )

    @server.tool()
    async def update_inspection(
        inspection_id: str,
        notes: str | None = None,
        queen_seen: bool | None = None,
        temperament: str | None = None,
        brood_pattern: str | None = None,
    ) -> str:
        """Update an existing inspection record. Requires user confirmation."""
        uid = _uuid(inspection_id)
        if not uid:
            return "Error: invalid inspection_id format."
        insp = await inspection_service.get_inspection(db, uid, user_id)
        if not insp:
            return "Error: inspection not found."
        payload = {"inspection_id": str(uid)}
        if notes is not None:
            payload["notes"] = notes
        observations: dict = {}
        if queen_seen is not None:
            observations["queen_seen"] = queen_seen
        if temperament:
            observations["temperament"] = temperament
        if brood_pattern:
            observations["brood_pattern"] = brood_pattern
        if observations:
            payload["observations"] = observations
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_inspection", "inspection", payload,
            summary=f"Update inspection from {_serialize_date(insp.inspected_at)}",
        )
        return f"I've prepared updates for the inspection. [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def delete_inspection(inspection_id: str) -> str:
        """Delete an inspection record. Requires user confirmation."""
        uid = _uuid(inspection_id)
        if not uid:
            return "Error: invalid inspection_id format."
        insp = await inspection_service.get_inspection(db, uid, user_id)
        if not insp:
            return "Error: inspection not found."
        payload = {"inspection_id": str(uid)}
        action = await pending_action_service.create_pending_action(
            db, user_id, "delete_inspection", "inspection", payload,
            summary=f"Delete inspection from {_serialize_date(insp.inspected_at)}",
        )
        return f"I've prepared to delete the inspection. [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def create_harvest(
        hive_id: str,
        weight_kg: float,
        honey_type: str | None = None,
        frames_harvested: int | None = None,
        notes: str = "",
    ) -> str:
        """Create a new harvest record. Requires user confirmation."""
        hive_uid = _uuid(hive_id)
        if not hive_uid:
            return "Error: invalid hive_id format."
        hive = await hive_service.get_hive(db, hive_uid, user_id)
        if not hive:
            return "Error: hive not found."
        payload: dict = {"hive_id": str(hive_uid), "weight_kg": weight_kg}
        if honey_type:
            payload["honey_type"] = honey_type
        if frames_harvested is not None:
            payload["frames_harvested"] = frames_harvested
        if notes:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_harvest", "harvest", payload,
            summary=f"Log {weight_kg}kg harvest from {hive.name}",
        )
        return (
            f"I've prepared a {weight_kg}kg harvest record for "
            f"{hive.name}. [PENDING:{action.id}] Please confirm."
        )

    @server.tool()
    async def update_harvest(
        harvest_id: str,
        weight_kg: float | None = None,
        honey_type: str | None = None,
        notes: str | None = None,
    ) -> str:
        """Update an existing harvest record. Requires user confirmation."""
        uid = _uuid(harvest_id)
        if not uid:
            return "Error: invalid harvest_id format."
        harvest = await harvest_service.get_harvest(db, uid, user_id)
        if not harvest:
            return "Error: harvest not found."
        payload = {"harvest_id": str(uid)}
        if weight_kg is not None:
            payload["weight_kg"] = weight_kg
        if honey_type is not None:
            payload["honey_type"] = honey_type
        if notes is not None:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_harvest", "harvest", payload,
            summary="Update harvest record",
        )
        return f"I've prepared updates for the harvest. [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def create_treatment(
        hive_id: str,
        treatment_type: str,
        product_name: str,
        method: str | None = None,
        dosage: str | None = None,
        notes: str = "",
    ) -> str:
        """Create a new treatment record. Requires user confirmation."""
        hive_uid = _uuid(hive_id)
        if not hive_uid:
            return "Error: invalid hive_id format."
        hive = await hive_service.get_hive(db, hive_uid, user_id)
        if not hive:
            return "Error: hive not found."
        payload = {
            "hive_id": str(hive_uid),
            "treatment_type": treatment_type,
            "product_name": product_name,
        }
        if method:
            payload["method"] = method
        if dosage:
            payload["dosage"] = dosage
        if notes:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_treatment", "treatment", payload,
            summary=f"Log {product_name} treatment for {hive.name}",
        )
        return (
            f"I've prepared a {product_name} treatment record for "
            f"{hive.name}. [PENDING:{action.id}] Please confirm."
        )

    @server.tool()
    async def update_treatment(
        treatment_id: str,
        effectiveness_notes: str | None = None,
        ended_at: str | None = None,
    ) -> str:
        """Update an existing treatment record. Requires user confirmation."""
        uid = _uuid(treatment_id)
        if not uid:
            return "Error: invalid treatment_id format."
        treatment = await treatment_service.get_treatment(db, uid, user_id)
        if not treatment:
            return "Error: treatment not found."
        payload = {"treatment_id": str(uid)}
        if effectiveness_notes is not None:
            payload["effectiveness_notes"] = effectiveness_notes
        if ended_at is not None:
            payload["ended_at"] = ended_at
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_treatment", "treatment", payload,
            summary=f"Update {treatment.product_name} treatment",
        )
        return f"I've prepared updates for the treatment. [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def create_event(
        hive_id: str,
        event_type: str,
        details: str | None = None,
        notes: str = "",
    ) -> str:
        """Create a new hive event (swarm, split, combine, etc.). Requires user confirmation."""
        hive_uid = _uuid(hive_id)
        if not hive_uid:
            return "Error: invalid hive_id format."
        hive = await hive_service.get_hive(db, hive_uid, user_id)
        if not hive:
            return "Error: hive not found."
        payload = {"hive_id": str(hive_uid), "event_type": event_type}
        if details:
            payload["details"] = details
        if notes:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_event", "event", payload,
            summary=f"Log {event_type} event for {hive.name}",
        )
        return (
            f"I've prepared a {event_type} event for {hive.name}. "
            f"[PENDING:{action.id}] Please confirm."
        )

    @server.tool()
    async def create_task(
        title: str,
        description: str = "",
        due_date: str | None = None,
        hive_id: str | None = None,
        priority: str | None = None,
    ) -> str:
        """Create a new task. Requires user confirmation."""
        payload: dict = {"title": title}
        if description:
            payload["description"] = description
        if due_date:
            payload["due_date"] = due_date
        if priority:
            payload["priority"] = priority
        hive_name = None
        if hive_id:
            hive_uid = _uuid(hive_id)
            if hive_uid:
                hive = await hive_service.get_hive(db, hive_uid, user_id)
                if hive:
                    payload["hive_id"] = str(hive_uid)
                    hive_name = hive.name
        summary = f"Create task: {title}"
        if hive_name:
            summary += f" (for {hive_name})"
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_task", "task", payload, summary=summary,
        )
        return f"I've prepared the task \"{title}\". [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def update_task(
        task_id: str,
        title: str | None = None,
        description: str | None = None,
        due_date: str | None = None,
        priority: str | None = None,
    ) -> str:
        """Update an existing task. Requires user confirmation."""
        uid = _uuid(task_id)
        if not uid:
            return "Error: invalid task_id format."
        task = await task_service.get_task(db, uid, user_id)
        if not task:
            return "Error: task not found."
        payload = {"task_id": str(uid)}
        if title is not None:
            payload["title"] = title
        if description is not None:
            payload["description"] = description
        if due_date is not None:
            payload["due_date"] = due_date
        if priority is not None:
            payload["priority"] = priority
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_task", "task", payload,
            summary=f"Update task: {task.title}",
        )
        return f"I've prepared updates for \"{task.title}\". [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def complete_task(task_id: str) -> str:
        """Mark a task as completed. Requires user confirmation."""
        uid = _uuid(task_id)
        if not uid:
            return "Error: invalid task_id format."
        task = await task_service.get_task(db, uid, user_id)
        if not task:
            return "Error: task not found."
        payload = {"task_id": str(uid)}
        action = await pending_action_service.create_pending_action(
            db, user_id, "complete_task", "task", payload,
            summary=f"Complete task: {task.title}",
        )
        return (
            f"I've prepared to mark \"{task.title}\" as complete. "
            f"[PENDING:{action.id}] Please confirm."
        )

    @server.tool()
    async def delete_task(task_id: str) -> str:
        """Delete a task. Requires user confirmation."""
        uid = _uuid(task_id)
        if not uid:
            return "Error: invalid task_id format."
        task = await task_service.get_task(db, uid, user_id)
        if not task:
            return "Error: task not found."
        payload = {"task_id": str(uid)}
        action = await pending_action_service.create_pending_action(
            db, user_id, "delete_task", "task", payload,
            summary=f"Delete task: {task.title}",
        )
        return f"I've prepared to delete \"{task.title}\". [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def create_apiary(
        name: str,
        city: str | None = None,
        country_code: str | None = None,
        notes: str = "",
    ) -> str:
        """Create a new apiary. Requires user confirmation."""
        payload: dict = {"name": name}
        if city:
            payload["city"] = city
        if country_code:
            payload["country_code"] = country_code
        if notes:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_apiary", "apiary", payload,
            summary=f"Create apiary: {name}",
        )
        return f"I've prepared a new apiary \"{name}\". [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def update_apiary(
        apiary_id: str,
        name: str | None = None,
        city: str | None = None,
        country_code: str | None = None,
        notes: str | None = None,
    ) -> str:
        """Update an existing apiary. Requires user confirmation."""
        uid = _uuid(apiary_id)
        if not uid:
            return "Error: invalid apiary_id format."
        apiary = await apiary_service.get_apiary(db, uid)
        if not apiary or apiary.user_id != user_id:
            return "Error: apiary not found."
        payload = {"apiary_id": str(uid)}
        if name is not None:
            payload["name"] = name
        if city is not None:
            payload["city"] = city
        if country_code is not None:
            payload["country_code"] = country_code
        if notes is not None:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_apiary", "apiary", payload,
            summary=f"Update apiary: {apiary.name}",
        )
        return f"I've prepared updates for \"{apiary.name}\". [PENDING:{action.id}] Please confirm."

    @server.tool()
    async def create_hive(
        apiary_id: str,
        name: str,
        hive_type: str | None = None,
        source: str | None = None,
        notes: str = "",
    ) -> str:
        """Create a new hive in an apiary. Requires user confirmation."""
        apiary_uid = _uuid(apiary_id)
        if not apiary_uid:
            return "Error: invalid apiary_id format."
        apiary = await apiary_service.get_apiary(db, apiary_uid)
        if not apiary or apiary.user_id != user_id:
            return "Error: apiary not found."
        payload = {"apiary_id": str(apiary_uid), "name": name}
        if hive_type:
            payload["hive_type"] = hive_type
        if source:
            payload["source"] = source
        if notes:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "create_hive", "hive", payload,
            summary=f"Create hive \"{name}\" in {apiary.name}",
        )
        return (
            f"I've prepared a new hive \"{name}\" in {apiary.name}. "
            f"[PENDING:{action.id}] Please confirm."
        )

    @server.tool()
    async def update_hive(
        hive_id: str,
        name: str | None = None,
        status: str | None = None,
        notes: str | None = None,
    ) -> str:
        """Update an existing hive. Requires user confirmation."""
        uid = _uuid(hive_id)
        if not uid:
            return "Error: invalid hive_id format."
        hive = await hive_service.get_hive(db, uid, user_id)
        if not hive:
            return "Error: hive not found."
        payload = {"hive_id": str(uid)}
        if name is not None:
            payload["name"] = name
        if status is not None:
            payload["status"] = status
        if notes is not None:
            payload["notes"] = notes
        action = await pending_action_service.create_pending_action(
            db, user_id, "update_hive", "hive", payload,
            summary=f"Update hive: {hive.name}",
        )
        return f"I've prepared updates for \"{hive.name}\". [PENDING:{action.id}] Please confirm."

    # ── Knowledge base (RAG) ──────────────────────────────────────────────

    @server.tool()
    async def search_knowledge_base(query: str, limit: int = 5) -> list[dict]:
        """Search the beekeeping knowledge base for relevant information.

        Use this for general beekeeping questions about treatments, diseases,
        management practices, regulations, and seasonal guidance.
        Do NOT use this for questions about the user's own data (hives,
        inspections, etc.) — use the data tools for those.
        """
        from app.services import rag_service

        results = await rag_service.search(db, query, top_k=min(limit, 10))
        return [
            {
                "content": r["content"],
                "source": r["source_name"],
                "relevance": r["similarity"],
            }
            for r in results
        ]

    return server
