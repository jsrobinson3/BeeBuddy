"""Add index on updated_at for sync performance

Revision ID: 58d6f86f749c
Revises: g2h3i4j5k6l7
Create Date: 2026-02-24 19:37:12.363667

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '58d6f86f749c'
down_revision: Union[str, Sequence[str], None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_at indexes to all tables for sync pull performance."""
    op.create_index(op.f('ix_apiaries_updated_at'), 'apiaries', ['updated_at'], unique=False)
    op.create_index(op.f('ix_events_updated_at'), 'events', ['updated_at'], unique=False)
    op.create_index(op.f('ix_harvests_updated_at'), 'harvests', ['updated_at'], unique=False)
    op.create_index(op.f('ix_hives_updated_at'), 'hives', ['updated_at'], unique=False)
    op.create_index(op.f('ix_inspection_photos_updated_at'), 'inspection_photos', ['updated_at'], unique=False)
    op.create_index(op.f('ix_inspections_updated_at'), 'inspections', ['updated_at'], unique=False)
    op.create_index(op.f('ix_queens_updated_at'), 'queens', ['updated_at'], unique=False)
    op.create_index(op.f('ix_task_cadences_updated_at'), 'task_cadences', ['updated_at'], unique=False)
    op.create_index(op.f('ix_tasks_updated_at'), 'tasks', ['updated_at'], unique=False)
    op.create_index(op.f('ix_treatments_updated_at'), 'treatments', ['updated_at'], unique=False)
    op.create_index(op.f('ix_users_updated_at'), 'users', ['updated_at'], unique=False)


def downgrade() -> None:
    """Remove updated_at indexes."""
    op.drop_index(op.f('ix_users_updated_at'), table_name='users')
    op.drop_index(op.f('ix_treatments_updated_at'), table_name='treatments')
    op.drop_index(op.f('ix_tasks_updated_at'), table_name='tasks')
    op.drop_index(op.f('ix_task_cadences_updated_at'), table_name='task_cadences')
    op.drop_index(op.f('ix_queens_updated_at'), table_name='queens')
    op.drop_index(op.f('ix_inspections_updated_at'), table_name='inspections')
    op.drop_index(op.f('ix_inspection_photos_updated_at'), table_name='inspection_photos')
    op.drop_index(op.f('ix_hives_updated_at'), table_name='hives')
    op.drop_index(op.f('ix_harvests_updated_at'), table_name='harvests')
    op.drop_index(op.f('ix_events_updated_at'), table_name='events')
    op.drop_index(op.f('ix_apiaries_updated_at'), table_name='apiaries')
