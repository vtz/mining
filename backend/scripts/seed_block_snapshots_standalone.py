"""Standalone seed script for historical block NSR snapshots.

No dependency on app modules or pydantic — only needs sqlalchemy + psycopg2.
Reads DATABASE_URL from environment (injected by `railway run`).

Usage:
    railway run -s backend .venv/bin/python scripts/seed_block_snapshots_standalone.py
"""

import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── DB connection ─────────────────────────────────────────────
database_url = os.environ.get("DATABASE_URL", "")
if not database_url:
    raise SystemExit("DATABASE_URL env var not set. Run via: railway run -s backend ...")
if "+asyncpg" in database_url:
    database_url = database_url.replace("+asyncpg", "")

engine = create_engine(database_url)
Session = sessionmaker(bind=engine)

# ── Constants (inlined from nsr_engine) ───────────────────────
LB_PER_TONNE = 2204.62
TROY_OZ_PER_GRAM = 0.0321507466

DEFAULT_CU_PAYABILITY = 0.9665
DEFAULT_CU_TC = 40.0
DEFAULT_CU_RC = 1.90
DEFAULT_CU_FREIGHT = 84.0
DEFAULT_AU_PAYABILITY = 0.90
DEFAULT_AU_RC = 4.00
DEFAULT_AG_PAYABILITY = 0.90
DEFAULT_AG_RC = 0.35
DEFAULT_CU_CONC_GRADE = 33.5
DEFAULT_AU_RECOVERY = 0.60
DEFAULT_AG_RECOVERY = 0.60

RECOVERY_PARAMS = {
    "Vermelhos Sul": {"a": 2.8286, "b": 92.584},
    "UG03": {"a": 2.8286, "b": 92.584},
    "N5/UG04": {"a": 2.8286, "b": 92.584},
    "N8 - UG": {"a": 2.8286, "b": 92.584},
    "Deepening Above - 965": {"a": 4.0851, "b": 90.346, "fixed": 92.9},
    "Deepening Below - 965": {"a": 4.0851, "b": 90.346},
    "MSBSUL": {"a": 7.5986, "b": 85.494, "fixed": 90.0},
    "P1P2NE": {"a": 2.3826, "b": 91.442},
    "P1P2W": {"a": 8.8922, "b": 87.637},
    "BARAUNA": {"a": 4.0851, "b": 90.346},
    "HONEYPOT": {"a": 4.0851, "b": 90.346},
    "R22UG": {"a": 3.0368, "b": 91.539},
    "MSBW": {"a": 3.0368, "b": 91.539},
    "GO2040": {"a": 5.4967, "b": 88.751},
    "PROJETO N-100": {"a": 4.0851, "b": 90.346},
    "EAST LIMB": {"a": 0.0, "b": 91.0, "fixed": 91.0},
    "Surubim OP": {"a": 4.0718, "b": 87.885},
    "C12 OP": {"a": 4.0718, "b": 87.885},
    "C12 UG": {"a": 4.0718, "b": 87.885},
    "N8": {"a": 2.8286, "b": 92.584},
    "N9": {"a": 2.8286, "b": 92.584},
    "Suçuarana OP": {"a": 4.0718, "b": 87.885},
    "S10": {"a": 4.0718, "b": 87.885},
    "S5": {"a": 4.0718, "b": 87.885},
}
DEFAULT_RECOVERY = {"a": 3.0, "b": 90.0}

# ── Price trajectories (monthly) ─────────────────────────────
CU_PRICE_MONTHLY = {
    "2025-03": 3.50, "2025-04": 3.65, "2025-05": 3.40,
    "2025-06": 3.55, "2025-07": 3.80, "2025-08": 4.10,
    "2025-09": 4.40, "2025-10": 4.75, "2025-11": 5.10,
    "2025-12": 5.50, "2026-01": 5.90, "2026-02": 6.28,
}
AU_PRICE_MONTHLY = {
    "2025-03": 2100.0, "2025-04": 2150.0, "2025-05": 2200.0,
    "2025-06": 2350.0, "2025-07": 2500.0, "2025-08": 2700.0,
    "2025-09": 3000.0, "2025-10": 3400.0, "2025-11": 3800.0,
    "2025-12": 4200.0, "2026-01": 4800.0, "2026-02": 5360.0,
}
AG_PRICE_MONTHLY = {
    "2025-03": 25.0, "2025-04": 26.0, "2025-05": 27.0,
    "2025-06": 30.0, "2025-07": 32.0, "2025-08": 38.0,
    "2025-09": 45.0, "2025-10": 55.0, "2025-11": 65.0,
    "2025-12": 80.0, "2026-01": 100.0, "2026-02": 116.0,
}

CUTOFF_COST = 45.0


# ── Inline NSR calculation ────────────────────────────────────
def cu_recovery(cu_grade_pct: float, area: str) -> float:
    params = RECOVERY_PARAMS.get(area, DEFAULT_RECOVERY)
    if params.get("fixed") is not None:
        return min(params["fixed"] / 100.0, 1.0)
    return min((params["a"] * cu_grade_pct + params["b"]) / 100.0, 1.0)


