"""Feature toggle management endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.mine_feature import MineFeature
from app.models.user import User
from app.auth.dependencies import get_current_user, require_admin
from app.features import FEATURE_CATALOG

router = APIRouter(tags=["Features"])


# ── Schemas ───────────────────────────────────────────────


class FeatureCatalogItem(BaseModel):
    key: str
    name: str
    description: str
    default_enabled: bool
    icon: str


class FeatureCatalogResponse(BaseModel):
    features: List[FeatureCatalogItem]


class MineFeatureStatus(BaseModel):
    feature_key: str
    name: str
    description: str
    enabled: bool
    enabled_at: Optional[str] = None
    disabled_at: Optional[str] = None
    notes: Optional[str] = None
    is_default: bool  # True if no explicit record exists (using catalog default)


class MineFeatureListResponse(BaseModel):
    mine_id: str
    features: List[MineFeatureStatus]


class FeatureUpdateRequest(BaseModel):
    enabled: bool = Field(..., description="Enable or disable the feature")
    notes: Optional[str] = Field(default=None, description="Optional notes (e.g. trial info)")


class FeatureUpdateResponse(BaseModel):
    feature_key: str
    mine_id: str
    enabled: bool
    notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────


@router.get("/features/catalog", response_model=FeatureCatalogResponse)
async def list_feature_catalog():
    """List all available features (public)."""
    items = [
        FeatureCatalogItem(
            key=key,
            name=entry["name"],
            description=entry["description"],
            default_enabled=entry["default_enabled"],
            icon=entry.get("icon", ""),
        )
        for key, entry in FEATURE_CATALOG.items()
    ]
    return FeatureCatalogResponse(features=items)


@router.get("/mines/{mine_id}/features", response_model=MineFeatureListResponse)
async def list_mine_features(
    mine_id: uuid.UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """List feature statuses for a mine (admin only)."""
    # Fetch explicit records
    result = await db.execute(
        select(MineFeature).where(MineFeature.mine_id == mine_id)
    )
    records = {r.feature_key: r for r in result.scalars().all()}

    features: List[MineFeatureStatus] = []
    for key, catalog in FEATURE_CATALOG.items():
        record = records.get(key)
        if record:
            features.append(
                MineFeatureStatus(
                    feature_key=key,
                    name=catalog["name"],
                    description=catalog["description"],
                    enabled=record.enabled,
                    enabled_at=record.enabled_at.isoformat() if record.enabled_at else None,
                    disabled_at=record.disabled_at.isoformat() if record.disabled_at else None,
                    notes=record.notes,
                    is_default=False,
                )
            )
        else:
            features.append(
                MineFeatureStatus(
                    feature_key=key,
                    name=catalog["name"],
                    description=catalog["description"],
                    enabled=catalog["default_enabled"],
                    is_default=True,
                )
            )

    return MineFeatureListResponse(mine_id=str(mine_id), features=features)


@router.put(
    "/mines/{mine_id}/features/{feature_key}",
    response_model=FeatureUpdateResponse,
)
async def update_mine_feature(
    mine_id: uuid.UUID,
    feature_key: str,
    request: FeatureUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enable or disable a feature for a mine (admin only)."""
    if feature_key not in FEATURE_CATALOG:
        raise HTTPException(404, f"Unknown feature: {feature_key}")

    result = await db.execute(
        select(MineFeature).where(
            MineFeature.mine_id == mine_id,
            MineFeature.feature_key == feature_key,
        )
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if record:
        record.enabled = request.enabled
        record.notes = request.notes if request.notes is not None else record.notes
        if request.enabled:
            record.enabled_at = now
            record.disabled_at = None
            record.enabled_by = admin.id
        else:
            record.disabled_at = now
    else:
        record = MineFeature(
            mine_id=mine_id,
            feature_key=feature_key,
            enabled=request.enabled,
            enabled_by=admin.id,
            enabled_at=now,
            disabled_at=None if request.enabled else now,
            notes=request.notes,
        )
        db.add(record)

    await db.flush()

    return FeatureUpdateResponse(
        feature_key=feature_key,
        mine_id=str(mine_id),
        enabled=record.enabled,
        notes=record.notes,
    )
