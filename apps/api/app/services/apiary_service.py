"""Apiary CRUD service layer."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.share import Share, ShareStatus
from app.services.access_service import apiary_access_filter


async def get_apiaries(
    db: AsyncSession,
    user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[Apiary]:
    """Return all non-deleted apiaries with hive counts and sharing metadata."""
    # Subquery for the user's role on each apiary via shares
    my_share = (
        select(Share.apiary_id, Share.role)
        .where(
            Share.shared_with_user_id == user_id,
            Share.status == ShareStatus.ACCEPTED,
            Share.apiary_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .subquery()
    )

    # Count of accepted shares per apiary
    share_count_sq = (
        select(
            Share.apiary_id,
            func.count(Share.id).label("cnt"),
        )
        .where(
            Share.status == ShareStatus.ACCEPTED,
            Share.apiary_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .group_by(Share.apiary_id)
        .subquery()
    )

    stmt = (
        select(
            Apiary,
            func.count(Hive.id).label("hive_count"),
            case(
                (Apiary.user_id == user_id, None),
                else_=my_share.c.role,
            ).label("my_role"),
            func.coalesce(share_count_sq.c.cnt, 0).label("share_count"),
        )
        .outerjoin(Hive, (Hive.apiary_id == Apiary.id) & Hive.deleted_at.is_(None))
        .outerjoin(my_share, Apiary.id == my_share.c.apiary_id)
        .outerjoin(share_count_sq, Apiary.id == share_count_sq.c.apiary_id)
        .where(Apiary.deleted_at.is_(None), apiary_access_filter(user_id))
        .group_by(Apiary.id, my_share.c.role, share_count_sq.c.cnt)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()
    for apiary, hive_count, my_role, share_count in rows:
        apiary.hive_count = hive_count
        apiary.my_role = my_role
        apiary.share_count = share_count
    return [apiary for apiary, *_ in rows]


async def create_apiary(db: AsyncSession, data: dict, user_id: UUID) -> Apiary:
    """Create a new apiary."""
    data["user_id"] = user_id
    apiary = Apiary(**data)
    db.add(apiary)
    await db.commit()
    await db.refresh(apiary)
    apiary.hive_count = 0
    return apiary


async def get_apiary(db: AsyncSession, apiary_id: UUID) -> Apiary | None:
    """Get a single non-deleted apiary by ID with hive count."""
    stmt = (
        select(
            Apiary,
            func.count(Hive.id).label("hive_count"),
        )
        .outerjoin(Hive, (Hive.apiary_id == Apiary.id) & Hive.deleted_at.is_(None))
        .where(Apiary.id == apiary_id, Apiary.deleted_at.is_(None))
        .group_by(Apiary.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    if row is None:
        return None
    apiary, hive_count = row
    apiary.hive_count = hive_count
    return apiary


async def update_apiary(db: AsyncSession, apiary: Apiary, data: dict) -> Apiary:
    """Update apiary fields from a dict of changed values."""
    for key, value in data.items():
        setattr(apiary, key, value)
    await db.commit()
    await db.refresh(apiary)
    return apiary


async def delete_apiary(db: AsyncSession, apiary: Apiary) -> None:
    """Soft-delete an apiary."""
    apiary.deleted_at = datetime.now(UTC)
    await db.commit()
