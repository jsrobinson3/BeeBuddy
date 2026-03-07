"""Admin panel endpoints — stats, user management, OAuth client CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.admin import get_admin_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserResponse,
    AdminUserUpdate,
    OAuth2ClientCreate,
    OAuth2ClientResponse,
    OAuth2ClientUpdate,
    PaginatedUsersResponse,
)
from app.services import admin_service

router = APIRouter(prefix="/admin")


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Dashboard statistics."""
    return await admin_service.get_dashboard_stats(db)


@router.get("/users", response_model=PaginatedUsersResponse)
async def list_users(
    search: str | None = Query(None),
    include_deleted: bool = Query(False),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Paginated user list with optional search."""
    users, total = await admin_service.list_users(
        db, search=search, include_deleted=include_deleted, limit=limit, offset=offset
    )
    return PaginatedUsersResponse(items=users, total=total)


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Get a single user by ID."""
    user = await admin_service.get_user_detail(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: UUID,
    data: AdminUserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update admin-controlled fields on a user."""
    user = await admin_service.get_user_detail(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await admin_service.update_user_admin(
        db, user, data.model_dump(exclude_unset=True)
    )
    return await admin_service.get_user_detail(db, updated.id)


@router.post("/users/{user_id}/restore", response_model=AdminUserResponse)
async def restore_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Restore a soft-deleted user."""
    user = await admin_service.get_user_detail(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.deleted_at is None:
        raise HTTPException(status_code=400, detail="User is not deleted")
    restored = await admin_service.restore_user(db, user)
    return await admin_service.get_user_detail(db, restored.id)


# ---------------------------------------------------------------------------
# OAuth2 client management
# ---------------------------------------------------------------------------


@router.get("/oauth-clients", response_model=list[OAuth2ClientResponse])
async def list_oauth_clients(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """List all registered OAuth2 clients."""
    return await admin_service.list_oauth_clients(db)


@router.post(
    "/oauth-clients", response_model=OAuth2ClientResponse, status_code=201
)
async def create_oauth_client(
    data: OAuth2ClientCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Register a new OAuth2 client."""
    return await admin_service.create_oauth_client(db, data.model_dump())


@router.patch("/oauth-clients/{client_id}", response_model=OAuth2ClientResponse)
async def update_oauth_client(
    client_id: UUID,
    data: OAuth2ClientUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    """Update an OAuth2 client."""
    client = await admin_service.get_oauth_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="OAuth2 client not found")
    return await admin_service.update_oauth_client(
        db, client, data.model_dump(exclude_unset=True)
    )
