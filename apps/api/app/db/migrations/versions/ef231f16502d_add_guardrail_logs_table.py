"""add guardrail_logs table

Revision ID: ef231f16502d
Revises: bc5fd328f6ce
Create Date: 2026-03-21 15:06:00.198754

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ef231f16502d'
down_revision: Union[str, Sequence[str], None] = 'bc5fd328f6ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('guardrail_logs',
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('conversation_id', sa.UUID(), nullable=True),
    sa.Column('guard_name', sa.String(length=50), nullable=False),
    sa.Column('phase', sa.String(length=20), nullable=False),
    sa.Column('result', sa.String(length=20), nullable=False),
    sa.Column('reason', sa.String(length=100), nullable=True),
    sa.Column('flags_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('user_message', sa.Text(), nullable=True),
    sa.Column('response_snippet', sa.Text(), nullable=True),
    sa.Column('message_index', sa.Integer(), server_default='0', nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_guardrail_logs_deleted_at'), 'guardrail_logs', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_guardrail_logs_guard_name'), 'guardrail_logs', ['guard_name'], unique=False)
    op.create_index('ix_guardrail_logs_guard_result', 'guardrail_logs', ['guard_name', 'result'], unique=False)
    op.create_index(op.f('ix_guardrail_logs_updated_at'), 'guardrail_logs', ['updated_at'], unique=False)
    op.create_index('ix_guardrail_logs_user_created', 'guardrail_logs', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_guardrail_logs_user_id'), 'guardrail_logs', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_guardrail_logs_user_id'), table_name='guardrail_logs')
    op.drop_index('ix_guardrail_logs_user_created', table_name='guardrail_logs')
    op.drop_index(op.f('ix_guardrail_logs_updated_at'), table_name='guardrail_logs')
    op.drop_index('ix_guardrail_logs_guard_result', table_name='guardrail_logs')
    op.drop_index(op.f('ix_guardrail_logs_guard_name'), table_name='guardrail_logs')
    op.drop_index(op.f('ix_guardrail_logs_deleted_at'), table_name='guardrail_logs')
    op.drop_table('guardrail_logs')
