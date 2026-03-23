"""add pgvector extension and knowledge_chunks table

Revision ID: 0089231dedc7
Revises: ef231f16502d
Create Date: 2026-03-23 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0089231dedc7'
down_revision: Union[str, Sequence[str], None] = 'ef231f16502d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    op.create_table('knowledge_chunks',
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('source_type', sa.String(length=64), nullable=False),
    sa.Column('source_name', sa.String(length=256), nullable=True),
    sa.Column('content_hash', sa.String(length=64), nullable=False),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('token_count', sa.Integer(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )

    # Add vector column via raw SQL (Alembic doesn't natively support pgvector types)
    op.execute('ALTER TABLE knowledge_chunks ADD COLUMN embedding vector(768) NOT NULL')

    op.execute(
        'CREATE INDEX ix_knowledge_chunks_embedding ON knowledge_chunks '
        'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)'
    )
    op.create_index('ix_knowledge_chunks_hash', 'knowledge_chunks', ['content_hash'], unique=True)
    op.create_index('ix_knowledge_chunks_source_type', 'knowledge_chunks', ['source_type'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_deleted_at'), 'knowledge_chunks', ['deleted_at'], unique=False)
    op.create_index(op.f('ix_knowledge_chunks_updated_at'), 'knowledge_chunks', ['updated_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_knowledge_chunks_updated_at'), table_name='knowledge_chunks')
    op.drop_index(op.f('ix_knowledge_chunks_deleted_at'), table_name='knowledge_chunks')
    op.drop_index('ix_knowledge_chunks_source_type', table_name='knowledge_chunks')
    op.drop_index('ix_knowledge_chunks_hash', table_name='knowledge_chunks')
    op.drop_index('ix_knowledge_chunks_embedding', table_name='knowledge_chunks')
    op.drop_table('knowledge_chunks')
    op.execute('DROP EXTENSION IF EXISTS vector')
