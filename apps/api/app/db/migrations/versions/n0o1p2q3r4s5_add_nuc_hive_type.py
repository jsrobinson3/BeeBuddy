"""add nuc to hive_type enum

Revision ID: n0o1p2q3r4s5
Revises: 0089231dedc7
Create Date: 2026-04-19 00:00:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "n0o1p2q3r4s5"
down_revision: str | None = "0089231dedc7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE hive_type ADD VALUE IF NOT EXISTS 'nuc'")


def downgrade() -> None:
    # PostgreSQL does not support removing individual enum values.
    # The 'nuc' value in hive_type will remain after downgrade.
    pass
