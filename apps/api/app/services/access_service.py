"""Reusable SQLAlchemy filter clauses for shared resource access.

These functions return composable WHERE clauses that expand ownership
checks to include accepted shares. Used by service-layer list queries.
"""

from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.share import Share, ShareStatus


def apiary_access_filter(user_id: UUID) -> ColumnElement[bool]:
    """WHERE clause: apiaries the user owns OR has an accepted share on."""
    shared_apiary_subq = (
        select(Share.apiary_id)
        .where(
            Share.shared_with_user_id == user_id,
            Share.status == ShareStatus.ACCEPTED,
            Share.apiary_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .correlate_except(Share)
    )
    return or_(Apiary.user_id == user_id, Apiary.id.in_(shared_apiary_subq))


def hive_access_filter(user_id: UUID) -> ColumnElement[bool]:
    """WHERE clause: hives in accessible apiaries OR with direct accepted shares."""
    # Hives via apiary access (owned or shared apiaries)
    accessible_apiary_subq = (
        select(Apiary.id)
        .where(apiary_access_filter(user_id), Apiary.deleted_at.is_(None))
        .correlate_except(Apiary)
    )

    # Direct hive shares
    shared_hive_subq = (
        select(Share.hive_id)
        .where(
            Share.shared_with_user_id == user_id,
            Share.status == ShareStatus.ACCEPTED,
            Share.hive_id.isnot(None),
            Share.deleted_at.is_(None),
        )
        .correlate_except(Share)
    )

    return or_(
        Hive.apiary_id.in_(accessible_apiary_subq),
        Hive.id.in_(shared_hive_subq),
    )
