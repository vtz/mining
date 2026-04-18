"""Parameter definition CRUD and mine parameter endpoints."""

import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.parameter import ParameterDefinition, MineParameter
from app.models.mine import Mine
from app.models.user import User
from app.auth.dependencies import get_current_user, require_admin
from app.auth.permissions import check_mine_access

router = APIRouter(tags=["Parameters"])


# ── Schemas ──────────────────────────────────────────────────────────

class ParamDefCreate(BaseModel):
    key: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)
    data_type: str = Field(default="float", pattern="^(float|integer|string|boolean|json)$")
    unit: Optional[str] = Field(None, max_length=50)
    default_value: Optional[str] = Field(None, max_length=500)
    is_required: bool = False
    validation_rules: Optional[Dict[str, Any]] = None
    sort_order: int = 0


class ParamDefUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=50)
    data_type: Optional[str] = Field(None, pattern="^(float|integer|string|boolean|json)$")
    unit: Optional[str] = Field(None, max_length=50)
    default_value: Optional[str] = Field(None, max_length=500)
    is_required: Optional[bool] = None
    validation_rules: Optional[Dict[str, Any]] = None
    sort_order: Optional[int] = None


class ParamDefResponse(BaseModel):
    id: str
    key: str
    name: str
    description: Optional[str]
    category: str
    data_type: str
    unit: Optional[str]
    default_value: Optional[str]
    is_required: bool
    validation_rules: Optional[Dict[str, Any]]
    sort_order: int

    class Config:
        from_attributes = True


class ParamDefListResponse(BaseModel):
    parameters: List[ParamDefResponse]
    total: int


class MineParamValue(BaseModel):
    parameter_id: str
    value: str


class MineParamBulkUpsert(BaseModel):
    parameters: List[MineParamValue]


class MineParamResponse(BaseModel):
    id: str
    parameter_id: str
    parameter_key: str
    parameter_name: str
    category: str
    data_type: str
    unit: Optional[str]
    value: str
    default_value: Optional[str]
    is_required: bool
    validation_rules: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


class MineParamListResponse(BaseModel):
    parameters: List[MineParamResponse]
    total: int


# ── Parameter definition endpoints ───────────────────────────────────

param_router = APIRouter(prefix="/parameters", tags=["Parameters"])


