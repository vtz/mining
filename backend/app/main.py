"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api import health, compute, prices, export
from app.api.regions import router as regions_router
from app.api.mines import router as mines_router
from app.api.users import router as users_router
from app.api.goal_seek_scenarios import router as goal_seek_router
from app.api.blocks import router as blocks_router
from app.api.features import router as features_router
from app.api.errors import setup_error_handlers
from app.auth.router import router as auth_router
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import setup_rate_limiting

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start/stop background services."""
    # Startup
    try:
        from app.services.alert_checker import start_scheduler, stop_scheduler

        start_scheduler()
    except Exception as e:
        logger.warning(f"Failed to start alert scheduler: {e}")

    yield

    # Shutdown
    try:
        from app.services.alert_checker import stop_scheduler

        stop_scheduler()
    except Exception:
        pass


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="NSR (Net Smelter Return) Calculator API for mining operations",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Setup error handlers
setup_error_handlers(app)

# Setup rate limiting
setup_rate_limiting(app)

# Security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth_router, tags=["Auth"])
app.include_router(compute.router, prefix="/api/v1", tags=["Compute"])
app.include_router(prices.router, prefix="/api/v1", tags=["Prices"])
app.include_router(export.router, prefix="/api/v1", tags=["Export"])
app.include_router(regions_router, prefix="/api/v1", tags=["Regions"])
app.include_router(mines_router, prefix="/api/v1", tags=["Mines"])
app.include_router(users_router, prefix="/api/v1", tags=["Users"])
app.include_router(goal_seek_router, prefix="/api/v1", tags=["Goal Seek"])
app.include_router(blocks_router, prefix="/api/v1", tags=["Blocks"])
app.include_router(features_router, prefix="/api/v1", tags=["Features"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
    }
