"""Seed historical NSR snapshots with real-world metal prices from the past year.

Generates daily snapshots for a Goal Seek scenario using actual
market prices from Feb 2025 to Feb 2026.

Data sources:
- Silver: bullion-rates.com, Fortune
- Copper: ycharts.com (LME), converted from $/MT to $/lb
- Gold: ycharts.com, exchange-rates.org
"""

import json
import uuid
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.nsr_engine.models import NSRInput
from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.constants import DEFAULT_CU_TC, DEFAULT_CU_RC, DEFAULT_CU_FREIGHT

# ── Real historical prices (monthly averages from market data) ──

# Silver $/oz - REAL market data
# Sources: indexmundi.com (monthly avg), statmuse.com (closing), bullion-rates.com, Fortune
# Feb 2025 ~$32, stable through mid-2025, surge in Q4, Dec $76, Jan 2026 ~$88, Feb $82
AG_PRICES_MONTHLY = {
    "2025-02": 32.00,  # bullion-rates.com avg ~$31.15-$32.96
    "2025-03": 33.19,  # indexmundi monthly avg
    "2025-04": 32.23,  # indexmundi monthly avg
    "2025-05": 32.76,  # indexmundi monthly avg
    "2025-06": 36.01,  # indexmundi monthly avg
    "2025-07": 36.77,  # statmuse closing
    "2025-08": 38.50,  # statmuse closing $39.79, avg ~$38.50
    "2025-09": 43.21,  # statmuse open $39.71 close $46.71, avg
    "2025-10": 47.70,  # statmuse open $46.71 close $48.68, avg
    "2025-11": 52.87,  # statmuse open $48.70 close $57.03, avg
    "2025-12": 66.00,  # Fortune Dec 30: $76.28, est avg ~$66
    "2026-01": 88.00,  # investing.com Jan 23: $101.33, est avg ~$88
    "2026-02": 82.49,  # Fortune Feb 12: $82.49
}

# Copper $/lb (from LME $/MT divided by 2204.62)
CU_PRICES_MONTHLY = {
    "2025-02": 4.23, "2025-03": 4.42, "2025-04": 4.16,
    "2025-05": 4.33, "2025-06": 4.46, "2025-07": 4.43,
    "2025-08": 4.39, "2025-09": 4.53, "2025-10": 4.87,
    "2025-11": 4.91, "2025-12": 5.35, "2026-01": 5.55,
    "2026-02": 5.79,
}

# Gold $/oz (ycharts.com end-of-month prices)
AU_PRICES_MONTHLY = {
    "2025-02": 2895, "2025-03": 2983, "2025-04": 3208,
    "2025-05": 3278, "2025-06": 3352, "2025-07": 3338,
    "2025-08": 3363, "2025-09": 3665, "2025-10": 4053,
    "2025-11": 4083, "2025-12": 4290, "2026-01": 4333,
    "2026-02": 4913,
}


def interpolate_price(base: float, day_in_month: int, days_in_month: int) -> float:
    """Add realistic daily noise to monthly price."""
    noise = random.gauss(0, base * 0.008)  # ~0.8% daily volatility
    return round(base + noise, 2)


def get_monthly_price(prices: dict, dt: datetime) -> float:
    key = dt.strftime("%Y-%m")
    if key in prices:
        return prices[key]
    # Fallback to closest month
    keys = sorted(prices.keys())
    return prices[keys[-1]]


