"""Mine CRUD endpoints."""

import uuid
from datetime import datetime, timezone
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
from app.models.mineral import Mineral, MineMineral
from app.models.parameter import ParameterDefinition, MineParameter
from app.auth.dependencies import get_current_user, require_admin
from app.auth.permissions import get_accessible_mine_ids, check_mine_access
from app.features import FEATURE_CATALOG

router = APIRouter(prefix="/mines", tags=["mines"])

VALID_STATUSES = {"draft", "active", "suspended", "decommissioned"}

# Kept for backward compatibility; DB minerals table is the source of truth
SUPPORTED_METALS = ["Cu", "Au", "Zn", "Ni", "Fe", "Ag"]


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


class MineMineralInput(BaseModel):
    mineral_id: str
    is_primary: bool = False
    recovery_rate: Optional[float] = None
    commercial_terms: Optional[Dict[str, Any]] = None


class MineMineralResponse(BaseModel):
    id: str
    mineral_id: str
    mineral_code: str
    mineral_name: str
    is_primary: bool
    recovery_rate: Optional[float]
    commercial_terms: Optional[Dict[str, Any]]


class SetMineMinerals(BaseModel):
    minerals: List[MineMineralInput]


class MineResponse(BaseModel):
    """Mine response model."""
    id: str
    name: str
    region_id: str
    region_name: str
    primary_metal: str
    mining_method: str
    status: str = "active"
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
            status=mine.status,
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
async def list_supported_metals(
    db: AsyncSession = Depends(get_db),
):
    """List supported primary metals from the minerals catalog."""
    result = await db.execute(select(Mineral).order_by(Mineral.code))
    minerals = result.scalars().all()
    return {
        "metals": [
            {
                "code": m.code,
                "name": m.name,
                "unit": m.price_unit,
                "implemented": m.implemented,
            }
            for m in minerals
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
        status=mine.status,
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
    """Create a new mine in draft status. Requires admin privileges."""
    # Validate primary metal against the minerals catalog
    mineral_result = await db.execute(
        select(Mineral).where(Mineral.code == data.primary_metal)
    )
    mineral = mineral_result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown mineral code '{data.primary_metal}'. Add it to the mineral catalog first.",
        )

    try:
        region_uuid = uuid.UUID(data.region_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid region_id format",
        )
    
    result = await db.execute(select(Region).where(Region.id == region_uuid))
    region = result.scalar_one_or_none()
    if not region:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Region not found")
    
    mine = Mine(
        name=data.name,
        region_id=region_uuid,
        primary_metal=data.primary_metal,
        mining_method=data.mining_method,
        status="draft",
        recovery_params=data.recovery_params,
        commercial_terms=data.commercial_terms,
        created_by=current_user.id,
    )
    db.add(mine)
    await db.flush()

    db.add(MineMineral(
        mine_id=mine.id, mineral_id=mineral.id, is_primary=True,
    ))

    await db.commit()
    await db.refresh(mine)
    
    return MineResponse(
        id=str(mine.id),
        name=mine.name,
        region_id=str(mine.region_id),
        region_name=region.name,
        primary_metal=mine.primary_metal,
        mining_method=mine.mining_method,
        status=mine.status,
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
    
    if data.name is not None:
        mine.name = data.name
    if data.primary_metal is not None:
        mineral_check = await db.execute(
            select(Mineral).where(Mineral.code == data.primary_metal)
        )
        if not mineral_check.scalar_one_or_none():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown mineral code '{data.primary_metal}'",
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
        status=mine.status,
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


# ── Mine minerals ────────────────────────────────────────────────────

@router.get("/{mine_id}/minerals")
async def list_mine_minerals(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List minerals associated with a mine."""
    has_access = await check_mine_access(db, current_user, mine_id)
    if not has_access:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MineMineral)
        .options(selectinload(MineMineral.mineral))
        .where(MineMineral.mine_id == mine_id)
    )
    items = result.scalars().all()
    return {
        "minerals": [
            MineMineralResponse(
                id=str(mm.id),
                mineral_id=str(mm.mineral_id),
                mineral_code=mm.mineral.code,
                mineral_name=mm.mineral.name,
                is_primary=mm.is_primary,
                recovery_rate=mm.recovery_rate,
                commercial_terms=mm.commercial_terms,
            )
            for mm in items
        ],
        "total": len(items),
    }


@router.put("/{mine_id}/minerals")
async def set_mine_minerals(
    mine_id: uuid.UUID,
    data: SetMineMinerals,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Replace the mineral set for a mine. Exactly one must be primary."""
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")

    primary_count = sum(1 for m in data.minerals if m.is_primary)
    if primary_count != 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Exactly one mineral must be marked as primary",
        )

    # Remove existing associations
    existing = await db.execute(
        select(MineMineral).where(MineMineral.mine_id == mine_id)
    )
    for mm in existing.scalars().all():
        await db.delete(mm)

    for item in data.minerals:
        mineral_uuid = uuid.UUID(item.mineral_id)
        mineral = await db.get(Mineral, mineral_uuid)
        if not mineral:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Mineral {item.mineral_id} not found",
            )
        db.add(MineMineral(
            mine_id=mine_id,
            mineral_id=mineral_uuid,
            is_primary=item.is_primary,
            recovery_rate=item.recovery_rate,
            commercial_terms=item.commercial_terms,
        ))
        if item.is_primary:
            mine.primary_metal = mineral.code

    await db.commit()
    return await list_mine_minerals(mine_id, db, current_user)


# ── Commissioning lifecycle ──────────────────────────────────────────

@router.post("/{mine_id}/commission")
async def commission_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Validate completeness and transition mine from draft to active."""
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")
    if mine.status not in ("draft", "suspended"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot commission a mine with status '{mine.status}'",
        )

    errors: List[str] = []

    minerals_result = await db.execute(
        select(MineMineral).where(MineMineral.mine_id == mine_id)
    )
    mine_minerals = minerals_result.scalars().all()
    if not mine_minerals:
        errors.append("At least one mineral must be assigned")
    elif not any(mm.is_primary for mm in mine_minerals):
        errors.append("Exactly one mineral must be marked as primary")

    required_params = await db.execute(
        select(ParameterDefinition).where(ParameterDefinition.is_required.is_(True))
    )
    for pd in required_params.scalars().all():
        mp_result = await db.execute(
            select(MineParameter).where(
                MineParameter.mine_id == mine_id,
                MineParameter.parameter_id == pd.id,
            )
        )
        if not mp_result.scalar_one_or_none():
            errors.append(f"Required parameter '{pd.name}' is missing")

    if errors:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"errors": errors})

    mine.status = "active"
    mine.commissioned_at = datetime.now(timezone.utc)
    mine.commissioned_by = current_user.id
    await db.commit()

    return {"message": "Mine commissioned successfully", "status": mine.status}


@router.post("/{mine_id}/decommission")
async def decommission_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Transition mine to decommissioned status."""
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")
    if mine.status == "decommissioned":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Mine is already decommissioned")

    mine.status = "decommissioned"
    await db.commit()
    return {"message": "Mine decommissioned", "status": mine.status}


@router.post("/{mine_id}/suspend")
async def suspend_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Suspend an active mine."""
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")
    if mine.status != "active":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Only active mines can be suspended",
        )

    mine.status = "suspended"
    await db.commit()
    return {"message": "Mine suspended", "status": mine.status}


@router.post("/{mine_id}/activate")
async def activate_mine(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Re-activate a suspended mine."""
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")
    if mine.status != "suspended":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Only suspended mines can be re-activated",
        )

    mine.status = "active"
    await db.commit()
    return {"message": "Mine activated", "status": mine.status}
