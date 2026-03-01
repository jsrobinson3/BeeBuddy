"""Add oauth2_clients table for redirect URI validation.

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-03-01 00:00:00.000000

"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "k6l7m8n9o0p1"
down_revision: str = "j5k6l7m8n9o0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SEED_CLIENTS = [
    {
        "id": uuid.uuid4(),
        "client_id": "claude-desktop",
        "name": "Claude Desktop",
        "redirect_uris": '["http://localhost/callback"]',
        "is_active": True,
    },
]


def _oauth2_clients_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("redirect_uris", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True, index=True),
    ]


def upgrade() -> None:
    clients = op.create_table("oauth2_clients", *_oauth2_clients_columns())
    op.bulk_insert(clients, SEED_CLIENTS)


def downgrade() -> None:
    op.drop_table("oauth2_clients")
