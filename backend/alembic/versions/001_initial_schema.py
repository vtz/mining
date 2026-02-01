"""Initial schema - users, regions, mines, user_mines

Revision ID: 001_initial
Revises: 
Create Date: 2026-01-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('avatar_url', sa.String(512), nullable=True),
        sa.Column('auth_provider', sa.String(50), nullable=False, default='google'),
        sa.Column('auth_provider_id', sa.String(255), nullable=True),
        sa.Column('password_hash', sa.String(255), nullable=True),
        sa.Column('is_admin', sa.Boolean(), default=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('last_login', sa.DateTime(timezone=True), nullable=True),
    )
    
    # Create regions table
    op.create_table(
        'regions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('country', sa.String(100), nullable=False, default='Brazil'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), 
                  server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create mines table
    op.create_table(
        'mines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('region_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('regions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('primary_metal', sa.String(10), nullable=False, default='Cu'),
        sa.Column('mining_method', sa.String(20), nullable=False, default='UG'),
        sa.Column('recovery_params', postgresql.JSON(), nullable=True),
        sa.Column('commercial_terms', postgresql.JSON(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), 
                  server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create user_mines association table
    op.create_table(
        'user_mines',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('mine_id', postgresql.UUID(as_uuid=True), 
                  sa.ForeignKey('mines.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('role', sa.String(50), nullable=False, default='viewer'),
        sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'mine_id', name='uq_user_mine'),
    )


def downgrade() -> None:
    op.drop_table('user_mines')
    op.drop_table('mines')
    op.drop_table('regions')
    op.drop_table('users')
