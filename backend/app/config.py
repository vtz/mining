"""Application configuration."""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Application
    app_name: str = "NSR Calculator"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./nsr.db"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Metal Price API (get free key at metalpriceapi.com)
    metal_price_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
