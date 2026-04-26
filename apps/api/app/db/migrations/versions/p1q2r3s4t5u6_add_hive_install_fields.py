"""add install_kind, initial_frames, queen_introduced to hives

Revision ID: p1q2r3s4t5u6
Revises: n0o1p2q3r4s5
Create Date: 2026-04-23 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p1q2r3s4t5u6"
down_revision: str | None = "n0o1p2q3r4s5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


HIVE_INSTALL_KIND = sa.Enum(
    "installed", "transferred", name="hive_install_kind"
)


def upgrade() -> None:
    HIVE_INSTALL_KIND.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "hives",
        sa.Column("install_kind", HIVE_INSTALL_KIND, nullable=True),
    )
    op.add_column(
        "hives",
        sa.Column("initial_frames", sa.Integer(), nullable=True),
    )
    op.add_column(
        "hives",
        sa.Column("queen_introduced", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hives", "queen_introduced")
    op.drop_column("hives", "initial_frames")
    op.drop_column("hives", "install_kind")
    HIVE_INSTALL_KIND.drop(op.get_bind(), checkfirst=True)
