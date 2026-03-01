"""Registered OAuth2 client model for redirect URI validation."""

from sqlalchemy import Boolean, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class OAuth2Client(Base):
    """A registered OAuth2 public client (PKCE, no client_secret).

    Stores allowed redirect URIs so the authorization endpoint can reject
    requests that would redirect auth codes to unregistered origins.
    """

    __tablename__ = "oauth2_clients"

    client_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    redirect_uris: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
