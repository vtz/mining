"""Data models for NSR calculations."""

from pydantic import BaseModel, Field
from typing import Any, Dict, Optional


class MetalResult(BaseModel):
    """Result for a single metal calculation."""

    metal: str = Field(..., description="Metal code (Cu, Au, Ag)")
    conc_price: float = Field(..., description="Contribution to concentrate price ($/t conc)")
    nsr: float = Field(..., description="NSR contribution ($/t ore)")
    payable_metal: float = Field(..., description="Payable metal quantity")
    payable_unit: str = Field(..., description="Unit of payable metal")


class DeductionsResult(BaseModel):
    """Breakdown of deductions."""

    tc: float = Field(..., description="Treatment charge total ($)")
    rc_cu: float = Field(..., description="Refining charge Cu ($)")
    rc_au: float = Field(..., description="Refining charge Au ($)")
    rc_ag: float = Field(..., description="Refining charge Ag ($)")
    freight: float = Field(..., description="Freight total ($)")
    penalties: float = Field(default=0.0, description="Penalties total ($)")
    total: float = Field(..., description="Total deductions ($)")


class NSRInput(BaseModel):
    """Input parameters for NSR calculation."""

    # Mine/Area selection
    mine: str = Field(..., description="Mine name")
    area: str = Field(..., description="Area within mine")

    # Head grades
    cu_grade: float = Field(..., ge=0, le=100, description="Copper grade (%)")
    au_grade: float = Field(..., ge=0, description="Gold grade (g/t)")
    ag_grade: float = Field(..., ge=0, description="Silver grade (g/t)")

    # Ore parameters
    ore_tonnage: float = Field(default=1000, gt=0, description="Ore tonnage (tonnes)")
    mine_dilution: float = Field(default=0.14, ge=0, le=1, description="Mine dilution")
    ore_recovery: float = Field(default=0.98, ge=0, le=1, description="Ore recovery")

    # Prices (optional - uses defaults if not provided)
    cu_price: Optional[float] = Field(default=None, description="Cu price ($/lb)")
    au_price: Optional[float] = Field(default=None, description="Au price ($/oz)")
    ag_price: Optional[float] = Field(default=None, description="Ag price ($/oz)")

    # Commercial terms (optional)
    cu_payability: Optional[float] = Field(default=None, description="Cu payability")
    cu_tc: Optional[float] = Field(default=None, description="Treatment charge ($/dmt)")
    cu_rc: Optional[float] = Field(default=None, description="Refining charge Cu ($/lb)")
    cu_freight: Optional[float] = Field(default=None, description="Freight ($/dmt)")
    cu_penalties: Optional[float] = Field(default=None, description="Penalties ($/dmt)")

    au_payability: Optional[float] = Field(default=None, description="Au payability")
    au_rc: Optional[float] = Field(default=None, description="Refining charge Au ($/oz)")

    ag_payability: Optional[float] = Field(default=None, description="Ag payability")
    ag_rc: Optional[float] = Field(default=None, description="Refining charge Ag ($/oz)")

    cu_conc_grade: Optional[float] = Field(default=None, description="Cu concentrate grade (%)")

    # Operational costs (for EBITDA)
    mine_cost: Optional[float] = Field(default=None, ge=0, description="Mining cost ($/t ore)")
    development_cost: Optional[float] = Field(default=None, ge=0, description="Development cost ($/meter)")
    development_meters: Optional[float] = Field(default=None, ge=0, description="Development meters (m)")
    haul_cost: Optional[float] = Field(default=None, ge=0, description="Haul cost ($/t ore)")
    plant_cost: Optional[float] = Field(default=None, ge=0, description="Plant cost ($/t ore)")
    ga_cost: Optional[float] = Field(default=None, ge=0, description="G&A cost ($/t ore)")


