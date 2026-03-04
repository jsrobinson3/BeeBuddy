"""User schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from app.schemas.common import BaseResponse, CamelBase


class UserCreate(CamelBase):
    """Request model for creating a user."""

    name: str | None = None
    email: str
    password: str


class UserUpdate(CamelBase):
    """Request model for updating a user. All fields optional."""

    name: str | None = None
    email: str | None = None
    experience_level: str | None = None
    locale: str | None = None
    timezone: str | None = None


class UserResponse(BaseResponse):
    """Response model for a user."""

    id: UUID
    name: str | None = None
    email: str
    experience_level: str | None = None
    locale: str | None = None
    timezone: str = "UTC"
    email_verified: bool = False
    is_admin: bool = False
    preferences: dict[str, Any] | None = None
    created_at: datetime
