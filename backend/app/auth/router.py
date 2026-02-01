"""Authentication API routes."""

import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext

from app.db.session import get_db
from app.models.user import User
from app.auth.jwt import create_access_token, create_refresh_token, verify_token
from app.auth.oauth import google_oauth
from app.auth.dependencies import get_current_user
from app.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory state storage (use Redis in production)
_oauth_states: dict = {}


class TokenResponse(BaseModel):
    """Token response model."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response model."""
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    is_admin: bool
    
    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    """Refresh token request."""
    refresh_token: str


class DevLoginRequest(BaseModel):
    """Development login request."""
    email: str
    name: str = "Dev User"
    is_admin: bool = True


class LocalLoginRequest(BaseModel):
    """Local login request with email and password."""
    email: EmailStr
    password: str


# =============================================================================
# Development Login (DEBUG mode only)
# =============================================================================

@router.post("/dev-login", response_model=TokenResponse)
async def dev_login(
    request: DevLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Development login - creates or finds a user without OAuth.
    
    ONLY available when DEBUG=true.
    """
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dev login only available in debug mode"
        )
    
    # Find or create user
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Update existing user
        user.name = request.name
        user.last_login = datetime.now(timezone.utc)
        if request.is_admin:
            user.is_admin = True
    else:
        # Create new user
        user = User(
            email=request.email,
            name=request.name,
            auth_provider="dev",
            auth_provider_id="dev-" + request.email,
            is_admin=request.is_admin,
            last_login=datetime.now(timezone.utc),
        )
        db.add(user)
    
    await db.commit()
    await db.refresh(user)
    
    # Create tokens
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/dev-status")
async def dev_status():
    """Check if dev login is available."""
    return {
        "dev_login_available": settings.debug,
        "google_oauth_configured": bool(settings.google_client_id),
        "local_login_available": True,  # Always available for local users
    }


# =============================================================================
# Local Login (Email/Password)
# =============================================================================

@router.post("/login", response_model=TokenResponse)
async def local_login(
    request: LocalLoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Login with email and password.
    
    For users created with local authentication.
    """
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user has a password (local auth)
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses external authentication (Google). Please login with Google."
        )
    
    # Verify password
    if not pwd_context.verify(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated"
        )
    
    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    
    # Create tokens
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


# =============================================================================
# Google OAuth
# =============================================================================

@router.get("/login/google")
async def login_google():
    """
    Initiate Google OAuth2 login flow.
    
    Redirects user to Google's authorization page.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured"
        )
    
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = datetime.now(timezone.utc)
    
    auth_url = google_oauth.get_authorization_url(state)
    return RedirectResponse(url=auth_url)


@router.get("/callback/google")
async def callback_google(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Google OAuth2 callback.
    
    Creates or updates user and returns tokens.
    """
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth error: {error}"
        )
    
    if not code or not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing code or state"
        )
    
    # Verify state
    if state not in _oauth_states:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid state"
        )
    del _oauth_states[state]
    
    # Exchange code for tokens
    token_data = await google_oauth.exchange_code(code)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange code"
        )
    
    # Get user info
    user_info = await google_oauth.get_user_info(token_data.get("access_token", ""))
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to get user info"
        )
    
    # Find or create user
    result = await db.execute(
        select(User).where(User.email == user_info.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Update existing user
        user.name = user_info.name
        user.avatar_url = user_info.avatar_url
        user.auth_provider = user_info.provider
        user.auth_provider_id = user_info.provider_id
        user.last_login = datetime.now(timezone.utc)
    else:
        # Create new user
        is_admin = (
            settings.initial_admin_email and 
            user_info.email == settings.initial_admin_email
        )
        
        user = User(
            email=user_info.email,
            name=user_info.name,
            avatar_url=user_info.avatar_url,
            auth_provider=user_info.provider,
            auth_provider_id=user_info.provider_id,
            is_admin=is_admin,
            last_login=datetime.now(timezone.utc),
        )
        db.add(user)
    
    await db.commit()
    await db.refresh(user)
    
    # Create tokens
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    # Redirect to frontend with tokens
    frontend_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000"
    redirect_url = f"{frontend_url}/auth/callback?access_token={access_token}&refresh_token={refresh_token}"
    
    return RedirectResponse(url=redirect_url)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token.
    """
    payload = verify_token(request.refresh_token, "refresh")
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Verify user still exists and is active
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new tokens
    token_data = {"sub": str(user.id), "email": user.email}
    access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user.
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        is_admin=current_user.is_admin,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout current user.
    
    Note: JWT tokens are stateless, so this just returns success.
    In production, implement token blacklisting with Redis.
    """
    return {"message": "Logged out successfully"}
