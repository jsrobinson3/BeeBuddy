"""OAuth2 authorization code model for MCP client authentication."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OAuth2Code(Base):
    """Short-lived authorization code for OAuth2 PKCE flow.

    These codes are created during the /authorize step and exchanged for
    JWT tokens at the /token endpoint.  Each code is single-use and expires
    after a short TTL (typically 10 minutes).
    """

    __tablename__ = "oauth2_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    client_id: Mapped[str] = mapped_column(String(255), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False, default="mcp:read")
    code_challenge: Mapped[str] = mapped_column(String(255), nullable=False)
    code_challenge_method: Mapped[str] = mapped_column(
        String(10), nullable=False, default="S256"
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
