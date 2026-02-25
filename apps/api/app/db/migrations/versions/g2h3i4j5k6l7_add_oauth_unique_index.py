"""Add partial unique index on (oauth_provider, oauth_sub).

Revision ID: g2h3i4j5k6l7
Revises: f7g8h9i0j1k2
Create Date: 2026-02-24 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "g2h3i4j5k6l7"
down_revision: str | None = "f7g8h9i0j1k2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_users_oauth_provider_sub",
        "users",
        ["oauth_provider", "oauth_sub"],
        unique=True,
        postgresql_where=text(
            "oauth_provider IS NOT NULL AND oauth_sub IS NOT NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("ix_users_oauth_provider_sub", table_name="users")
