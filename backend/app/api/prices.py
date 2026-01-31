"""Metal prices API endpoints."""

from fastapi import APIRouter

from app.services.metal_prices import get_metal_prices, MetalPrices

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("", response_model=dict)
async def get_current_prices(refresh: bool = False):
    """
    Get current metal prices.
    
    Fetches real-time prices from external API (cached for 1 hour).
    Falls back to default values if API is unavailable.
    
    Query params:
        refresh: Force refresh from API (bypass cache)
    
    Returns:
        Metal prices with source metadata
    """
    prices = await get_metal_prices(force_refresh=refresh)
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
        }
    }
