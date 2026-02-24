"""add hive_id to task_cadences for per-hive cadences

Revision ID: f7g8h9i0j1k2
Revises: a1b2c3d4e5f6
Create Date: 2026-02-23 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "f7g8h9i0j1k2"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add nullable hive_id FK column
    op.add_column(
        "task_cadences",
        sa.Column(
            "hive_id",
            UUID(as_uuid=True),
            sa.ForeignKey("hives.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_task_cadences_hive_id", "task_cadences", ["hive_id"])

    # 2. Drop the old unique constraint (user_id, cadence_key)
    op.drop_constraint("uq_user_cadence", "task_cadences", type_="unique")

    # 3. Create partial unique index for global (user-level) cadences
    op.execute(
        "CREATE UNIQUE INDEX uq_user_cadence_global "
        "ON task_cadences (user_id, cadence_key) "
        "WHERE hive_id IS NULL AND deleted_at IS NULL"
    )

    # 4. Create partial unique index for hive-scoped cadences
    op.execute(
        "CREATE UNIQUE INDEX uq_user_cadence_hive "
        "ON task_cadences (user_id, cadence_key, hive_id) "
        "WHERE hive_id IS NOT NULL AND deleted_at IS NULL"
    )

    # 5. Soft-delete existing user-level rows for keys that are now hive-scoped.
    #    These will be recreated per-hive when users next create a hive.
    op.execute(
        "UPDATE task_cadences SET deleted_at = NOW() "
        "WHERE cadence_key IN ('regular_inspection', 'varroa_monitoring') "
        "AND hive_id IS NULL AND deleted_at IS NULL"
    )


def downgrade() -> None:
    # Reverse soft-deletes
    op.execute(
        "UPDATE task_cadences SET deleted_at = NULL "
        "WHERE cadence_key IN ('regular_inspection', 'varroa_monitoring') "
        "AND hive_id IS NULL"
    )

    # Drop partial unique indexes
    op.execute("DROP INDEX IF EXISTS uq_user_cadence_hive")
    op.execute("DROP INDEX IF EXISTS uq_user_cadence_global")

    # Restore original unique constraint
    op.create_unique_constraint("uq_user_cadence", "task_cadences", ["user_id", "cadence_key"])

    # Drop hive_id column
    op.drop_index("ix_task_cadences_hive_id", "task_cadences")
    op.drop_column("task_cadences", "hive_id")
