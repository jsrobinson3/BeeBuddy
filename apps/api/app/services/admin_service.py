"""Admin service layer — dashboard stats, user management, OAuth client CRUD."""

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


async def _count(db: AsyncSession, model, *filters) -> int:
    """Count non-deleted rows for a model with optional extra filters."""
    stmt = (
        select(func.count())
        .select_from(model)
        .where(model.deleted_at.is_(None), *filters)
    )
    return (await db.execute(stmt)).scalar_one()


def _user_count_subqueries():
    """Correlated subqueries for per-user aggregate counts."""
    now = datetime.now(UTC)
    d30 = now - timedelta(days=30)

    apiary_sq = (
        select(func.count())
        .where(Apiary.user_id == User.id, Apiary.deleted_at.is_(None))
        .correlate(User)
        .scalar_subquery()
        .label("apiary_count")
    )
    hive_sq = (
        select(func.count())
        .where(
            Hive.apiary_id == Apiary.id,
            Apiary.user_id == User.id,
            Hive.deleted_at.is_(None),
            Apiary.deleted_at.is_(None),
        )
        .correlate(User)
        .scalar_subquery()
        .label("hive_count")
    )
    tokens_sq = (
        select(func.coalesce(func.sum(AITokenUsage.total_tokens), 0))
        .where(AITokenUsage.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
        .label("total_ai_tokens")
    )
    ai_req_30d_sq = (
        select(func.count())
        .where(
            AITokenUsage.user_id == User.id,
            AITokenUsage.created_at >= d30,
        )
        .correlate(User)
        .scalar_subquery()
        .label("ai_requests_30d")
    )
    return apiary_sq, hive_sq, tokens_sq, ai_req_30d_sq


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


async def get_dashboard_stats(db: AsyncSession) -> dict:
    """Aggregate counts for the admin dashboard."""
    now = datetime.now(UTC)
    d7 = now - timedelta(days=7)
    d30 = now - timedelta(days=30)

    return {
        "total_users": await _count(db, User),
        "total_apiaries": await _count(db, Apiary),
        "total_hives": await _count(db, Hive),
        "total_inspections": await _count(db, Inspection),
        "total_conversations": await _count(db, AIConversation),
        "new_users_7d": await _count(db, User, User.created_at >= d7),
        "new_users_30d": await _count(db, User, User.created_at >= d30),
        "active_users_7d": await _count(
            db, User, User.last_login_at.isnot(None), User.last_login_at >= d7
        ),
        "total_ai_tokens": await _sum_tokens(db),
        "ai_requests_7d": await _count_requests(
            db, AITokenUsage.created_at >= d7
        ),
        "ai_requests_30d": await _count_requests(
            db, AITokenUsage.created_at >= d30
        ),
    }


async def list_users(
    db: AsyncSession,
    search: str | None = None,
    include_deleted: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list, int]:
    """Paginated user list with optional search. Returns (users, total_count)."""
    apiary_sq, hive_sq, tokens_sq, ai_req_sq = _user_count_subqueries()

    base_filter = [] if include_deleted else [User.deleted_at.is_(None)]
    if search:
        pattern = f"%{search}%"
        base_filter.append(
            or_(User.name.ilike(pattern), User.email.ilike(pattern))
        )

    count_stmt = select(func.count()).select_from(User).where(*base_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(User, apiary_sq, hive_sq, tokens_sq, ai_req_sq)
        .where(*base_filter)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    rows = (await db.execute(stmt)).all()
    users = [_attach_counts(u, ac, hc, tk, ar) for u, ac, hc, tk, ar in rows]
    return users, total


async def get_user_detail(db: AsyncSession, user_id: UUID):
    """Get a single user with counts (including deleted)."""
    apiary_sq, hive_sq, tokens_sq, ai_req_sq = _user_count_subqueries()
    stmt = (
        select(User, apiary_sq, hive_sq, tokens_sq, ai_req_sq)
        .where(User.id == user_id)
    )
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        return None
    return _attach_counts(*row)


async def update_user_admin(db: AsyncSession, user: User, data: dict) -> User:
    """Update admin-controlled fields on a user."""
    for key, value in data.items():
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
    """Update an OAuth2 client."""
    for key, value in data.items():
        setattr(client, key, value)
    await db.commit()
    await db.refresh(client)
    return client
