"""add_shares_table

Revision ID: a080fea34fe1
Revises: 0089231dedc7
Create Date: 2026-04-19 13:16:35.679676

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a080fea34fe1"
down_revision: Union[str, Sequence[str], None] = "0089231dedc7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create shares table with enums, indexes, and constraints."""
    share_role = sa.Enum("editor", "viewer", name="share_role")
    share_status = sa.Enum(
        "pending", "accepted", "declined", "revoked", name="share_status",
    )

    op.create_table(
        "shares",
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("shared_with_user_id", sa.UUID(), nullable=True),
        sa.Column("invite_email", sa.String(length=255), nullable=True),
        sa.Column("apiary_id", sa.UUID(), nullable=True),
        sa.Column("hive_id", sa.UUID(), nullable=True),
        sa.Column("role", share_role, nullable=False),
        sa.Column("status", share_status, server_default="pending", nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "(apiary_id IS NOT NULL AND hive_id IS NULL) OR "
            "(apiary_id IS NULL AND hive_id IS NOT NULL)",
            name="ck_shares_one_asset",
        ),
        sa.ForeignKeyConstraint(["apiary_id"], ["apiaries.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["hive_id"], ["hives.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["shared_with_user_id"], ["users.id"], ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Standard indexes
    op.create_index("ix_shares_owner_id", "shares", ["owner_id"])
    op.create_index(
        "ix_shares_shared_with_user_id", "shares", ["shared_with_user_id"],
    )
    op.create_index("ix_shares_apiary_id", "shares", ["apiary_id"])
    op.create_index("ix_shares_hive_id", "shares", ["hive_id"])
    op.create_index("ix_shares_invite_email", "shares", ["invite_email"])
    op.create_index("ix_shares_deleted_at", "shares", ["deleted_at"])
    op.create_index("ix_shares_updated_at", "shares", ["updated_at"])

    # Partial unique indexes — prevent duplicate active shares
    op.create_index(
        "uq_shares_user_apiary",
        "shares",
        ["shared_with_user_id", "apiary_id"],
        unique=True,
        postgresql_where=sa.text(
            "apiary_id IS NOT NULL AND status IN ('pending', 'accepted')"
        ),
    )
    op.create_index(
        "uq_shares_user_hive",
        "shares",
        ["shared_with_user_id", "hive_id"],
        unique=True,
        postgresql_where=sa.text(
            "hive_id IS NOT NULL AND status IN ('pending', 'accepted')"
        ),
    )

    # Add created_by_user_id to child resource tables for audit trail
    for table in ("inspections", "treatments", "harvests", "events", "queens"):
        op.add_column(table, sa.Column("created_by_user_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_created_by_user_id",
            table,
            "users",
            ["created_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Drop shares table and created_by columns."""
    # Drop created_by_user_id from child tables
    for table in ("queens", "events", "harvests", "treatments", "inspections"):
        op.drop_constraint(f"fk_{table}_created_by_user_id", table, type_="foreignkey")
        op.drop_column(table, "created_by_user_id")

    # Drop shares indexes
    op.drop_index(
        "uq_shares_user_hive",
        table_name="shares",
        postgresql_where=sa.text(
            "hive_id IS NOT NULL AND status IN ('pending', 'accepted')"
        ),
    )
    op.drop_index(
        "uq_shares_user_apiary",
        table_name="shares",
        postgresql_where=sa.text(
            "apiary_id IS NOT NULL AND status IN ('pending', 'accepted')"
        ),
    )
    op.drop_index("ix_shares_updated_at", table_name="shares")
    op.drop_index("ix_shares_deleted_at", table_name="shares")
    op.drop_index("ix_shares_invite_email", table_name="shares")
    op.drop_index("ix_shares_hive_id", table_name="shares")
    op.drop_index("ix_shares_apiary_id", table_name="shares")
    op.drop_index("ix_shares_shared_with_user_id", table_name="shares")
    op.drop_index("ix_shares_owner_id", table_name="shares")

    # Drop shares table and enums
    op.drop_table("shares")
    op.execute("DROP TYPE IF EXISTS share_status")
    op.execute("DROP TYPE IF EXISTS share_role")
