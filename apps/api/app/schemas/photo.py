"""Photo schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PhotoResponse(BaseModel):
    """Response model for a photo."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inspection_id: UUID
    s3_key: str
    caption: str | None = None
    ai_analysis: dict[str, Any] | None = None
    uploaded_at: datetime
    url: str | None = None
