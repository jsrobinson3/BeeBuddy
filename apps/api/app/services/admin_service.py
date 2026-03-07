"""Admin service layer — dashboard stats, user management, OAuth client CRUD."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_conversation import AIConversation
from app.models.ai_token_usage import AITokenUsage
from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.inspection import Inspection
from app.models.oauth2_client import OAuth2Client
from app.models.user import User

# ---------------------------------------------------------------------------
# Allowlists for mass-assignment protection
# ---------------------------------------------------------------------------
USER_ADMIN_ALLOWED_FIELDS = {"is_admin", "email_verified"}
OAUTH_CLIENT_ALLOWED_FIELDS = {"name", "redirect_uris", "is_active"}


# ---------------------------------------------------------------------------
# User + counts wrapper (replaces monkey-patching ORM model attributes)
# ---------------------------------------------------------------------------


@dataclass
class UserWithCounts:
    """User data with aggregate counts for admin views.

    Forwards attribute access to the wrapped User so Pydantic's
    ``from_attributes=True`` can read ORM columns like ``id``, ``email``, etc.
    """

    user: User
    apiary_count: int = 0
    hive_count: int = 0
    total_ai_tokens: int = 0
    ai_requests_30d: int = 0

    def __getattr__(self, name: str):
        """Forward unknown attribute lookups to the wrapped User model."""
        return getattr(self.user, name)


# ---------------------------------------------------------------------------
# Internal query helpers
# ---------------------------------------------------------------------------


async def _count(db: AsyncSession, model, *filters) -> int:
    """Count non-deleted rows for a model with optional extra filters."""
    stmt = (
        select(func.count())
        .select_from(model)
        .where(model.deleted_at.is_(None), *filters)
    )
    return (await db.execute(stmt)).scalar_one()


async def _sum_tokens(db: AsyncSession, *filters) -> int:
    """Sum total_tokens from AITokenUsage with optional filters."""
    stmt = (
        select(func.coalesce(func.sum(AITokenUsage.total_tokens), 0))
        .select_from(AITokenUsage)
        .where(AITokenUsage.deleted_at.is_(None), *filters)
    )
    return (await db.execute(stmt)).scalar_one()


async def _count_requests(db: AsyncSession, *filters) -> int:
    """Count rows in AITokenUsage with optional filters."""
    stmt = (
        select(func.count())
        .select_from(AITokenUsage)
        .where(AITokenUsage.deleted_at.is_(None), *filters)
    )
    return (await db.execute(stmt)).scalar_one()


async def _count_user_hives(db: AsyncSession, user_id: UUID) -> int:
    """Count hives belonging to a user's non-deleted apiaries."""
    stmt = (
        select(func.count())
        .select_from(Hive)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Apiary.user_id == user_id, Hive.deleted_at.is_(None), Apiary.deleted_at.is_(None))
    )
    return (await db.execute(stmt)).scalar_one()


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Aggregate counts for the admin dashboard (sequential queries)."""
    now = datetime.now(UTC)
    d7, d30 = now - timedelta(days=7), now - timedelta(days=30)

    total_users = await _count(db, User)
    total_apiaries = await _count(db, Apiary)
    total_hives = await _count(db, Hive)
    total_inspections = await _count(db, Inspection)
    total_conversations = await _count(db, AIConversation)
    new_users_7d = await _count(db, User, User.created_at >= d7)
    new_users_30d = await _count(db, User, User.created_at >= d30)
    active_users_7d = await _count(
        db, User, User.last_login_at.isnot(None), User.last_login_at >= d7,
    )
    total_ai_tokens = await _sum_tokens(db)
    ai_requests_7d = await _count_requests(db, AITokenUsage.created_at >= d7)
    ai_requests_30d = await _count_requests(db, AITokenUsage.created_at >= d30)

    return {
        "total_users": total_users,
        "total_apiaries": total_apiaries,
        "total_hives": total_hives,
        "total_inspections": total_inspections,
        "total_conversations": total_conversations,
        "new_users_7d": new_users_7d,
        "new_users_30d": new_users_30d,
        "active_users_7d": active_users_7d,
        "total_ai_tokens": total_ai_tokens,
        "ai_requests_7d": ai_requests_7d,
        "ai_requests_30d": ai_requests_30d,
    }


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


def _user_count_subqueries():
    """Build correlated scalar subqueries for per-user aggregate counts."""
    d30 = datetime.now(UTC) - timedelta(days=30)

    apiary_sq = (
        select(func.count())
        .where(Apiary.user_id == User.id, Apiary.deleted_at.is_(None))
        .correlate(User)
        .scalar_subquery()
    )
    hive_sq = (
        select(func.count())
        .select_from(Hive)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(
            Apiary.user_id == User.id,
            Hive.deleted_at.is_(None),
            Apiary.deleted_at.is_(None),
        )
        .correlate(User)
        .scalar_subquery()
    )
    token_sq = (
        select(func.coalesce(func.sum(AITokenUsage.total_tokens), 0))
        .where(AITokenUsage.user_id == User.id, AITokenUsage.deleted_at.is_(None))
        .correlate(User)
        .scalar_subquery()
    )
    req_sq = (
        select(func.count())
        .select_from(AITokenUsage)
        .where(
            AITokenUsage.user_id == User.id,
            AITokenUsage.deleted_at.is_(None),
            AITokenUsage.created_at >= d30,
        )
        .correlate(User)
        .scalar_subquery()
    )
    return apiary_sq, hive_sq, token_sq, req_sq


async def list_users(
    db: AsyncSession,
    search: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[UserWithCounts], int]:
    """Paginated user list with search. Returns (users, total_count)."""
    base_filter = [] if include_deleted else [User.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        base_filter.append(
            or_(User.name.ilike(pattern), User.email.ilike(pattern))
        )

    count_stmt = select(func.count()).select_from(User).where(*base_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    apiary_sq, hive_sq, token_sq, req_sq = _user_count_subqueries()
    stmt = (
        select(
            User,
            apiary_sq.label("apiary_count"),
            hive_sq.label("hive_count"),
            token_sq.label("total_ai_tokens"),
            req_sq.label("ai_requests_30d"),
        )
        .where(*base_filter)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()

    users = [
        UserWithCounts(
            user=row[0],
            apiary_count=row[1],
            hive_count=row[2],
            total_ai_tokens=row[3],
            ai_requests_30d=row[4],
        )
        for row in rows
    ]
    return users, total


async def get_user_detail(db: AsyncSession, user_id: UUID) -> UserWithCounts | None:
    """Get a single user with aggregate counts (including soft-deleted users)."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        return None

    d30 = datetime.now(UTC) - timedelta(days=30)
    apiary_count = await _count(db, Apiary, Apiary.user_id == user_id)
    hive_count = await _count_user_hives(db, user_id)
    total_ai_tokens = await _sum_tokens(db, AITokenUsage.user_id == user_id)
    ai_requests_30d = await _count_requests(
        db, AITokenUsage.user_id == user_id, AITokenUsage.created_at >= d30,
    )
    return UserWithCounts(
        user=user,
        apiary_count=apiary_count,
        hive_count=hive_count,
        total_ai_tokens=total_ai_tokens,
        ai_requests_30d=ai_requests_30d,
    )


