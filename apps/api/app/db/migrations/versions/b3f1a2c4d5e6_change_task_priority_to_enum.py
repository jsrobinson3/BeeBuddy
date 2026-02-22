"""change task priority to enum

Revision ID: b3f1a2c4d5e6
Revises: ac190f372658
Create Date: 2026-02-22 12:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3f1a2c4d5e6'
down_revision: str | None = 'ac190f372658'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

task_priority = sa.Enum('LOW', 'MEDIUM', 'HIGH', 'URGENT', name='task_priority')


def upgrade() -> None:
    task_priority.create(op.get_bind(), checkfirst=True)
    op.drop_column('tasks', 'priority')
    op.add_column(
        'tasks',
        sa.Column(
            'priority',
            task_priority,
            nullable=False,
            server_default='MEDIUM',
        ),
    )


def downgrade() -> None:
    op.drop_column('tasks', 'priority')
    op.add_column(
        'tasks',
        sa.Column('priority', sa.Integer(), nullable=False, server_default='0'),
    )
    task_priority.drop(op.get_bind(), checkfirst=True)
