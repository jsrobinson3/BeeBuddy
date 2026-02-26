"""WatermelonDB sync service — implements pull/push logic.

Ownership hierarchy:
  - Direct ownership (user_id column): apiaries, tasks, task_cadences
  - Via apiary (apiary_id → apiary.user_id): hives
  - Via hive→apiary: queens, inspections, treatments, harvests, events
  - Via inspection→hive→apiary: inspection_photos
"""

import asyncio
import json
import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.event import Event
from app.models.harvest import Harvest
from app.models.hive import Hive
from app.models.inspection import Inspection
from app.models.inspection_photo import InspectionPhoto
from app.models.queen import Queen
from app.models.task import Task
from app.models.task_cadence import TaskCadence
from app.models.treatment import Treatment

# Internal fields injected by WatermelonDB that must be stripped before persisting
_WMDB_INTERNAL_FIELDS = {"_status", "_changed"}

# Maps table names to their SQLAlchemy model classes
TABLE_MODEL_MAP: dict[str, type] = {
    "apiaries": Apiary,
    "hives": Hive,
    "queens": Queen,
    "inspections": Inspection,
    "inspection_photos": InspectionPhoto,
    "treatments": Treatment,
    "harvests": Harvest,
    "events": Event,
    "tasks": Task,
    "task_cadences": TaskCadence,
}

# Fields that are stored as JSON in the database (JSONB) but come as
# plain dicts from WatermelonDB.  On pull we serialize them to dicts;
# on push we accept dicts and store directly.
_JSON_FIELDS: dict[str, set[str]] = {
    "inspections": {"observations", "weather"},
    "events": {"details"},
    "inspection_photos": {"ai_analysis"},
}

# Writable fields per table — only these may be set via setattr on updates.
# System fields (id, user_id, created_at, deleted_at) are never writable.
_WRITABLE_FIELDS: dict[str, set[str]] = {
    "apiaries": {
        "name", "latitude", "longitude", "city",
        "country_code", "hex_color", "notes", "archived_at",
    },
    "hives": {
        "apiary_id", "name", "hive_type", "status",
        "source", "installation_date", "color", "order", "notes",
    },
    "queens": {
        "hive_id", "marking_color", "marking_year", "origin",
        "status", "race", "quality", "fertilized", "clipped",
        "birth_date", "introduced_date", "replaced_date", "notes",
    },
    "inspections": {
        "hive_id", "inspected_at", "duration_minutes",
        "experience_template", "observations", "weather",
        "impression", "attention", "reminder", "reminder_date",
        "ai_summary", "notes",
    },
    "inspection_photos": {
        "inspection_id", "s3_key", "caption",
        "ai_analysis", "url", "uploaded_at",
    },
    "treatments": {
        "hive_id", "treatment_type", "product_name", "method",
        "started_at", "ended_at", "dosage",
        "effectiveness_notes", "follow_up_date",
    },
    "harvests": {
        "hive_id", "harvested_at", "weight_kg", "moisture_percent",
        "honey_type", "flavor_notes", "color",
        "frames_harvested", "notes",
    },
    "events": {
        "hive_id", "event_type", "occurred_at", "details", "notes",
    },
    "tasks": {
        "hive_id", "apiary_id", "title", "description",
        "due_date", "recurring", "recurrence_rule", "source",
        "completed_at", "priority",
    },
    "task_cadences": {
        "hive_id", "cadence_key", "is_active",
        "last_generated_at", "next_due_date",
        "custom_interval_days", "custom_season_month",
        "custom_season_day",
    },
}

# WatermelonDB column name → backend column name mappings for fields
# where the names differ between client schema and server schema.
_COLUMN_RENAMES: dict[str, dict[str, str]] = {
    "inspections": {
        "observations_json": "observations",
        "weather_json": "weather",
    },
    "events": {
        "details_json": "details",
    },
    "inspection_photos": {
        "ai_analysis_json": "ai_analysis",
    },
    "hives": {
        "position_order": "order",
    },
}

# Reverse: server → client
_COLUMN_RENAMES_REVERSE: dict[str, dict[str, str]] = {
    table: {v: k for k, v in mapping.items()}
    for table, mapping in _COLUMN_RENAMES.items()
}


