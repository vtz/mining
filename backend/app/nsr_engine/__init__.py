"""NSR Engine - Core calculation library."""

from app.nsr_engine.calculations import (
    compute_cu_recovery,
    compute_payable_metal,
    compute_conc_ratio,
    compute_conc_price_cu,
    compute_conc_price_au,
    compute_conc_price_ag,
    compute_gross_revenue,
    compute_deductions,
    compute_nsr_complete,
)
from app.nsr_engine.models import (
    NSRInput,
    NSRResult,
    MetalResult,
    DeductionsResult,
)
from app.nsr_engine.goal_seek import (
    goal_seek,
    GoalSeekResult,
    GoalSeekError,
    GOAL_SEEK_VARIABLES,
)

__all__ = [
    "compute_cu_recovery",
    "compute_payable_metal",
    "compute_conc_ratio",
    "compute_conc_price_cu",
    "compute_conc_price_au",
    "compute_conc_price_ag",
    "compute_gross_revenue",
    "compute_deductions",
    "compute_nsr_complete",
    "NSRInput",
    "NSRResult",
    "MetalResult",
    "DeductionsResult",
    "goal_seek",
    "GoalSeekResult",
    "GoalSeekError",
    "GOAL_SEEK_VARIABLES",
]
