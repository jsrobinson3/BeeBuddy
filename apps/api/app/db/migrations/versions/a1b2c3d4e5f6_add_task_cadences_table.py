"""add task_cadences table and system task source

Revision ID: a1b2c3d4e5f6
Revises: b3f1a2c4d5e6
Create Date: 2026-02-23 00:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "b3f1a2c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add SYSTEM to the task_source enum
    op.execute("ALTER TYPE task_source ADD VALUE IF NOT EXISTS 'SYSTEM'")

    op.create_table(
        "task_cadences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("cadence_key", sa.String(100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "cadence_key", name="uq_user_cadence"),
    )


def downgrade() -> None:
    op.drop_table("task_cadences")
    # Note: PostgreSQL does not support removing individual enum values.
    # The SYSTEM value in task_source will remain after downgrade.
