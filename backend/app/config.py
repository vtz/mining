"""Application configuration."""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    # Application
    app_name: str = "NSR Calculator"
    app_version: str = "0.2.0"
    debug: bool = False

    # Database (Railway uses DATABASE_URL)
    database_url: str = "postgresql://postgres:postgres@localhost:5432/nsr"
    
    @field_validator("database_url", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Convert postgres:// to postgresql:// for SQLAlchemy compatibility."""
        if not v:
            return v
        # Fix postgres:// to postgresql://
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql://", 1)
        # Remove sslmode parameter if present (asyncpg doesn't support it in URL)
        if "sslmode=" in v:
            import re
            v = re.sub(r'[?&]sslmode=[^&]*', '', v)
            # Clean up double && or trailing ?
            v = v.replace('&&', '&').rstrip('?').rstrip('&')
        return v

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    
    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Google OAuth2
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/auth/callback/google"

    # Metal Price API (get free key at metalpriceapi.com)
    metal_price_api_key: str = ""

    # Resend (email alerts)
    resend_api_key: str = ""
    alert_from_email: str = "alerts@nsr-calculator.com"
    
    # Initial admin (created on first run)
    initial_admin_email: Optional[str] = None


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
