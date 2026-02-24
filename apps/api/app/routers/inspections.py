"""Inspection management endpoints."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.user import User
from app.schemas.inspection import (
    ExperienceLevel,
    InspectionCreate,
    InspectionResponse,
    InspectionUpdate,
)
from app.schemas.photo import PhotoResponse
from app.services import inspection_service, photo_service

router = APIRouter(prefix="/inspections")


def _photos_from_orm(inspection: Inspection) -> list[PhotoResponse]:
    """Build PhotoResponse list with presigned URLs from eager-loaded photos."""
    return photo_service.attach_presigned_urls(
        [PhotoResponse.model_validate(p) for p in inspection.photos]
    )


# -- Static template data --------------------------------------------------

_STORES_OPTS = ["low", "adequate", "abundant"]
_TEMPERAMENT_OPTS = ["calm", "nervous", "aggressive"]
_POP_OPTS = ["weak", "moderate", "strong"]
_PEST_OPTS = ["varroa", "hive_beetles", "wax_moths", "ants", "none"]
_DISEASE_OPTS = ["afb", "efb", "chalkbrood", "nosema", "dwv", "none"]

_BEGINNER_FIELDS: list[dict] = [
    {"name": "queen_seen", "label": "Did you see the queen?",
     "type": "boolean"},
    {"name": "eggs_seen", "label": "Did you see eggs?",
     "type": "boolean"},
    {"name": "population_estimate",
     "label": "How strong is the colony?",
     "type": "select", "options": _POP_OPTS},
    {"name": "honey_stores", "label": "How are the honey stores?",
     "type": "select", "options": _STORES_OPTS},
    {"name": "temperament", "label": "How was their temperament?",
     "type": "select", "options": _TEMPERAMENT_OPTS},
    {"name": "notes", "label": "Additional notes", "type": "text"},
]

_INTERMEDIATE_FIELDS: list[dict] = [
    {"name": "queen_seen", "label": "Queen seen?",
     "type": "boolean"},
    {"name": "eggs_seen", "label": "Eggs present?",
     "type": "boolean"},
    {"name": "larvae_seen", "label": "Larvae present?",
     "type": "boolean"},
    {"name": "capped_brood", "label": "Capped brood present?",
     "type": "boolean"},
    {"name": "brood_pattern_score", "label": "Brood pattern (1-5)",
     "type": "number", "min": 1, "max": 5},
    {"name": "frames_of_bees", "label": "Frames of bees",
     "type": "number"},
    {"name": "frames_of_brood", "label": "Frames of brood",
     "type": "number"},
    {"name": "honey_stores", "label": "Honey stores",
     "type": "select", "options": _STORES_OPTS},
    {"name": "pollen_stores", "label": "Pollen stores",
     "type": "select", "options": _STORES_OPTS},
    {"name": "pest_signs", "label": "Signs of pests?",
     "type": "multiselect", "options": _PEST_OPTS},
    {"name": "notes", "label": "Notes", "type": "text"},
]

_ADVANCED_FIELDS: list[dict] = [
    {"name": "queen_seen", "label": "Queen seen",
     "type": "boolean"},
    {"name": "eggs_seen", "label": "Eggs", "type": "boolean"},
    {"name": "larvae_seen", "label": "Larvae", "type": "boolean"},
    {"name": "capped_brood", "label": "Capped brood",
     "type": "boolean"},
    {"name": "brood_pattern_score", "label": "Brood pattern (1-5)",
     "type": "number", "min": 1, "max": 5},
    {"name": "frames_of_bees", "label": "Frames of bees",
     "type": "number"},
    {"name": "frames_of_brood", "label": "Frames of brood",
     "type": "number"},
    {"name": "num_supers", "label": "Number of supers",
     "type": "number"},
    {"name": "population_estimate", "label": "Population",
     "type": "select", "options": _POP_OPTS},
    {"name": "temperament", "label": "Temperament",
     "type": "select", "options": _TEMPERAMENT_OPTS},
    {"name": "honey_stores", "label": "Honey stores",
     "type": "select", "options": _STORES_OPTS},
    {"name": "pollen_stores", "label": "Pollen stores",
     "type": "select", "options": _STORES_OPTS},
    {"name": "disease_signs", "label": "Disease signs",
     "type": "multiselect", "options": _DISEASE_OPTS},
    {"name": "pest_signs", "label": "Pest signs",
     "type": "multiselect", "options": _PEST_OPTS},
    {"name": "varroa_count", "label": "Varroa count (per 100 bees)",
     "type": "number"},
    {"name": "notes", "label": "Detailed notes", "type": "text"},
]

_TEMPLATES = {
    ExperienceLevel.BEGINNER: {
        "level": "beginner", "fields": _BEGINNER_FIELDS,
    },
    ExperienceLevel.INTERMEDIATE: {
        "level": "intermediate", "fields": _INTERMEDIATE_FIELDS,
    },
    ExperienceLevel.ADVANCED: {
        "level": "advanced", "fields": _ADVANCED_FIELDS,
    },
}

# -- Endpoints --------------------------------------------------------------


@router.get("", response_model=list[InspectionResponse])
async def list_inspections(
    hive_id: UUID | None = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List inspections, optionally filtered by hive."""
    inspections = await inspection_service.get_inspections(
        db, user_id=current_user.id, hive_id=hive_id, limit=limit, offset=offset
    )
    results = []
    for insp in inspections:
        resp = InspectionResponse.model_validate(insp)
        resp.photos = _photos_from_orm(insp)
        results.append(resp)
    return results