async def update_user_admin(db: AsyncSession, user: User, data: dict) -> User:
    """Update admin-controlled fields on a user (allowlisted)."""
    for key, value in data.items():
        if key in USER_ADMIN_ALLOWED_FIELDS:
            setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return user


async def restore_user(db: AsyncSession, user: User) -> User:
    """Restore a soft-deleted user by clearing deleted_at and _delete_data."""
    user.deleted_at = None
    if user.preferences and "_delete_data" in user.preferences:
        prefs = dict(user.preferences)
        prefs.pop("_delete_data", None)
        user.preferences = prefs if prefs else None
    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# OAuth2 client management
# ---------------------------------------------------------------------------


async def list_oauth_clients(db: AsyncSession) -> list[OAuth2Client]:
    """List all OAuth2 clients."""
    stmt = (
        select(OAuth2Client)
        .where(OAuth2Client.deleted_at.is_(None))
        .order_by(OAuth2Client.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_oauth_client(db: AsyncSession, client_id: UUID) -> OAuth2Client | None:
    """Fetch a single OAuth2 client by primary key."""
    stmt = select(OAuth2Client).where(
        OAuth2Client.id == client_id,
        OAuth2Client.deleted_at.is_(None),
    )
    return (await db.execute(stmt)).scalar_one_or_none()


async def create_oauth_client(db: AsyncSession, data: dict) -> OAuth2Client:
    """Create a new OAuth2 client."""
    client = OAuth2Client(**data)
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


async def update_oauth_client(
    db: AsyncSession, client: OAuth2Client, data: dict
) -> OAuth2Client:
    """Update an OAuth2 client (allowlisted fields only)."""
    for key, value in data.items():
        if key in OAUTH_CLIENT_ALLOWED_FIELDS:
            setattr(client, key, value)
    await db.commit()
    await db.refresh(client)
    return client
