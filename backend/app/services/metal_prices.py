"""
Metal Price Service

Unified interface for the price provider system.
Uses the plugin architecture from price_providers module.
"""

import logging
from typing import Optional, List, Dict, Any

from app.services.price_providers import (
    get_registry,
    MetalPrices,
    ManualPriceProvider,
)

logger = logging.getLogger(__name__)


class MetalPriceService:
    """
    High-level service for metal price management.
    
    Wraps the provider registry with a simpler interface.
    """
    
    def __init__(self):
        self._registry = get_registry()
    
    async def get_prices(
        self, 
        provider: Optional[str] = None,
        force_refresh: bool = False
    ) -> Optional[MetalPrices]:
        """
        Get metal prices from a provider.
        
        Args:
            provider: Specific provider name, or None for default
            force_refresh: Currently unused (providers manage their own cache)
            
        Returns:
            MetalPrices or None if all providers fail
        """
        return await self._registry.get_prices(provider)
    
    def list_providers(self) -> List[Dict[str, Any]]:
        """List all available price providers."""
        return self._registry.list_providers()
    
    def set_manual_prices(
        self,
        cu_price: float,
        au_price: float,
        ag_price: float,
        note: str = ""
    ) -> MetalPrices:
        """
        Set manual prices.
        
        Args:
            cu_price: Copper price ($/lb)
            au_price: Gold price ($/oz)
            ag_price: Silver price ($/oz)
            note: Optional note
            
        Returns:
            The stored prices
        """
        return ManualPriceProvider.set_prices(
            cu_price_per_lb=cu_price,
            au_price_per_oz=au_price,
            ag_price_per_oz=ag_price,
            note=note
        )
    
    def clear_manual_prices(self) -> None:
        """Clear manual prices."""
        ManualPriceProvider.clear_prices()
    
    def set_default_provider(self, provider_name: str) -> bool:
        """Set the default provider."""
        return self._registry.set_default(provider_name)


# Singleton instance
_service: Optional[MetalPriceService] = None


def get_service() -> MetalPriceService:
    """Get singleton service instance."""
    global _service
    if _service is None:
        _service = MetalPriceService()
    return _service


async def get_metal_prices(
    provider: Optional[str] = None,
    force_refresh: bool = False
) -> Optional[MetalPrices]:
    """Get current metal prices (convenience function)."""
    service = get_service()
    return await service.get_prices(provider, force_refresh)


def get_metal_prices_sync() -> Optional[MetalPrices]:
    """Get cached or default metal prices synchronously."""
    # For sync access, use the default provider's sync method if available
    from app.services.price_providers.default import DefaultPriceProvider
    import asyncio
    
    provider = DefaultPriceProvider()
    # Create a simple sync wrapper
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(provider.fetch_prices())
    finally:
        loop.close()
