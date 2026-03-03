"""Add user_oauth_links table for multi-provider OAuth.

Migrates existing (oauth_provider, oauth_sub) data from users into the new
join table, then drops the old columns.

Revision ID: m7n8o9p0q1r2
Revises: 3a54cc8c7603
Create Date: 2026-03-03 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "m7n8o9p0q1r2"
down_revision: str | None = "3a54cc8c7603"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _create_oauth_links_table() -> None:
    op.create_table(
        "user_oauth_links",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("provider_sub", sa.String(length=255), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_sub", name="uq_oauth_provider_sub"),
    )
    op.create_index(
        op.f("ix_user_oauth_links_deleted_at"), "user_oauth_links", ["deleted_at"],
    )
    op.create_index(
        op.f("ix_user_oauth_links_updated_at"), "user_oauth_links", ["updated_at"],
    )
    op.create_index(
        op.f("ix_user_oauth_links_user_id"), "user_oauth_links", ["user_id"],
    )


def upgrade() -> None:
    _create_oauth_links_table()

    # Migrate existing OAuth data into the new table
    op.execute(
        """
        INSERT INTO user_oauth_links (id, user_id, provider, provider_sub, created_at, updated_at)
        SELECT gen_random_uuid(), id, oauth_provider, oauth_sub, now(), now()
        FROM users
        WHERE oauth_provider IS NOT NULL AND oauth_sub IS NOT NULL
        """
    )

    # 3. Drop old index and columns from users
    op.drop_index("ix_users_oauth_provider_sub", table_name="users")
    op.drop_column("users", "oauth_sub")
    op.drop_column("users", "oauth_provider")


def downgrade() -> None:
    # 1. Re-add columns to users
    op.add_column(
        "users",
        sa.Column("oauth_provider", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("oauth_sub", sa.String(length=255), nullable=True),
    )

    # 2. Copy back the earliest link per user
    op.execute(
        """
        UPDATE users u
        SET oauth_provider = sub.provider,
            oauth_sub = sub.provider_sub
        FROM (
            SELECT DISTINCT ON (user_id) user_id, provider, provider_sub
            FROM user_oauth_links
            ORDER BY user_id, created_at ASC
        ) sub
        WHERE u.id = sub.user_id
        """
    )

    # 3. Re-create the partial unique index
    op.create_index(
        "ix_users_oauth_provider_sub",
        "users",
        ["oauth_provider", "oauth_sub"],
        unique=True,
        postgresql_where=sa.text(
            "oauth_provider IS NOT NULL AND oauth_sub IS NOT NULL"
        ),
    )

    # 4. Drop the join table
    op.drop_index(op.f("ix_user_oauth_links_user_id"), table_name="user_oauth_links")
    op.drop_index(
        op.f("ix_user_oauth_links_updated_at"), table_name="user_oauth_links"
    )
    op.drop_index(
        op.f("ix_user_oauth_links_deleted_at"), table_name="user_oauth_links"
    )
    op.drop_table("user_oauth_links")
