"""add_share_composite_indexes

Revision ID: a422d6ba7a65
Revises: a080fea34fe1
Create Date: 2026-04-19 14:26:05.544013

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a422d6ba7a65"
down_revision: Union[str, Sequence[str], None] = "a080fea34fe1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add composite partial indexes for access filter subquery hot paths."""
    op.create_index(
        "ix_shares_access_apiary",
        "shares",
        ["shared_with_user_id", "apiary_id"],
        postgresql_where=sa.text(
            "status = 'accepted' AND deleted_at IS NULL AND apiary_id IS NOT NULL"
        ),
    )
    op.create_index(
        "ix_shares_access_hive",
        "shares",
        ["shared_with_user_id", "hive_id"],
        postgresql_where=sa.text(
            "status = 'accepted' AND deleted_at IS NULL AND hive_id IS NOT NULL"
        ),
    )
    op.create_index(
        "ix_shares_pending_email",
        "shares",
        ["invite_email"],
        postgresql_where=sa.text(
            "shared_with_user_id IS NULL AND status = 'pending' AND deleted_at IS NULL"
        ),
    )


def downgrade() -> None:
    """Drop composite partial indexes."""
    op.drop_index(
        "ix_shares_pending_email",
        table_name="shares",
        postgresql_where=sa.text(
            "shared_with_user_id IS NULL AND status = 'pending' AND deleted_at IS NULL"
        ),
    )
    op.drop_index(
        "ix_shares_access_hive",
        table_name="shares",
        postgresql_where=sa.text(
            "status = 'accepted' AND deleted_at IS NULL AND hive_id IS NOT NULL"
        ),
    )
    op.drop_index(
        "ix_shares_access_apiary",
        table_name="shares",
        postgresql_where=sa.text(
            "status = 'accepted' AND deleted_at IS NULL AND apiary_id IS NOT NULL"
        ),
    )
