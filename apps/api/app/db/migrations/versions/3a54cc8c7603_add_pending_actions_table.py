"""add pending_actions table

Revision ID: 3a54cc8c7603
Revises: k6l7m8n9o0p1
Create Date: 2026-03-03 01:25:24.549579

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3a54cc8c7603'
down_revision: Union[str, Sequence[str], None] = 'k6l7m8n9o0p1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('pending_actions',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('conversation_id', sa.UUID(), nullable=True),
    sa.Column('action_type', sa.String(length=64), nullable=False),
    sa.Column('resource_type', sa.String(length=64), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('summary', sa.Text(), nullable=False),
    sa.Column('status', sa.Enum(
        'pending', 'confirmed', 'rejected', 'expired',
        name='action_status',
    ), server_default='pending', nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('result_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pending_actions_deleted_at'), 'pending_actions', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_pending_actions_updated_at'), 'pending_actions', ['updated_at'], unique=False)
    op.create_index(op.f('ix_pending_actions_user_id'), 'pending_actions', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_pending_actions_user_id'), table_name='pending_actions')
    op.drop_index(op.f('ix_pending_actions_updated_at'), table_name='pending_actions')
    op.drop_index(op.f('ix_pending_actions_deleted_at'), table_name='pending_actions')
    op.drop_table('pending_actions')
    op.execute("DROP TYPE IF EXISTS action_status")
