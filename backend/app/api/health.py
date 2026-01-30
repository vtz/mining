"""Health check endpoints."""

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "version": settings.app_version,
    }
