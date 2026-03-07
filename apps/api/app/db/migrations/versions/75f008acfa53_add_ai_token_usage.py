"""Add ai_token_usage table.

Revision ID: 75f008acfa53
Revises: b4bd4099efee
Create Date: 2026-03-03 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "75f008acfa53"
down_revision = "b4bd4099efee"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_token_usage",
        sa.Column(
            "id", UUID(as_uuid=True), primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column(
            "conversation_id", UUID(as_uuid=True),
            sa.ForeignKey("ai_conversations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(255), nullable=False),
        sa.Column("input_tokens", sa.Integer, server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer, server_default="0", nullable=False),
        sa.Column("total_tokens", sa.Integer, server_default="0", nullable=False),
        sa.Column("request_type", sa.String(50), nullable=False),
        sa.Column("estimated", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_ai_token_usage_user_created",
        "ai_token_usage",
        ["user_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_token_usage_user_created", table_name="ai_token_usage")
    op.drop_table("ai_token_usage")
