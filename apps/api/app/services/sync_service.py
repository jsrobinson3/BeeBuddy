"""WatermelonDB sync service — implements pull/push logic.

Ownership hierarchy:
  - Direct ownership (user_id column): apiaries, tasks, task_cadences
  - Via apiary (apiary_id → apiary.user_id): hives
  - Via hive→apiary: queens, inspections, treatments, harvests, events
  - Via inspection→hive→apiary: inspection_photos
"""

import json
import uuid
from datetime import UTC, datetime
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


def _serialize_value(value: Any) -> Any:
    """Serialize a single Python value for WatermelonDB."""
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return _datetime_to_ms(value)
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
    """Query a single table for changes since last_pulled_at."""
    created = []
    updated = []
    deleted = []

    if last_pulled_at is None:
        # First sync: return all non-deleted records as "created"
        stmt = select(model).where(
            model.deleted_at.is_(None),
            ownership_filter,
        )
        result = await db.execute(stmt)
        for record in result.scalars().all():
            created.append(_serialize_record(table_name, record))
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
            elif record.created_at > last_pulled_at:
                created.append(_serialize_record(table_name, record))
            else:
                updated.append(_serialize_record(table_name, record))

    return {"created": created, "updated": updated, "deleted": deleted}


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
    ownership_filters: dict[str, Any] = {
        "apiaries": Apiary.user_id == user_id,
        "hives": Hive.apiary_id.in_(apiary_ids) if apiary_ids else Hive.id == None,
        "queens": Queen.hive_id.in_(hive_ids) if hive_ids else Queen.id == None,
        "inspections": Inspection.hive_id.in_(hive_ids) if hive_ids else Inspection.id == None,
        "inspection_photos": InspectionPhoto.inspection_id.in_(inspection_ids) if inspection_ids else InspectionPhoto.id == None,
        "treatments": Treatment.hive_id.in_(hive_ids) if hive_ids else Treatment.id == None,
        "harvests": Harvest.hive_id.in_(hive_ids) if hive_ids else Harvest.id == None,
        "events": Event.hive_id.in_(hive_ids) if hive_ids else Event.id == None,
        "tasks": Task.user_id == user_id,
        "task_cadences": TaskCadence.user_id == user_id,
    }

    changes: dict[str, dict] = {}
    for table_name, model in TABLE_MODEL_MAP.items():
        changes[table_name] = await _pull_table(
            db, model, table_name, ownership_filters[table_name], last_pulled_at
        )

    return {"changes": changes, "timestamp": server_timestamp_ms}


# ─── Push ─────────────────────────────────────────────────────────────────────

def _prepare_record_data(
    table_name: str, raw: dict[str, Any]
) -> dict[str, Any]:
    """Clean and transform a WatermelonDB record dict for the ORM model."""
    data = {k: v for k, v in raw.items() if k not in _WMDB_INTERNAL_FIELDS}

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

        # Process created/updated records (sendCreatedAsUpdated means
        # creates come in the "updated" list too)
        for raw_record in table_changes.get("created", []) + table_changes.get("updated", []):
            record_id = raw_record.get("id")
            if not record_id:
                continue

            data = _prepare_record_data(table_name, raw_record)

            # Check if record already exists
            existing = await db.get(model, uuid.UUID(record_id))

            if existing is not None:
                # Server-wins: skip if server record is newer than client's last pull
                if last_pulled_at and existing.updated_at > last_pulled_at:
                    continue

                # Verify ownership before updating
                if not _verify_ownership(
                    table_name, existing, user_id, apiary_ids, hive_ids, inspection_ids
                ):
                    continue

                # Apply changes
                for key, value in data.items():
                    if key in ("id", "created_at"):
                        continue
                    if hasattr(existing, key):
                        setattr(existing, key, value)
                existing.updated_at = datetime.now(UTC)
            else:
                # New record — create it
                data["id"] = uuid.UUID(record_id)
                # Inject user_id for tables that require it
                if table_name in ("apiaries", "tasks", "task_cadences"):
                    data["user_id"] = user_id
                # Remove 'id' from data to set it separately
                new_record = model(**data)
                db.add(new_record)

        # Process deletions
        for record_id in table_changes.get("deleted", []):
            existing = await db.get(model, uuid.UUID(record_id))
            if existing is None:
                continue

            if not _verify_ownership(
                table_name, existing, user_id, apiary_ids, hive_ids, inspection_ids
            ):
                continue

            # Soft-delete
            existing.deleted_at = datetime.now(UTC)
            existing.updated_at = datetime.now(UTC)

    await db.commit()


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
