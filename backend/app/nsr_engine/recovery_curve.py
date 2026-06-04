"""Recovery vs Concentrate grade-recovery curve generation.

Generates a metallurgical grade-recovery curve showing how NSR changes
at each operating point along the trade-off between Cu recovery and
concentrate grade.

The model uses a parametric curve calibrated from the current operating
point:

    conc_grade(R) = head_grade + (CG_max - head_grade) * ((1 - R) / (1 - R_min))^n

Where n is the shape factor calibrated so the curve passes through the
base operating point (R_base, CG_base).
"""

import math
from typing import List, Optional

from pydantic import BaseModel, Field

from app.nsr_engine.calculations import compute_cu_recovery, compute_nsr_complete
from app.nsr_engine.constants import DEFAULT_CU_CONC_GRADE, DEFAULT_CU_CONC_GRADE_MAX
from app.nsr_engine.models import NSRInput


class RecoveryCurvePoint(BaseModel):
    """A single point on the recovery-grade curve."""

    cu_recovery: float = Field(..., description="Cu recovery (decimal 0-1)")
    cu_recovery_pct: float = Field(..., description="Cu recovery (%)")
    cu_conc_grade: float = Field(..., description="Cu concentrate grade (%)")
    nsr_per_tonne: float = Field(..., description="NSR per tonne ore ($/t)")
    nsr_cu: float = Field(..., description="Cu NSR contribution ($/t ore)")
    nsr_au: float = Field(..., description="Au NSR contribution ($/t ore)")
    nsr_ag: float = Field(..., description="Ag NSR contribution ($/t ore)")
    conc_ratio: float = Field(..., description="Concentrate ratio (t conc / t ore)")
    conc_price_total: float = Field(..., description="Total concentrate price ($/t conc)")
    is_base_point: bool = Field(default=False, description="Whether this is the base operating point")


class RecoveryCurveModelParams(BaseModel):
    """Parameters of the fitted grade-recovery model."""

    shape_factor_n: float = Field(..., description="Shape factor n")
    conc_grade_max: float = Field(..., description="Max concentrate grade (%)")
    head_grade: float = Field(..., description="Head grade (%)")
    base_recovery: float = Field(..., description="Base recovery (decimal)")
    base_conc_grade: float = Field(..., description="Base concentrate grade (%)")


class RecoveryCurveResult(BaseModel):
    """Full result of a recovery curve generation."""

    base_point: RecoveryCurvePoint
    curve: List[RecoveryCurvePoint]
    model_params: RecoveryCurveModelParams


def _calibrate_shape_factor(
    recovery_base: float,
    conc_grade_base: float,
    head_grade: float,
    conc_grade_max: float,
    recovery_min: float,
) -> float:
    """Calibrate shape factor n so the curve passes through the base point.

    n = ln((CG_base - HG) / (CG_max - HG)) / ln((1 - R_base) / (1 - R_min))
    """
    numerator = conc_grade_base - head_grade
    denominator = conc_grade_max - head_grade

    if denominator <= 0 or numerator <= 0:
        return 1.0

    ratio_grade = numerator / denominator
    ratio_recovery = (1.0 - recovery_base) / (1.0 - recovery_min)

    if ratio_recovery <= 0 or ratio_grade <= 0:
        return 1.0

    return math.log(ratio_grade) / math.log(ratio_recovery)


def _compute_conc_grade(
    recovery: float,
    head_grade: float,
    conc_grade_max: float,
    recovery_min: float,
    n: float,
) -> float:
    """Compute concentrate grade for a given recovery using the parametric model."""
    if recovery >= 1.0:
        return head_grade

    ratio = (1.0 - recovery) / (1.0 - recovery_min)
    ratio = max(ratio, 0.0)

    return head_grade + (conc_grade_max - head_grade) * (ratio ** n)


