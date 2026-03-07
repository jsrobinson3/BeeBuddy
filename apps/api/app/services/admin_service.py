"""Admin service layer — dashboard stats, user management, OAuth client CRUD."""

import asyncio
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
        .where(*filters)
    )
    return (await db.execute(stmt)).scalar_one()


async def _count_requests(db: AsyncSession, *filters) -> int:
    """Count rows in AITokenUsage with optional filters."""
    stmt = (
        select(func.count())
        .select_from(AITokenUsage)
        .where(*filters)
    )
    return (await db.execute(stmt)).scalar_one()


# ---------------------------------------------------------------------------
# Per-user aggregate counts (used by list_users / get_user_detail)
# ---------------------------------------------------------------------------


async def _count_user_hives(db: AsyncSession, user_id: UUID) -> int:
    """Count hives belonging to a user's non-deleted apiaries."""
    stmt = (
        select(func.count())
        .select_from(Hive)
        .join(Apiary, Hive.apiary_id == Apiary.id)
        .where(Apiary.user_id == user_id, Hive.deleted_at.is_(None), Apiary.deleted_at.is_(None))
    )
    return (await db.execute(stmt)).scalar_one()


async def _user_aggregate_counts(
    db: AsyncSession, user_id: UUID
) -> tuple[int, int, int, int]:
    """Fetch per-user aggregate counts concurrently via asyncio.gather."""
    d30 = datetime.now(UTC) - timedelta(days=30)

    return await asyncio.gather(
        _count(db, Apiary, Apiary.user_id == user_id),
        _count_user_hives(db, user_id),
        _sum_tokens(db, AITokenUsage.user_id == user_id),
        _count_requests(
            db, AITokenUsage.user_id == user_id, AITokenUsage.created_at >= d30
        ),
    )


def _attach_counts(
    user: User,
    apiary_count: int,
    hive_count: int,
    total_ai_tokens: int = 0,
    ai_requests_30d: int = 0,
) -> User:
    """Attach aggregate counts to a user instance."""
    user.apiary_count = apiary_count or 0
    user.hive_count = hive_count or 0
    user.total_ai_tokens = total_ai_tokens or 0
    user.ai_requests_30d = ai_requests_30d or 0
    return user


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Aggregate counts for the admin dashboard (concurrent via asyncio.gather)."""
    now = datetime.now(UTC)
    d7, d30 = now - timedelta(days=7), now - timedelta(days=30)

    keys = [
        "total_users", "total_apiaries", "total_hives", "total_inspections",
        "total_conversations", "new_users_7d", "new_users_30d",
        "active_users_7d", "total_ai_tokens", "ai_requests_7d", "ai_requests_30d",
    ]
    values = await asyncio.gather(
        _count(db, User),
        _count(db, Apiary),
        _count(db, Hive),
        _count(db, Inspection),
        _count(db, AIConversation),
        _count(db, User, User.created_at >= d7),
        _count(db, User, User.created_at >= d30),
        _count(db, User, User.last_login_at.isnot(None), User.last_login_at >= d7),
        _sum_tokens(db),
        _count_requests(db, AITokenUsage.created_at >= d7),
        _count_requests(db, AITokenUsage.created_at >= d30),
    )
    return dict(zip(keys, values))


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


async def list_users(
    db: AsyncSession,
    search: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list, int]:
    """Paginated user list with optional search. Returns (users, total_count).

    Uses asyncio.gather for per-user aggregate counts instead of correlated
    subqueries.
    """
    base_filter = [] if include_deleted else [User.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        base_filter.append(
            or_(User.name.ilike(pattern), User.email.ilike(pattern))
        )

    count_stmt = select(func.count()).select_from(User).where(*base_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(User)
        .where(*base_filter)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).scalars().all()

    # Gather aggregate counts concurrently for all users
    count_tasks = [_user_aggregate_counts(db, u.id) for u in rows]
    counts = await asyncio.gather(*count_tasks) if count_tasks else []

    users = [
        _attach_counts(user, ac, hc, tk, ar)
        for user, (ac, hc, tk, ar) in zip(rows, counts)
    ]
    return users, total


async def get_user_detail(db: AsyncSession, user_id: UUID):
    """Get a single user with counts (including deleted)."""
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        return None
    ac, hc, tk, ar = await _user_aggregate_counts(db, user_id)
    return _attach_counts(user, ac, hc, tk, ar)


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
