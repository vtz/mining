"""
Manual Price Provider

Allows users to set prices manually via API or configuration.
Prices are stored in memory and persist until restart.
"""

import logging
import time
from typing import Optional, Dict, Any

from app.services.price_providers.base import BasePriceProvider, MetalPrices

logger = logging.getLogger(__name__)


class ManualPriceProvider(BasePriceProvider):
    """
    Manual price entry provider.
    
    Allows users to set custom prices that override external sources.
    Useful for:
    - Testing with specific price scenarios
    - Using internal/proprietary price forecasts
    - Offline operation
    """
    
    # Class-level storage (persists across instances)
    _stored_prices: Optional[MetalPrices] = None
    
    def __init__(self):
        pass
    
    @property
    def name(self) -> str:
        return "manual"
    
    @property
    def display_name(self) -> str:
        return "Preços Manuais"
    
    @property
    def description(self) -> str:
        return (
            "Permite inserir preços manualmente. "
            "Útil para cenários de teste ou previsões internas. "
            "Os valores persistem até reiniciar o servidor."
        )
    
    @property
    def requires_api_key(self) -> bool:
        return False
    
    def is_available(self) -> bool:
        return ManualPriceProvider._stored_prices is not None
    
    async def fetch_prices(self) -> Optional[MetalPrices]:
        """Return stored manual prices."""
        return ManualPriceProvider._stored_prices
    
    @classmethod
    def set_prices(
        cls,
        cu_price_per_lb: float,
        au_price_per_oz: float,
        ag_price_per_oz: float,
        note: str = ""
    ) -> MetalPrices:
        """
        Set manual prices.
        
        Args:
            cu_price_per_lb: Copper price ($/lb)
            au_price_per_oz: Gold price ($/oz)
            ag_price_per_oz: Silver price ($/oz)
            note: Optional note about price source/reason
            
        Returns:
            The stored MetalPrices object
        """
        prices = MetalPrices(
            cu_price_per_lb=cu_price_per_lb,
            au_price_per_oz=au_price_per_oz,
            ag_price_per_oz=ag_price_per_oz,
            source="manual",
            timestamp=time.time(),
            is_live=False,
            metadata={"note": note} if note else {}
        )
        cls._stored_prices = prices
        logger.info(f"Manual prices set: Cu=${cu_price_per_lb}/lb, Au=${au_price_per_oz}/oz, Ag=${ag_price_per_oz}/oz")
        return prices
    
    @classmethod
    def clear_prices(cls) -> None:
        """Clear stored manual prices."""
        cls._stored_prices = None
        logger.info("Manual prices cleared")
    
    @classmethod
    def get_stored_prices(cls) -> Optional[MetalPrices]:
        """Get currently stored prices without async."""
        return cls._stored_prices
    
    def get_config_schema(self) -> Dict[str, Any]:
        """Return configuration schema for manual prices."""
        return {
            "type": "object",
            "properties": {
                "cu_price_per_lb": {
                    "type": "number",
                    "description": "Copper price ($/lb)",
                    "minimum": 0,
                },
                "au_price_per_oz": {
                    "type": "number",
                    "description": "Gold price ($/oz)",
                    "minimum": 0,
                },
                "ag_price_per_oz": {
                    "type": "number",
                    "description": "Silver price ($/oz)",
                    "minimum": 0,
                },
                "note": {
                    "type": "string",
                    "description": "Optional note about price source",
                },
            },
            "required": ["cu_price_per_lb", "au_price_per_oz", "ag_price_per_oz"],
        }