def generate_recovery_curve(
    base_input: NSRInput,
    num_points: int = 15,
    recovery_min: float = 0.50,
    recovery_max: float = 0.99,
    conc_grade_max: float = DEFAULT_CU_CONC_GRADE_MAX,
) -> RecoveryCurveResult:
    """Generate a recovery vs concentrate grade curve with NSR at each point.

    Args:
        base_input: Base NSR calculation inputs (mine, area, grades, prices, etc.)
        num_points: Number of points on the curve
        recovery_min: Minimum Cu recovery (decimal)
        recovery_max: Maximum Cu recovery (decimal)
        conc_grade_max: Maximum achievable concentrate grade (%)

    Returns:
        RecoveryCurveResult with base point, curve points, and model params
    """
    base_recovery = compute_cu_recovery(base_input.cu_grade, base_input.area)
    base_conc_grade = base_input.cu_conc_grade or DEFAULT_CU_CONC_GRADE
    head_grade = base_input.cu_grade

    # Ensure conc_grade_max > base_conc_grade > head_grade
    conc_grade_max = max(conc_grade_max, base_conc_grade + 1.0)

    # Calibrate model shape factor
    n = _calibrate_shape_factor(
        recovery_base=base_recovery,
        conc_grade_base=base_conc_grade,
        head_grade=head_grade,
        conc_grade_max=conc_grade_max,
        recovery_min=recovery_min,
    )

    # Clamp n to reasonable range
    n = max(0.1, min(n, 10.0))

    # Build list of recovery values, always including the base recovery
    recovery_values: List[float] = []
    step = (recovery_max - recovery_min) / (num_points - 1) if num_points > 1 else 0

    for i in range(num_points):
        recovery_values.append(recovery_min + i * step)

    # Inject base recovery if it falls within range but isn't already close to a point
    base_in_range = recovery_min <= base_recovery <= recovery_max
    if base_in_range and all(abs(r - base_recovery) > step * 0.3 for r in recovery_values):
        recovery_values.append(base_recovery)
        recovery_values.sort()

    # Generate curve points
    curve_points: List[RecoveryCurvePoint] = []
    base_point: Optional[RecoveryCurvePoint] = None

    for recovery in recovery_values:
        recovery = min(recovery, recovery_max)

        conc_grade = _compute_conc_grade(
            recovery=recovery,
            head_grade=head_grade,
            conc_grade_max=conc_grade_max,
            recovery_min=recovery_min,
            n=n,
        )

        # Ensure conc_grade stays above head_grade
        conc_grade = max(conc_grade, head_grade + 0.1)

        modified_input = base_input.model_copy(
            update={"cu_recovery": recovery, "cu_conc_grade": conc_grade}
        )
        result = compute_nsr_complete(modified_input)

        is_base = abs(recovery - base_recovery) < (step * 0.3 if step > 0 else 0.005)

        point = RecoveryCurvePoint(
            cu_recovery=round(recovery, 4),
            cu_recovery_pct=round(recovery * 100, 2),
            cu_conc_grade=round(conc_grade, 2),
            nsr_per_tonne=result.nsr_per_tonne,
            nsr_cu=result.nsr_cu,
            nsr_au=result.nsr_au,
            nsr_ag=result.nsr_ag,
            conc_ratio=result.conc_ratio,
            conc_price_total=result.conc_price_total,
            is_base_point=is_base,
        )

        curve_points.append(point)

        if is_base:
            base_point = point

    # If base point is outside the range, compute it separately for the response
    if base_point is None:
        base_conc_grade_computed = _compute_conc_grade(
            recovery=base_recovery,
            head_grade=head_grade,
            conc_grade_max=conc_grade_max,
            recovery_min=recovery_min,
            n=n,
        )
        base_conc_grade_computed = max(base_conc_grade_computed, head_grade + 0.1)

        modified_input = base_input.model_copy(
            update={"cu_recovery": base_recovery, "cu_conc_grade": base_conc_grade_computed}
        )
        result = compute_nsr_complete(modified_input)

        base_point = RecoveryCurvePoint(
            cu_recovery=round(base_recovery, 4),
            cu_recovery_pct=round(base_recovery * 100, 2),
            cu_conc_grade=round(base_conc_grade_computed, 2),
            nsr_per_tonne=result.nsr_per_tonne,
            nsr_cu=result.nsr_cu,
            nsr_au=result.nsr_au,
            nsr_ag=result.nsr_ag,
            conc_ratio=result.conc_ratio,
            conc_price_total=result.conc_price_total,
            is_base_point=True,
        )

    model_params = RecoveryCurveModelParams(
        shape_factor_n=round(n, 4),
        conc_grade_max=round(conc_grade_max, 2),
        head_grade=round(head_grade, 4),
        base_recovery=round(base_recovery, 4),
        base_conc_grade=round(base_conc_grade, 2),
    )

    return RecoveryCurveResult(
        base_point=base_point,
        curve=curve_points,
        model_params=model_params,
    )