def _ms_to_datetime(ms: float | None) -> datetime | None:
    """Convert Unix milliseconds to a timezone-aware datetime."""
    if ms is None or ms == 0:
        return None
    return datetime.fromtimestamp(ms / 1000.0, tz=UTC)


def _datetime_to_ms(dt: datetime | None) -> float | None:
    """Convert datetime to Unix milliseconds."""
    if dt is None:
        return None
    return dt.timestamp() * 1000.0


def _date_to_iso(d: date | None) -> str | None:
    """Convert a date to ISO-8601 string (YYYY-MM-DD) for WatermelonDB."""
    if d is None:
        return None
    return d.isoformat()


def _serialize_value(value: Any) -> Any:
    """Serialize a single Python value for WatermelonDB."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return _datetime_to_ms(value)
    if isinstance(value, date):
        return _date_to_iso(value)
    if isinstance(value, dict | list):
        return value  # JSONB — already JSON-serializable
    if hasattr(value, "value"):
        return value.value  # StrEnum
    return value


def _serialize_record(table_name: str, record: Any) -> dict[str, Any]:
    """Serialize an ORM record to a WatermelonDB-compatible dict."""
    data: dict[str, Any] = {}
    for col in record.__table__.columns:
        col_name = col.name
        # Skip user_id — not part of the client schema
        if col_name == "user_id":
            continue
        # Skip deleted_at — WatermelonDB handles deletions via its own protocol
        if col_name == "deleted_at":
            continue
        value = getattr(record, col_name)
        serialized = _serialize_value(value)

        # Apply column renames (server name → client name)
        renames = _COLUMN_RENAMES_REVERSE.get(table_name, {})
        client_name = renames.get(col_name, col_name)

        # JSON fields: serialize dict to JSON string for client
        if col_name in _JSON_FIELDS.get(table_name, set()):
            serialized = json.dumps(serialized) if serialized is not None else None

        data[client_name] = serialized
    return data


# ─── Ownership Queries ────────────────────────────────────────────────────────

async def _get_user_apiary_ids(
    db: AsyncSession, user_id: uuid.UUID
) -> set[uuid.UUID]:
    """Return all apiary IDs owned by the user (including soft-deleted)."""
    result = await db.execute(
        select(Apiary.id).where(Apiary.user_id == user_id)
    )
    return {row[0] for row in result.all()}


async def _get_user_hive_ids(
    db: AsyncSession, apiary_ids: set[uuid.UUID]
) -> set[uuid.UUID]:
    """Return all hive IDs belonging to the user's apiaries."""
    if not apiary_ids:
        return set()
    result = await db.execute(
        select(Hive.id).where(Hive.apiary_id.in_(apiary_ids))
    )
    return {row[0] for row in result.all()}


async def _get_user_inspection_ids(
    db: AsyncSession, hive_ids: set[uuid.UUID]
) -> set[uuid.UUID]:
    """Return all inspection IDs belonging to the user's hives."""
    if not hive_ids:
        return set()
    result = await db.execute(
        select(Inspection.id).where(Inspection.hive_id.in_(hive_ids))
    )
    return {row[0] for row in result.all()}


# ─── Pull ─────────────────────────────────────────────────────────────────────

async def _pull_table(
    db: AsyncSession,
    model: type,
    table_name: str,
    ownership_filter: Any,
    last_pulled_at: datetime | None,
) -> dict[str, list]:
    """Query a single table for changes since last_pulled_at.

    All live records are returned in the ``updated`` array (never ``created``)
    because the mobile client uses ``sendCreatedAsUpdated: true``.
    WatermelonDB requires the server response to match this convention.
    """
    updated = []
    deleted = []

    if last_pulled_at is None:
        # First sync: return all non-deleted records
        stmt = select(model).where(
            model.deleted_at.is_(None),
            ownership_filter,
        )
        result = await db.execute(stmt)
        for record in result.scalars().all():
            updated.append(_serialize_record(table_name, record))
    else:
        # Subsequent sync: return records changed since last_pulled_at
        stmt = select(model).where(
            model.updated_at > last_pulled_at,
            ownership_filter,
        )
        result = await db.execute(stmt)
        for record in result.scalars().all():
            if record.deleted_at is not None:
                deleted.append(str(record.id))
            else:
                updated.append(_serialize_record(table_name, record))

    return {"created": [], "updated": updated, "deleted": deleted}


