"""Add geographic fields to regions

Revision ID: 002_geo_fields
Revises: 001_initial
Create Date: 2026-01-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '002_geo_fields'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('regions', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('regions', sa.Column('municipality', sa.String(255), nullable=True))
    op.add_column('regions', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('regions', sa.Column('longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('regions', 'longitude')
    op.drop_column('regions', 'latitude')
    op.drop_column('regions', 'municipality')
    op.drop_column('regions', 'state')
