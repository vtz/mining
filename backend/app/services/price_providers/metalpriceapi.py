"""
MetalPriceAPI Provider

Fetches real-time metal prices from metalpriceapi.com (COMEX data).
Free tier available with rate limits.
"""

import logging
import time
from typing import Optional

import httpx

from app.config import get_settings
from app.services.price_providers.base import BasePriceProvider, MetalPrices

logger = logging.getLogger(__name__)


class MetalPriceAPIProvider(BasePriceProvider):
    """
    Price provider using metalpriceapi.com.
    
    Provides COMEX futures prices for Cu, Au, Ag.
    Requires free API key from https://metalpriceapi.com/
    """
    
    API_URL = "https://api.metalpriceapi.com/v1/latest"
    CACHE_TTL = 3600  # 1 hour cache
    
    def __init__(self):
        self._cache: Optional[MetalPrices] = None
        self._cache_time: float = 0
        self._settings = get_settings()
    
    @property
    def name(self) -> str:
        return "metalpriceapi"
    
    @property
    def display_name(self) -> str:
        return "COMEX (MetalpriceAPI)"
    
    @property
    def description(self) -> str:
        return (
            "Preços em tempo real do COMEX (CME Group) via MetalpriceAPI. "
            "Dados de futuros atualizados a cada hora. "
            "Requer API key gratuita de metalpriceapi.com"
        )
    
    @property
    def requires_api_key(self) -> bool:
        return True
    
    def is_available(self) -> bool:
        return bool(self._settings.metal_price_api_key)
    
    def _is_cache_valid(self) -> bool:
        if self._cache is None:
            return False
        return (time.time() - self._cache_time) < self.CACHE_TTL
    
    async def fetch_prices(self) -> Optional[MetalPrices]:
        """Fetch prices from MetalpriceAPI."""
        # Check cache first
        if self._is_cache_valid():
            return self._cache
        
        api_key = self._settings.metal_price_api_key
        if not api_key:
            logger.warning("MetalPriceAPI key not configured")
            return None
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.API_URL,
                    params={
                        "api_key": api_key,
                        "base": "USD",
                        "currencies": "XCU,XAU,XAG",
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                if not data.get("success", False):
                    logger.error(f"API error: {data.get('error', 'Unknown')}")
                    return None
                
                rates = data.get("rates", {})
                xau_rate = rates.get("XAU")
                xag_rate = rates.get("XAG")
                xcu_rate = rates.get("XCU")
                
                if not all([xau_rate, xag_rate, xcu_rate]):
                    logger.error("Missing metal rates in response")
                    return None
                
                # Convert rates to prices
                # API returns 1 USD = X metal, so price = 1/rate
                au_price_per_oz = 1.0 / xau_rate
                ag_price_per_oz = 1.0 / xag_rate
                
                # Copper: convert from $/oz to $/lb
                # 1 lb = 14.583 troy oz
                cu_price_per_oz = 1.0 / xcu_rate
                cu_price_per_lb = cu_price_per_oz * 14.583
                
                prices = MetalPrices(
                    cu_price_per_lb=round(cu_price_per_lb, 4),
                    au_price_per_oz=round(au_price_per_oz, 2),
                    ag_price_per_oz=round(ag_price_per_oz, 2),
                    source=self.name,
                    timestamp=time.time(),
                    is_live=True,
                    metadata={
                        "api_timestamp": data.get("timestamp"),
                        "base_currency": "USD",
                    }
                )
                
                # Update cache
                self._cache = prices
                self._cache_time = time.time()
                
                return prices
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error: {e}")
            # Return stale cache if available
            if self._cache:
                logger.info("Returning stale cache")
                return self._cache
            return None
        except Exception as e:
            logger.error(f"Error: {e}")
            return None
