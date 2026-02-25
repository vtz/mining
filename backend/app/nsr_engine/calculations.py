"""Core NSR calculation functions.

This module implements the NSR (Net Smelter Return) calculation logic
following the Mina Caraíba methodology.

All functions are pure (no side effects) and deterministic.
"""

from app.nsr_engine.models import NSRInput, NSRResult, EBITDAResult
from app.nsr_engine.constants import (
    # Conversions
    LB_PER_TONNE,
    TROY_OZ_PER_GRAM,
    # Defaults
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AG_PRICE_PER_OZ,
    DEFAULT_CU_PAYABILITY,
    DEFAULT_CU_TC,
    DEFAULT_CU_RC,
    DEFAULT_CU_FREIGHT,
    DEFAULT_CU_PENALTIES,
    DEFAULT_AU_PAYABILITY,
    DEFAULT_AU_RC,
    DEFAULT_AG_PAYABILITY,
    DEFAULT_AG_RC,
    DEFAULT_CU_CONC_GRADE,
    DEFAULT_AU_RECOVERY,
    DEFAULT_AG_RECOVERY,
    DEFAULT_MINE_COST,
    DEFAULT_DEVELOPMENT_COST,
    DEFAULT_DEVELOPMENT_METERS,
    DEFAULT_HAUL_COST,
    DEFAULT_PLANT_COST,
    DEFAULT_GA_COST,
    # Recovery params
    RECOVERY_PARAMS,
    DEFAULT_RECOVERY_PARAMS,
)


def compute_cu_recovery(cu_grade_pct: float, area: str) -> float:
    """
    Compute copper metallurgical recovery based on grade and area.

    The recovery is calculated using a linear formula:
        recovery (%) = a × grade (%) + b

    If a fixed value is specified for the area, it overrides the formula.

    Args:
        cu_grade_pct: Copper head grade in percent (e.g., 1.4 for 1.4%)
        area: Mining area name (e.g., "Vermelhos Sul")

    Returns:
        Recovery as a decimal (0-1). Capped at 1.0.

    Example:
        >>> compute_cu_recovery(1.4, "Vermelhos Sul")
        0.9654  # 2.8286 × 1.4 + 92.584 = 96.54%
    """
    params = RECOVERY_PARAMS.get(area, DEFAULT_RECOVERY_PARAMS)

    # Use fixed value if specified
    if params.get("fixed") is not None:
        return min(params["fixed"] / 100.0, 1.0)

    # Calculate using linear formula
    a = params["a"]
    b = params["b"]
    recovery_pct = a * cu_grade_pct + b

    # Return as decimal, capped at 100%
    return min(recovery_pct / 100.0, 1.0)


def compute_payable_metal(
    tonnage: float,
    grade: float,
    grade_unit: str,
    recovery: float,
    payability: float,
) -> float:
    """
    Compute payable metal quantity.

    Formula:
        payable_metal = tonnage × grade_fraction × recovery × payability

    Args:
        tonnage: Ore tonnage in tonnes
        grade: Metal grade in specified unit
        grade_unit: Unit of grade ("%" or "g/t")
        recovery: Metallurgical recovery as decimal (0-1)
        payability: Commercial payability as decimal (0-1)

    Returns:
        Payable metal quantity in tonnes (for %) or grams (for g/t)

    Raises:
        ValueError: If inputs are invalid
    """
    if tonnage < 0:
        raise ValueError("tonnage must be positive")
    if recovery < 0 or recovery > 1:
        raise ValueError("recovery must be between 0 and 1")
    if payability < 0 or payability > 1:
        raise ValueError("payability must be between 0 and 1")

    # Convert grade to fraction
    if grade_unit == "%":
        grade_fraction = grade / 100.0
    elif grade_unit == "g/t":
        grade_fraction = grade / 1_000_000.0  # g/t to fraction
    else:
        raise ValueError(f"Unsupported grade unit: {grade_unit}")

    return tonnage * grade_fraction * recovery * payability


def compute_conc_ratio(
    cu_grade_pct: float,
    cu_recovery: float,
    cu_conc_grade_pct: float,
) -> float:
    """
    Compute concentrate ratio (tonnes of concentrate per tonne of ore).

    Formula:
        conc_ratio = (Cu Grade × Cu Recovery) / Cu Conc Grade

    Args:
        cu_grade_pct: Copper head grade (%)
        cu_recovery: Copper recovery (decimal)
        cu_conc_grade_pct: Copper grade in concentrate (%)

    Returns:
        Concentrate ratio (t conc / t ore)
    """
    return (cu_grade_pct / 100.0) * cu_recovery / (cu_conc_grade_pct / 100.0)


