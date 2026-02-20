"""Add block model tables and mine feature toggles

Revision ID: 004_blocks_features
Revises: 003_goal_seek
Create Date: 2026-02-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "004_blocks_features"
down_revision: Union[str, None] = "003_goal_seek"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Mine Features (add-on toggles) ────────────────────────
    op.create_table(
        "mine_features",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "mine_id",
            UUID(as_uuid=True),
            sa.ForeignKey("mines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("feature_key", sa.String(50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "enabled_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "enabled_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("mine_id", "feature_key", name="uq_mine_feature"),
    )
    op.create_index("ix_mine_features_mine_id", "mine_features", ["mine_id"])

    # ── Block Imports ─────────────────────────────────────────
    op.create_table(
        "block_imports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "mine_id",
            UUID(as_uuid=True),
            sa.ForeignKey("mines.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_filename", sa.String(500), nullable=False),
        sa.Column("column_mapping", sa.JSON(), nullable=False),
        sa.Column("block_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_block_imports_mine_id", "block_imports", ["mine_id"])

    # ── Blocks ────────────────────────────────────────────────
    op.create_table(
        "blocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "import_id",
            UUID(as_uuid=True),
            sa.ForeignKey("block_imports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Spatial
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.Column("z", sa.Float(), nullable=False),
        sa.Column("dx", sa.Float(), nullable=True),
        sa.Column("dy", sa.Float(), nullable=True),
        sa.Column("dz", sa.Float(), nullable=True),
        # Geology
        sa.Column("cu_grade", sa.Float(), nullable=False),
        sa.Column("au_grade", sa.Float(), nullable=True),
        sa.Column("ag_grade", sa.Float(), nullable=True),
        sa.Column("density", sa.Float(), nullable=True),
        sa.Column("tonnage", sa.Float(), nullable=True),
        sa.Column("rock_type", sa.String(100), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        # Deswik reference
        sa.Column("deswik_block_id", sa.String(255), nullable=True),
        # Extra attributes
        sa.Column("extra_attributes", sa.JSON(), nullable=True),
    )
    op.create_index("ix_blocks_import_id", "blocks", ["import_id"])
    op.create_index("ix_blocks_import_z", "blocks", ["import_id", "z"])

    # ── Block NSR Snapshots ───────────────────────────────────
    op.create_table(
        "block_nsr_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "block_id",
            UUID(as_uuid=True),
            sa.ForeignKey("blocks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        # NSR values
        sa.Column("nsr_per_tonne", sa.Float(), nullable=False),
        sa.Column("nsr_cu", sa.Float(), nullable=False),
        sa.Column("nsr_au", sa.Float(), nullable=False),
        sa.Column("nsr_ag", sa.Float(), nullable=False),
        # Prices used
        sa.Column("cu_price", sa.Float(), nullable=False),
        sa.Column("au_price", sa.Float(), nullable=False),
        sa.Column("ag_price", sa.Float(), nullable=False),
        # Viability
        sa.Column("cutoff_cost", sa.Float(), nullable=False),
        sa.Column("is_viable", sa.Boolean(), nullable=False),
        sa.Column("margin", sa.Float(), nullable=False),
    )
    op.create_index(
        "ix_block_nsr_snapshots_block_calc",
        "block_nsr_snapshots",
        ["block_id", "calculated_at"],
    )
    op.create_index(
        "ix_block_nsr_snapshots_calc",
        "block_nsr_snapshots",
        ["calculated_at"],
    )

    # ── Seed: enable goal_seek for all existing mines ─────────
    # This keeps backwards compatibility — goal_seek was always available.
    op.execute(
        """
        INSERT INTO mine_features (id, mine_id, feature_key, enabled)
        SELECT gen_random_uuid(), id, 'goal_seek', true
        FROM mines
        """
    )


def downgrade() -> None:
    op.drop_table("block_nsr_snapshots")
    op.drop_table("blocks")
    op.drop_table("block_imports")
    op.drop_table("mine_features")
