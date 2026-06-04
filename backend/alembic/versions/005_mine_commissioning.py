"""Add mine commissioning: minerals catalog, custom parameters, mine status

Revision ID: 005_commissioning
Revises: 004_blocks_features
Create Date: 2026-04-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "005_commissioning"
down_revision: Union[str, None] = "004_blocks_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── minerals catalog ─────────────────────────────────────────────
    op.create_table(
        "minerals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(10), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("price_unit", sa.String(20), nullable=False),
        sa.Column("default_price", sa.Float, nullable=False),
        sa.Column("grade_unit", sa.String(20), nullable=False, server_default="%"),
        sa.Column("implemented", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
        ),
    )

    # ── mine ↔ mineral many-to-many ──────────────────────────────────
    op.create_table(
        "mine_minerals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "mine_id", UUID(as_uuid=True),
            sa.ForeignKey("mines.id", ondelete="CASCADE"), nullable=False, index=True,
        ),
        sa.Column(
            "mineral_id", UUID(as_uuid=True),
            sa.ForeignKey("minerals.id", ondelete="CASCADE"), nullable=False, index=True,
        ),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("recovery_rate", sa.Float, nullable=True),
        sa.Column("commercial_terms", sa.JSON, nullable=True),
        sa.UniqueConstraint("mine_id", "mineral_id", name="uq_mine_mineral"),
    )

    # ── parameter definitions ────────────────────────────────────────
    op.create_table(
        "parameter_definitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "category", sa.String(50), nullable=False,
            server_default="general", index=True,
        ),
        sa.Column("data_type", sa.String(20), nullable=False, server_default="float"),
        sa.Column("unit", sa.String(50), nullable=True),
        sa.Column("default_value", sa.String(500), nullable=True),
        sa.Column("is_required", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("validation_rules", sa.JSON, nullable=True),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "created_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
        ),
    )

    # ── mine parameters (concrete values) ────────────────────────────
    op.create_table(
        "mine_parameters",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "mine_id", UUID(as_uuid=True),
            sa.ForeignKey("mines.id", ondelete="CASCADE"), nullable=False, index=True,
        ),
        sa.Column(
            "parameter_id", UUID(as_uuid=True),
            sa.ForeignKey("parameter_definitions.id", ondelete="CASCADE"),
            nullable=False, index=True,
        ),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column(
            "set_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column(
            "set_at", sa.DateTime(timezone=True), server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("mine_id", "parameter_id", name="uq_mine_parameter"),
    )

    # ── mines: add commissioning columns ─────────────────────────────
    op.add_column(
        "mines",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_index("ix_mines_status", "mines", ["status"])

    op.add_column(
        "mines",
        sa.Column("commissioned_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mines",
        sa.Column(
            "commissioned_by", UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
    )

    # ── seed minerals from hardcoded SUPPORTED_METALS ────────────────
    op.execute("""
        INSERT INTO minerals (id, code, name, price_unit, default_price, grade_unit, implemented)
        VALUES
            (gen_random_uuid(), 'Cu', 'Copper',  '$/lb', 6.28,    '%%',  true),
            (gen_random_uuid(), 'Au', 'Gold',    '$/oz', 5360.0,  'g/t', false),
            (gen_random_uuid(), 'Zn', 'Zinc',    '$/lb', 1.35,    '%%',  false),
            (gen_random_uuid(), 'Ni', 'Nickel',  '$/lb', 8.50,    '%%',  false),
            (gen_random_uuid(), 'Fe', 'Iron',    '$/t',  120.0,   '%%',  false),
            (gen_random_uuid(), 'Ag', 'Silver',  '$/oz', 116.39,  'g/t', false)
        ON CONFLICT (code) DO NOTHING;
    """)

    # ── backfill mine_minerals from mines.primary_metal ───────────────
    op.execute("""
        INSERT INTO mine_minerals (id, mine_id, mineral_id, is_primary)
        SELECT gen_random_uuid(), m.id, min.id, true
        FROM mines m
        JOIN minerals min ON min.code = m.primary_metal
        ON CONFLICT (mine_id, mineral_id) DO NOTHING;
    """)

    # ── seed common parameter definitions ────────────────────────────
    op.execute("""
        INSERT INTO parameter_definitions (id, key, name, description, category, data_type, unit, default_value, is_required, validation_rules, sort_order)
        VALUES
            (gen_random_uuid(), 'mine_dilution',       'Mine Dilution',            'Fraction of waste mixed with ore',          'operational',  'float', '%%',   '0.14',   true,  '{"min": 0, "max": 1}',   10),
            (gen_random_uuid(), 'ore_recovery',        'Ore Recovery',             'Fraction of ore recovered from mining',     'operational',  'float', '%%',   '0.98',   true,  '{"min": 0, "max": 1}',   20),
            (gen_random_uuid(), 'cu_payability',       'Cu Payability',            'Copper payability factor',                  'commercial',   'float', '%%',   '0.9665', false, '{"min": 0, "max": 1}',   10),
            (gen_random_uuid(), 'cu_tc',               'Treatment Charge',         'Treatment charge per dry metric tonne',     'commercial',   'float', '$/dmt','40.0',   false, '{"min": 0}',             20),
            (gen_random_uuid(), 'cu_rc',               'Refining Charge (Cu)',     'Copper refining charge per pound',          'commercial',   'float', '$/lb', '1.90',   false, '{"min": 0}',             30),
            (gen_random_uuid(), 'cu_freight',          'Freight',                  'Freight cost per dry metric tonne',         'commercial',   'float', '$/dmt','84.0',   false, '{"min": 0}',             40),
            (gen_random_uuid(), 'cu_conc_grade',       'Concentrate Grade (Cu)',   'Copper grade in concentrate',               'recovery',     'float', '%%',   '33.5',   false, '{"min": 0, "max": 100}', 10),
            (gen_random_uuid(), 'au_recovery',         'Au Recovery',              'Gold metallurgical recovery',               'recovery',     'float', '%%',   '0.60',   false, '{"min": 0, "max": 1}',   20),
            (gen_random_uuid(), 'ag_recovery',         'Ag Recovery',              'Silver metallurgical recovery',             'recovery',     'float', '%%',   '0.60',   false, '{"min": 0, "max": 1}',   30),
            (gen_random_uuid(), 'mine_cost',           'Mining Cost',              'Mining cost per tonne of ore',              'operational',  'float', '$/t',  '28.0',   false, '{"min": 0}',             30),
            (gen_random_uuid(), 'plant_cost',          'Plant Cost',               'Processing plant cost per tonne of ore',    'operational',  'float', '$/t',  '7.40',   false, '{"min": 0}',             40),
            (gen_random_uuid(), 'ga_cost',             'G&A Cost',                 'General & administrative cost per tonne',   'operational',  'float', '$/t',  '5.0',    false, '{"min": 0}',             50),
            (gen_random_uuid(), 'cfem_rate',           'CFEM Royalty Rate',        'Brazilian mining royalty rate',              'commercial',   'float', '%%',   '0.02',   false, '{"min": 0, "max": 1}',   50)
        ON CONFLICT (key) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("mine_parameters")
    op.drop_table("parameter_definitions")
    op.drop_table("mine_minerals")
    op.drop_table("minerals")

    op.drop_index("ix_mines_status", table_name="mines")
    op.drop_column("mines", "commissioned_by")
    op.drop_column("mines", "commissioned_at")
    op.drop_column("mines", "status")
