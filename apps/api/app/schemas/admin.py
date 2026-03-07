"""Admin panel schemas."""

from datetime import datetime
from uuid import UUID

from app.schemas.common import BaseResponse, CamelBase


class AdminUserResponse(BaseResponse):
    """Admin view of a user with aggregate counts."""

    id: UUID
    name: str | None = None
    email: str
    experience_level: str | None = None
    email_verified: bool = False
    is_admin: bool = False
    last_login_at: datetime | None = None
    created_at: datetime
    deleted_at: datetime | None = None
    apiary_count: int = 0
    hive_count: int = 0
    total_ai_tokens: int = 0
    ai_requests_30d: int = 0


class AdminUserUpdate(CamelBase):
    """Admin update fields for a user."""

    is_admin: bool | None = None
    email_verified: bool | None = None


class AdminStatsResponse(BaseResponse):
    """Dashboard statistics."""

    total_users: int
    total_apiaries: int
    total_hives: int
    total_inspections: int
    total_conversations: int
    new_users_7d: int
    new_users_30d: int
    active_users_7d: int
    total_ai_tokens: int
    ai_requests_7d: int
    ai_requests_30d: int


class OAuth2ClientCreate(CamelBase):
    """Create a new OAuth2 client."""

    client_id: str
    name: str
    redirect_uris: list[str] = []


class OAuth2ClientUpdate(CamelBase):
    """Update an OAuth2 client."""

    name: str | None = None
    redirect_uris: list[str] | None = None
    is_active: bool | None = None


class OAuth2ClientResponse(BaseResponse):
    """OAuth2 client response."""

    id: UUID
    client_id: str
    name: str
    redirect_uris: list
    is_active: bool
    created_at: datetime