def compute_nsr(cu_grade, au_grade, ag_grade, area, tonnage, ct,
                cu_price, au_price, ag_price):
    cu_pay = ct.get("cu_payability") or DEFAULT_CU_PAYABILITY
    cu_tc = ct.get("cu_tc") or DEFAULT_CU_TC
    cu_rc = ct.get("cu_rc") or DEFAULT_CU_RC
    cu_frt = ct.get("cu_freight") or DEFAULT_CU_FREIGHT
    au_pay = ct.get("au_payability") or DEFAULT_AU_PAYABILITY
    au_rc = ct.get("au_rc") or DEFAULT_AU_RC
    ag_pay = ct.get("ag_payability") or DEFAULT_AG_PAYABILITY
    ag_rc = ct.get("ag_rc") or DEFAULT_AG_RC
    cu_cg = ct.get("cu_conc_grade") or DEFAULT_CU_CONC_GRADE

    rec = cu_recovery(cu_grade, area)
    conc_ratio = (cu_grade / 100.0) * rec / (cu_cg / 100.0)

    au_in_conc = (au_grade * DEFAULT_AU_RECOVERY) / conc_ratio if conc_ratio > 0 else 0
    ag_in_conc = (ag_grade * DEFAULT_AG_RECOVERY) / conc_ratio if conc_ratio > 0 else 0

    cg_frac = cu_cg / 100.0
    cp_cu = (cu_price * cg_frac * cu_pay * LB_PER_TONNE
             - cu_tc - cu_rc * cg_frac * LB_PER_TONNE - cu_frt)
    cp_au = (au_price * au_in_conc * TROY_OZ_PER_GRAM * au_pay
             - au_rc * au_in_conc * TROY_OZ_PER_GRAM)
    cp_ag = (ag_price * ag_in_conc * TROY_OZ_PER_GRAM * ag_pay
             - ag_rc * ag_in_conc * TROY_OZ_PER_GRAM)

    nsr_cu = cp_cu * conc_ratio
    nsr_au = cp_au * conc_ratio
    nsr_ag = cp_ag * conc_ratio
    nsr_total = nsr_cu + nsr_au + nsr_ag

    return round(nsr_total, 2), round(nsr_cu, 2), round(nsr_au, 2), round(nsr_ag, 2)


# ── Main ──────────────────────────────────────────────────────
def main():
    session = Session()

    row = session.execute(
        text("SELECT id, mine_id FROM block_imports ORDER BY created_at DESC LIMIT 1")
    ).fetchone()
    if not row:
        print("No block imports found. Upload a CSV first.")
        return

    import_id, mine_id = row[0], row[1]
    print(f"Using import {import_id}")

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
        ct = json.loads(ct)
    print(f"Mine: {mine_name} | Commercial terms keys: {list(ct.keys())}")

    blocks = session.execute(
        text("SELECT id, cu_grade, au_grade, ag_grade, tonnage, zone "
             "FROM blocks WHERE import_id = :iid"),
        {"iid": import_id},
    ).fetchall()
    print(f"Blocks: {len(blocks)}")

    block_ids = [b[0] for b in blocks]
    session.execute(
        text("DELETE FROM block_nsr_snapshots WHERE block_id = ANY(:ids)"),
        {"ids": block_ids},
    )
    session.commit()
    print("Cleared existing snapshots.")

    total_inserted = 0
    for month_key in sorted(CU_PRICE_MONTHLY.keys()):
        cu_p = CU_PRICE_MONTHLY[month_key]
        au_p = AU_PRICE_MONTHLY[month_key]
        ag_p = AG_PRICE_MONTHLY[month_key]

        year, mon = month_key.split("-")
        calc_date = datetime(int(year), int(mon), 15, 12, 0, 0, tzinfo=timezone.utc)
        print(f"\n{month_key}: Cu=${cu_p}/lb  Au=${au_p}/oz  Ag=${ag_p}/oz")

        v, m, inv = 0, 0, 0
        for block in blocks:
            bid, cu_g, au_g, ag_g, ton, zone = block
            au_g = au_g or 0.0
            ag_g = ag_g or 0.0

            try:
                nsr, nsr_cu, nsr_au, nsr_ag = compute_nsr(
                    cu_g, au_g, ag_g, zone or mine_name, ton or 1.0, ct,
                    cu_p, au_p, ag_p)
            except Exception as exc:
                print(f"  WARN: block {bid} failed: {exc}")
                nsr = nsr_cu = nsr_au = nsr_ag = 0.0

            margin = nsr - CUTOFF_COST
            is_viable = nsr >= CUTOFF_COST
            if is_viable:
                if nsr <= CUTOFF_COST * 1.1:
                    m += 1
                else:
                    v += 1
            else:
                inv += 1

            session.execute(
                text("""
                    INSERT INTO block_nsr_snapshots
                        (id, block_id, calculated_at, nsr_per_tonne,
                         nsr_cu, nsr_au, nsr_ag,
                         cu_price, au_price, ag_price,
                         cutoff_cost, is_viable, margin)
                    VALUES (:id, :bid, :calc, :nsr,
                            :ncu, :nau, :nag,
                            :cup, :aup, :agp,
                            :cutoff, :viable, :margin)
                """),
                {
                    "id": uuid.uuid4(), "bid": bid, "calc": calc_date,
                    "nsr": nsr, "ncu": nsr_cu, "nau": nsr_au, "nag": nsr_ag,
                    "cup": cu_p, "aup": au_p, "agp": ag_p,
                    "cutoff": CUTOFF_COST, "viable": is_viable,
                    "margin": round(margin, 2),
                },
            )
            total_inserted += 1

        print(f"  Viable: {v}  Marginal: {m}  Inviable: {inv}")

    session.commit()
    print(f"\nDone! {total_inserted} snapshots ({len(sorted(CU_PRICE_MONTHLY.keys()))} months × {len(blocks)} blocks)")


if __name__ == "__main__":
    main()
