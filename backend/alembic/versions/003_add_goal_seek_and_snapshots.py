"""Add goal seek scenarios and NSR snapshots tables

Revision ID: 003_goal_seek
Revises: 002_geo_fields
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = '003_goal_seek'
down_revision: Union[str, None] = '002_geo_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Goal Seek Scenarios table
    op.create_table(
        'goal_seek_scenarios',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('mine_id', UUID(as_uuid=True), sa.ForeignKey('mines.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('base_inputs', sa.JSON(), nullable=False),
        sa.Column('target_variable', sa.String(50), nullable=False),
        sa.Column('target_nsr', sa.Float(), nullable=False, server_default='0'),
        sa.Column('threshold_value', sa.Float(), nullable=False),
        sa.Column('alert_enabled', sa.Boolean(), server_default='false'),
        sa.Column('alert_email', sa.String(255), nullable=True),
        sa.Column('alert_frequency', sa.String(20), nullable=False, server_default='daily'),
        sa.Column('alert_last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('alert_triggered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_nsr_value', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_goal_seek_scenarios_user_id', 'goal_seek_scenarios', ['user_id'])

    # NSR Snapshots table
    op.create_table(
        'nsr_snapshots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('scenario_id', UUID(as_uuid=True), sa.ForeignKey('goal_seek_scenarios.id', ondelete='CASCADE'), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('nsr_per_tonne', sa.Float(), nullable=False),
        sa.Column('nsr_cu', sa.Float(), nullable=False),
        sa.Column('nsr_au', sa.Float(), nullable=False),
        sa.Column('nsr_ag', sa.Float(), nullable=False),
        sa.Column('cu_price', sa.Float(), nullable=False),
        sa.Column('au_price', sa.Float(), nullable=False),
        sa.Column('ag_price', sa.Float(), nullable=False),
        sa.Column('cu_tc', sa.Float(), nullable=False),
        sa.Column('cu_rc', sa.Float(), nullable=False),
        sa.Column('cu_freight', sa.Float(), nullable=False),
        sa.Column('is_viable', sa.Boolean(), nullable=False),
        sa.Column('metadata_extra', sa.JSON(), nullable=True),
    )
    op.create_index(
        'ix_nsr_snapshots_scenario_timestamp',
        'nsr_snapshots',
        ['scenario_id', 'timestamp'],
    )


def downgrade() -> None:
    op.drop_table('nsr_snapshots')
    op.drop_table('goal_seek_scenarios')
