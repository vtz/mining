"""
Price Provider Registry

Central registry for managing price providers.
Supports dynamic registration and provider selection.
"""

import logging
from typing import Dict, List, Optional, Type
from functools import lru_cache

from app.services.price_providers.base import BasePriceProvider, MetalPrices

logger = logging.getLogger(__name__)


class PriceProviderRegistry:
    """
    Registry for price providers.
    
    Manages registration, selection, and fallback of price providers.
    
    Usage:
        registry = PriceProviderRegistry()
        registry.register(MetalPriceAPIProvider())
        registry.register(ManualPriceProvider())
        
        prices = await registry.get_prices("metalpriceapi")
    """
    
    def __init__(self):
        self._providers: Dict[str, BasePriceProvider] = {}
        self._default_provider: Optional[str] = None
        self._fallback_order: List[str] = []
    
    def register(
        self, 
        provider: BasePriceProvider, 
        set_as_default: bool = False
    ) -> None:
        """
        Register a price provider.
        
        Args:
            provider: Provider instance to register
            set_as_default: If True, set as the default provider
        """
        name = provider.name
        self._providers[name] = provider
        
        if set_as_default or self._default_provider is None:
            self._default_provider = name
        
        # Add to fallback order
        if name not in self._fallback_order:
            self._fallback_order.append(name)
        
        logger.info(f"Registered price provider: {name} ({provider.display_name})")
    
    def unregister(self, name: str) -> bool:
        """
        Unregister a provider.
        
        Args:
            name: Provider name to remove
            
        Returns:
            True if removed, False if not found
        """
        if name in self._providers:
            del self._providers[name]
            if name in self._fallback_order:
                self._fallback_order.remove(name)
            if self._default_provider == name:
                self._default_provider = self._fallback_order[0] if self._fallback_order else None
            return True
        return False
    
    def get_provider(self, name: str) -> Optional[BasePriceProvider]:
        """Get a specific provider by name."""
        return self._providers.get(name)
    
    def list_providers(self) -> List[Dict]:
        """
        List all registered providers with their info.
        
        Returns:
            List of provider info dicts
        """
        return [
            {
                "name": p.name,
                "display_name": p.display_name,
                "description": p.description,
                "requires_api_key": p.requires_api_key,
                "is_available": p.is_available(),
                "is_default": p.name == self._default_provider,
            }
            for p in self._providers.values()
        ]
    
    def set_default(self, name: str) -> bool:
        """
        Set the default provider.
        
        Args:
            name: Provider name to set as default
            
        Returns:
            True if successful, False if provider not found
        """
        if name in self._providers:
            self._default_provider = name
            return True
        return False
    
    def set_fallback_order(self, order: List[str]) -> None:
        """
        Set the fallback order for providers.
        
        Args:
            order: List of provider names in priority order
        """
        self._fallback_order = [n for n in order if n in self._providers]
    
    async def get_prices(
        self, 
        provider_name: Optional[str] = None,
        use_fallback: bool = True
    ) -> Optional[MetalPrices]:
        """
        Get prices from a specific provider or with fallback.
        
        Args:
            provider_name: Specific provider to use (None for default)
            use_fallback: If True, try other providers on failure
            
        Returns:
            MetalPrices object or None if all providers fail
        """
        # Determine which providers to try
        if provider_name:
            providers_to_try = [provider_name]
            if use_fallback:
                providers_to_try.extend(
                    [n for n in self._fallback_order if n != provider_name]
                )
        else:
            providers_to_try = (
                [self._default_provider] if self._default_provider else []
            ) + [n for n in self._fallback_order if n != self._default_provider]
        
        # Try each provider
        for name in providers_to_try:
            provider = self._providers.get(name)
            if not provider:
                continue
            
            if not provider.is_available():
                logger.debug(f"Provider {name} not available, skipping")
                continue
            
            try:
                prices = await provider.fetch_prices()
                if prices:
                    logger.info(f"Got prices from {name}")
                    return prices
            except Exception as e:
                logger.warning(f"Provider {name} failed: {e}")
                continue
        
        logger.error("All price providers failed")
        return None


# Singleton registry instance
_registry: Optional[PriceProviderRegistry] = None


def get_registry() -> PriceProviderRegistry:
    """Get the singleton registry instance."""
    global _registry
    if _registry is None:
        _registry = PriceProviderRegistry()
        _initialize_default_providers(_registry)
    return _registry


def _initialize_default_providers(registry: PriceProviderRegistry) -> None:
    """Initialize the registry with default providers."""
    # Import here to avoid circular imports
    from app.services.price_providers.metalpriceapi import MetalPriceAPIProvider
    from app.services.price_providers.manual import ManualPriceProvider
    from app.services.price_providers.default import DefaultPriceProvider
    
    # Register providers in priority order
    registry.register(MetalPriceAPIProvider(), set_as_default=True)
    registry.register(ManualPriceProvider())
    registry.register(DefaultPriceProvider())
    
    # Set fallback order
    registry.set_fallback_order(["metalpriceapi", "manual", "default"])
