"""User management endpoints (admin only)."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from passlib.context import CryptContext

from app.db.session import get_db
from app.models.user import User
from app.models.user_mine import UserMine
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/users", tags=["users"])

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserCreate(BaseModel):
    """Request to create a new local user."""
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=6, max_length=100)
    is_admin: bool = False


class UserUpdate(BaseModel):
    """Request to update a user."""
    name: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserMineInfo(BaseModel):
    """Mine access info for a user."""
    mine_id: str
    mine_name: str
    role: str


class UserResponse(BaseModel):
    """User response model."""
    id: str
    email: str
    name: str
    avatar_url: Optional[str]
    auth_provider: str
    is_admin: bool
    is_active: bool
    mine_access: List[UserMineInfo] = []
    
    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """List of users response."""
    users: List[UserResponse]
    total: int


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new local user with email/password.
    
    Requires admin privileges.
    """
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user with hashed password
    password_hash = pwd_context.hash(data.password)
    
    user = User(
        email=data.email,
        name=data.name,
        auth_provider="local",
        auth_provider_id=f"local-{data.email}",
        password_hash=password_hash,
        is_admin=data.is_admin,
        is_active=True,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        auth_provider=user.auth_provider,
        is_admin=user.is_admin,
        is_active=user.is_active,
        mine_access=[],
    )


@router.get("", response_model=UserListResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    List all users.
    
    Requires admin privileges.
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.mine_access).selectinload(UserMine.mine))
        .order_by(User.email)
    )
    users = result.scalars().all()
    
    response_users = []
    for user in users:
        mine_access = [
            UserMineInfo(
                mine_id=str(um.mine_id),
                mine_name=um.mine.name if um.mine else "Unknown",
                role=um.role,
            )
            for um in user.mine_access
        ]
        
        response_users.append(UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            auth_provider=user.auth_provider,
            is_admin=user.is_admin,
            is_active=user.is_active,
            mine_access=mine_access,
        ))
    
    return UserListResponse(
        users=response_users,
        total=len(response_users),
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get a specific user.
    
    Requires admin privileges.
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.mine_access).selectinload(UserMine.mine))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    mine_access = [
        UserMineInfo(
            mine_id=str(um.mine_id),
            mine_name=um.mine.name if um.mine else "Unknown",
            role=um.role,
        )
        for um in user.mine_access
    ]
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        auth_provider=user.auth_provider,
        is_admin=user.is_admin,
        is_active=user.is_active,
        mine_access=mine_access,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update a user.
    
    Requires admin privileges.
    Cannot modify own admin status.
    """
    result = await db.execute(
        select(User)
        .options(selectinload(User.mine_access).selectinload(UserMine.mine))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-modification of admin status
    if user.id == current_user.id and data.is_admin is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify your own admin status"
        )
    
    # Update fields
    if data.name is not None:
        user.name = data.name
    if data.password is not None:
        user.password_hash = pwd_context.hash(data.password)
        # Set auth_provider to local if changing password
        if user.auth_provider != "local":
            user.auth_provider = "local"
            user.auth_provider_id = f"local-{user.email}"
    if data.is_admin is not None:
        user.is_admin = data.is_admin
    if data.is_active is not None:
        user.is_active = data.is_active
    
    await db.commit()
    await db.refresh(user)
    
    mine_access = [
        UserMineInfo(
            mine_id=str(um.mine_id),
            mine_name=um.mine.name if um.mine else "Unknown",
            role=um.role,
        )
        for um in user.mine_access
    ]
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        auth_provider=user.auth_provider,
        is_admin=user.is_admin,
        is_active=user.is_active,
        mine_access=mine_access,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Deactivate a user (soft delete).
    
    Requires admin privileges.
    Cannot deactivate yourself.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = False
    await db.commit()


# =============================================================================
# User-Mine Access Management
# =============================================================================

class UserMineAccess(BaseModel):
    """Request to grant mine access to a user."""
    mine_id: str
    role: str = "viewer"  # admin, editor, viewer


class UserMineAccessResponse(BaseModel):
    """Response for mine access."""
    mine_id: str
    mine_name: str
    role: str


@router.post("/{user_id}/mines", response_model=List[UserMineAccessResponse])
async def set_user_mines(
    user_id: uuid.UUID,
    mine_access: List[UserMineAccess],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Set mine access for a user. Replaces all existing access.
    
    Requires admin privileges.
    """
    from app.models.mine import Mine
    
    # Verify user exists
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete existing access
    await db.execute(
        UserMine.__table__.delete().where(UserMine.user_id == user_id)
    )
    
    # Add new access
    response = []
    for access in mine_access:
        mine_uuid = uuid.UUID(access.mine_id)
        
        # Verify mine exists
        result = await db.execute(
            select(Mine).where(Mine.id == mine_uuid)
        )
        mine = result.scalar_one_or_none()
        
        if not mine:
            continue  # Skip invalid mines
        
        user_mine = UserMine(
            user_id=user_id,
            mine_id=mine_uuid,
            role=access.role,
        )
        db.add(user_mine)
        
        response.append(UserMineAccessResponse(
            mine_id=str(mine.id),
            mine_name=mine.name,
            role=access.role,
        ))
    
    await db.commit()
    return response


@router.get("/{user_id}/mines", response_model=List[UserMineAccessResponse])
async def get_user_mines(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get mine access for a user.
    
    Requires admin privileges.
    """
    from app.models.mine import Mine
    
    result = await db.execute(
        select(UserMine, Mine)
        .join(Mine, UserMine.mine_id == Mine.id)
        .where(UserMine.user_id == user_id)
    )
    rows = result.all()
    
    return [
        UserMineAccessResponse(
            mine_id=str(um.mine_id),
            mine_name=mine.name,
            role=um.role,
        )
        for um, mine in rows
    ]
