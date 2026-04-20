"""NSR Audit Report generation.

Produces a step-by-step trace of the NSR calculation so domain experts
can verify every intermediate value against a reference spreadsheet.
"""

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.nsr_engine.calculations import (
    compute_conc_price_ag,
    compute_conc_price_au,
    compute_conc_price_cu,
    compute_conc_ratio,
    compute_cu_recovery,
    compute_ebitda,
)
from app.nsr_engine.constants import (
    DEFAULT_AG_PAYABILITY,
    DEFAULT_AG_PRICE_PER_OZ,
    DEFAULT_AG_RC,
    DEFAULT_AG_RECOVERY,
    DEFAULT_AU_PAYABILITY,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AU_RC,
    DEFAULT_AU_RECOVERY,
    DEFAULT_CU_CONC_GRADE,
    DEFAULT_CU_FREIGHT,
    DEFAULT_CU_PAYABILITY,
    DEFAULT_CU_PENALTIES,
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_CU_RC,
    DEFAULT_CU_TC,
    DEFAULT_DEVELOPMENT_COST,
    DEFAULT_DEVELOPMENT_METERS,
    DEFAULT_GA_COST,
    DEFAULT_HAUL_COST,
    DEFAULT_MINE_COST,
    DEFAULT_PLANT_COST,
    DEFAULT_RECOVERY_PARAMS,
    LB_PER_TONNE,
    RECOVERY_PARAMS,
    TROY_OZ_PER_GRAM,
)
from app.nsr_engine.models import NSRInput


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class InputAuditEntry(BaseModel):
    """One row in the input-parameters audit table."""

    parameter: str
    value: float | str
    unit: str
    source: Literal["user", "default"]
    default_value: Optional[float | str] = None


class AuditStep(BaseModel):
    """One calculation step in the audit trace."""

    step: int
    name: str
    formula: str = Field(..., description="Symbolic formula")
    substitution: str = Field(..., description="Formula with numeric values plugged in")
    result: float
    unit: str


class CrossCheck(BaseModel):
    """An automated sanity check comparing two values."""

    label: str
    expected: float
    actual: float
    difference: float
    passed: bool


class RecoveryParamsAudit(BaseModel):
    """Recovery parameters used for the selected area."""

    area: str
    a: float
    b: float
    fixed: Optional[float] = None
    source: str = Field(
        ..., description="Whether the area was found in RECOVERY_PARAMS or fell back to default"
    )


class NSRAuditReport(BaseModel):
    """Complete audit report returned by the API."""

    generated_at: str
    mine: str
    area: str

    inputs: List[InputAuditEntry]
    recovery_params: RecoveryParamsAudit
    constants: dict

    steps: List[AuditStep]
    cross_checks: List[CrossCheck]

    results_summary: dict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TOLERANCE = 0.015


def _input_entry(
    parameter: str,
    user_value: Optional[float],
    default: float,
    unit: str,
) -> InputAuditEntry:
    if user_value is not None:
        return InputAuditEntry(
            parameter=parameter,
            value=user_value,
            unit=unit,
            source="user",
            default_value=default,
        )
    return InputAuditEntry(
        parameter=parameter,
        value=default,
        unit=unit,
        source="default",
        default_value=default,
    )


