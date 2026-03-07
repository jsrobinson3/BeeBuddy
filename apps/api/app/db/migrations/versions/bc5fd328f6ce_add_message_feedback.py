"""add_message_feedback

Revision ID: bc5fd328f6ce
Revises: 75f008acfa53
Create Date: 2026-03-06 21:30:28.255617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc5fd328f6ce'
down_revision: Union[str, Sequence[str], None] = '75f008acfa53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('message_feedback',
    sa.Column('conversation_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('message_index', sa.Integer(), nullable=False),
    sa.Column('rating', sa.SmallInteger(), nullable=False, comment='1 = thumbs up, -1 = thumbs down'),
    sa.Column('correction', sa.Text(), nullable=True),
    sa.Column('model_version', sa.Text(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('conversation_id', 'message_index', name='uq_feedback_conv_msg')
    )
    op.create_index(op.f('ix_message_feedback_conversation_id'), 'message_feedback', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_message_feedback_deleted_at'), 'message_feedback', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_message_feedback_updated_at'), 'message_feedback', ['updated_at'], unique=False)
    op.create_index(op.f('ix_message_feedback_user_id'), 'message_feedback', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_message_feedback_user_id'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_updated_at'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_deleted_at'), table_name='message_feedback')
    op.drop_index(op.f('ix_message_feedback_conversation_id'), table_name='message_feedback')
    op.drop_table('message_feedback')
