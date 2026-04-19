"""Permission helpers for shared resource access control.

Provides functions to check a user's effective permission on an apiary or hive,
considering both direct ownership and accepted shares. Used by routers to gate
create/update/delete operations.
"""

import enum
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.share import Share, ShareStatus


class Permission(enum.StrEnum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


_HIERARCHY = {Permission.OWNER: 3, Permission.EDITOR: 2, Permission.VIEWER: 1}


async def check_apiary_permission(
    db: AsyncSession,
    apiary_id: UUID,
    user_id: UUID,
) -> Permission | None:
    """Return the user's effective permission on an apiary, or None."""
    apiary = await _get_apiary(db, apiary_id)
    if apiary is None:
        return None
    if apiary.user_id == user_id:
        return Permission.OWNER

    share = await _get_accepted_share(db, user_id, apiary_id=apiary_id)
    return Permission(share.role) if share else None


async def check_hive_permission(
    db: AsyncSession,
    hive_id: UUID,
    user_id: UUID,
) -> Permission | None:
    """Return the user's effective permission on a hive, or None.

    Checks: ownership, direct hive share, parent apiary share.
    When multiple shares apply, the highest permission wins.
    """
    hive = await _get_hive(db, hive_id)
    if hive is None:
        return None

    apiary = await _get_apiary(db, hive.apiary_id)
    if apiary is None:
        return None
    if apiary.user_id == user_id:
        return Permission.OWNER

    # Collect all applicable share permissions
    permissions: list[Permission] = []

    hive_share = await _get_accepted_share(db, user_id, hive_id=hive_id)
    if hive_share:
        permissions.append(Permission(hive_share.role))

    apiary_share = await _get_accepted_share(db, user_id, apiary_id=hive.apiary_id)
    if apiary_share:
        permissions.append(Permission(apiary_share.role))

    if not permissions:
        return None
    return max(permissions, key=lambda p: _HIERARCHY[p])


def require_permission(
    permission: Permission | None,
    minimum: Permission,
    detail: str = "Not found",
) -> None:
    """Raise 404 if no access, 403 if insufficient permission."""
    if permission is None:
        raise HTTPException(status_code=404, detail=detail)
    if _HIERARCHY[permission] < _HIERARCHY[minimum]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _get_apiary(db: AsyncSession, apiary_id: UUID) -> Apiary | None:
    stmt = select(Apiary).where(
        Apiary.id == apiary_id, Apiary.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _get_hive(db: AsyncSession, hive_id: UUID) -> Hive | None:
    stmt = select(Hive).where(
        Hive.id == hive_id, Hive.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _get_accepted_share(
    db: AsyncSession,
    user_id: UUID,
    *,
    apiary_id: UUID | None = None,
    hive_id: UUID | None = None,
) -> Share | None:
    stmt = select(Share).where(
        Share.shared_with_user_id == user_id,
        Share.status == ShareStatus.ACCEPTED,
        Share.deleted_at.is_(None),
    )
    if apiary_id is not None:
        stmt = stmt.where(Share.apiary_id == apiary_id)
    if hive_id is not None:
        stmt = stmt.where(Share.hive_id == hive_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
