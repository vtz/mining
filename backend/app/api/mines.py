"""Mine CRUD endpoints."""

import uuid
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.mine import Mine
from app.models.region import Region
from app.models.user import User
from app.models.user_mine import UserMine
from app.models.mine_feature import MineFeature
from app.auth.dependencies import get_current_user, require_admin
from app.auth.permissions import get_accessible_mine_ids, check_mine_access
from app.features import FEATURE_CATALOG

router = APIRouter(prefix="/mines", tags=["mines"])


# Supported primary metals
SUPPORTED_METALS = ["Cu", "Au", "Zn", "Ni", "Fe"]


class MineCreate(BaseModel):
    """Request to create a mine."""
    name: str = Field(..., min_length=1, max_length=255)
    region_id: str = Field(..., description="UUID of the region")
    primary_metal: str = Field(default="Cu", description="Primary metal code")
    mining_method: str = Field(default="UG", description="UG or OP")
    recovery_params: Optional[Dict[str, Any]] = None
    commercial_terms: Optional[Dict[str, Any]] = None


class MineUpdate(BaseModel):
    """Request to update a mine."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    primary_metal: Optional[str] = None
    mining_method: Optional[str] = None
    recovery_params: Optional[Dict[str, Any]] = None
    commercial_terms: Optional[Dict[str, Any]] = None


class UserMineAdd(BaseModel):
    """Request to add user to mine."""
    user_id: str
    role: str = Field(default="viewer", description="admin, editor, or viewer")


class MineResponse(BaseModel):
    """Mine response model."""
    id: str
    name: str
    region_id: str
    region_name: str
    primary_metal: str
    mining_method: str
    recovery_params: Optional[Dict[str, Any]]
    commercial_terms: Optional[Dict[str, Any]]
    user_role: Optional[str] = None
    enabled_features: List[str] = []
    
    class Config:
        from_attributes = True


class MineListResponse(BaseModel):
    """List of mines response."""
    mines: List[MineResponse]
    total: int


@router.get("", response_model=MineListResponse)
async def list_mines(
    region_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List mines accessible to the current user.
    
    Admins see all mines. Regular users see only mines they have access to.
    """
    # Get accessible mine IDs
    if current_user.is_admin:
        query = select(Mine).options(selectinload(Mine.region))
        if region_id:
            query = query.where(Mine.region_id == region_id)
    else:
        accessible_ids = await get_accessible_mine_ids(db, current_user)
        query = (
            select(Mine)
            .options(selectinload(Mine.region))
            .where(Mine.id.in_(accessible_ids))
        )
        if region_id:
            query = query.where(Mine.region_id == region_id)
    
    query = query.order_by(Mine.name)
    result = await db.execute(query)
    mines = result.scalars().all()
    
    # Pre-load feature toggles for all mines
    mine_ids = [m.id for m in mines]
    feat_result = await db.execute(
        select(MineFeature).where(MineFeature.mine_id.in_(mine_ids))
    )
    feat_by_mine: Dict[uuid.UUID, Dict[str, bool]] = {}
    for feat in feat_result.scalars().all():
        feat_by_mine.setdefault(feat.mine_id, {})[feat.feature_key] = feat.enabled

    def _enabled_features(mine_id: uuid.UUID) -> List[str]:
        explicit = feat_by_mine.get(mine_id, {})
        enabled = []
        for key, catalog in FEATURE_CATALOG.items():
            if key in explicit:
                if explicit[key]:
                    enabled.append(key)
            elif catalog["default_enabled"]:
                enabled.append(key)
        return enabled

    # Get user roles for each mine
    response_mines = []
    for mine in mines:
        role = None
        if current_user.is_admin:
            role = "admin"
        else:
            role_result = await db.execute(
                select(UserMine.role).where(
                    UserMine.user_id == current_user.id,
                    UserMine.mine_id == mine.id
                )
            )
            role = role_result.scalar_one_or_none()
        
        response_mines.append(MineResponse(
            id=str(mine.id),
            name=mine.name,
            region_id=str(mine.region_id),
            region_name=mine.region.name,
            primary_metal=mine.primary_metal,
            mining_method=mine.mining_method,
            recovery_params=mine.recovery_params,
            commercial_terms=mine.commercial_terms,
            user_role=role,
            enabled_features=_enabled_features(mine.id),
        ))
    
    return MineListResponse(
        mines=response_mines,
        total=len(response_mines),
    )


@router.get("/metals")
async def list_supported_metals():
    """
    List supported primary metals.
    """
    return {
        "metals": [
            {"code": "Cu", "name": "Copper", "unit": "$/lb", "implemented": True},
            {"code": "Au", "name": "Gold", "unit": "$/oz", "implemented": False},
            {"code": "Zn", "name": "Zinc", "unit": "$/lb", "implemented": False},
            {"code": "Ni", "name": "Nickel", "unit": "$/lb", "implemented": False},
            {"code": "Fe", "name": "Iron", "unit": "$/t", "implemented": False},
        ]
    }


