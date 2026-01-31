"""
Metal Price Service

Fetches real-time metal prices from public APIs.
Primary: MetalpriceAPI (metalpriceapi.com)
Fallback: Default values from constants

Prices are cached to avoid excessive API calls.
"""

import logging
import time
from dataclasses import dataclass
from typing import Optional, Dict, Any

import httpx

from app.config import settings
from app.nsr_engine.constants import (
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AG_PRICE_PER_OZ,
    LB_PER_TONNE,
)

logger = logging.getLogger(__name__)


@dataclass
class MetalPrices:
    """Current metal prices with metadata."""
    cu_price_per_lb: float
    au_price_per_oz: float
    ag_price_per_oz: float
    source: str
    timestamp: float
    is_live: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cu_price_per_lb": self.cu_price_per_lb,
            "au_price_per_oz": self.au_price_per_oz,
            "ag_price_per_oz": self.ag_price_per_oz,
            "source": self.source,
            "timestamp": self.timestamp,
            "is_live": self.is_live,
        }


class MetalPriceService:
    """
    Service to fetch and cache metal prices from external APIs.
    
    Supports multiple providers with automatic fallback:
    1. MetalpriceAPI (primary)
    2. Default constants (fallback)
    """
    
    # Cache duration in seconds (1 hour)
    CACHE_TTL = 3600
    
    # API endpoints
    METALPRICEAPI_URL = "https://api.metalpriceapi.com/v1/latest"
    
    def __init__(self):
        self._cache: Optional[MetalPrices] = None
        self._cache_time: float = 0
    
    def _is_cache_valid(self) -> bool:
        """Check if cached prices are still valid."""
        if self._cache is None:
            return False
        return (time.time() - self._cache_time) < self.CACHE_TTL
    
    def _get_default_prices(self) -> MetalPrices:
        """Return default prices from constants."""
        return MetalPrices(
            cu_price_per_lb=DEFAULT_CU_PRICE_PER_LB,
            au_price_per_oz=DEFAULT_AU_PRICE_PER_OZ,
            ag_price_per_oz=DEFAULT_AG_PRICE_PER_OZ,
            source="default",
            timestamp=time.time(),
            is_live=False,
        )
    
    async def _fetch_from_metalpriceapi(self) -> Optional[MetalPrices]:
        """
        Fetch prices from MetalpriceAPI.
        
        API returns prices in USD per troy ounce for precious metals.
        Copper (XCU) is returned in USD per troy ounce, needs conversion to $/lb.
        
        Conversion: 1 troy oz = 31.1035 grams
        Copper: 1 lb = 453.592 grams = 14.583 troy oz
        """
        api_key = settings.metal_price_api_key
        if not api_key:
            logger.warning("METAL_PRICE_API_KEY not configured")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.METALPRICEAPI_URL,
                    params={
                        "api_key": api_key,
                        "base": "USD",
                        "currencies": "XCU,XAU,XAG",
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                if not data.get("success", False):
                    logger.error(f"MetalpriceAPI error: {data.get('error', 'Unknown')}")
                    return None
                
                rates = data.get("rates", {})
                
                # API returns 1 USD = X metal, so we need to invert
                # XAU rate means: 1 USD = 0.000XX oz gold, so price = 1/rate
                xau_rate = rates.get("XAU")
                xag_rate = rates.get("XAG")
                xcu_rate = rates.get("XCU")
                
                if not all([xau_rate, xag_rate, xcu_rate]):
                    logger.error("Missing metal rates in API response")
                    return None
                
                # Convert rates to prices ($/oz or $/lb)
                au_price_per_oz = 1.0 / xau_rate
                ag_price_per_oz = 1.0 / xag_rate
                
                # Copper: API gives $/oz, convert to $/lb
                # 1 troy oz = 31.1035g, 1 lb = 453.592g
                # So 1 lb = 453.592 / 31.1035 = 14.583 troy oz
                cu_price_per_oz = 1.0 / xcu_rate
                cu_price_per_lb = cu_price_per_oz * 14.583
                
                return MetalPrices(
                    cu_price_per_lb=round(cu_price_per_lb, 4),
                    au_price_per_oz=round(au_price_per_oz, 2),
                    ag_price_per_oz=round(ag_price_per_oz, 2),
                    source="metalpriceapi",
                    timestamp=time.time(),
                    is_live=True,
                )
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching prices: {e}")
            return None
        except Exception as e:
            logger.error(f"Error fetching prices: {e}")
            return None
    
    async def get_prices(self, force_refresh: bool = False) -> MetalPrices:
        """
        Get current metal prices.
        
        Uses cached values if available and valid.
        Falls back to defaults if API fails.
        
        Args:
            force_refresh: If True, bypass cache and fetch fresh prices
            
        Returns:
            MetalPrices object with current prices
        """
        # Check cache first
        if not force_refresh and self._is_cache_valid():
            return self._cache
        
        # Try to fetch from API
        prices = await self._fetch_from_metalpriceapi()
        
        if prices:
            self._cache = prices
            self._cache_time = time.time()
            logger.info(f"Updated metal prices from {prices.source}")
            return prices
        
        # Return cached if available, even if expired
        if self._cache:
            logger.warning("Using expired cache due to API failure")
            return self._cache
        
        # Last resort: defaults
        logger.warning("Using default prices (API unavailable)")
        return self._get_default_prices()
    
    def get_prices_sync(self) -> MetalPrices:
        """
        Synchronous version - returns cached or default prices.
        
        For use in synchronous contexts where async is not available.
        """
        if self._is_cache_valid():
            return self._cache
        return self._get_default_prices()


# Singleton instance
_service = MetalPriceService()


async def get_metal_prices(force_refresh: bool = False) -> MetalPrices:
    """Get current metal prices (convenience function)."""
    return await _service.get_prices(force_refresh)


def get_metal_prices_sync() -> MetalPrices:
    """Get cached or default metal prices synchronously."""
    return _service.get_prices_sync()
