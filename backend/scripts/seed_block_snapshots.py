"""Seed historical block NSR snapshots with varying Cu prices over 12 months.

Simulates a scenario where Cu price rises from ~$3.50/lb to ~$6.30/lb over
a year, causing marginal blocks to transition from inviable to viable.

Usage:
    python scripts/seed_block_snapshots.py
"""

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.nsr_engine.models import NSRInput
from app.nsr_engine.calculations import compute_nsr_complete

settings = get_settings()
database_url = settings.database_url
if "+asyncpg" in database_url:
    database_url = database_url.replace("+asyncpg", "")

engine = create_engine(database_url)
Session = sessionmaker(bind=engine)

# ── Historical Cu price trajectory ($/lb) ─────────────────────
# Tells a story: Cu was low in early 2025, dipped mid-year, then rallied hard
CU_PRICE_MONTHLY = {
    "2025-03": 3.50,
    "2025-04": 3.65,
    "2025-05": 3.40,  # dip
    "2025-06": 3.55,
    "2025-07": 3.80,
    "2025-08": 4.10,
    "2025-09": 4.40,
    "2025-10": 4.75,
    "2025-11": 5.10,
    "2025-12": 5.50,
    "2026-01": 5.90,
    "2026-02": 6.28,  # current
}

# Au and Ag also move but less dramatically
AU_PRICE_MONTHLY = {
    "2025-03": 2100.0,
    "2025-04": 2150.0,
    "2025-05": 2200.0,
    "2025-06": 2350.0,
    "2025-07": 2500.0,
    "2025-08": 2700.0,
    "2025-09": 3000.0,
    "2025-10": 3400.0,
    "2025-11": 3800.0,
    "2025-12": 4200.0,
    "2026-01": 4800.0,
    "2026-02": 5360.0,
}

AG_PRICE_MONTHLY = {
    "2025-03": 25.0,
    "2025-04": 26.0,
    "2025-05": 27.0,
    "2025-06": 30.0,
    "2025-07": 32.0,
    "2025-08": 38.0,
    "2025-09": 45.0,
    "2025-10": 55.0,
    "2025-11": 65.0,
    "2025-12": 80.0,
    "2026-01": 100.0,
    "2026-02": 116.0,
}

CUTOFF_COST = 45.0  # $/t


def main():
    session = Session()

    # Find the most recent block import
    row = session.execute(
        text("SELECT id, mine_id FROM block_imports ORDER BY created_at DESC LIMIT 1")
    ).fetchone()

    if not row:
        print("No block imports found. Upload a CSV first.")
        return

    import_id, mine_id = row[0], row[1]
    print(f"Using import {import_id}")

    # Get mine commercial terms
    mine_row = session.execute(
        text("SELECT name, commercial_terms FROM mines WHERE id = :id"),
        {"id": mine_id},
    ).fetchone()

    if not mine_row:
        print(f"Mine {mine_id} not found.")
        return

    mine_name = mine_row[0]
    ct = mine_row[1] or {}
    if isinstance(ct, str):
        import json
        ct = json.loads(ct)

    print(f"Mine: {mine_name}")
    print(f"Commercial terms: {list(ct.keys())}")

    # Get all blocks
    blocks = session.execute(
        text("""
            SELECT id, cu_grade, au_grade, ag_grade, tonnage, zone
            FROM blocks WHERE import_id = :iid
        """),
        {"iid": import_id},
    ).fetchall()

    print(f"Blocks: {len(blocks)}")

    # Delete any existing snapshots for these blocks
    block_ids = [b[0] for b in blocks]
    session.execute(
        text("DELETE FROM block_nsr_snapshots WHERE block_id = ANY(:ids)"),
        {"ids": block_ids},
    )
    session.commit()
    print("Cleared existing snapshots.")

    # Generate snapshots for each month
    total_inserted = 0
    months = sorted(CU_PRICE_MONTHLY.keys())

    for month_key in months:
        cu_price = CU_PRICE_MONTHLY[month_key]
        au_price = AU_PRICE_MONTHLY[month_key]
        ag_price = AG_PRICE_MONTHLY[month_key]

        # Parse date (15th of each month, noon UTC)
        year, mon = month_key.split("-")
        calc_date = datetime(int(year), int(mon), 15, 12, 0, 0, tzinfo=timezone.utc)

        print(f"\n{month_key}: Cu=${cu_price}/lb, Au=${au_price}/oz, Ag=${ag_price}/oz")

        viable_count = 0
        marginal_count = 0
        inviable_count = 0

        for block in blocks:
            block_id, cu_grade, au_grade, ag_grade, tonnage, zone = block
            au_grade = au_grade or 0.0
            ag_grade = ag_grade or 0.0

            try:
                nsr_input = NSRInput(
                    mine=mine_name,
                    area=zone or mine_name,
                    cu_grade=cu_grade,
                    au_grade=au_grade,
                    ag_grade=ag_grade,
                    ore_tonnage=tonnage or 1.0,
                    cu_price=cu_price,
                    au_price=au_price,
                    ag_price=ag_price,
                    cu_payability=ct.get("cu_payability"),
                    cu_tc=ct.get("cu_tc"),
                    cu_rc=ct.get("cu_rc"),
                    cu_freight=ct.get("cu_freight"),
                    au_payability=ct.get("au_payability"),
                    au_rc=ct.get("au_rc"),
                    ag_payability=ct.get("ag_payability"),
                    ag_rc=ct.get("ag_rc"),
                    cu_conc_grade=ct.get("cu_conc_grade"),
                    mine_dilution=ct.get("mine_dilution", 0.14),
                    ore_recovery=ct.get("ore_recovery", 0.98),
                )
                result = compute_nsr_complete(nsr_input)
                nsr = result.nsr_per_tonne
                nsr_cu = result.nsr_cu
                nsr_au = result.nsr_au
                nsr_ag = result.nsr_ag
            except Exception as exc:
                print(f"  WARN: block {block_id} failed: {exc}")
                nsr = nsr_cu = nsr_au = nsr_ag = 0.0

            margin = nsr - CUTOFF_COST
            is_viable = nsr >= CUTOFF_COST

            if is_viable:
                if nsr <= CUTOFF_COST * 1.1:
                    marginal_count += 1
                else:
                    viable_count += 1
            else:
                inviable_count += 1

            snap_id = uuid.uuid4()
            session.execute(
                text("""
                    INSERT INTO block_nsr_snapshots
                        (id, block_id, calculated_at, nsr_per_tonne,
                         nsr_cu, nsr_au, nsr_ag,
                         cu_price, au_price, ag_price,
                         cutoff_cost, is_viable, margin)
                    VALUES
                        (:id, :bid, :calc, :nsr,
                         :ncu, :nau, :nag,
                         :cup, :aup, :agp,
                         :cutoff, :viable, :margin)
                """),
                {
                    "id": snap_id,
                    "bid": block_id,
                    "calc": calc_date,
                    "nsr": round(nsr, 2),
                    "ncu": round(nsr_cu, 2),
                    "nau": round(nsr_au, 2),
                    "nag": round(nsr_ag, 2),
                    "cup": cu_price,
                    "aup": au_price,
                    "agp": ag_price,
                    "cutoff": CUTOFF_COST,
                    "viable": is_viable,
                    "margin": round(margin, 2),
                },
            )
            total_inserted += 1

        print(f"  Viable: {viable_count}, Marginal: {marginal_count}, Inviable: {inviable_count}")

    session.commit()
    print(f"\nDone! Inserted {total_inserted} snapshots ({len(months)} months x {len(blocks)} blocks)")


if __name__ == "__main__":
    main()
