"""
Default Price Provider

Provides hardcoded default prices as a last-resort fallback.
These are based on COMEX prices from a specific date.
"""

import time
from typing import Optional

from app.services.price_providers.base import BasePriceProvider, MetalPrices
from app.nsr_engine.constants import (
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AG_PRICE_PER_OZ,
)


class DefaultPriceProvider(BasePriceProvider):
    """
    Default/fallback price provider.
    
    Returns hardcoded prices from constants.
    Always available as a last resort.
    """
    
    @property
    def name(self) -> str:
        return "default"
    
    @property
    def display_name(self) -> str:
        return "Valores Padrão"
    
    @property
    def description(self) -> str:
        return (
            "Preços padrão baseados em cotações COMEX de Janeiro/2026. "
            "Usado como fallback quando outras fontes não estão disponíveis. "
            "Para preços atualizados, configure uma fonte em tempo real."
        )
    
    @property
    def requires_api_key(self) -> bool:
        return False
    
    def is_available(self) -> bool:
        return True  # Always available
    
    async def fetch_prices(self) -> Optional[MetalPrices]:
        """Return default prices from constants."""
        return MetalPrices(
            cu_price_per_lb=DEFAULT_CU_PRICE_PER_LB,
            au_price_per_oz=DEFAULT_AU_PRICE_PER_OZ,
            ag_price_per_oz=DEFAULT_AG_PRICE_PER_OZ,
            source=self.name,
            timestamp=time.time(),
            is_live=False,
            metadata={
                "reference_date": "2026-01-29",
                "reference_source": "COMEX",
            }
        )