def main():
    settings = get_settings()
    db_url = settings.database_url
    if "+asyncpg" in db_url:
        db_url = db_url.replace("+asyncpg", "")

    # Railway internal DB needs sslmode=disable
    connect_args = {}
    if "railway.internal" in db_url or "railway" in db_url:
        connect_args["sslmode"] = "disable"

    engine = create_engine(db_url, connect_args=connect_args)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Clean up previous seed data
        existing = session.execute(
            text("SELECT id FROM goal_seek_scenarios WHERE name LIKE '%Historical%'")
        ).fetchall()
        for row in existing:
            sid = row[0]
            session.execute(text("DELETE FROM nsr_snapshots WHERE scenario_id = :sid"), {"sid": str(sid)})
            session.execute(text("DELETE FROM goal_seek_scenarios WHERE id = :sid"), {"sid": str(sid)})
            print(f"Deleted old scenario: {sid}")

        # Find the Admin Dev user (or first user)
        row = session.execute(
            text("SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1")
        ).fetchone()
        if not row:
            row = session.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
        if not row:
            print("No users found. Login first to create a user.")
            return
        user_id = row[0]
        print(f"Using user: {user_id}")

        # Scenario base inputs
        base_inputs = {
            "mine": "Vermelhos UG",
            "area": "Vermelhos Sul",
            "cu_grade": 1.4,
            "au_grade": 0.23,
            "ag_grade": 2.33,
        }
        target_nsr = 0.0  # break-even
        target_variable = "ag_price"

        # Compute threshold for ag_price at target_nsr
        from app.nsr_engine.goal_seek import goal_seek
        nsr_input = NSRInput(
            mine="Vermelhos UG", area="Vermelhos Sul",
            cu_grade=1.4, au_grade=0.23, ag_grade=2.33,
            cu_price=5.79, au_price=4913, ag_price=82.49,
        )
        gs_result = goal_seek(nsr_input, "ag_price", target_nsr)
        threshold = gs_result.threshold_value
        print(f"Goal Seek: Ag needs to be ${threshold:.2f}/oz for NSR={target_nsr}/t")

        # Create scenario
        scenario_id = uuid.uuid4()
        base_inputs_json = json.dumps(base_inputs)
        session.execute(
            text("""
                INSERT INTO goal_seek_scenarios 
                (id, user_id, name, base_inputs, target_variable, target_nsr, 
                 threshold_value, alert_enabled, alert_frequency, created_at, updated_at)
                VALUES (:id, :user_id, :name, CAST(:base_inputs AS json), :target_variable, 
                        :target_nsr, :threshold_value, true, 'daily', now(), now())
            """),
            {
                "id": str(scenario_id),
                "user_id": str(user_id),
                "name": "Ag Price Viability - Vermelhos Sul (Historical)",
                "base_inputs": base_inputs_json,
                "target_variable": target_variable,
                "target_nsr": target_nsr,
                "threshold_value": threshold,
            },
        )
        print(f"Created scenario: {scenario_id}")

        # Generate daily snapshots for the past year
        start_date = datetime(2025, 2, 12, 12, 0, 0, tzinfo=timezone.utc)
        end_date = datetime(2026, 2, 12, 12, 0, 0, tzinfo=timezone.utc)
        current = start_date

        count = 0
        while current <= end_date:
            ag_base = get_monthly_price(AG_PRICES_MONTHLY, current)
            cu_base = get_monthly_price(CU_PRICES_MONTHLY, current)
            au_base = get_monthly_price(AU_PRICES_MONTHLY, current)

            ag_price = interpolate_price(ag_base, current.day, 30)
            cu_price = interpolate_price(cu_base, current.day, 30)
            au_price = interpolate_price(au_base, current.day, 30)

            # Compute NSR with these prices
            inp = NSRInput(
                mine="Vermelhos UG", area="Vermelhos Sul",
                cu_grade=1.4, au_grade=0.23, ag_grade=2.33,
                cu_price=cu_price, au_price=au_price, ag_price=ag_price,
            )
            result = compute_nsr_complete(inp)
            is_viable = result.nsr_per_tonne >= target_nsr

            snapshot_id = uuid.uuid4()
            session.execute(
                text("""
                    INSERT INTO nsr_snapshots
                    (id, scenario_id, timestamp, nsr_per_tonne, nsr_cu, nsr_au, nsr_ag,
                     cu_price, au_price, ag_price, cu_tc, cu_rc, cu_freight, is_viable)
                    VALUES (:id, :scenario_id, :ts, :nsr, :nsr_cu, :nsr_au, :nsr_ag,
                            :cu, :au, :ag, :tc, :rc, :freight, :viable)
                """),
                {
                    "id": str(snapshot_id),
                    "scenario_id": str(scenario_id),
                    "ts": current.isoformat(),
                    "nsr": result.nsr_per_tonne,
                    "nsr_cu": result.nsr_cu,
                    "nsr_au": result.nsr_au,
                    "nsr_ag": result.nsr_ag,
                    "cu": cu_price,
                    "au": au_price,
                    "ag": ag_price,
                    "tc": DEFAULT_CU_TC,
                    "rc": DEFAULT_CU_RC,
                    "freight": DEFAULT_CU_FREIGHT,
                    "viable": is_viable,
                },
            )
            count += 1
            current += timedelta(days=1)

        session.commit()
        print(f"Created {count} daily snapshots from {start_date.date()} to {end_date.date()}")
        print(f"Scenario ID: {scenario_id}")
        print("Done! Refresh the Goal Seek page to see the time series chart.")

    except Exception as e:
        session.rollback()
        print(f"Error: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
