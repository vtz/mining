"""
Base classes for price providers.

To create a new price provider:
1. Inherit from BasePriceProvider
2. Implement the abstract methods
3. Register in the PriceProviderRegistry
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
import time


@dataclass
class MetalPrices:
    """
    Container for metal prices with metadata.
    
    Attributes:
        cu_price_per_lb: Copper price in USD per pound
        au_price_per_oz: Gold price in USD per troy ounce
        ag_price_per_oz: Silver price in USD per troy ounce
        source: Identifier of the price source/provider
        timestamp: Unix timestamp when prices were fetched
        is_live: Whether prices are from a live source
        metadata: Additional provider-specific data
    """
    cu_price_per_lb: float
    au_price_per_oz: float
    ag_price_per_oz: float
    source: str
    timestamp: float = field(default_factory=time.time)
    is_live: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "cu_price_per_lb": self.cu_price_per_lb,
            "au_price_per_oz": self.au_price_per_oz,
            "ag_price_per_oz": self.ag_price_per_oz,
            "source": self.source,
            "timestamp": self.timestamp,
            "is_live": self.is_live,
            "metadata": self.metadata,
        }


class BasePriceProvider(ABC):
    """
    Abstract base class for metal price providers.
    
    All price providers must implement this interface.
    
    Example implementation:
    
        class MyCustomProvider(BasePriceProvider):
            @property
            def name(self) -> str:
                return "my_custom_provider"
            
            @property
            def display_name(self) -> str:
                return "My Custom Price Source"
            
            @property
            def description(self) -> str:
                return "Fetches prices from my custom API"
            
            @property
            def requires_api_key(self) -> bool:
                return True
            
            async def fetch_prices(self) -> Optional[MetalPrices]:
                # Your implementation here
                pass
            
            def is_available(self) -> bool:
                return self.api_key is not None
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """
        Unique identifier for this provider.
        Used for configuration and API endpoints.
        Example: "metalpriceapi", "lme", "manual"
        """
        pass
    
    @property
    @abstractmethod
    def display_name(self) -> str:
        """
        Human-readable name for UI display.
        Example: "COMEX via MetalpriceAPI"
        """
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """
        Description of the price source.
        Shown in UI to help users understand the source.
        """
        pass
    
    @property
    @abstractmethod
    def requires_api_key(self) -> bool:
        """Whether this provider requires an API key to function."""
        pass
    
    @abstractmethod
    async def fetch_prices(self) -> Optional[MetalPrices]:
        """
        Fetch current metal prices from this source.
        
        Returns:
            MetalPrices object with current prices, or None if fetch fails
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if this provider is currently available.
        
        Returns:
            True if provider can fetch prices, False otherwise
        """
        pass
    
    def get_config_schema(self) -> Dict[str, Any]:
        """
        Return JSON schema for provider configuration.
        Override to add custom configuration options.
        
        Returns:
            JSON Schema dict for configuration validation
        """
        return {}