def compute_conc_price_cu(
    cu_price_per_lb: float,
    cu_conc_grade_pct: float,
    payability: float,
    tc: float,
    rc: float,
    freight: float,
    penalties: float = 0.0,
) -> float:
    """
    Compute copper contribution to concentrate price.

    Formula:
        Conc Price Cu = (Cu Price × Cu Conc Grade × Payability × LB_PER_TONNE)
                        - TC - (RC × Cu Conc Grade × LB_PER_TONNE) - Freight - Penalties

    Args:
        cu_price_per_lb: Copper price in $/lb
        cu_conc_grade_pct: Copper grade in concentrate (%)
        payability: Copper payability (decimal)
        tc: Treatment charge ($/dmt concentrate)
        rc: Refining charge ($/lb Cu payable)
        freight: Freight cost ($/dmt concentrate)
        penalties: Penalties ($/dmt concentrate)

    Returns:
        Copper contribution to concentrate price ($/t concentrate)
    """
    cu_grade_fraction = cu_conc_grade_pct / 100.0

    # Gross revenue per tonne of concentrate
    gross_revenue = cu_price_per_lb * cu_grade_fraction * payability * LB_PER_TONNE

    # RC is per lb of Cu in concentrate
    rc_total = rc * cu_grade_fraction * LB_PER_TONNE

    # Total deductions per tonne of concentrate
    total_deductions = tc + rc_total + freight + penalties

    return gross_revenue - total_deductions


def compute_conc_price_au(
    au_price_per_oz: float,
    au_grade_in_conc_gpt: float,
    payability: float,
    rc: float,
) -> float:
    """
    Compute gold contribution to concentrate price.

    Args:
        au_price_per_oz: Gold price in $/oz
        au_grade_in_conc_gpt: Gold grade in concentrate (g/t)
        payability: Gold payability (decimal)
        rc: Refining charge ($/oz Au)

    Returns:
        Gold contribution to concentrate price ($/t concentrate)
    """
    # Convert g/t to oz/t
    au_oz_per_tonne_conc = au_grade_in_conc_gpt * TROY_OZ_PER_GRAM

    gross_revenue = au_price_per_oz * au_oz_per_tonne_conc * payability
    rc_total = rc * au_oz_per_tonne_conc

    return gross_revenue - rc_total


def compute_conc_price_ag(
    ag_price_per_oz: float,
    ag_grade_in_conc_gpt: float,
    payability: float,
    rc: float,
) -> float:
    """
    Compute silver contribution to concentrate price.

    Args:
        ag_price_per_oz: Silver price in $/oz
        ag_grade_in_conc_gpt: Silver grade in concentrate (g/t)
        payability: Silver payability (decimal)
        rc: Refining charge ($/oz Ag)

    Returns:
        Silver contribution to concentrate price ($/t concentrate)
    """
    # Convert g/t to oz/t
    ag_oz_per_tonne_conc = ag_grade_in_conc_gpt * TROY_OZ_PER_GRAM

    gross_revenue = ag_price_per_oz * ag_oz_per_tonne_conc * payability
    rc_total = rc * ag_oz_per_tonne_conc

    return gross_revenue - rc_total


def compute_gross_revenue(conc_price_total: float, conc_tonnage: float) -> float:
    """
    Compute gross revenue from concentrate sales.

    Args:
        conc_price_total: Total concentrate price ($/t conc)
        conc_tonnage: Concentrate tonnage (tonnes)

    Returns:
        Gross revenue ($)
    """
    return conc_price_total * conc_tonnage


def compute_deductions(
    tc: float,
    rc_cu: float,
    rc_au: float,
    rc_ag: float,
    freight: float,
    penalties: float,
    conc_tonnage: float,
) -> dict:
    """
    Compute total deductions.

    Returns dict with breakdown and total.
    """
    tc_total = tc * conc_tonnage
    freight_total = freight * conc_tonnage
    penalties_total = penalties * conc_tonnage

    return {
        "tc": tc_total,
        "rc_cu": rc_cu,
        "rc_au": rc_au,
        "rc_ag": rc_ag,
        "freight": freight_total,
        "penalties": penalties_total,
        "total": tc_total + rc_cu + rc_au + rc_ag + freight_total + penalties_total,
    }


