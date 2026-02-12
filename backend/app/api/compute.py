"""NSR computation endpoints."""

from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.models import NSRInput, NSRResult
from app.nsr_engine.goal_seek import (
    goal_seek,
    GoalSeekResult,
    GoalSeekError,
    GOAL_SEEK_VARIABLES,
)
from app.services.metal_prices import get_metal_prices

router = APIRouter()


class ScenarioResult(BaseModel):
    """Result for a single scenario."""
    name: str
    variation: float
    cu_price: float
    au_price: float
    ag_price: float
    result: NSRResult


class ScenariosResponse(BaseModel):
    """Response containing multiple scenarios."""
    base: NSRResult
    scenarios: List[ScenarioResult]


class ComputeNSRRequest(BaseModel):
    """Request body for NSR computation."""

    # Mine/Area selection
    mine: str = Field(..., description="Mine name (e.g., 'Vermelhos UG')")
    area: str = Field(..., description="Area within mine (e.g., 'Vermelhos Sul')")

    # Head grades
    cu_grade: float = Field(..., ge=0, le=100, description="Copper grade (%)")
    au_grade: float = Field(..., ge=0, description="Gold grade (g/t)")
    ag_grade: float = Field(..., ge=0, description="Silver grade (g/t)")

    # Ore parameters
    ore_tonnage: float = Field(default=1000, gt=0, description="Ore tonnage (tonnes)")
    mine_dilution: float = Field(
        default=0.14, ge=0, le=1, description="Mine dilution (decimal)"
    )
    ore_recovery: float = Field(
        default=0.98, ge=0, le=1, description="Ore recovery (decimal)"
    )

    # Price deck (optional - uses defaults if not provided)
    cu_price: Optional[float] = Field(
        default=None, description="Copper price ($/lb) - uses default if not provided"
    )
    au_price: Optional[float] = Field(
        default=None, description="Gold price ($/oz) - uses default if not provided"
    )
    ag_price: Optional[float] = Field(
        default=None, description="Silver price ($/oz) - uses default if not provided"
    )

    # Commercial terms (optional - uses defaults if not provided)
    cu_payability: Optional[float] = Field(
        default=None, ge=0, le=1, description="Cu payability (decimal)"
    )
    cu_tc: Optional[float] = Field(default=None, ge=0, description="Treatment charge ($/dmt)")
    cu_rc: Optional[float] = Field(default=None, ge=0, description="Refining charge Cu ($/lb)")
    cu_freight: Optional[float] = Field(default=None, ge=0, description="Freight ($/dmt)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "mine": "Vermelhos UG",
                "area": "Vermelhos Sul",
                "cu_grade": 1.4,
                "au_grade": 0.23,
                "ag_grade": 2.33,
                "ore_tonnage": 20000,
                "mine_dilution": 0.14,
                "ore_recovery": 0.98,
            }
        }
    }


@router.post("/compute/nsr", response_model=NSRResult)
async def compute_nsr(request: ComputeNSRRequest) -> NSRResult:
    """
    Compute NSR (Net Smelter Return) for given inputs.

    This is a stateless computation endpoint that calculates NSR
    based on the provided ore grades, mine parameters, and commercial terms.

    If metal prices are not provided, fetches real-time prices from COMEX.

    Returns a detailed breakdown including:
    - Concentrate price by metal
    - NSR by metal ($/t ore)
    - NSR at different levels (Mineral Resources, Processing, Mine)
    - Loss breakdown (dilution, recovery)
    """
    try:
        # Fetch live prices if not provided
        cu_price = request.cu_price
        au_price = request.au_price
        ag_price = request.ag_price

        if cu_price is None or au_price is None or ag_price is None:
            live_prices = await get_metal_prices()
            if cu_price is None:
                cu_price = live_prices.cu_price_per_lb
            if au_price is None:
                au_price = live_prices.au_price_per_oz
            if ag_price is None:
                ag_price = live_prices.ag_price_per_oz

        # Convert request to NSRInput
        nsr_input = NSRInput(
            mine=request.mine,
            area=request.area,
            cu_grade=request.cu_grade,
            au_grade=request.au_grade,
            ag_grade=request.ag_grade,
            ore_tonnage=request.ore_tonnage,
            mine_dilution=request.mine_dilution,
            ore_recovery=request.ore_recovery,
            cu_price=cu_price,
            au_price=au_price,
            ag_price=ag_price,
            cu_payability=request.cu_payability,
            cu_tc=request.cu_tc,
            cu_rc=request.cu_rc,
            cu_freight=request.cu_freight,
        )

        # Compute NSR
        result = compute_nsr_complete(nsr_input)
        return result

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Computation error: {str(e)}")


