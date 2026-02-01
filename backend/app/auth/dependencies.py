"""Authentication dependencies for FastAPI."""

from typing import Optional
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.user import User
from app.auth.jwt import verify_token

# HTTP Bearer scheme for JWT
security = HTTPBearer(auto_error=False)


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise.
    
    Use this for endpoints that work with or without authentication.
    """
    if not credentials:
        return None
    
    token = credentials.credentials
    payload = verify_token(token, "access")
    
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        return None
    
    result = await db.execute(
        select(User).where(User.id == user_uuid, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user.
    
    Raises HTTPException 401 if not authenticated.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not credentials:
        raise credentials_exception
    
    token = credentials.credentials
    payload = verify_token(token, "access")
    
    if not payload:
        raise credentials_exception
    
    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception
    
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise credentials_exception
    
    result = await db.execute(
        select(User).where(User.id == user_uuid, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise credentials_exception
    
    return user


async def require_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Require admin privileges.
    
    Raises HTTPException 403 if user is not admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user