async def pull_changes(
    db: AsyncSession,
    user_id: uuid.UUID,
    last_pulled_at_ms: float | None,
) -> dict:
    """Pull all changes for a user since the given timestamp.

    Returns a dict with 'changes' and 'timestamp' keys matching
    the WatermelonDB sync protocol.
    """
    # Capture server timestamp BEFORE querying to avoid missing concurrent writes
    result = await db.execute(text("SELECT extract(epoch from now()) * 1000"))
    server_timestamp_ms: float = result.scalar_one()

    last_pulled_at = _ms_to_datetime(last_pulled_at_ms)

    # Build ownership ID sets
    apiary_ids = await _get_user_apiary_ids(db, user_id)
    hive_ids = await _get_user_hive_ids(db, apiary_ids)
    inspection_ids = await _get_user_inspection_ids(db, hive_ids)

    # Define ownership filters per table
    # Use false() equivalent (id IS NULL) when the user has no records
    _no_hives = Hive.id.is_(None)
    _no_queens = Queen.id.is_(None)
    _no_insp = Inspection.id.is_(None)
    _no_photos = InspectionPhoto.id.is_(None)
    _no_treat = Treatment.id.is_(None)
    _no_harv = Harvest.id.is_(None)
    _no_evt = Event.id.is_(None)

    ownership_filters: dict[str, Any] = {
        "apiaries": Apiary.user_id == user_id,
        "hives": (
            Hive.apiary_id.in_(apiary_ids) if apiary_ids
            else _no_hives
        ),
        "queens": (
            Queen.hive_id.in_(hive_ids) if hive_ids
            else _no_queens
        ),
        "inspections": (
            Inspection.hive_id.in_(hive_ids) if hive_ids
            else _no_insp
        ),
        "inspection_photos": (
            InspectionPhoto.inspection_id.in_(inspection_ids)
            if inspection_ids else _no_photos
        ),
        "treatments": (
            Treatment.hive_id.in_(hive_ids) if hive_ids
            else _no_treat
        ),
        "harvests": (
            Harvest.hive_id.in_(hive_ids) if hive_ids
            else _no_harv
        ),
        "events": (
            Event.hive_id.in_(hive_ids) if hive_ids
            else _no_evt
        ),
        "tasks": Task.user_id == user_id,
        "task_cadences": TaskCadence.user_id == user_id,
    }

    # Parallelize the 10 _pull_table calls with independent sessions
    from app.db.session import AsyncSessionLocal

    async def _pull_one(table_name: str, model: type) -> tuple[str, dict]:
        async with AsyncSessionLocal() as session:
            data = await _pull_table(
                session, model, table_name,
                ownership_filters[table_name], last_pulled_at,
            )
        return table_name, data

    results = await asyncio.gather(*[
        _pull_one(table_name, model)
        for table_name, model in TABLE_MODEL_MAP.items()
    ])
    changes = dict(results)

    return {"changes": changes, "timestamp": server_timestamp_ms}


# ─── Push ─────────────────────────────────────────────────────────────────────

def _prepare_record_data(
    table_name: str, raw: dict[str, Any]
) -> dict[str, Any]:
    """Clean and transform a WatermelonDB record dict for the ORM model."""
    data = {k: v for k, v in raw.items() if k not in _WMDB_INTERNAL_FIELDS and k != "created_at"}

    # Apply column renames (client name → server name)
    renames = _COLUMN_RENAMES.get(table_name, {})
    for client_name, server_name in renames.items():
        if client_name in data:
            value = data.pop(client_name)
            # JSON fields sent as strings from client — parse them
            if server_name in _JSON_FIELDS.get(table_name, set()):
                if isinstance(value, str):
                    try:
                        value = json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        value = None
            data[server_name] = value

    # Convert timestamp fields (number → datetime)
    datetime_fields = _get_datetime_fields(table_name)
    for field_name in datetime_fields:
        if field_name in data and data[field_name] is not None:
            val = data[field_name]
            if isinstance(val, (int, float)):
                data[field_name] = _ms_to_datetime(val)

    # Convert date-only fields (ISO string → date)
    date_fields = _get_date_fields(table_name)
    for field_name in date_fields:
        if field_name in data and data[field_name] is not None:
            val = data[field_name]
            if isinstance(val, str):
                data[field_name] = date.fromisoformat(val)

    return data


