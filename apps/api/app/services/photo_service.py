"""InspectionPhoto CRUD service layer."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.inspection import Inspection
from app.models.inspection_photo import InspectionPhoto


async def get_photos_for_inspection(
    db: AsyncSession, inspection_id: UUID
) -> list[InspectionPhoto]:
    """Return all non-deleted photos for an inspection."""
    result = await db.execute(
        select(InspectionPhoto)
        .where(
            InspectionPhoto.inspection_id == inspection_id,
            InspectionPhoto.deleted_at.is_(None),
        )
        .order_by(InspectionPhoto.uploaded_at.desc())
    )
    return list(result.scalars().all())


async def get_photo(db: AsyncSession, photo_id: UUID) -> InspectionPhoto | None:
    """Get a single non-deleted photo by ID."""
    result = await db.execute(
        select(InspectionPhoto).where(
            InspectionPhoto.id == photo_id,
            InspectionPhoto.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_photo(db: AsyncSession, data: dict) -> InspectionPhoto:
    """Create a new inspection photo record."""
    photo = InspectionPhoto(**data)
    db.add(photo)
    await db.commit()
    await db.refresh(photo)
    return photo


async def get_photo_for_user(
    db: AsyncSession, photo_id: UUID, user_id: UUID
) -> InspectionPhoto | None:
    """Get a photo only if the requesting user owns it (via inspection->hive->apiary)."""
    result = await db.execute(
        select(InspectionPhoto)
        .join(Inspection, InspectionPhoto.inspection_id == Inspection.id)
        .join(Hive, Inspection.hive_id == Hive.id)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            InspectionPhoto.id == photo_id,
            InspectionPhoto.deleted_at.is_(None),
            Apiary.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_photo(db: AsyncSession, photo: InspectionPhoto) -> None:
    """Hard-delete a photo record."""
    await db.delete(photo)
    await db.commit()
