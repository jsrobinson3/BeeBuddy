"""Photo schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from app.schemas.common import BaseResponse


class PhotoResponse(BaseResponse):
    """Response model for a photo."""

    id: UUID
    inspection_id: UUID
    s3_key: str
    caption: str | None = None
    ai_analysis: dict[str, Any] | None = None
    uploaded_at: datetime
    url: str | None = None
