"""Metal prices API endpoints."""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.metal_prices import get_metal_prices, get_service

router = APIRouter(prefix="/prices", tags=["prices"])


class ManualPriceInput(BaseModel):
    """Input for setting manual prices."""
    cu_price: float = Field(..., gt=0, description="Copper price ($/lb)")
    au_price: float = Field(..., gt=0, description="Gold price ($/oz)")
    ag_price: float = Field(..., gt=0, description="Silver price ($/oz)")
    note: str = Field(default="", description="Optional note about price source")


@router.get("")
async def get_current_prices(
    provider: Optional[str] = None,
    refresh: bool = False
):
    """
    Get current metal prices.
    
    Query params:
        provider: Specific provider name (optional, uses default if not specified)
        refresh: Force refresh from API (bypass cache)
    
    Returns:
        Metal prices with source metadata
    """
    prices = await get_metal_prices(provider=provider, force_refresh=refresh)
    
    if not prices:
        raise HTTPException(
            status_code=503,
            detail="Unable to fetch prices from any provider"
        )
    
    return {
        "prices": {
            "cu": {
                "value": prices.cu_price_per_lb,
                "unit": "$/lb",
                "name": "Copper",
            },
            "au": {
                "value": prices.au_price_per_oz,
                "unit": "$/oz",
                "name": "Gold",
            },
            "ag": {
                "value": prices.ag_price_per_oz,
                "unit": "$/oz",
                "name": "Silver",
            },
        },
        "metadata": {
            "source": prices.source,
            "timestamp": prices.timestamp,
            "is_live": prices.is_live,
            "extra": prices.metadata,
        }
    }


@router.get("/providers")
async def list_providers():
    """
    List all available price providers.
    
    Returns information about each registered provider including:
    - name: Unique identifier
    - display_name: Human-readable name
    - description: Provider description
    - requires_api_key: Whether API key is needed
    - is_available: Whether provider can currently fetch prices
    - is_default: Whether this is the default provider
    """
    service = get_service()
    providers = service.list_providers()
    return {
        "providers": providers,
        "count": len(providers),
    }


@router.post("/manual")
async def set_manual_prices(input: ManualPriceInput):
    """
    Set manual prices.
    
    Allows setting custom prices that can be used instead of live data.
    Useful for:
    - Testing specific price scenarios
    - Using internal price forecasts
    - Offline operation
    
    The manual provider must be selected to use these prices.
    """
    service = get_service()
    prices = service.set_manual_prices(
        cu_price=input.cu_price,
        au_price=input.au_price,
        ag_price=input.ag_price,
        note=input.note,
    )
    return {
        "message": "Manual prices set successfully",
        "prices": {
            "cu": prices.cu_price_per_lb,
            "au": prices.au_price_per_oz,
            "ag": prices.ag_price_per_oz,
        },
        "source": "manual",
    }


@router.delete("/manual")
async def clear_manual_prices():
    """
    Clear manual prices.
    
    Removes any manually set prices.
    """
    service = get_service()
    service.clear_manual_prices()
    return {"message": "Manual prices cleared"}


@router.post("/providers/{provider_name}/default")
async def set_default_provider(provider_name: str):
    """
    Set the default price provider.
    
    The default provider is used when no specific provider is requested.
    """
    service = get_service()
    success = service.set_default_provider(provider_name)
    
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Provider '{provider_name}' not found"
        )
    
    return {
        "message": f"Default provider set to '{provider_name}'",
        "provider": provider_name,
    }
