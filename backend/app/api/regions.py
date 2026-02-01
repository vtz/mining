"""Region CRUD endpoints."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.region import Region
from app.models.user import User
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/regions", tags=["regions"])


class RegionCreate(BaseModel):
    """Request to create a region."""
    name: str = Field(..., min_length=1, max_length=255)
    country: str = Field(default="Brazil", max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    municipality: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None


class RegionUpdate(BaseModel):
    """Request to update a region."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    country: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)
    municipality: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None


class RegionResponse(BaseModel):
    """Region response model."""
    id: str
    name: str
    country: str
    state: Optional[str]
    municipality: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    description: Optional[str]
    mine_count: int = 0
    
    class Config:
        from_attributes = True


class RegionListResponse(BaseModel):
    """List of regions response."""
    regions: List[RegionResponse]
    total: int


@router.get("", response_model=RegionListResponse)
async def list_regions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all regions.
    
    Requires authentication.
    """
    result = await db.execute(
        select(Region).options(selectinload(Region.mines)).order_by(Region.name)
    )
    regions = result.scalars().all()
    
    response_regions = [
        RegionResponse(
            id=str(r.id),
            name=r.name,
            country=r.country,
            state=r.state,
            municipality=r.municipality,
            latitude=r.latitude,
            longitude=r.longitude,
            description=r.description,
            mine_count=len(r.mines),
        )
        for r in regions
    ]
    
    return RegionListResponse(
        regions=response_regions,
        total=len(response_regions),
    )


@router.get("/{region_id}", response_model=RegionResponse)
async def get_region(
    region_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific region.
    
    Requires authentication.
    """
    result = await db.execute(
        select(Region)
        .options(selectinload(Region.mines))
        .where(Region.id == region_id)
    )
    region = result.scalar_one_or_none()
    
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found"
        )
    
    return RegionResponse(
        id=str(region.id),
        name=region.name,
        country=region.country,
        state=region.state,
        municipality=region.municipality,
        latitude=region.latitude,
        longitude=region.longitude,
        description=region.description,
        mine_count=len(region.mines),
    )


@router.post("", response_model=RegionResponse, status_code=status.HTTP_201_CREATED)
async def create_region(
    data: RegionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create a new region.
    
    Requires admin privileges.
    """
    # Check for duplicate name
    result = await db.execute(
        select(Region).where(Region.name == data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Region with this name already exists"
        )
    
    region = Region(
        name=data.name,
        country=data.country,
        state=data.state,
        municipality=data.municipality,
        latitude=data.latitude,
        longitude=data.longitude,
        description=data.description,
        created_by=current_user.id,
    )
    
    db.add(region)
    await db.commit()
    await db.refresh(region)
    
    return RegionResponse(
        id=str(region.id),
        name=region.name,
        country=region.country,
        state=region.state,
        municipality=region.municipality,
        latitude=region.latitude,
        longitude=region.longitude,
        description=region.description,
        mine_count=0,
    )


@router.put("/{region_id}", response_model=RegionResponse)
async def update_region(
    region_id: uuid.UUID,
    data: RegionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Update a region.
    
    Requires admin privileges.
    """
    result = await db.execute(
        select(Region)
        .options(selectinload(Region.mines))
        .where(Region.id == region_id)
    )
    region = result.scalar_one_or_none()
    
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found"
        )
    
    # Check for duplicate name
    if data.name and data.name != region.name:
        result = await db.execute(
            select(Region).where(Region.name == data.name)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Region with this name already exists"
            )
    
    # Update fields
    if data.name is not None:
        region.name = data.name
    if data.country is not None:
        region.country = data.country
    if data.state is not None:
        region.state = data.state
    if data.municipality is not None:
        region.municipality = data.municipality
    if data.latitude is not None:
        region.latitude = data.latitude
    if data.longitude is not None:
        region.longitude = data.longitude
    if data.description is not None:
        region.description = data.description
    
    await db.commit()
    await db.refresh(region)
    
    return RegionResponse(
        id=str(region.id),
        name=region.name,
        country=region.country,
        state=region.state,
        municipality=region.municipality,
        latitude=region.latitude,
        longitude=region.longitude,
        description=region.description,
        mine_count=len(region.mines),
    )


@router.delete("/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_region(
    region_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete a region.
    
    Requires admin privileges.
    Will also delete all mines in the region.
    """
    result = await db.execute(
        select(Region).where(Region.id == region_id)
    )
    region = result.scalar_one_or_none()
    
    if not region:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Region not found"
        )
    
    await db.delete(region)
    await db.commit()