@router.get("/{mine_id}", response_model=MineResponse)
async def get_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific mine.
    
    Requires access to the mine.
    """
    # Check access
    has_access = await check_mine_access(db, current_user, mine_id)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this mine"
        )
    
    result = await db.execute(
        select(Mine)
        .options(selectinload(Mine.region))
        .where(Mine.id == mine_id)
    )
    mine = result.scalar_one_or_none()
    
    if not mine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mine not found"
        )
    
    # Get user role
    role = "admin" if current_user.is_admin else None
    if not current_user.is_admin:
        role_result = await db.execute(
            select(UserMine.role).where(
                UserMine.user_id == current_user.id,
                UserMine.mine_id == mine.id
            )
        )
        role = role_result.scalar_one_or_none()
    
    return MineResponse(
        id=str(mine.id),
        name=mine.name,
        region_id=str(mine.region_id),
        region_name=mine.region.name,
        primary_metal=mine.primary_metal,
        mining_method=mine.mining_method,
        recovery_params=mine.recovery_params,
        commercial_terms=mine.commercial_terms,
        user_role=role,
    )


@router.post("", response_model=MineResponse, status_code=status.HTTP_201_CREATED)
async def create_mine(
    data: MineCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new mine.
    
    Requires admin privileges.
    """
    # Validate primary metal
    if data.primary_metal not in SUPPORTED_METALS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported metal. Supported: {SUPPORTED_METALS}"
        )
    
    # Validate region exists
    try:
        region_uuid = uuid.UUID(data.region_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid region_id format"
        )
    
    result = await db.execute(
        select(Region).where(Region.id == region_uuid)
    )
    region = result.scalar_one_or_none()
    
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found"
        )
    
    mine = Mine(
        name=data.name,
        region_id=region_uuid,
        primary_metal=data.primary_metal,
        mining_method=data.mining_method,
        recovery_params=data.recovery_params,
        commercial_terms=data.commercial_terms,
        created_by=current_user.id,
    )
    
    db.add(mine)
    await db.commit()
    await db.refresh(mine)
    
    return MineResponse(
        id=str(mine.id),
        name=mine.name,
        region_id=str(mine.region_id),
        region_name=region.name,
        primary_metal=mine.primary_metal,
        mining_method=mine.mining_method,
        recovery_params=mine.recovery_params,
        commercial_terms=mine.commercial_terms,
        user_role="admin",
    )


@router.put("/{mine_id}", response_model=MineResponse)
async def update_mine(
    mine_id: uuid.UUID,
    data: MineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a mine.
    
    Requires admin role on the mine.
    """
    # Check admin access
    has_access = await check_mine_access(db, current_user, mine_id, ["admin"])
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    result = await db.execute(
        select(Mine)
        .options(selectinload(Mine.region))
        .where(Mine.id == mine_id)
    )
    mine = result.scalar_one_or_none()
    
    if not mine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mine not found"
        )
    
    # Update fields
    if data.name is not None:
        mine.name = data.name
    if data.primary_metal is not None:
        if data.primary_metal not in SUPPORTED_METALS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported metal. Supported: {SUPPORTED_METALS}"
            )
        mine.primary_metal = data.primary_metal
    if data.mining_method is not None:
        mine.mining_method = data.mining_method
    if data.recovery_params is not None:
        mine.recovery_params = data.recovery_params
    if data.commercial_terms is not None:
        mine.commercial_terms = data.commercial_terms
    
    await db.commit()
    await db.refresh(mine)
    
    return MineResponse(
        id=str(mine.id),
        name=mine.name,
        region_id=str(mine.region_id),
        region_name=mine.region.name,
        primary_metal=mine.primary_metal,
        mining_method=mine.mining_method,
        recovery_params=mine.recovery_params,
        commercial_terms=mine.commercial_terms,
        user_role="admin",
    )


@router.delete("/{mine_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete a mine.
    
    Requires admin privileges.
    """
    result = await db.execute(
        select(Mine).where(Mine.id == mine_id)
    )
    mine = result.scalar_one_or_none()
    
    if not mine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mine not found"
        )
    
    await db.delete(mine)
    await db.commit()


@router.post("/{mine_id}/users", status_code=status.HTTP_201_CREATED)
async def add_user_to_mine(
    mine_id: uuid.UUID,
    data: UserMineAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Add a user to a mine with a specific role.
    
    Requires admin privileges.
    """
    # Validate mine exists
    result = await db.execute(
        select(Mine).where(Mine.id == mine_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mine not found"
        )
    
    # Validate user exists
    try:
        user_uuid = uuid.UUID(data.user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_id format"
        )
    
    result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Validate role
    if data.role not in ["admin", "editor", "viewer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be admin, editor, or viewer"
        )
    
    # Check if association exists
    result = await db.execute(
        select(UserMine).where(
            UserMine.user_id == user_uuid,
            UserMine.mine_id == mine_id
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update role
        existing.role = data.role
    else:
        # Create new association
        user_mine = UserMine(
            user_id=user_uuid,
            mine_id=mine_id,
            role=data.role,
        )
        db.add(user_mine)
    
    await db.commit()
    
    return {"message": "User added to mine", "role": data.role}


@router.delete("/{mine_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_from_mine(
    mine_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Remove a user from a mine.
    
    Requires admin privileges.
    """
    result = await db.execute(
        select(UserMine).where(
            UserMine.user_id == user_id,
            UserMine.mine_id == mine_id
        )
    )
    user_mine = result.scalar_one_or_none()
    
    if not user_mine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User-mine association not found"
        )
    
    await db.delete(user_mine)
    await db.commit()
