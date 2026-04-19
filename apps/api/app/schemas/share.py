"""Share schemas for request/response models."""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, model_validator

from app.models.share import ShareRole, ShareStatus
from app.schemas.common import BaseResponse, CamelBase


class ShareCreate(CamelBase):
    """Request model for creating a share invitation."""

    email: EmailStr
    apiary_id: UUID | None = None
    hive_id: UUID | None = None
    role: ShareRole  # StrEnum only accepts "editor" | "viewer"

    @model_validator(mode="after")
    def exactly_one_asset(self) -> "ShareCreate":
        if self.apiary_id and self.hive_id:
            msg = "Provide either apiary_id or hive_id, not both"
            raise ValueError(msg)
        if not self.apiary_id and not self.hive_id:
            msg = "Provide either apiary_id or hive_id"
            raise ValueError(msg)
        return self


class ShareUpdate(CamelBase):
    """Request model for updating a share role."""

    role: ShareRole  # StrEnum only accepts "editor" | "viewer"


class ShareResponse(BaseResponse):
    """Response model for a share."""

    id: UUID
    owner_id: UUID
    owner_name: str | None = None
    shared_with_user_id: UUID | None = None
    shared_with_name: str | None = None
    invite_email: str | None = None
    apiary_id: UUID | None = None
    apiary_name: str | None = None
    hive_id: UUID | None = None
    hive_name: str | None = None
    role: ShareRole
    status: ShareStatus
    created_at: datetime