def compute_ebitda(
    revenue: float,
    ore_tonnage: float,
    mine_cost: float,
    development_cost: float,
    development_meters: float,
    haul_cost: float,
    plant_cost: float,
    ga_cost: float,
) -> EBITDAResult:
    """
    Compute EBITDA from revenue and operational costs.

    Args:
        revenue: Total revenue from concentrate sales ($)
        ore_tonnage: Ore tonnage (tonnes)
        mine_cost: Mining cost per tonne ($/t ore)
        development_cost: Development cost per meter ($/m)
        development_meters: Total development meters (m)
        haul_cost: Haul cost per tonne ($/t ore)
        plant_cost: Plant cost per tonne ($/t ore)
        ga_cost: G&A cost per tonne ($/t ore)

    Returns:
        EBITDAResult with full breakdown
    """
    mine_cost_total = mine_cost * ore_tonnage
    development_cost_total = development_cost * development_meters
    haul_cost_total = haul_cost * ore_tonnage
    plant_cost_total = plant_cost * ore_tonnage
    ga_cost_total = ga_cost * ore_tonnage

    total_costs = (
        mine_cost_total
        + development_cost_total
        + haul_cost_total
        + plant_cost_total
        + ga_cost_total
    )

    ebitda = revenue - total_costs
    ebitda_per_tonne = ebitda / ore_tonnage if ore_tonnage > 0 else 0
    ebitda_margin = (ebitda / revenue * 100) if revenue > 0 else 0

    return EBITDAResult(
        revenue=round(revenue, 2),
        mine_cost_total=round(mine_cost_total, 2),
        development_cost_total=round(development_cost_total, 2),
        haul_cost_total=round(haul_cost_total, 2),
        plant_cost_total=round(plant_cost_total, 2),
        ga_cost_total=round(ga_cost_total, 2),
        total_costs=round(total_costs, 2),
        ebitda=round(ebitda, 2),
        ebitda_per_tonne=round(ebitda_per_tonne, 2),
        ebitda_margin=round(ebitda_margin, 2),
    )


