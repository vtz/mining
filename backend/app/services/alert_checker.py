"""Alert checker service with APScheduler.

Runs a master job every hour. For each active scenario, checks if
enough time has passed based on the scenario's alert_frequency,
then:
  1. Fetches current metal prices
  2. Computes NSR with current prices + scenario's base inputs
  3. Records an NsrSnapshot (for time series)
  4. Checks if NSR crossed the target threshold (hysteresis)
  5. Sends email alert if crossed
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.models.goal_seek import GoalSeekScenario, NsrSnapshot
from app.nsr_engine.models import NSRInput
from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.constants import (
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AG_PRICE_PER_OZ,
    DEFAULT_CU_TC,
    DEFAULT_CU_RC,
    DEFAULT_CU_FREIGHT,
)
from app.services.email_service import send_viability_alert, is_email_configured

logger = logging.getLogger(__name__)

# Frequency -> minimum timedelta between checks
FREQUENCY_INTERVALS = {
    "hourly": timedelta(hours=1),
    "daily": timedelta(hours=24),
    "weekly": timedelta(days=7),
}

# APScheduler instance (created on startup)
_scheduler = None


def _get_sync_session():
    """Create a synchronous database session for the scheduler."""
    settings = get_settings()
    db_url = settings.database_url
    # Ensure sync driver
    if "+asyncpg" in db_url:
        db_url = db_url.replace("+asyncpg", "")

    connect_args = {}
    if "railway.internal" in db_url:
        connect_args["sslmode"] = "disable"

    engine = create_engine(db_url, connect_args=connect_args)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


def _fetch_live_prices_sync() -> dict:
    """Fetch live metal prices synchronously (best effort)."""
    try:
        import httpx

        settings = get_settings()
        api_key = settings.metal_price_api_key

        if not api_key:
            return {
                "cu_price": DEFAULT_CU_PRICE_PER_LB,
                "au_price": DEFAULT_AU_PRICE_PER_OZ,
                "ag_price": DEFAULT_AG_PRICE_PER_OZ,
            }

        response = httpx.get(
            "https://api.metalpriceapi.com/v1/latest",
            params={
                "api_key": api_key,
                "base": "USD",
                "currencies": "XCU,XAU,XAG",
            },
            timeout=10.0,
        )
        response.raise_for_status()
        data = response.json()

        if not data.get("success"):
            raise ValueError("API returned error")

        rates = data.get("rates", {})
        xau = rates.get("XAU", 0)
        xag = rates.get("XAG", 0)
        xcu = rates.get("XCU", 0)

        if not all([xau, xag, xcu]):
            raise ValueError("Missing rates")

        return {
            "cu_price": round((1.0 / xcu) * 14.583, 4),
            "au_price": round(1.0 / xau, 2),
            "ag_price": round(1.0 / xag, 2),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch live prices: {e}. Using defaults.")
        return {
            "cu_price": DEFAULT_CU_PRICE_PER_LB,
            "au_price": DEFAULT_AU_PRICE_PER_OZ,
            "ag_price": DEFAULT_AG_PRICE_PER_OZ,
        }


def check_alerts_job():
    """
    Master alert checker job. Runs every hour via APScheduler.

    For each active scenario whose frequency interval has elapsed:
    - Compute NSR with current prices
    - Record snapshot
    - Check threshold crossing and send alert
    """
    logger.info("Alert checker job started")
    now = datetime.now(timezone.utc)

    session = _get_sync_session()
    try:
        # Get all scenarios with alerts enabled
        scenarios = (
            session.query(GoalSeekScenario)
            .filter(GoalSeekScenario.alert_enabled == True)
            .all()
        )

        if not scenarios:
            logger.info("No active alert scenarios found")
            return

        # Fetch prices once for all scenarios
        prices = _fetch_live_prices_sync()

        for scenario in scenarios:
            try:
                _process_scenario(session, scenario, prices, now)
            except Exception as e:
                logger.error(
                    f"Error processing scenario {scenario.id} ({scenario.name}): {e}"
                )
                continue

        session.commit()
        logger.info(f"Alert checker completed. Processed {len(scenarios)} scenarios.")

    except Exception as e:
        logger.error(f"Alert checker job error: {e}")
        session.rollback()
    finally:
        session.close()


def _process_scenario(
    session: Session,
    scenario: GoalSeekScenario,
    prices: dict,
    now: datetime,
):
    """Process a single scenario: check frequency, compute, snapshot, alert."""
    # Check if enough time has passed
    interval = FREQUENCY_INTERVALS.get(scenario.alert_frequency, timedelta(hours=24))
    if scenario.alert_last_checked_at:
        elapsed = now - scenario.alert_last_checked_at
        if elapsed < interval:
            return  # Not due yet

    # Build NSRInput from saved base_inputs, overriding prices with current
    base = scenario.base_inputs
    nsr_input = NSRInput(
        mine=base.get("mine", ""),
        area=base.get("area", ""),
        cu_grade=base.get("cu_grade", 0),
        au_grade=base.get("au_grade", 0),
        ag_grade=base.get("ag_grade", 0),
        ore_tonnage=base.get("ore_tonnage", 1000),
        mine_dilution=base.get("mine_dilution", 0.14),
        ore_recovery=base.get("ore_recovery", 0.98),
        cu_price=prices["cu_price"],
        au_price=prices["au_price"],
        ag_price=prices["ag_price"],
        cu_payability=base.get("cu_payability"),
        cu_tc=base.get("cu_tc"),
        cu_rc=base.get("cu_rc"),
        cu_freight=base.get("cu_freight"),
    )

    # Compute NSR
    result = compute_nsr_complete(nsr_input)
    current_nsr = result.nsr_per_tonne
    is_viable = current_nsr >= scenario.target_nsr

    # Get cost values for snapshot
    cu_tc = base.get("cu_tc") or DEFAULT_CU_TC
    cu_rc = base.get("cu_rc") or DEFAULT_CU_RC
    cu_freight = base.get("cu_freight") or DEFAULT_CU_FREIGHT

    # Record snapshot
    snapshot = NsrSnapshot(
        scenario_id=scenario.id,
        timestamp=now,
        nsr_per_tonne=round(current_nsr, 2),
        nsr_cu=round(result.nsr_cu, 2),
        nsr_au=round(result.nsr_au, 2),
        nsr_ag=round(result.nsr_ag, 2),
        cu_price=prices["cu_price"],
        au_price=prices["au_price"],
        ag_price=prices["ag_price"],
        cu_tc=cu_tc,
        cu_rc=cu_rc,
        cu_freight=cu_freight,
        is_viable=is_viable,
    )
    session.add(snapshot)

    # Check for threshold crossing (hysteresis)
    previous_nsr = scenario.last_nsr_value
    crossed_up = False

    if previous_nsr is not None:
        was_below = previous_nsr < scenario.target_nsr
        is_above = current_nsr >= scenario.target_nsr
        crossed_up = was_below and is_above

    # Update scenario state
    scenario.last_nsr_value = current_nsr
    scenario.alert_last_checked_at = now

    # Send alert if crossed
    if crossed_up and scenario.alert_email and is_email_configured():
        mine_name = base.get("mine", "Unknown")
        area_name = base.get("area", "Unknown")

        sent = send_viability_alert(
            recipient_email=scenario.alert_email,
            scenario_name=scenario.name,
            mine_name=mine_name,
            area_name=area_name,
            target_variable=scenario.target_variable,
            target_nsr=scenario.target_nsr,
            current_nsr=current_nsr,
            threshold_value=scenario.threshold_value,
            current_prices=prices,
        )
        if sent:
            scenario.alert_triggered_at = now
            logger.info(
                f"Alert triggered for scenario '{scenario.name}': "
                f"NSR crossed ${scenario.target_nsr}/t (now ${current_nsr:.2f}/t)"
            )


def start_scheduler():
    """Start the APScheduler background scheduler."""
    global _scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
    except ImportError:
        logger.warning(
            "apscheduler not installed. Alert checking disabled. "
            "Install with: pip install apscheduler"
        )
        return

    if _scheduler is not None:
        logger.info("Scheduler already running")
        return

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        check_alerts_job,
        trigger=IntervalTrigger(hours=1),
        id="alert_checker",
        name="Check Goal Seek alerts and record snapshots",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Alert checker scheduler started (runs every hour)")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Alert checker scheduler stopped")