@router.post("/compute/scenarios", response_model=ScenariosResponse)
async def compute_scenarios(
    request: ComputeNSRRequest,
    variation: float = 10.0
) -> ScenariosResponse:
    """
    Compute NSR scenarios with price variations.
    
    Generates three scenarios:
    - Downside: prices reduced by variation %
    - Base: current prices
    - Upside: prices increased by variation %
    
    Args:
        request: Base NSR computation parameters
        variation: Percentage variation for downside/upside (default 10%)
    
    Returns:
        Base result and list of scenario results
    """
    try:
        # Fetch live prices if not provided
        cu_price = request.cu_price
        au_price = request.au_price
        ag_price = request.ag_price

        if cu_price is None or au_price is None or ag_price is None:
            live_prices = await get_metal_prices()
            if cu_price is None:
                cu_price = live_prices.cu_price_per_lb
            if au_price is None:
                au_price = live_prices.au_price_per_oz
            if ag_price is None:
                ag_price = live_prices.ag_price_per_oz

        # Calculate base case
        base_input = NSRInput(
            mine=request.mine,
            area=request.area,
            cu_grade=request.cu_grade,
            au_grade=request.au_grade,
            ag_grade=request.ag_grade,
            ore_tonnage=request.ore_tonnage,
            mine_dilution=request.mine_dilution,
            ore_recovery=request.ore_recovery,
            cu_price=cu_price,
            au_price=au_price,
            ag_price=ag_price,
            cu_payability=request.cu_payability,
            cu_tc=request.cu_tc,
            cu_rc=request.cu_rc,
            cu_freight=request.cu_freight,
        )
        base_result = compute_nsr_complete(base_input)

        # Define scenarios
        scenario_configs = [
            ("Downside", -variation),
            ("Base", 0.0),
            ("Upside", variation),
        ]

        scenarios = []
        for name, var in scenario_configs:
            factor = 1 + (var / 100)
            
            scenario_input = NSRInput(
                mine=request.mine,
                area=request.area,
                cu_grade=request.cu_grade,
                au_grade=request.au_grade,
                ag_grade=request.ag_grade,
                ore_tonnage=request.ore_tonnage,
                mine_dilution=request.mine_dilution,
                ore_recovery=request.ore_recovery,
                cu_price=cu_price * factor,
                au_price=au_price * factor,
                ag_price=ag_price * factor,
                cu_payability=request.cu_payability,
                cu_tc=request.cu_tc,
                cu_rc=request.cu_rc,
                cu_freight=request.cu_freight,
            )
            
            result = compute_nsr_complete(scenario_input)
            
            scenarios.append(ScenarioResult(
                name=name,
                variation=var,
                cu_price=cu_price * factor,
                au_price=au_price * factor,
                ag_price=ag_price * factor,
                result=result,
            ))

        return ScenariosResponse(
            base=base_result,
            scenarios=scenarios,
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Computation error: {str(e)}")


# ──────────────────────────────────────────────────────────
# Goal Seek
# ──────────────────────────────────────────────────────────


class GoalSeekRequest(BaseModel):
    """Request body for Goal Seek computation."""

    # Base NSR parameters (same as ComputeNSRRequest)
    mine: str = Field(..., description="Mine name")
    area: str = Field(..., description="Area within mine")
    cu_grade: float = Field(..., ge=0, le=100, description="Copper grade (%)")
    au_grade: float = Field(..., ge=0, description="Gold grade (g/t)")
    ag_grade: float = Field(..., ge=0, description="Silver grade (g/t)")
    ore_tonnage: float = Field(default=1000, gt=0, description="Ore tonnage (tonnes)")
    mine_dilution: float = Field(default=0.14, ge=0, le=1, description="Mine dilution")
    ore_recovery: float = Field(default=0.98, ge=0, le=1, description="Ore recovery")
    cu_price: Optional[float] = Field(default=None, description="Cu price ($/lb)")
    au_price: Optional[float] = Field(default=None, description="Au price ($/oz)")
    ag_price: Optional[float] = Field(default=None, description="Ag price ($/oz)")
    cu_payability: Optional[float] = Field(default=None, description="Cu payability")
    cu_tc: Optional[float] = Field(default=None, description="Treatment charge ($/dmt)")
    cu_rc: Optional[float] = Field(default=None, description="Refining charge Cu ($/lb)")
    cu_freight: Optional[float] = Field(default=None, description="Freight ($/dmt)")

    # Goal Seek specific
    target_variable: str = Field(
        ..., description="Variable to solve for (e.g., 'cu_price', 'cu_tc')"
    )
    target_nsr: float = Field(
        default=0.0, description="Target NSR value in $/t (default 0 = break-even)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "mine": "Vermelhos UG",
                "area": "Vermelhos Sul",
                "cu_grade": 0.8,
                "au_grade": 0.15,
                "ag_grade": 1.5,
                "target_variable": "cu_price",
                "target_nsr": 50.0,
            }
        }
    }


