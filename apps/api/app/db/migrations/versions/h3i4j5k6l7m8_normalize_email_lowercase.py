"""Normalize user emails to lowercase and add case-insensitive unique index.

Revision ID: h3i4j5k6l7m8
Revises: 58d6f86f749c
Create Date: 2026-02-26 00:00:00.000000

"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = "h3i4j5k6l7m8"
down_revision: str | None = "58d6f86f749c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Lowercase all existing emails
    op.execute(text("UPDATE users SET email = LOWER(email) WHERE email != LOWER(email)"))

    # Replace the default case-sensitive unique constraint with a
    # case-insensitive unique index so LOWER(email) lookups are fast.
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.create_index(
        "ix_users_email_lower",
        "users",
        [text("LOWER(email)")],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_email_lower", table_name="users")
    op.create_unique_constraint("users_email_key", "users", ["email"])
