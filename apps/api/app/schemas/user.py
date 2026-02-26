"""User schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    """Request model for creating a user."""

    name: str | None = None
    email: str
    password: str


class UserUpdate(BaseModel):
    """Request model for updating a user. All fields optional."""

    name: str | None = None
    email: str | None = None
    experience_level: str | None = None
    locale: str | None = None
    timezone: str | None = None


class UserResponse(BaseModel):
    """Response model for a user."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None = None
    email: str
    experience_level: str | None = None
    locale: str | None = None
    timezone: str = "UTC"
    email_verified: bool = False
    preferences: dict[str, Any] | None = None
    created_at: datetime
