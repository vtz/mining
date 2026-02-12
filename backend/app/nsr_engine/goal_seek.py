"""Goal Seek solver for NSR calculations.

Implements a bisection-based solver that finds the value of any input
variable needed to achieve a target NSR value. Similar to Excel's
Goal Seek feature but integrated with the NSR calculation engine.

The NSR function is monotonic with respect to each individual variable,
which guarantees bisection convergence.
"""

from dataclasses import dataclass
from typing import Dict, Tuple

from app.nsr_engine.models import NSRInput
from app.nsr_engine.calculations import compute_nsr_complete


# Variable definitions: name -> (direction, lower_bound, upper_bound, unit)
# direction: "revenue" means NSR increases as variable increases
#            "cost" means NSR decreases as variable increases
GOAL_SEEK_VARIABLES: Dict[str, Tuple[str, float, float, str]] = {
    # Revenue variables (NSR increases as they increase)
    "cu_price": ("revenue", 0.01, 50.0, "$/lb"),
    "au_price": ("revenue", 1.0, 50000.0, "$/oz"),
    "ag_price": ("revenue", 0.01, 5000.0, "$/oz"),
    "cu_grade": ("revenue", 0.001, 20.0, "%"),
    "au_grade": ("revenue", 0.001, 100.0, "g/t"),
    "ag_grade": ("revenue", 0.001, 500.0, "g/t"),
    # Cost variables (NSR decreases as they increase)
    "cu_tc": ("cost", 0.0, 1000.0, "$/dmt"),
    "cu_rc": ("cost", 0.0, 50.0, "$/lb"),
    "cu_freight": ("cost", 0.0, 500.0, "$/dmt"),
    "cu_penalties": ("cost", 0.0, 500.0, "$/dmt"),
    "mine_dilution": ("cost", 0.0, 0.99, "decimal"),
}


@dataclass
class GoalSeekResult:
    """Result of a Goal Seek computation."""

    target_variable: str
    target_variable_unit: str
    target_nsr: float
    threshold_value: float
    current_value: float
    current_nsr: float
    delta_percent: float  # (threshold - current) / current * 100
    is_currently_viable: bool  # current_nsr >= target_nsr
    converged: bool
    iterations: int
    tolerance_achieved: float
    bound_hit: str = ""  # "lower", "upper", or "" — set when no solution in range


class GoalSeekError(Exception):
    """Raised when Goal Seek cannot find a solution."""

    pass


def _get_variable_value(inputs: NSRInput, variable: str) -> float:
    """Get the current value of a variable from NSRInput."""
    val = getattr(inputs, variable, None)
    if val is None:
        # For optional fields, get the default from constants
        from app.nsr_engine.constants import (
            DEFAULT_CU_PRICE_PER_LB,
            DEFAULT_AU_PRICE_PER_OZ,
            DEFAULT_AG_PRICE_PER_OZ,
            DEFAULT_CU_TC,
            DEFAULT_CU_RC,
            DEFAULT_CU_FREIGHT,
            DEFAULT_CU_PENALTIES,
        )

        defaults = {
            "cu_price": DEFAULT_CU_PRICE_PER_LB,
            "au_price": DEFAULT_AU_PRICE_PER_OZ,
            "ag_price": DEFAULT_AG_PRICE_PER_OZ,
            "cu_tc": DEFAULT_CU_TC,
            "cu_rc": DEFAULT_CU_RC,
            "cu_freight": DEFAULT_CU_FREIGHT,
            "cu_penalties": DEFAULT_CU_PENALTIES,
        }
        val = defaults.get(variable)
        if val is None:
            raise GoalSeekError(
                f"Cannot determine current value for variable '{variable}'"
            )
    return val


def _set_variable_value(inputs: NSRInput, variable: str, value: float) -> NSRInput:
    """Create a copy of NSRInput with one variable changed."""
    data = inputs.model_dump()
    data[variable] = value
    return NSRInput(**data)


def _compute_nsr_for_value(
    base_input: NSRInput, variable: str, value: float
) -> float:
    """Compute NSR for a specific variable value."""
    modified = _set_variable_value(base_input, variable, value)
    result = compute_nsr_complete(modified)
    return result.nsr_per_tonne