def _get_datetime_fields(table_name: str) -> set[str]:
    """Return the set of datetime field names for a given table."""
    common = {"created_at", "updated_at"}
    specific: dict[str, set[str]] = {
        "apiaries": {"archived_at"},
        "inspections": {"inspected_at", "reminder_date"},
        "inspection_photos": {"uploaded_at"},
        "treatments": {"started_at", "ended_at"},
        "harvests": {"harvested_at"},
        "events": {"occurred_at"},
        "tasks": {"completed_at"},
        "task_cadences": {"last_generated_at"},
    }
    return common | specific.get(table_name, set())


def _get_date_fields(table_name: str) -> set[str]:
    """Return the set of date-only (Date, not DateTime) field names."""
    specific: dict[str, set[str]] = {
        "hives": {"installation_date"},
        "queens": {"birth_date", "introduced_date", "replaced_date"},
        "treatments": {"follow_up_date"},
        "tasks": {"due_date"},
        "task_cadences": {"next_due_date"},
    }
    return specific.get(table_name, set())


def _parse_uuid(value: str) -> uuid.UUID | None:
    """Parse a UUID string, returning None on invalid input."""
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        return None


def _verify_new_record_ownership(
    table_name: str,
    data: dict[str, Any],
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> bool:
    """Verify FK ownership for a new child record."""
    if table_name == "hives":
        fk = _parse_uuid(str(data.get("apiary_id", "")))
        return fk is not None and fk in apiary_ids
    if table_name in (
        "queens", "inspections", "treatments",
        "harvests", "events",
    ):
        fk = _parse_uuid(str(data.get("hive_id", "")))
        return fk is not None and fk in hive_ids
    if table_name == "inspection_photos":
        fk = _parse_uuid(str(data.get("inspection_id", "")))
        return fk is not None and fk in inspection_ids
    # Top-level tables (apiaries, tasks, task_cadences) get user_id injected
    return True


def _apply_update(
    table_name: str,
    existing: Any,
    data: dict[str, Any],
) -> None:
    """Apply allowlisted field updates to an existing record."""
    allowed = _WRITABLE_FIELDS.get(table_name, set())
    for key, value in data.items():
        if key in allowed and hasattr(existing, key):
            setattr(existing, key, value)
    existing.updated_at = datetime.now(UTC)


async def _batch_fetch(
    db: AsyncSession,
    model: type,
    record_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Any]:
    """Fetch multiple records by ID in a single query."""
    if not record_ids:
        return {}
    result = await db.execute(
        select(model).where(model.id.in_(record_ids))
    )
    return {r.id: r for r in result.scalars().all()}


async def push_changes(
    db: AsyncSession,
    user_id: uuid.UUID,
    changes: dict[str, dict],
    last_pulled_at_ms: float,
) -> None:
    """Apply client changes to the database.

    Server-wins conflict resolution: updates are skipped if the server
    record was modified after last_pulled_at.
    """
    last_pulled_at = _ms_to_datetime(last_pulled_at_ms)

    # Pre-fetch ownership sets for authorization
    apiary_ids = await _get_user_apiary_ids(db, user_id)
    hive_ids = await _get_user_hive_ids(db, apiary_ids)
    inspection_ids = await _get_user_inspection_ids(db, hive_ids)

    for table_name, table_changes in changes.items():
        model = TABLE_MODEL_MAP.get(table_name)
        if model is None:
            continue

        created_ids = await _push_upserts(
            db, model, table_name, table_changes,
            user_id, last_pulled_at,
            apiary_ids, hive_ids, inspection_ids,
        )
        # Expand ownership sets with newly created records so that
        # child records in the same push can reference them (C1 fix)
        if table_name == "apiaries":
            apiary_ids.update(created_ids)
        elif table_name == "hives":
            hive_ids.update(created_ids)
        elif table_name == "inspections":
            inspection_ids.update(created_ids)

        await _push_deletions(
            db, model, table_name, table_changes,
            user_id, apiary_ids, hive_ids, inspection_ids,
        )

    await db.commit()


async def _push_upserts(
    db: AsyncSession,
    model: type,
    table_name: str,
    table_changes: dict,
    user_id: uuid.UUID,
    last_pulled_at: datetime | None,
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> list[uuid.UUID]:
    """Process created/updated records for a single table.

    Returns a list of IDs for newly created records.
    """
    raw_records = (
        table_changes.get("created", [])
        + table_changes.get("updated", [])
    )
    if not raw_records:
        return []

    # W1: Batch-fetch existing records in one query
    parsed_ids: list[tuple[uuid.UUID, dict]] = []
    for raw in raw_records:
        rid = _parse_uuid(str(raw.get("id", "")))
        if rid is None:
            continue
        parsed_ids.append((rid, raw))

    all_ids = [rid for rid, _ in parsed_ids]
    existing_map = await _batch_fetch(db, model, all_ids)

    created_ids: list[uuid.UUID] = []
    for record_id, raw_record in parsed_ids:
        data = _prepare_record_data(table_name, raw_record)
        existing = existing_map.get(record_id)

        if existing is not None:
            _handle_update(
                table_name, existing, data, last_pulled_at,
                user_id, apiary_ids, hive_ids, inspection_ids,
            )
        else:
            created_id = _handle_create(
                db, model, table_name, data, record_id,
                user_id, apiary_ids, hive_ids, inspection_ids,
            )
            if created_id is not None:
                created_ids.append(created_id)

    return created_ids


def _handle_update(
    table_name: str,
    existing: Any,
    data: dict[str, Any],
    last_pulled_at: datetime | None,
    user_id: uuid.UUID,
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> None:
    """Update an existing record with ownership and conflict checks."""
    if last_pulled_at and existing.updated_at > last_pulled_at:
        return
    if not _verify_ownership(
        table_name, existing,
        user_id, apiary_ids, hive_ids, inspection_ids,
    ):
        return
    _apply_update(table_name, existing, data)


def _handle_create(
    db: AsyncSession,
    model: type,
    table_name: str,
    data: dict[str, Any],
    record_id: uuid.UUID,
    user_id: uuid.UUID,
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> uuid.UUID | None:
    """Create a new record with ownership validation.

    Returns the record_id on success, or None if the record was rejected.
    """
    # C1: Verify FK ownership for child tables
    if not _verify_new_record_ownership(
        table_name, data,
        apiary_ids, hive_ids, inspection_ids,
    ):
        return None

    data["id"] = record_id
    if table_name in ("apiaries", "tasks", "task_cadences"):
        data["user_id"] = user_id
    new_record = model(**data)
    db.add(new_record)
    return record_id


async def _push_deletions(
    db: AsyncSession,
    model: type,
    table_name: str,
    table_changes: dict,
    user_id: uuid.UUID,
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> None:
    """Process soft-deletions for a single table."""
    deleted_raw = table_changes.get("deleted", [])
    if not deleted_raw:
        return

    # W1: Batch-fetch records to delete
    parsed_ids = []
    for rid_str in deleted_raw:
        rid = _parse_uuid(str(rid_str))
        if rid is not None:
            parsed_ids.append(rid)

    existing_map = await _batch_fetch(db, model, parsed_ids)

    now = datetime.now(UTC)
    for record_id in parsed_ids:
        existing = existing_map.get(record_id)
        if existing is None:
            continue
        if not _verify_ownership(
            table_name, existing,
            user_id, apiary_ids, hive_ids, inspection_ids,
        ):
            continue
        existing.deleted_at = now
        existing.updated_at = now


def _verify_ownership(
    table_name: str,
    record: Any,
    user_id: uuid.UUID,
    apiary_ids: set[uuid.UUID],
    hive_ids: set[uuid.UUID],
    inspection_ids: set[uuid.UUID],
) -> bool:
    """Verify that a record belongs to the current user."""
    if table_name in ("apiaries",):
        return record.user_id == user_id
    if table_name in ("tasks", "task_cadences"):
        return record.user_id == user_id
    if table_name == "hives":
        return record.apiary_id in apiary_ids
    if table_name in ("queens", "inspections", "treatments", "harvests", "events"):
        return record.hive_id in hive_ids
    if table_name == "inspection_photos":
        return record.inspection_id in inspection_ids
    return False
