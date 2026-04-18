"""Mineral catalog CRUD endpoints."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.mineral import Mineral
from app.models.user import User
from app.auth.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/minerals", tags=["Minerals"])


# ── Schemas ──────────────────────────────────────────────────────────

class MineralCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=10)
    name: str = Field(..., min_length=1, max_length=100)
    price_unit: str = Field(..., min_length=1, max_length=20)
    default_price: float = Field(..., gt=0)
    grade_unit: str = Field(default="%", max_length=20)
    implemented: bool = False


class MineralUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=10)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    price_unit: Optional[str] = Field(None, min_length=1, max_length=20)
    default_price: Optional[float] = Field(None, gt=0)
    grade_unit: Optional[str] = Field(None, max_length=20)
    implemented: Optional[bool] = None


class MineralResponse(BaseModel):
    id: str
    code: str
    name: str
    price_unit: str
    default_price: float
    grade_unit: str
    implemented: bool

    class Config:
        from_attributes = True


class MineralListResponse(BaseModel):
    minerals: List[MineralResponse]
    total: int


# ── Endpoints ────────────────────────────────────────────────────────

@router.get("", response_model=MineralListResponse)
async def list_minerals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Mineral).order_by(Mineral.code))
    minerals = result.scalars().all()
    return MineralListResponse(
        minerals=[
            MineralResponse(
                id=str(m.id), code=m.code, name=m.name,
                price_unit=m.price_unit, default_price=m.default_price,
                grade_unit=m.grade_unit, implemented=m.implemented,
            )
            for m in minerals
        ],
        total=len(minerals),
    )


@router.get("/{mineral_id}", response_model=MineralResponse)
async def get_mineral(
    mineral_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mineral not found")
    return MineralResponse(
        id=str(mineral.id), code=mineral.code, name=mineral.name,
        price_unit=mineral.price_unit, default_price=mineral.default_price,
        grade_unit=mineral.grade_unit, implemented=mineral.implemented,
    )


@router.post("", response_model=MineralResponse, status_code=status.HTTP_201_CREATED)
async def create_mineral(
    data: MineralCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(
        select(Mineral).where(Mineral.code == data.code.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Mineral with code '{data.code}' already exists",
        )

    mineral = Mineral(
        code=data.code.upper(),
        name=data.name,
        price_unit=data.price_unit,
        default_price=data.default_price,
        grade_unit=data.grade_unit,
        implemented=data.implemented,
        created_by=current_user.id,
    )
    db.add(mineral)
    await db.commit()
    await db.refresh(mineral)

    return MineralResponse(
        id=str(mineral.id), code=mineral.code, name=mineral.name,
        price_unit=mineral.price_unit, default_price=mineral.default_price,
        grade_unit=mineral.grade_unit, implemented=mineral.implemented,
    )


@router.put("/{mineral_id}", response_model=MineralResponse)
async def update_mineral(
    mineral_id: uuid.UUID,
    data: MineralUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mineral not found")

    if data.code is not None:
        dup = await db.execute(
            select(Mineral).where(
                Mineral.code == data.code.upper(), Mineral.id != mineral_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"Mineral with code '{data.code}' already exists",
            )
        mineral.code = data.code.upper()

    if data.name is not None:
        mineral.name = data.name
    if data.price_unit is not None:
        mineral.price_unit = data.price_unit
    if data.default_price is not None:
        mineral.default_price = data.default_price
    if data.grade_unit is not None:
        mineral.grade_unit = data.grade_unit
    if data.implemented is not None:
        mineral.implemented = data.implemented

    await db.commit()
    await db.refresh(mineral)

    return MineralResponse(
        id=str(mineral.id), code=mineral.code, name=mineral.name,
        price_unit=mineral.price_unit, default_price=mineral.default_price,
        grade_unit=mineral.grade_unit, implemented=mineral.implemented,
    )


@router.delete("/{mineral_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mineral(
    mineral_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(select(Mineral).where(Mineral.id == mineral_id))
    mineral = result.scalar_one_or_none()
    if not mineral:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mineral not found")

    await db.delete(mineral)
    await db.commit()
