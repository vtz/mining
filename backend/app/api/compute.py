"""NSR computation endpoints."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.models import NSRInput, NSRResult

router = APIRouter()


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

    class Config:
        json_schema_extra = {
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


@router.post("/compute/nsr", response_model=NSRResult)
async def compute_nsr(request: ComputeNSRRequest) -> NSRResult:
    """
    Compute NSR (Net Smelter Return) for given inputs.

    This is a stateless computation endpoint that calculates NSR
    based on the provided ore grades, mine parameters, and commercial terms.

    Returns a detailed breakdown including:
    - Concentrate price by metal
    - NSR by metal ($/t ore)
    - NSR at different levels (Mineral Resources, Processing, Mine)
    - Loss breakdown (dilution, recovery)
    """
    try:
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
            cu_price=request.cu_price,
            au_price=request.au_price,
            ag_price=request.ag_price,
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
