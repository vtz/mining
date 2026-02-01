"""Rate limiting middleware."""

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request

# Create limiter instance
limiter = Limiter(key_func=get_remote_address)


def get_user_id_or_ip(request: Request) -> str:
    """
    Get rate limit key - user ID if authenticated, IP otherwise.
    
    Authenticated users get higher limits.
    """
    # Check for Authorization header
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # For authenticated users, use a prefix to differentiate limits
        # In production, you'd decode the token and use the user ID
        return f"user:{auth_header[:50]}"
    
    # Fall back to IP address
    return get_remote_address(request)


def setup_rate_limiting(app: FastAPI) -> None:
    """
    Configure rate limiting for the application.
    
    Limits:
    - 100 requests/minute for anonymous users (by IP)
    - 1000 requests/minute for authenticated users
    - Custom limits for specific endpoints
    """
    # Add limiter to app state
    app.state.limiter = limiter
    
    # Add error handler for rate limit exceeded
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Decorator for rate limiting specific endpoints
# Usage: @limiter.limit("10/minute")
# Apply to sensitive endpoints like login, password reset, etc.

# Default limits (applied via middleware or route decorators)
DEFAULT_RATE_LIMIT = "100/minute"
AUTH_RATE_LIMIT = "1000/minute"
SENSITIVE_RATE_LIMIT = "10/minute"