def _check(label: str, expected: float, actual: float) -> CrossCheck:
    diff = abs(expected - actual)
    return CrossCheck(
        label=label,
        expected=round(expected, 6),
        actual=round(actual, 6),
        difference=round(diff, 6),
        passed=diff <= _TOLERANCE,
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


def generate_audit_report(inputs: NSRInput) -> NSRAuditReport:
    """Build the full audit report by re-running each calculation step."""

    # -- resolve defaults (mirrors compute_nsr_complete) --------------------
    cu_price = inputs.cu_price or DEFAULT_CU_PRICE_PER_LB
    au_price = inputs.au_price or DEFAULT_AU_PRICE_PER_OZ
    ag_price = inputs.ag_price or DEFAULT_AG_PRICE_PER_OZ

    cu_payability = inputs.cu_payability or DEFAULT_CU_PAYABILITY
    cu_tc = inputs.cu_tc or DEFAULT_CU_TC
    cu_rc = inputs.cu_rc or DEFAULT_CU_RC
    cu_freight = inputs.cu_freight or DEFAULT_CU_FREIGHT
    cu_penalties = inputs.cu_penalties or DEFAULT_CU_PENALTIES

    au_payability = inputs.au_payability or DEFAULT_AU_PAYABILITY
    au_rc = inputs.au_rc or DEFAULT_AU_RC

    ag_payability = inputs.ag_payability or DEFAULT_AG_PAYABILITY
    ag_rc = inputs.ag_rc or DEFAULT_AG_RC

    cu_conc_grade = inputs.cu_conc_grade or DEFAULT_CU_CONC_GRADE

    # -- Section 2: input audit entries ------------------------------------
    audit_inputs: List[InputAuditEntry] = [
        InputAuditEntry(parameter="Mine", value=inputs.mine, unit="", source="user"),
        InputAuditEntry(parameter="Area", value=inputs.area, unit="", source="user"),
        InputAuditEntry(
            parameter="Cu Grade", value=inputs.cu_grade, unit="%", source="user"
        ),
        InputAuditEntry(
            parameter="Au Grade", value=inputs.au_grade, unit="g/t", source="user"
        ),
        InputAuditEntry(
            parameter="Ag Grade", value=inputs.ag_grade, unit="g/t", source="user"
        ),
        InputAuditEntry(
            parameter="Ore Tonnage",
            value=inputs.ore_tonnage,
            unit="t",
            source="user",
        ),
        InputAuditEntry(
            parameter="Mine Dilution",
            value=inputs.mine_dilution,
            unit="decimal",
            source="user",
        ),
        InputAuditEntry(
            parameter="Ore Recovery",
            value=inputs.ore_recovery,
            unit="decimal",
            source="user",
        ),
        _input_entry("Cu Price", inputs.cu_price, DEFAULT_CU_PRICE_PER_LB, "$/lb"),
        _input_entry("Au Price", inputs.au_price, DEFAULT_AU_PRICE_PER_OZ, "$/oz"),
        _input_entry("Ag Price", inputs.ag_price, DEFAULT_AG_PRICE_PER_OZ, "$/oz"),
        _input_entry("Cu Payability", inputs.cu_payability, DEFAULT_CU_PAYABILITY, "decimal"),
        _input_entry("Cu TC", inputs.cu_tc, DEFAULT_CU_TC, "$/dmt"),
        _input_entry("Cu RC", inputs.cu_rc, DEFAULT_CU_RC, "$/lb"),
        _input_entry("Cu Freight", inputs.cu_freight, DEFAULT_CU_FREIGHT, "$/dmt"),
        _input_entry("Cu Penalties", inputs.cu_penalties, DEFAULT_CU_PENALTIES, "$/dmt"),
        _input_entry("Au Payability", inputs.au_payability, DEFAULT_AU_PAYABILITY, "decimal"),
        _input_entry("Au RC", inputs.au_rc, DEFAULT_AU_RC, "$/oz"),
        _input_entry("Ag Payability", inputs.ag_payability, DEFAULT_AG_PAYABILITY, "decimal"),
        _input_entry("Ag RC", inputs.ag_rc, DEFAULT_AG_RC, "$/oz"),
        _input_entry("Cu Conc Grade", inputs.cu_conc_grade, DEFAULT_CU_CONC_GRADE, "%"),
    ]

    # -- Section 3: recovery params ----------------------------------------
    params = RECOVERY_PARAMS.get(inputs.area)
    if params is not None:
        rec_audit = RecoveryParamsAudit(
            area=inputs.area,
            a=params["a"],
            b=params["b"],
            fixed=params.get("fixed"),
            source="RECOVERY_PARAMS",
        )
    else:
        rec_audit = RecoveryParamsAudit(
            area=inputs.area,
            a=DEFAULT_RECOVERY_PARAMS["a"],
            b=DEFAULT_RECOVERY_PARAMS["b"],
            fixed=DEFAULT_RECOVERY_PARAMS.get("fixed"),
            source="DEFAULT_RECOVERY_PARAMS (area not found)",
        )

    constants_dict = {
        "LB_PER_TONNE": LB_PER_TONNE,
        "TROY_OZ_PER_GRAM": TROY_OZ_PER_GRAM,
        "DEFAULT_AU_RECOVERY": DEFAULT_AU_RECOVERY,
        "DEFAULT_AG_RECOVERY": DEFAULT_AG_RECOVERY,
    }

    # -- Section 4: step-by-step calculation --------------------------------
    steps: List[AuditStep] = []
    step_num = 0

    # Step 1 – Cu Recovery
    step_num += 1
    cu_recovery = compute_cu_recovery(inputs.cu_grade, inputs.area)
    au_recovery = DEFAULT_AU_RECOVERY
    ag_recovery = DEFAULT_AG_RECOVERY

    if rec_audit.fixed is not None:
        steps.append(AuditStep(
            step=step_num,
            name="Cu Recovery (fixed)",
            formula="recovery = fixed / 100",
            substitution=f"recovery = {rec_audit.fixed} / 100",
            result=round(cu_recovery, 6),
            unit="decimal",
        ))
    else:
        recovery_pct = rec_audit.a * inputs.cu_grade + rec_audit.b
        steps.append(AuditStep(
            step=step_num,
            name="Cu Recovery",
            formula="recovery = (a * cu_grade + b) / 100",
            substitution=(
                f"recovery = ({rec_audit.a} * {inputs.cu_grade} + {rec_audit.b}) / 100"
                f" = {round(recovery_pct, 4)} / 100"
            ),
            result=round(cu_recovery, 6),
            unit="decimal",
        ))

    # Step 2 – Concentrate Ratio
    step_num += 1
    conc_ratio = compute_conc_ratio(inputs.cu_grade, cu_recovery, cu_conc_grade)
    steps.append(AuditStep(
        step=step_num,
        name="Concentrate Ratio",
        formula="conc_ratio = (cu_grade / 100 * cu_recovery) / (cu_conc_grade / 100)",
        substitution=(
            f"conc_ratio = ({inputs.cu_grade} / 100 * {round(cu_recovery, 6)})"
            f" / ({cu_conc_grade} / 100)"
        ),
        result=round(conc_ratio, 6),
        unit="t conc / t ore",
    ))

    # Step 3 – Au grade in concentrate
    step_num += 1
    au_in_conc = (inputs.au_grade * au_recovery) / conc_ratio if conc_ratio > 0 else 0
    steps.append(AuditStep(
        step=step_num,
        name="Au Grade in Concentrate",
        formula="au_in_conc = (au_grade * au_recovery) / conc_ratio",
        substitution=(
            f"au_in_conc = ({inputs.au_grade} * {au_recovery}) / {round(conc_ratio, 6)}"
        ),
        result=round(au_in_conc, 4),
        unit="g/t conc",
    ))

    # Step 4 – Ag grade in concentrate
    step_num += 1
    ag_in_conc = (inputs.ag_grade * ag_recovery) / conc_ratio if conc_ratio > 0 else 0
    steps.append(AuditStep(
        step=step_num,
        name="Ag Grade in Concentrate",
        formula="ag_in_conc = (ag_grade * ag_recovery) / conc_ratio",
        substitution=(
            f"ag_in_conc = ({inputs.ag_grade} * {ag_recovery}) / {round(conc_ratio, 6)}"
        ),
        result=round(ag_in_conc, 4),
        unit="g/t conc",
    ))

    # Step 5 – Cu Concentrate Price
    step_num += 1
    conc_price_cu = compute_conc_price_cu(
        cu_price, cu_conc_grade, cu_payability, cu_tc, cu_rc, cu_freight, cu_penalties
    )
    cu_grade_frac = cu_conc_grade / 100.0
    gross_cu = cu_price * cu_grade_frac * cu_payability * LB_PER_TONNE
    rc_total_cu = cu_rc * cu_grade_frac * LB_PER_TONNE
    steps.append(AuditStep(
        step=step_num,
        name="Cu Concentrate Price",
        formula=(
            "conc_price_cu = (cu_price * cu_conc_grade/100 * payability * LB_PER_TONNE)"
            " - TC - (RC * cu_conc_grade/100 * LB_PER_TONNE) - freight - penalties"
        ),
        substitution=(
            f"gross = {cu_price} * {cu_grade_frac} * {cu_payability} * {LB_PER_TONNE}"
            f" = {round(gross_cu, 2)}\n"
            f"rc_total = {cu_rc} * {cu_grade_frac} * {LB_PER_TONNE}"
            f" = {round(rc_total_cu, 2)}\n"
            f"conc_price_cu = {round(gross_cu, 2)} - {cu_tc} - {round(rc_total_cu, 2)}"
            f" - {cu_freight} - {cu_penalties}"
        ),
        result=round(conc_price_cu, 2),
        unit="$/t conc",
    ))

    # Step 6 – Au Concentrate Price
    step_num += 1
    conc_price_au = compute_conc_price_au(au_price, au_in_conc, au_payability, au_rc)
    au_oz = au_in_conc * TROY_OZ_PER_GRAM
    gross_au_conc = au_price * au_oz * au_payability
    rc_total_au = au_rc * au_oz
    steps.append(AuditStep(
        step=step_num,
        name="Au Concentrate Price",
        formula=(
            "au_oz = au_in_conc * TROY_OZ_PER_GRAM\n"
            "conc_price_au = (au_price * au_oz * payability) - (rc * au_oz)"
        ),
        substitution=(
            f"au_oz = {round(au_in_conc, 4)} * {TROY_OZ_PER_GRAM} = {round(au_oz, 6)}\n"
            f"gross = {au_price} * {round(au_oz, 6)} * {au_payability} = {round(gross_au_conc, 2)}\n"
            f"rc_total = {au_rc} * {round(au_oz, 6)} = {round(rc_total_au, 2)}\n"
            f"conc_price_au = {round(gross_au_conc, 2)} - {round(rc_total_au, 2)}"
        ),
        result=round(conc_price_au, 2),
        unit="$/t conc",
    ))

    # Step 7 – Ag Concentrate Price
    step_num += 1
    conc_price_ag = compute_conc_price_ag(ag_price, ag_in_conc, ag_payability, ag_rc)
    ag_oz = ag_in_conc * TROY_OZ_PER_GRAM
    gross_ag_conc = ag_price * ag_oz * ag_payability
    rc_total_ag = ag_rc * ag_oz
    steps.append(AuditStep(
        step=step_num,
        name="Ag Concentrate Price",
        formula=(
            "ag_oz = ag_in_conc * TROY_OZ_PER_GRAM\n"
            "conc_price_ag = (ag_price * ag_oz * payability) - (rc * ag_oz)"
        ),
        substitution=(
            f"ag_oz = {round(ag_in_conc, 4)} * {TROY_OZ_PER_GRAM} = {round(ag_oz, 6)}\n"
            f"gross = {ag_price} * {round(ag_oz, 6)} * {ag_payability} = {round(gross_ag_conc, 2)}\n"
            f"rc_total = {ag_rc} * {round(ag_oz, 6)} = {round(rc_total_ag, 2)}\n"
            f"conc_price_ag = {round(gross_ag_conc, 2)} - {round(rc_total_ag, 2)}"
        ),
        result=round(conc_price_ag, 2),
        unit="$/t conc",
    ))

    # Step 8 – Total Concentrate Price
    step_num += 1
    conc_price_total = conc_price_cu + conc_price_au + conc_price_ag
    steps.append(AuditStep(
        step=step_num,
        name="Total Concentrate Price",
        formula="conc_price_total = conc_price_cu + conc_price_au + conc_price_ag",
        substitution=(
            f"conc_price_total = {round(conc_price_cu, 2)}"
            f" + {round(conc_price_au, 2)}"
            f" + {round(conc_price_ag, 2)}"
        ),
        result=round(conc_price_total, 2),
        unit="$/t conc",
    ))

    # Step 9 – NSR per metal
    step_num += 1
    nsr_cu = conc_price_cu * conc_ratio
    nsr_au = conc_price_au * conc_ratio
    nsr_ag = conc_price_ag * conc_ratio
    steps.append(AuditStep(
        step=step_num,
        name="NSR per Metal",
        formula="nsr_metal = conc_price_metal * conc_ratio",
        substitution=(
            f"nsr_cu = {round(conc_price_cu, 2)} * {round(conc_ratio, 6)} = {round(nsr_cu, 2)}\n"
            f"nsr_au = {round(conc_price_au, 2)} * {round(conc_ratio, 6)} = {round(nsr_au, 2)}\n"
            f"nsr_ag = {round(conc_price_ag, 2)} * {round(conc_ratio, 6)} = {round(nsr_ag, 2)}"
        ),
        result=round(nsr_cu, 2),
        unit="$/t ore",
    ))

    # Step 10 – NSR Total
    step_num += 1
    nsr_total = nsr_cu + nsr_au + nsr_ag
    nsr_per_tonne = nsr_total
    steps.append(AuditStep(
        step=step_num,
        name="NSR Total (per tonne)",
        formula="nsr_total = nsr_cu + nsr_au + nsr_ag",
        substitution=(
            f"nsr_total = {round(nsr_cu, 2)} + {round(nsr_au, 2)} + {round(nsr_ag, 2)}"
        ),
        result=round(nsr_total, 2),
        unit="$/t ore",
    ))

    # Step 11 – Selling Costs per tonne of ore
    step_num += 1
    gross_rev_cu = cu_price * (cu_conc_grade / 100.0) * cu_payability * LB_PER_TONNE
    gross_rev_au = (
        au_price * au_in_conc * TROY_OZ_PER_GRAM * au_payability
        if conc_ratio > 0
        else 0
    )
    gross_rev_ag = (
        ag_price * ag_in_conc * TROY_OZ_PER_GRAM * ag_payability
        if conc_ratio > 0
        else 0
    )
    gross_rev_total = gross_rev_cu + gross_rev_au + gross_rev_ag
    selling_costs_per_tonne = (gross_rev_total - conc_price_total) * conc_ratio
    steps.append(AuditStep(
        step=step_num,
        name="Selling Costs (per t ore)",
        formula="selling_costs = (gross_rev_total - conc_price_total) * conc_ratio",
        substitution=(
            f"gross_rev_cu = {round(gross_rev_cu, 2)}\n"
            f"gross_rev_au = {round(gross_rev_au, 2)}\n"
            f"gross_rev_ag = {round(gross_rev_ag, 2)}\n"
            f"gross_rev_total = {round(gross_rev_total, 2)}\n"
            f"selling_costs = ({round(gross_rev_total, 2)} - {round(conc_price_total, 2)})"
            f" * {round(conc_ratio, 6)}"
        ),
        result=round(selling_costs_per_tonne, 2),
        unit="$/t ore",
    ))

    # Step 12 – NSR Processing
    step_num += 1
    nsr_processing = nsr_total + selling_costs_per_tonne
    steps.append(AuditStep(
        step=step_num,
        name="NSR Processing",
        formula="nsr_processing = nsr_total + selling_costs_per_tonne",
        substitution=(
            f"nsr_processing = {round(nsr_total, 2)} + {round(selling_costs_per_tonne, 2)}"
        ),
        result=round(nsr_processing, 2),
        unit="$/t ore",
    ))

    # Step 13 – Recovery Loss
    step_num += 1
    conc_ratio_100 = (
        (inputs.cu_grade / 100.0) / (cu_conc_grade / 100.0) if cu_conc_grade > 0 else 0
    )
    recovery_loss = gross_rev_cu * conc_ratio_100 * (1 - cu_recovery)
    steps.append(AuditStep(
        step=step_num,
        name="Recovery Loss",
        formula=(
            "conc_ratio_100 = (cu_grade / 100) / (cu_conc_grade / 100)\n"
            "recovery_loss = gross_rev_cu * conc_ratio_100 * (1 - cu_recovery)"
        ),
        substitution=(
            f"conc_ratio_100 = ({inputs.cu_grade} / 100) / ({cu_conc_grade} / 100)"
            f" = {round(conc_ratio_100, 6)}\n"
            f"recovery_loss = {round(gross_rev_cu, 2)} * {round(conc_ratio_100, 6)}"
            f" * (1 - {round(cu_recovery, 6)})"
        ),
        result=round(recovery_loss, 2),
        unit="$/t ore",
    ))

    # Step 14 – NSR Mine
    step_num += 1
    nsr_mine = nsr_processing + recovery_loss
    steps.append(AuditStep(
        step=step_num,
        name="NSR Mine",
        formula="nsr_mine = nsr_processing + recovery_loss",
        substitution=(
            f"nsr_mine = {round(nsr_processing, 2)} + {round(recovery_loss, 2)}"
        ),
        result=round(nsr_mine, 2),
        unit="$/t ore",
    ))

    # Step 15 – NSR Mineral Resources
    step_num += 1
    mine_factor = (1 - inputs.mine_dilution) * inputs.ore_recovery
    nsr_mineral_resources = nsr_mine / mine_factor if mine_factor > 0 else nsr_mine
    dilution_loss = nsr_mineral_resources - nsr_mine
    steps.append(AuditStep(
        step=step_num,
        name="NSR Mineral Resources",
        formula=(
            "mine_factor = (1 - mine_dilution) * ore_recovery\n"
            "nsr_mineral_resources = nsr_mine / mine_factor"
        ),
        substitution=(
            f"mine_factor = (1 - {inputs.mine_dilution}) * {inputs.ore_recovery}"
            f" = {round(mine_factor, 6)}\n"
            f"nsr_mineral_resources = {round(nsr_mine, 2)} / {round(mine_factor, 6)}"
        ),
        result=round(nsr_mineral_resources, 2),
        unit="$/t ore",
    ))

    # Step 16 – Dilution Loss
    step_num += 1
    steps.append(AuditStep(
        step=step_num,
        name="Dilution Loss",
        formula="dilution_loss = nsr_mineral_resources - nsr_mine",
        substitution=(
            f"dilution_loss = {round(nsr_mineral_resources, 2)} - {round(nsr_mine, 2)}"
        ),
        result=round(dilution_loss, 2),
        unit="$/t ore",
    ))

    # Step 17 – Revenue
    step_num += 1
    conc_tonnage = inputs.ore_tonnage * conc_ratio
    revenue_total = conc_price_total * conc_tonnage
    steps.append(AuditStep(
        step=step_num,
        name="Revenue",
        formula=(
            "conc_tonnage = ore_tonnage * conc_ratio\n"
            "revenue_total = conc_price_total * conc_tonnage"
        ),
        substitution=(
            f"conc_tonnage = {inputs.ore_tonnage} * {round(conc_ratio, 6)}"
            f" = {round(conc_tonnage, 2)}\n"
            f"revenue_total = {round(conc_price_total, 2)} * {round(conc_tonnage, 2)}"
        ),
        result=round(revenue_total, 2),
        unit="$",
    ))

    # Step 18 – EBITDA (optional)
    has_costs = any(
        v is not None
        for v in [
            inputs.mine_cost,
            inputs.development_cost,
            inputs.haul_cost,
            inputs.plant_cost,
            inputs.ga_cost,
        ]
    )
    if has_costs:
        step_num += 1
        mc = inputs.mine_cost if inputs.mine_cost is not None else DEFAULT_MINE_COST
        dc = inputs.development_cost if inputs.development_cost is not None else DEFAULT_DEVELOPMENT_COST
        dm = inputs.development_meters if inputs.development_meters is not None else DEFAULT_DEVELOPMENT_METERS
        hc = inputs.haul_cost if inputs.haul_cost is not None else DEFAULT_HAUL_COST
        pc = inputs.plant_cost if inputs.plant_cost is not None else DEFAULT_PLANT_COST
        ga = inputs.ga_cost if inputs.ga_cost is not None else DEFAULT_GA_COST

        ebitda_result = compute_ebitda(
            revenue=revenue_total,
            ore_tonnage=inputs.ore_tonnage,
            mine_cost=mc,
            development_cost=dc,
            development_meters=dm,
            haul_cost=hc,
            plant_cost=pc,
            ga_cost=ga,
        )
        steps.append(AuditStep(
            step=step_num,
            name="EBITDA",
            formula="ebitda = revenue - (mine_cost + dev_cost + haul + plant + g&a)",
            substitution=(
                f"mine_cost_total = {mc} * {inputs.ore_tonnage} = {round(mc * inputs.ore_tonnage, 2)}\n"
                f"dev_cost_total = {dc} * {dm} = {round(dc * dm, 2)}\n"
                f"haul_total = {hc} * {inputs.ore_tonnage} = {round(hc * inputs.ore_tonnage, 2)}\n"
                f"plant_total = {pc} * {inputs.ore_tonnage} = {round(pc * inputs.ore_tonnage, 2)}\n"
                f"ga_total = {ga} * {inputs.ore_tonnage} = {round(ga * inputs.ore_tonnage, 2)}\n"
                f"total_costs = {ebitda_result.total_costs}\n"
                f"ebitda = {round(revenue_total, 2)} - {ebitda_result.total_costs}"
            ),
            result=ebitda_result.ebitda,
            unit="$",
        ))

    # -- Section 5: cross-checks -------------------------------------------
    checks: List[CrossCheck] = [
        _check(
            "NSR total = NSR Cu + NSR Au + NSR Ag",
            nsr_cu + nsr_au + nsr_ag,
            nsr_per_tonne,
        ),
        _check(
            "Conc price total = Cu + Au + Ag",
            conc_price_cu + conc_price_au + conc_price_ag,
            conc_price_total,
        ),
        _check(
            "Dilution loss = NSR Mineral Resources - NSR Mine",
            nsr_mineral_resources - nsr_mine,
            dilution_loss,
        ),
        _check(
            "NSR Mineral Resources = NSR Mine / mine_factor",
            nsr_mine / mine_factor if mine_factor > 0 else nsr_mine,
            nsr_mineral_resources,
        ),
        _check(
            "Revenue = conc_price_total * conc_tonnage",
            conc_price_total * conc_tonnage,
            revenue_total,
        ),
    ]

    # -- Section 6: results summary ----------------------------------------
    results_summary = {
        "conc_price_cu": round(conc_price_cu, 2),
        "conc_price_au": round(conc_price_au, 2),
        "conc_price_ag": round(conc_price_ag, 2),
        "conc_price_total": round(conc_price_total, 2),
        "nsr_cu": round(nsr_cu, 2),
        "nsr_au": round(nsr_au, 2),
        "nsr_ag": round(nsr_ag, 2),
        "nsr_per_tonne": round(nsr_per_tonne, 2),
        "nsr_mineral_resources": round(nsr_mineral_resources, 2),
        "nsr_mine": round(nsr_mine, 2),
        "nsr_processing": round(nsr_processing, 2),
        "dilution_loss": round(dilution_loss, 2),
        "recovery_loss": round(recovery_loss, 2),
        "selling_costs_per_tonne": round(selling_costs_per_tonne, 2),
        "conc_ratio": round(conc_ratio, 6),
        "cu_recovery": round(cu_recovery, 4),
        "au_recovery": round(au_recovery, 4),
        "ag_recovery": round(ag_recovery, 4),
        "revenue_total": round(revenue_total, 2),
    }

    return NSRAuditReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        mine=inputs.mine,
        area=inputs.area,
        inputs=audit_inputs,
        recovery_params=rec_audit,
        constants=constants_dict,
        steps=steps,
        cross_checks=checks,
        results_summary=results_summary,
    )