def goal_seek(
    base_input: NSRInput,
    target_variable: str,
    target_nsr: float = 0.0,
    tolerance: float = 0.01,
    max_iterations: int = 50,
) -> GoalSeekResult:
    """
    Find the value of target_variable that yields target_nsr.

    Uses bisection method, which is guaranteed to converge for
    monotonic functions.

    Args:
        base_input: Base NSR calculation parameters.
        target_variable: Variable to solve for (e.g., "cu_price").
        target_nsr: Desired NSR value in $/t (default 0 = break-even).
        tolerance: Convergence tolerance in $/t (default $0.01).
        max_iterations: Maximum bisection iterations (default 50).

    Returns:
        GoalSeekResult with the threshold value and metadata.

    Raises:
        GoalSeekError: If the variable is unsupported or no solution exists
                       within the variable bounds.
    """
    if target_variable not in GOAL_SEEK_VARIABLES:
        raise GoalSeekError(
            f"Unsupported variable: '{target_variable}'. "
            f"Supported: {list(GOAL_SEEK_VARIABLES.keys())}"
        )

    direction, lower_bound, upper_bound, unit = GOAL_SEEK_VARIABLES[target_variable]
    current_value = _get_variable_value(base_input, target_variable)

    # Compute current NSR
    current_nsr = _compute_nsr_for_value(base_input, target_variable, current_value)
    is_currently_viable = current_nsr >= target_nsr

    # Check if target is already met exactly
    if abs(current_nsr - target_nsr) <= tolerance:
        return GoalSeekResult(
            target_variable=target_variable,
            target_variable_unit=unit,
            target_nsr=target_nsr,
            threshold_value=round(current_value, 6),
            current_value=current_value,
            current_nsr=round(current_nsr, 2),
            delta_percent=0.0,
            is_currently_viable=is_currently_viable,
            converged=True,
            iterations=0,
            tolerance_achieved=abs(current_nsr - target_nsr),
        )

    # Evaluate NSR at bounds
    nsr_at_lower = _compute_nsr_for_value(base_input, target_variable, lower_bound)
    nsr_at_upper = _compute_nsr_for_value(base_input, target_variable, upper_bound)

    # For revenue variables: NSR increases with variable
    # For cost variables: NSR decreases with variable
    # We need f(x) = nsr(x) - target_nsr = 0

    # Check if solution exists within bounds
    f_lower = nsr_at_lower - target_nsr
    f_upper = nsr_at_upper - target_nsr

    if f_lower * f_upper > 0:
        # No sign change -> no solution in bounds.
        # Both bounds produce NSR on the same side of the target.
        # For revenue vars: if both > 0, even at lower bound NSR exceeds target
        # For cost vars: if both > 0, even at upper bound NSR exceeds target
        if abs(f_lower) < abs(f_upper):
            threshold = lower_bound
            nsr_at_threshold = nsr_at_lower
            hit = "lower"
        else:
            threshold = upper_bound
            nsr_at_threshold = nsr_at_upper
            hit = "upper"

        delta_pct = (
            ((threshold - current_value) / current_value * 100)
            if current_value != 0
            else 0.0
        )

        return GoalSeekResult(
            target_variable=target_variable,
            target_variable_unit=unit,
            target_nsr=target_nsr,
            threshold_value=round(threshold, 6),
            current_value=current_value,
            current_nsr=round(current_nsr, 2),
            delta_percent=round(delta_pct, 2),
            is_currently_viable=is_currently_viable,
            converged=False,
            iterations=0,
            tolerance_achieved=abs(nsr_at_threshold - target_nsr),
            bound_hit=hit,
        )

    # Bisection method
    a, b = lower_bound, upper_bound
    fa = f_lower

    iterations = 0
    for i in range(max_iterations):
        iterations = i + 1
        mid = (a + b) / 2.0
        nsr_mid = _compute_nsr_for_value(base_input, target_variable, mid)
        f_mid = nsr_mid - target_nsr

        if abs(f_mid) <= tolerance:
            # Converged
            break

        if fa * f_mid < 0:
            b = mid
        else:
            a = mid
            fa = f_mid

    threshold = (a + b) / 2.0
    nsr_at_threshold = _compute_nsr_for_value(base_input, target_variable, threshold)

    delta_pct = (
        ((threshold - current_value) / current_value * 100)
        if current_value != 0
        else 0.0
    )

    return GoalSeekResult(
        target_variable=target_variable,
        target_variable_unit=unit,
        target_nsr=target_nsr,
        threshold_value=round(threshold, 6),
        current_value=current_value,
        current_nsr=round(current_nsr, 2),
        delta_percent=round(delta_pct, 2),
        is_currently_viable=is_currently_viable,
        converged=True,
        iterations=iterations,
        tolerance_achieved=round(abs(nsr_at_threshold - target_nsr), 4),
    )
