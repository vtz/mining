"""
Price Providers Plugin Architecture

This module provides a pluggable system for metal price sources.
New providers can be added by implementing the BasePriceProvider interface.
"""

from app.services.price_providers.base import BasePriceProvider, MetalPrices
from app.services.price_providers.registry import PriceProviderRegistry, get_registry
from app.services.price_providers.metalpriceapi import MetalPriceAPIProvider
from app.services.price_providers.manual import ManualPriceProvider
from app.services.price_providers.default import DefaultPriceProvider

__all__ = [
    "BasePriceProvider",
    "MetalPrices",
    "PriceProviderRegistry",
    "get_registry",
    "MetalPriceAPIProvider",
    "ManualPriceProvider",
    "DefaultPriceProvider",
]
