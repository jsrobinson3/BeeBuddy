"""Dashboard schemas."""

from datetime import datetime

from app.schemas.common import CamelBase


class DashboardSummaryResponse(CamelBase):
    """Response model for the dashboard AI summary."""

    summary: str
    inspection_count: int
    generated_at: datetime
