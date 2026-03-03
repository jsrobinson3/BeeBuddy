"""Add oauth2_codes table for MCP client PKCE authentication.

Revision ID: j5k6l7m8n9o0
Revises: i4j5k6l7m8n9
Create Date: 2026-02-28 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "j5k6l7m8n9o0"
down_revision: str = "i4j5k6l7m8n9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "oauth2_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "code",
            sa.String(255),
            unique=True,
            nullable=False,
            index=True,
        ),
        sa.Column("client_id", sa.String(255), nullable=False),
        sa.Column("redirect_uri", sa.Text, nullable=False),
        sa.Column(
            "scope",
            sa.String(255),
            nullable=False,
            server_default="mcp:read",
        ),
        sa.Column("code_challenge", sa.String(255), nullable=False),
        sa.Column(
            "code_challenge_method",
            sa.String(10),
            nullable=False,
            server_default="S256",
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "used",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("oauth2_codes")