class EBITDAResult(BaseModel):
    """EBITDA calculation breakdown."""

    revenue: float = Field(..., description="Total revenue ($)")
    mine_cost_total: float = Field(..., description="Total mining cost ($)")
    development_cost_total: float = Field(..., description="Total development cost ($)")
    haul_cost_total: float = Field(..., description="Total haul cost ($)")
    plant_cost_total: float = Field(..., description="Total plant cost ($)")
    ga_cost_total: float = Field(..., description="Total G&A cost ($)")
    total_costs: float = Field(..., description="Sum of all costs ($)")
    ebitda: float = Field(..., description="EBITDA = Revenue - Costs ($)")
    ebitda_per_tonne: float = Field(..., description="EBITDA per tonne ore ($/t)")
    ebitda_margin: float = Field(..., description="EBITDA margin (%)")


class NSRResult(BaseModel):
    """Complete NSR calculation result."""

    # Concentrate prices ($/t concentrate)
    conc_price_cu: float = Field(..., description="Cu contribution to conc price ($/t conc)")
    conc_price_au: float = Field(..., description="Au contribution to conc price ($/t conc)")
    conc_price_ag: float = Field(..., description="Ag contribution to conc price ($/t conc)")
    conc_price_total: float = Field(..., description="Total concentrate price ($/t conc)")

    # NSR by metal ($/t ore)
    nsr_cu: float = Field(..., description="Cu NSR ($/t ore)")
    nsr_au: float = Field(..., description="Au NSR ($/t ore)")
    nsr_ag: float = Field(..., description="Ag NSR ($/t ore)")

    # NSR at different levels
    nsr_mineral_resources: float = Field(
        ..., description="NSR at Mineral Resources level ($/t ore)"
    )
    nsr_processing: float = Field(..., description="NSR after processing losses ($/t ore)")
    nsr_mine: float = Field(..., description="NSR after mine factors ($/t ore)")
    nsr_per_tonne: float = Field(..., description="Final NSR per tonne ore ($/t ore)")

    # Losses
    dilution_loss: float = Field(..., description="Loss due to dilution ($/t ore)")
    recovery_loss: float = Field(..., description="Loss due to metallurgical recovery ($/t ore)")

    # Ratios and recoveries
    conc_ratio: float = Field(..., description="Concentrate ratio (t conc / t ore)")
    cu_recovery: float = Field(..., description="Cu metallurgical recovery (decimal)")
    au_recovery: float = Field(..., description="Au metallurgical recovery (decimal)")
    ag_recovery: float = Field(..., description="Ag metallurgical recovery (decimal)")

    # Revenue (for given tonnage)
    revenue_total: float = Field(..., description="Total revenue ($)")

    # EBITDA (optional — populated when operational costs are provided)
    ebitda: Optional[EBITDAResult] = Field(default=None, description="EBITDA breakdown")

    # Metadata
    currency: str = Field(default="USD", description="Currency")
    ore_tonnage: float = Field(..., description="Input ore tonnage")
    formula_applied: str = Field(..., description="Reference to formula documentation")
    inputs_used: Dict[str, Any] = Field(..., description="All inputs used in calculation")

    model_config = {
        "json_schema_extra": {
            "example": {
                "conc_price_cu": 2824.68,
                "conc_price_au": 244.76,
                "conc_price_ag": 29.65,
                "conc_price_total": 3099.09,
                "nsr_cu": 108.21,
                "nsr_au": 9.38,
                "nsr_ag": 1.14,
                "nsr_mineral_resources": 175.61,
                "nsr_processing": 131.76,
                "nsr_mine": 148.01,
                "nsr_per_tonne": 118.72,
                "dilution_loss": 27.60,
                "recovery_loss": 16.25,
                "conc_ratio": 0.0383,
                "cu_recovery": 0.9654,
                "au_recovery": 0.90,
                "ag_recovery": 0.90,
                "revenue_total": 2374381.28,
                "ebitda": None,
                "currency": "USD",
                "ore_tonnage": 20000,
                "formula_applied": "See NSR_REQUIREMENTS.md",
                "inputs_used": {},
            }
        }
    }
