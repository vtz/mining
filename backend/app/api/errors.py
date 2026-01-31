"""
Standardized error handling for the API.

Provides consistent error responses across all endpoints.
"""

import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    """Standardized error detail structure."""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None
    correlation_id: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standardized error response."""
    error: ErrorDetail


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for error tracking."""
    return str(uuid.uuid4())[:8]


async def validation_exception_handler(
    request: Request, 
    exc: RequestValidationError
) -> JSONResponse:
    """
    Handle Pydantic validation errors.
    
    Returns 422 with detailed field errors.
    """
    correlation_id = generate_correlation_id()
    
    # Extract field errors
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"],
        })
    
    logger.warning(
        f"Validation error [{correlation_id}]: {errors}",
        extra={"correlation_id": correlation_id, "errors": errors}
    )
    
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed",
                "details": {"errors": errors},
                "correlation_id": correlation_id,
            }
        }
    )


async def http_exception_handler(
    request: Request, 
    exc: HTTPException
) -> JSONResponse:
    """
    Handle HTTPException with standardized format.
    """
    correlation_id = generate_correlation_id()
    
    # Map status codes to error codes
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        500: "INTERNAL_ERROR",
        502: "BAD_GATEWAY",
        503: "SERVICE_UNAVAILABLE",
    }
    
    error_code = code_map.get(exc.status_code, "ERROR")
    
    if exc.status_code >= 500:
        logger.error(
            f"Server error [{correlation_id}]: {exc.detail}",
            extra={"correlation_id": correlation_id, "status_code": exc.status_code}
        )
    else:
        logger.warning(
            f"Client error [{correlation_id}]: {exc.detail}",
            extra={"correlation_id": correlation_id, "status_code": exc.status_code}
        )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": error_code,
                "message": str(exc.detail),
                "correlation_id": correlation_id,
            }
        }
    )


async def generic_exception_handler(
    request: Request, 
    exc: Exception
) -> JSONResponse:
    """
    Handle unexpected exceptions.
    
    Logs full error but returns sanitized response (no stack traces).
    """
    correlation_id = generate_correlation_id()
    
    logger.exception(
        f"Unexpected error [{correlation_id}]: {str(exc)}",
        extra={"correlation_id": correlation_id}
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again later.",
                "correlation_id": correlation_id,
            }
        }
    )


def setup_error_handlers(app: FastAPI) -> None:
    """
    Register all error handlers with the FastAPI app.
    
    Call this in main.py after creating the app.
    """
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