def compute_nsr_complete(inputs: NSRInput) -> NSRResult:
    """
    Complete NSR calculation following Caraíba methodology.

    This is the main entry point for NSR calculations.

    Args:
        inputs: NSRInput with all calculation parameters

    Returns:
        NSRResult with complete breakdown

    Example:
        >>> inputs = NSRInput(
        ...     mine="Vermelhos UG",
        ...     area="Vermelhos Sul",
        ...     cu_grade=1.4,
        ...     au_grade=0.23,
        ...     ag_grade=2.33,
        ... )
        >>> result = compute_nsr_complete(inputs)
        >>> print(f"NSR: ${result.nsr_per_tonne:.2f}/t ore")
    """
    # Get defaults for optional parameters
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

    # Step 1: Calculate Cu recovery
    cu_recovery = compute_cu_recovery(inputs.cu_grade, inputs.area)
    au_recovery = DEFAULT_AU_RECOVERY
    ag_recovery = DEFAULT_AG_RECOVERY

    # Step 2: Calculate concentrate ratio
    conc_ratio = compute_conc_ratio(inputs.cu_grade, cu_recovery, cu_conc_grade)

    # Step 3: Calculate grades in concentrate (for Au and Ag)
    # Au/Ag in conc = (grade in ore × recovery) / conc_ratio
    au_in_conc = (inputs.au_grade * au_recovery) / conc_ratio if conc_ratio > 0 else 0
    ag_in_conc = (inputs.ag_grade * ag_recovery) / conc_ratio if conc_ratio > 0 else 0

    # Step 4: Calculate concentrate prices
    conc_price_cu = compute_conc_price_cu(
        cu_price, cu_conc_grade, cu_payability, cu_tc, cu_rc, cu_freight, cu_penalties
    )
    conc_price_au = compute_conc_price_au(au_price, au_in_conc, au_payability, au_rc)
    conc_price_ag = compute_conc_price_ag(ag_price, ag_in_conc, ag_payability, ag_rc)
    conc_price_total = conc_price_cu + conc_price_au + conc_price_ag

    # Step 5: Calculate NSR per tonne of ore (by metal)
    # nsr_total already includes Cu recovery (in conc_ratio) and selling costs (in conc_price)
    nsr_cu = conc_price_cu * conc_ratio
    nsr_au = conc_price_au * conc_ratio
    nsr_ag = conc_price_ag * conc_ratio
    nsr_total = nsr_cu + nsr_au + nsr_ag

    # Final NSR per tonne
    nsr_per_tonne = nsr_total

    # ── CASCADE: decompose nsr_total into Mineral Resources → Mine → Processing → Final ──

    # Gross conc revenue per tonne of concentrate (before TC/RC/freight deductions)
    gross_rev_cu = cu_price * (cu_conc_grade / 100.0) * cu_payability * LB_PER_TONNE
    gross_rev_au = au_price * au_in_conc * TROY_OZ_PER_GRAM * au_payability if conc_ratio > 0 else 0
    gross_rev_ag = ag_price * ag_in_conc * TROY_OZ_PER_GRAM * ag_payability if conc_ratio > 0 else 0

    # Selling costs per tonne of ore = (gross - net) × conc_ratio
    selling_costs_per_tonne = (
        (gross_rev_cu + gross_rev_au + gross_rev_ag) - conc_price_total
    ) * conc_ratio

    # NSR Processing = after recovery, BEFORE selling costs
    nsr_processing = nsr_total + selling_costs_per_tonne

    # Recovery loss: only Cu is affected by Cu recovery; Au/Ag NSR per tonne ore is invariant
    conc_ratio_100 = (inputs.cu_grade / 100.0) / (cu_conc_grade / 100.0) if cu_conc_grade > 0 else 0
    recovery_loss = gross_rev_cu * conc_ratio_100 * (1 - cu_recovery)

    # NSR Mine = after mine factors, BEFORE recovery and selling costs
    nsr_mine = nsr_processing + recovery_loss

    # Mineral Resources = BEFORE mine factors, recovery, and selling costs
    mine_factor = (1 - inputs.mine_dilution) * inputs.ore_recovery
    nsr_mineral_resources = nsr_mine / mine_factor if mine_factor > 0 else nsr_mine
    dilution_loss = nsr_mineral_resources - nsr_mine

    # Calculate revenue for given tonnage
    conc_tonnage = inputs.ore_tonnage * conc_ratio
    revenue_total = conc_price_total * conc_tonnage

    # EBITDA calculation (when any cost input is provided)
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
    ebitda_result = None
    if has_costs:
        ebitda_result = compute_ebitda(
            revenue=revenue_total,
            ore_tonnage=inputs.ore_tonnage,
            mine_cost=inputs.mine_cost if inputs.mine_cost is not None else DEFAULT_MINE_COST,
            development_cost=inputs.development_cost if inputs.development_cost is not None else DEFAULT_DEVELOPMENT_COST,
            development_meters=inputs.development_meters if inputs.development_meters is not None else DEFAULT_DEVELOPMENT_METERS,
            haul_cost=inputs.haul_cost if inputs.haul_cost is not None else DEFAULT_HAUL_COST,
            plant_cost=inputs.plant_cost if inputs.plant_cost is not None else DEFAULT_PLANT_COST,
            ga_cost=inputs.ga_cost if inputs.ga_cost is not None else DEFAULT_GA_COST,
        )

    # Build inputs_used dict
    inputs_used = {
        "mine": inputs.mine,
        "area": inputs.area,
        "cu_grade": inputs.cu_grade,
        "au_grade": inputs.au_grade,
        "ag_grade": inputs.ag_grade,
        "ore_tonnage": inputs.ore_tonnage,
        "mine_dilution": inputs.mine_dilution,
        "ore_recovery": inputs.ore_recovery,
        "cu_price": cu_price,
        "au_price": au_price,
        "ag_price": ag_price,
        "cu_payability": cu_payability,
        "cu_tc": cu_tc,
        "cu_rc": cu_rc,
        "cu_freight": cu_freight,
        "au_payability": au_payability,
        "au_rc": au_rc,
        "ag_payability": ag_payability,
        "ag_rc": ag_rc,
        "cu_conc_grade": cu_conc_grade,
        "mine_cost": inputs.mine_cost,
        "development_cost": inputs.development_cost,
        "development_meters": inputs.development_meters,
        "haul_cost": inputs.haul_cost,
        "plant_cost": inputs.plant_cost,
        "ga_cost": inputs.ga_cost,
    }

    return NSRResult(
        # Concentrate prices
        conc_price_cu=round(conc_price_cu, 2),
        conc_price_au=round(conc_price_au, 2),
        conc_price_ag=round(conc_price_ag, 2),
        conc_price_total=round(conc_price_total, 2),
        # NSR by metal
        nsr_cu=round(nsr_cu, 2),
        nsr_au=round(nsr_au, 2),
        nsr_ag=round(nsr_ag, 2),
        # NSR levels
        nsr_mineral_resources=round(nsr_mineral_resources, 2),
        nsr_processing=round(nsr_processing, 2),
        nsr_mine=round(nsr_mine, 2),
        nsr_per_tonne=round(nsr_per_tonne, 2),
        # Losses
        dilution_loss=round(dilution_loss, 2),
        recovery_loss=round(recovery_loss, 2),
        # Ratios
        conc_ratio=round(conc_ratio, 6),
        cu_recovery=round(cu_recovery, 4),
        au_recovery=round(au_recovery, 4),
        ag_recovery=round(ag_recovery, 4),
        # Revenue
        revenue_total=round(revenue_total, 2),
        # EBITDA
        ebitda=ebitda_result,
        # Metadata
        currency="USD",
        ore_tonnage=inputs.ore_tonnage,
        formula_applied="See NSR_REQUIREMENTS.md",
        inputs_used=inputs_used,
    )