@param_router.get("", response_model=ParamDefListResponse)
async def list_parameter_definitions(
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(ParameterDefinition).order_by(
        ParameterDefinition.category, ParameterDefinition.sort_order,
    )
    if category:
        query = query.where(ParameterDefinition.category == category)

    result = await db.execute(query)
    params = result.scalars().all()
    return ParamDefListResponse(
        parameters=[
            ParamDefResponse(
                id=str(p.id), key=p.key, name=p.name, description=p.description,
                category=p.category, data_type=p.data_type, unit=p.unit,
                default_value=p.default_value, is_required=p.is_required,
                validation_rules=p.validation_rules, sort_order=p.sort_order,
            )
            for p in params
        ],
        total=len(params),
    )


@param_router.post("", response_model=ParamDefResponse, status_code=status.HTTP_201_CREATED)
async def create_parameter_definition(
    data: ParamDefCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    existing = await db.execute(
        select(ParameterDefinition).where(ParameterDefinition.key == data.key)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Parameter with key '{data.key}' already exists",
        )

    param = ParameterDefinition(
        key=data.key, name=data.name, description=data.description,
        category=data.category, data_type=data.data_type, unit=data.unit,
        default_value=data.default_value, is_required=data.is_required,
        validation_rules=data.validation_rules, sort_order=data.sort_order,
        created_by=current_user.id,
    )
    db.add(param)
    await db.commit()
    await db.refresh(param)

    return ParamDefResponse(
        id=str(param.id), key=param.key, name=param.name,
        description=param.description, category=param.category,
        data_type=param.data_type, unit=param.unit,
        default_value=param.default_value, is_required=param.is_required,
        validation_rules=param.validation_rules, sort_order=param.sort_order,
    )


@param_router.put("/{param_id}", response_model=ParamDefResponse)
async def update_parameter_definition(
    param_id: uuid.UUID,
    data: ParamDefUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(ParameterDefinition).where(ParameterDefinition.id == param_id)
    )
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parameter definition not found")

    for field in ("name", "description", "category", "data_type", "unit",
                  "default_value", "is_required", "validation_rules", "sort_order"):
        val = getattr(data, field, None)
        if val is not None:
            setattr(param, field, val)

    await db.commit()
    await db.refresh(param)

    return ParamDefResponse(
        id=str(param.id), key=param.key, name=param.name,
        description=param.description, category=param.category,
        data_type=param.data_type, unit=param.unit,
        default_value=param.default_value, is_required=param.is_required,
        validation_rules=param.validation_rules, sort_order=param.sort_order,
    )


@param_router.delete("/{param_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parameter_definition(
    param_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(ParameterDefinition).where(ParameterDefinition.id == param_id)
    )
    param = result.scalar_one_or_none()
    if not param:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Parameter definition not found")

    await db.delete(param)
    await db.commit()


# ── Mine parameter endpoints ────────────────────────────────────────

mine_param_router = APIRouter(prefix="/mines/{mine_id}/parameters", tags=["Parameters"])


@mine_param_router.get("", response_model=MineParamListResponse)
async def list_mine_parameters(
    mine_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")

    has_access = await check_mine_access(db, current_user, mine_id)
    if not has_access:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(MineParameter)
        .options(selectinload(MineParameter.parameter))
        .where(MineParameter.mine_id == mine_id)
    )
    mine_params = result.scalars().all()

    all_defs = await db.execute(
        select(ParameterDefinition).order_by(
            ParameterDefinition.category, ParameterDefinition.sort_order,
        )
    )
    all_defs = all_defs.scalars().all()

    param_values = {str(mp.parameter_id): mp for mp in mine_params}

    items = []
    for d in all_defs:
        mp = param_values.get(str(d.id))
        items.append(MineParamResponse(
            id=str(mp.id) if mp else "",
            parameter_id=str(d.id),
            parameter_key=d.key,
            parameter_name=d.name,
            category=d.category,
            data_type=d.data_type,
            unit=d.unit,
            value=mp.value if mp else (d.default_value or ""),
            default_value=d.default_value,
            is_required=d.is_required,
            validation_rules=d.validation_rules,
        ))

    return MineParamListResponse(parameters=items, total=len(items))


@mine_param_router.put("", response_model=MineParamListResponse)
async def upsert_mine_parameters(
    mine_id: uuid.UUID,
    data: MineParamBulkUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    mine = await db.get(Mine, mine_id)
    if not mine:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine not found")

    for item in data.parameters:
        param_uuid = uuid.UUID(item.parameter_id)
        param_def = await db.get(ParameterDefinition, param_uuid)
        if not param_def:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"Parameter definition {item.parameter_id} not found",
            )

        result = await db.execute(
            select(MineParameter).where(
                MineParameter.mine_id == mine_id,
                MineParameter.parameter_id == param_uuid,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.value = item.value
            existing.set_by = current_user.id
            existing.set_at = datetime.now(timezone.utc)
        else:
            db.add(MineParameter(
                mine_id=mine_id,
                parameter_id=param_uuid,
                value=item.value,
                set_by=current_user.id,
            ))

    await db.commit()
    return await list_mine_parameters(mine_id, db, current_user)


@mine_param_router.delete("/{param_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mine_parameter(
    mine_id: uuid.UUID,
    param_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(MineParameter).where(
            MineParameter.mine_id == mine_id,
            MineParameter.parameter_id == param_id,
        )
    )
    mp = result.scalar_one_or_none()
    if not mp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Mine parameter not found")

    await db.delete(mp)
    await db.commit()
