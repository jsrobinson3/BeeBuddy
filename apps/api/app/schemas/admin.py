"""Admin panel schemas."""

from datetime import datetime
from urllib.parse import urlparse
from uuid import UUID

import json

from pydantic import field_validator

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


class PaginatedUsersResponse(CamelBase):
    """Paginated list of admin user records."""

    items: list[AdminUserResponse]
    total: int


class AdminUserUpdate(CamelBase):
    """Admin update fields for a user."""

    is_admin: bool | None = None
    email_verified: bool | None = None


class AdminStatsResponse(CamelBase):
    """Dashboard statistics (standalone — no id/created_at from BaseResponse)."""

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


def _validate_redirect_uris(uris: list[str]) -> list[str]:
    """Ensure each URI uses https:// or http://localhost."""
    for uri in uris:
        parsed = urlparse(uri)
        if parsed.scheme == "https":
            continue
        if parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1"):
            continue
        raise ValueError(
            f"Redirect URI must use https:// or http://localhost: {uri}"
        )
    return uris


class OAuth2ClientCreate(CamelBase):
    """Create a new OAuth2 client."""

    client_id: str
    name: str
    redirect_uris: list[str] = []

    @field_validator("redirect_uris")
    @classmethod
    def check_redirect_uris(cls, v: list[str]) -> list[str]:
        return _validate_redirect_uris(v)


class OAuth2ClientUpdate(CamelBase):
    """Update an OAuth2 client."""

    name: str | None = None
    redirect_uris: list[str] | None = None
    is_active: bool | None = None

    @field_validator("redirect_uris")
    @classmethod
    def check_redirect_uris(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return _validate_redirect_uris(v)


class OAuth2ClientResponse(BaseResponse):
    """OAuth2 client response."""

    id: UUID
    client_id: str
    name: str
    redirect_uris: list
    is_active: bool
    created_at: datetime

    @field_validator("redirect_uris", mode="before")
    @classmethod
    def parse_redirect_uris(cls, v: object) -> list:
        """Handle redirect_uris stored as a JSON string in the database."""
        if isinstance(v, str):
            return json.loads(v)
        return v
