"""Audit logging for sensitive operations."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Any, Dict
from dataclasses import dataclass, asdict
from enum import Enum
import logging

# Configure audit logger
audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)

# Create handler if not exists
if not audit_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - AUDIT - %(message)s'
    ))
    audit_logger.addHandler(handler)


class AuditAction(str, Enum):
    """Audit action types."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    ACCESS_DENIED = "access_denied"


@dataclass
class AuditEntry:
    """Audit log entry."""
    timestamp: str
    user_id: Optional[str]
    user_email: Optional[str]
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    correlation_id: str


def log_audit(
    action: AuditAction,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    user_email: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Log an audit event.
    
    Args:
        action: Type of action performed
        resource_type: Type of resource affected (user, mine, region)
        resource_id: ID of the affected resource
        user_id: ID of the user who performed the action
        user_email: Email of the user
        details: Additional details about the action
        ip_address: IP address of the request
    """
    entry = AuditEntry(
        timestamp=datetime.now(timezone.utc).isoformat(),
        user_id=str(user_id) if user_id else None,
        user_email=user_email,
        action=action.value,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        details=details,
        ip_address=ip_address,
        correlation_id=str(uuid.uuid4()),
    )
    
    # Log as structured JSON
    audit_logger.info(str(asdict(entry)))
    
    # In production, you would also:
    # - Store in database
    # - Send to logging service (e.g., CloudWatch, Datadog)
    # - Publish to event stream


def get_client_ip(request) -> Optional[str]:
    """Extract client IP from request."""
    # Check X-Forwarded-For header (for proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fall back to client host
    if request.client:
        return request.client.host
    
    return None