class GoalSeekResponse(BaseModel):
    """Response for Goal Seek computation."""

    target_variable: str
    target_variable_unit: str
    target_nsr: float
    threshold_value: float
    current_value: float
    current_nsr: float
    delta_percent: float
    is_currently_viable: bool
    converged: bool
    iterations: int
    tolerance_achieved: float
    bound_hit: str = ""  # "lower", "upper", or "" — when no exact solution in range


class GoalSeekVariablesResponse(BaseModel):
    """Available variables for Goal Seek."""

    variables: List[dict]


@router.get("/compute/goal-seek/variables", response_model=GoalSeekVariablesResponse)
async def list_goal_seek_variables() -> GoalSeekVariablesResponse:
    """List all variables available for Goal Seek."""
    variables = []
    for name, (direction, lower, upper, unit) in GOAL_SEEK_VARIABLES.items():
        variables.append(
            {
                "name": name,
                "direction": direction,
                "unit": unit,
                "lower_bound": lower,
                "upper_bound": upper,
            }
        )
    return GoalSeekVariablesResponse(variables=variables)


@router.post("/compute/goal-seek", response_model=GoalSeekResponse)
async def compute_goal_seek(request: GoalSeekRequest) -> GoalSeekResponse:
    """
    Goal Seek: find the value of a variable that yields a target NSR.

    Like Excel's Goal Seek, but for NSR calculations. Finds the minimum
    metal price (or maximum cost) needed for viability.

    Example: "What Cu price do I need for NSR = $50/t?"
    """
    try:
        # Fetch live prices if not provided
        cu_price = request.cu_price
        au_price = request.au_price
        ag_price = request.ag_price

        if cu_price is None or au_price is None or ag_price is None:
            live_prices = await get_metal_prices()
            if cu_price is None:
                cu_price = live_prices.cu_price_per_lb
            if au_price is None:
                au_price = live_prices.au_price_per_oz
            if ag_price is None:
                ag_price = live_prices.ag_price_per_oz

        nsr_input = NSRInput(
            mine=request.mine,
            area=request.area,
            cu_grade=request.cu_grade,
            au_grade=request.au_grade,
            ag_grade=request.ag_grade,
            ore_tonnage=request.ore_tonnage,
            mine_dilution=request.mine_dilution,
            ore_recovery=request.ore_recovery,
            cu_price=cu_price,
            au_price=au_price,
            ag_price=ag_price,
            cu_payability=request.cu_payability,
            cu_tc=request.cu_tc,
            cu_rc=request.cu_rc,
            cu_freight=request.cu_freight,
        )

        result = goal_seek(
            base_input=nsr_input,
            target_variable=request.target_variable,
            target_nsr=request.target_nsr,
        )

        return GoalSeekResponse(
            target_variable=result.target_variable,
            target_variable_unit=result.target_variable_unit,
            target_nsr=result.target_nsr,
            threshold_value=result.threshold_value,
            current_value=result.current_value,
            current_nsr=result.current_nsr,
            delta_percent=result.delta_percent,
            is_currently_viable=result.is_currently_viable,
            converged=result.converged,
            iterations=result.iterations,
            tolerance_achieved=result.tolerance_achieved,
            bound_hit=result.bound_hit,
        )

    except GoalSeekError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Goal Seek error: {str(e)}")