@router.post("", response_model=InspectionResponse, status_code=201)
async def create_inspection(
    data: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new inspection."""
    payload = data.model_dump()
    if payload.get("inspected_at") is None:
        payload["inspected_at"] = datetime.now(UTC)
    # Serialize nested Pydantic models to dicts for JSONB columns
    if payload.get("observations") is not None:
        payload["observations"] = data.observations.model_dump()
    if payload.get("weather") is not None:
        payload["weather"] = data.weather.model_dump()
    inspection = await inspection_service.create_inspection(db, payload)
    # Build response without touching inspection.photos (not eager-loaded,
    # lazy access would crash in async context).  New inspection has no photos.
    return InspectionResponse(
        id=inspection.id,
        hive_id=inspection.hive_id,
        inspected_at=inspection.inspected_at,
        duration_minutes=inspection.duration_minutes,
        experience_template=inspection.experience_template,
        observations=inspection.observations,
        weather=inspection.weather,
        impression=inspection.impression,
        attention=inspection.attention,
        reminder=inspection.reminder,
        reminder_date=inspection.reminder_date,
        notes=inspection.notes,
        ai_summary=inspection.ai_summary,
        created_at=inspection.created_at,
        photos=[],
    )


@router.get("/templates/{level}")
async def get_inspection_template(level: ExperienceLevel):
    """Get the inspection template for a given experience level."""
    return _TEMPLATES[level]


@router.get("/{inspection_id}", response_model=InspectionResponse)
async def get_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific inspection by ID."""
    inspection = await inspection_service.get_inspection(
        db, inspection_id, user_id=current_user.id
    )
    if not inspection:
        raise HTTPException(
            status_code=404, detail="Inspection not found"
        )
    resp = InspectionResponse.model_validate(inspection)
    resp.photos = _photos_from_orm(inspection)
    return resp


@router.patch("/{inspection_id}", response_model=InspectionResponse)
async def update_inspection(
    inspection_id: UUID,
    data: InspectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing inspection."""
    inspection = await inspection_service.get_inspection(
        db, inspection_id, user_id=current_user.id
    )
    if not inspection:
        raise HTTPException(
            status_code=404, detail="Inspection not found"
        )
    payload = data.model_dump(exclude_unset=True)
    if "observations" in payload and payload["observations"] is not None:
        payload["observations"] = data.observations.model_dump()
    if "weather" in payload and payload["weather"] is not None:
        payload["weather"] = data.weather.model_dump()
    # Capture photos before update — db.refresh() resets loaded state
    photos = _photos_from_orm(inspection)
    updated = await inspection_service.update_inspection(
        db, inspection, payload
    )
    return InspectionResponse(
        id=updated.id,
        hive_id=updated.hive_id,
        inspected_at=updated.inspected_at,
        duration_minutes=updated.duration_minutes,
        experience_template=updated.experience_template,
        observations=updated.observations,
        weather=updated.weather,
        impression=updated.impression,
        attention=updated.attention,
        reminder=updated.reminder,
        reminder_date=updated.reminder_date,
        notes=updated.notes,
        ai_summary=updated.ai_summary,
        created_at=updated.created_at,
        photos=photos,
    )


@router.delete("/{inspection_id}", status_code=204)
async def delete_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an inspection."""
    inspection = await inspection_service.get_inspection(
        db, inspection_id, user_id=current_user.id
    )
    if not inspection:
        raise HTTPException(
            status_code=404, detail="Inspection not found"
        )
    await inspection_service.delete_inspection(db, inspection)
