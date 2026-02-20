"""Block model endpoints — upload, CRUD, NSR calculation, visualisation, export."""

import csv
import io
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, distinct
from starlette.responses import StreamingResponse

from app.db.session import get_db
from app.models.block_model import Block, BlockImport, BlockNsrSnapshot
from app.models.mine import Mine
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.auth.feature_guard import require_feature
from app.auth.permissions import check_mine_access
from app.services.block_import import (
    parse_csv_preview,
    import_blocks_from_csv,
    validate_mapping,
    KNOWN_FIELDS,
)
from app.services.block_nsr import calculate_nsr_for_import

router = APIRouter(prefix="/blocks", tags=["Blocks"])


# ──────────────────────────────────────────────────────────
# Request / Response schemas
# ──────────────────────────────────────────────────────────


class PreviewResponse(BaseModel):
    headers: List[str]
    sample_rows: List[List[str]]
    suggested_mapping: Dict[str, str]
    known_fields: List[str]


class ImportRequest(BaseModel):
    mine_id: str = Field(..., description="Mine UUID")
    name: str = Field(..., min_length=1, max_length=255)
    column_mapping: Dict[str, str] = Field(
        ..., description="CSV header -> internal field mapping"
    )


class BlockImportResponse(BaseModel):
    id: str
    mine_id: str
    mine_name: str
    name: str
    source_filename: str
    column_mapping: Dict[str, str]
    block_count: int
    created_at: str
    created_by: Optional[str] = None


class BlockResponse(BaseModel):
    id: str
    x: float
    y: float
    z: float
    dx: Optional[float] = None
    dy: Optional[float] = None
    dz: Optional[float] = None
    cu_grade: float
    au_grade: Optional[float] = None
    ag_grade: Optional[float] = None
    density: Optional[float] = None
    tonnage: Optional[float] = None
    rock_type: Optional[str] = None
    zone: Optional[str] = None
    deswik_block_id: Optional[str] = None


class CalculateRequest(BaseModel):
    cutoff_cost: float = Field(..., ge=0, description="Cutoff cost $/t")
    cu_price: Optional[float] = Field(default=None, description="Cu price $/lb")
    au_price: Optional[float] = Field(default=None, description="Au price $/oz")
    ag_price: Optional[float] = Field(default=None, description="Ag price $/oz")


class HeatmapBlock(BaseModel):
    id: str
    x: float
    y: float
    z: float
    dx: Optional[float] = None
    dy: Optional[float] = None
    cu_grade: float
    tonnage: Optional[float] = None
    rock_type: Optional[str] = None
    zone: Optional[str] = None
    nsr_per_tonne: float
    nsr_cu: float
    nsr_au: float
    nsr_ag: float
    is_viable: bool
    margin: float


class HeatmapResponse(BaseModel):
    import_id: str
    z_level: float
    snapshot_date: str
    blocks: List[HeatmapBlock]
    cutoff_cost: float


class ViabilityTimelinePoint(BaseModel):
    snapshot_date: str
    viable_tonnage: float
    marginal_tonnage: float
    inviable_tonnage: float
    viable_blocks: int
    marginal_blocks: int
    inviable_blocks: int
    avg_nsr: float
    cu_price: float
    au_price: float
    ag_price: float


class ViabilityTimelineResponse(BaseModel):
    import_id: str
    points: List[ViabilityTimelinePoint]


class StatsResponse(BaseModel):
    import_id: str
    snapshot_date: Optional[str] = None
    total_blocks: int
    viable_blocks: int
    marginal_blocks: int
    inviable_blocks: int
    total_tonnage: float
    viable_tonnage: float
    marginal_tonnage: float
    inviable_tonnage: float
    avg_nsr: float
    min_nsr: float
    max_nsr: float
    cutoff_cost: float


# ──────────────────────────────────────────────────────────
# Upload / Preview
# ──────────────────────────────────────────────────────────


@router.post("/upload/preview", response_model=PreviewResponse)
async def upload_preview(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    """Upload a CSV and get headers, sample rows, and suggested column mapping."""
    content = (await file.read()).decode("utf-8-sig")
    headers, sample_rows, suggested = parse_csv_preview(content)
    return PreviewResponse(
        headers=headers,
        sample_rows=sample_rows,
        suggested_mapping=suggested,
        known_fields=sorted(KNOWN_FIELDS),
    )


@router.post("/upload", response_model=BlockImportResponse)
async def upload_blocks(
    file: UploadFile = File(...),
    mine_id: str = Form(...),
    name: str = Form(...),
    column_mapping: str = Form(...),  # JSON string
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Import a Deswik CSV block model.

    The ``column_mapping`` field is a JSON string, e.g.
    ``{"XCENTRE": "x", "YCENTRE": "y", ...}``.
    """
    import json

    try:
        mine_uuid = uuid.UUID(mine_id)
    except ValueError:
        raise HTTPException(400, "Invalid mine_id UUID")

    # Check feature toggle
    from app.models.mine_feature import MineFeature
    from app.features import FEATURE_CATALOG

    feature_row = await db.execute(
        select(MineFeature).where(
            MineFeature.mine_id == mine_uuid,
            MineFeature.feature_key == "block_model",
        )
    )
    feature = feature_row.scalar_one_or_none()
    catalog = FEATURE_CATALOG["block_model"]
    if feature is None and not catalog["default_enabled"]:
        raise HTTPException(403, "Block Model feature is not enabled for this mine.")
    if feature is not None and not feature.enabled:
        raise HTTPException(403, "Block Model feature is disabled for this mine.")

    # Check mine access
    has_access = await check_mine_access(db, user, mine_uuid, ["admin", "editor"])
    if not has_access:
        raise HTTPException(403, "No access to this mine.")

    # Parse mapping JSON
    try:
        mapping = json.loads(column_mapping)
    except json.JSONDecodeError:
        raise HTTPException(400, "column_mapping must be valid JSON")

    errors = validate_mapping(mapping)
    if errors:
        raise HTTPException(422, detail="; ".join(errors))

    content = (await file.read()).decode("utf-8-sig")

    try:
        block_import = await import_blocks_from_csv(
            db=db,
            csv_content=content,
            mine_id=mine_uuid,
            name=name,
            source_filename=file.filename or "upload.csv",
            column_mapping=mapping,
            user_id=user.id,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))

    # Fetch mine name
    mine_result = await db.execute(select(Mine.name).where(Mine.id == mine_uuid))
    mine_name = mine_result.scalar_one_or_none() or ""

    return BlockImportResponse(
        id=str(block_import.id),
        mine_id=str(block_import.mine_id),
        mine_name=mine_name,
        name=block_import.name,
        source_filename=block_import.source_filename,
        column_mapping=block_import.column_mapping,
        block_count=block_import.block_count,
        created_at=block_import.created_at.isoformat() if block_import.created_at else "",
        created_by=str(block_import.created_by) if block_import.created_by else None,
    )


# ──────────────────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────────────────


@router.get("/imports")
async def list_imports(
    mine_id: Optional[str] = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List block imports, optionally filtered by mine."""
    query = select(BlockImport).order_by(BlockImport.created_at.desc())
    if mine_id:
        try:
            query = query.where(BlockImport.mine_id == uuid.UUID(mine_id))
        except ValueError:
            raise HTTPException(400, "Invalid mine_id")

    result = await db.execute(query)
    imports = result.scalars().all()

    items = []
    for bi in imports:
        mine_result = await db.execute(select(Mine.name).where(Mine.id == bi.mine_id))
        mine_name = mine_result.scalar_one_or_none() or ""
        items.append(
            BlockImportResponse(
                id=str(bi.id),
                mine_id=str(bi.mine_id),
                mine_name=mine_name,
                name=bi.name,
                source_filename=bi.source_filename,
                column_mapping=bi.column_mapping,
                block_count=bi.block_count,
                created_at=bi.created_at.isoformat() if bi.created_at else "",
                created_by=str(bi.created_by) if bi.created_by else None,
            )
        )
    return {"imports": items, "total": len(items)}


@router.get("/imports/{import_id}", response_model=BlockImportResponse)
async def get_import(
    import_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlockImport).where(BlockImport.id == import_id)
    )
    bi = result.scalar_one_or_none()
    if not bi:
        raise HTTPException(404, "Import not found")

    mine_result = await db.execute(select(Mine.name).where(Mine.id == bi.mine_id))
    mine_name = mine_result.scalar_one_or_none() or ""

    return BlockImportResponse(
        id=str(bi.id),
        mine_id=str(bi.mine_id),
        mine_name=mine_name,
        name=bi.name,
        source_filename=bi.source_filename,
        column_mapping=bi.column_mapping,
        block_count=bi.block_count,
        created_at=bi.created_at.isoformat() if bi.created_at else "",
        created_by=str(bi.created_by) if bi.created_by else None,
    )


@router.delete("/imports/{import_id}", status_code=204)
async def delete_import(
    import_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlockImport).where(BlockImport.id == import_id)
    )
    bi = result.scalar_one_or_none()
    if not bi:
        raise HTTPException(404, "Import not found")

    has_access = await check_mine_access(db, user, bi.mine_id, ["admin", "editor"])
    if not has_access:
        raise HTTPException(403, "No permission to delete this import.")

    await db.execute(delete(BlockImport).where(BlockImport.id == import_id))
    await db.flush()


@router.get("/imports/{import_id}/blocks")
async def list_blocks(
    import_id: uuid.UUID,
    zone: Optional[str] = Query(default=None),
    rock_type: Optional[str] = Query(default=None),
    cu_min: Optional[float] = Query(default=None),
    cu_max: Optional[float] = Query(default=None),
    viable_only: Optional[bool] = Query(default=None),
    snapshot_date: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List blocks with optional filters and pagination."""
    query = select(Block).where(Block.import_id == import_id)

    if zone:
        query = query.where(Block.zone == zone)
    if rock_type:
        query = query.where(Block.rock_type == rock_type)
    if cu_min is not None:
        query = query.where(Block.cu_grade >= cu_min)
    if cu_max is not None:
        query = query.where(Block.cu_grade <= cu_max)

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    blocks = result.scalars().all()

    # If snapshot filtering requested, get latest snapshot data
    snapshot_data: Dict[uuid.UUID, BlockNsrSnapshot] = {}
    if (viable_only is not None or snapshot_date) and blocks:
        block_ids = [b.id for b in blocks]
        snap_q = select(BlockNsrSnapshot).where(
            BlockNsrSnapshot.block_id.in_(block_ids)
        )
        if snapshot_date:
            snap_q = snap_q.where(
                func.date(BlockNsrSnapshot.calculated_at) == snapshot_date
            )
        snap_q = snap_q.order_by(BlockNsrSnapshot.calculated_at.desc())
        snap_result = await db.execute(snap_q)
        for snap in snap_result.scalars().all():
            if snap.block_id not in snapshot_data:
                snapshot_data[snap.block_id] = snap

    items = []
    for b in blocks:
        if viable_only is not None and b.id in snapshot_data:
            snap = snapshot_data[b.id]
            if viable_only and not snap.is_viable:
                continue
            if not viable_only and snap.is_viable:
                continue

        item: Dict[str, Any] = {
            "id": str(b.id),
            "x": b.x,
            "y": b.y,
            "z": b.z,
            "dx": b.dx,
            "dy": b.dy,
            "dz": b.dz,
            "cu_grade": b.cu_grade,
            "au_grade": b.au_grade,
            "ag_grade": b.ag_grade,
            "density": b.density,
            "tonnage": b.tonnage,
            "rock_type": b.rock_type,
            "zone": b.zone,
            "deswik_block_id": b.deswik_block_id,
        }

        # Attach latest snapshot if available
        if b.id in snapshot_data:
            snap = snapshot_data[b.id]
            item["nsr_per_tonne"] = snap.nsr_per_tonne
            item["is_viable"] = snap.is_viable
            item["margin"] = snap.margin

        items.append(item)

    return {"blocks": items, "total": total, "page": page, "page_size": page_size}


@router.get("/imports/{import_id}/levels")
async def list_levels(
    import_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get unique Z levels for the heatmap slider."""
    result = await db.execute(
        select(distinct(Block.z))
        .where(Block.import_id == import_id)
        .order_by(Block.z)
    )
    levels = [row[0] for row in result.fetchall()]
    return {"levels": levels, "count": len(levels)}


# ──────────────────────────────────────────────────────────
# NSR Calculation
# ──────────────────────────────────────────────────────────


@router.post("/imports/{import_id}/calculate")
async def calculate_nsr(
    import_id: uuid.UUID,
    request: CalculateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate NSR for all blocks in an import and save snapshots."""
    # Verify import exists & user has access
    result = await db.execute(
        select(BlockImport).where(BlockImport.id == import_id)
    )
    bi = result.scalar_one_or_none()
    if not bi:
        raise HTTPException(404, "Import not found")

    has_access = await check_mine_access(db, user, bi.mine_id, ["admin", "editor"])
    if not has_access:
        raise HTTPException(403, "No permission.")

    try:
        stats = await calculate_nsr_for_import(
            db=db,
            import_id=import_id,
            cutoff_cost=request.cutoff_cost,
            cu_price=request.cu_price,
            au_price=request.au_price,
            ag_price=request.ag_price,
        )
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc))

    return stats


@router.get("/imports/{import_id}/snapshots")
async def list_snapshots(
    import_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List available snapshot dates for an import."""
    # Get distinct calculated_at dates via blocks
    result = await db.execute(
        select(distinct(func.date(BlockNsrSnapshot.calculated_at)))
        .join(Block, Block.id == BlockNsrSnapshot.block_id)
        .where(Block.import_id == import_id)
        .order_by(func.date(BlockNsrSnapshot.calculated_at).desc())
    )
    dates = [row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]) for row in result.fetchall()]
    return {"snapshots": dates, "count": len(dates)}


# ──────────────────────────────────────────────────────────
# Visualisation
# ──────────────────────────────────────────────────────────


@router.get("/imports/{import_id}/heatmap", response_model=HeatmapResponse)
async def get_heatmap(
    import_id: uuid.UUID,
    z: float = Query(..., description="Z level"),
    snapshot: Optional[str] = Query(default=None, description="Snapshot date (YYYY-MM-DD)"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get blocks at a given Z level with their latest NSR data for the heatmap."""
    # Fetch blocks at this Z level
    result = await db.execute(
        select(Block).where(Block.import_id == import_id, Block.z == z)
    )
    blocks = list(result.scalars().all())
    if not blocks:
        raise HTTPException(404, f"No blocks at z={z}")

    block_ids = [b.id for b in blocks]

    # Get latest snapshot for each block
    snap_q = (
        select(BlockNsrSnapshot)
        .where(BlockNsrSnapshot.block_id.in_(block_ids))
    )
    if snapshot:
        snap_q = snap_q.where(
            func.date(BlockNsrSnapshot.calculated_at) == snapshot
        )
    snap_q = snap_q.order_by(BlockNsrSnapshot.calculated_at.desc())

    snap_result = await db.execute(snap_q)
    snap_map: Dict[uuid.UUID, BlockNsrSnapshot] = {}
    cutoff = 0.0
    snap_date = ""
    for s in snap_result.scalars().all():
        if s.block_id not in snap_map:
            snap_map[s.block_id] = s
            cutoff = s.cutoff_cost
            if not snap_date:
                snap_date = s.calculated_at.isoformat()

    heatmap_blocks = []
    for b in blocks:
        s = snap_map.get(b.id)
        heatmap_blocks.append(
            HeatmapBlock(
                id=str(b.id),
                x=b.x,
                y=b.y,
                z=b.z,
                dx=b.dx,
                dy=b.dy,
                cu_grade=b.cu_grade,
                tonnage=b.tonnage,
                rock_type=b.rock_type,
                zone=b.zone,
                nsr_per_tonne=s.nsr_per_tonne if s else 0.0,
                nsr_cu=s.nsr_cu if s else 0.0,
                nsr_au=s.nsr_au if s else 0.0,
                nsr_ag=s.nsr_ag if s else 0.0,
                is_viable=s.is_viable if s else False,
                margin=s.margin if s else 0.0,
            )
        )

    return HeatmapResponse(
        import_id=str(import_id),
        z_level=z,
        snapshot_date=snap_date,
        blocks=heatmap_blocks,
        cutoff_cost=cutoff,
    )


@router.get("/imports/{import_id}/stats", response_model=StatsResponse)
async def get_stats(
    import_id: uuid.UUID,
    snapshot: Optional[str] = Query(default=None, description="Snapshot date"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate statistics for an import at a given snapshot."""
    # Get all blocks
    blocks_result = await db.execute(
        select(Block).where(Block.import_id == import_id)
    )
    blocks = list(blocks_result.scalars().all())
    if not blocks:
        raise HTTPException(404, "No blocks found.")

    block_ids = [b.id for b in blocks]
    tonnage_map = {b.id: b.tonnage or 0.0 for b in blocks}

    # Get snapshots
    snap_q = select(BlockNsrSnapshot).where(
        BlockNsrSnapshot.block_id.in_(block_ids)
    )
    if snapshot:
        snap_q = snap_q.where(
            func.date(BlockNsrSnapshot.calculated_at) == snapshot
        )
    snap_q = snap_q.order_by(BlockNsrSnapshot.calculated_at.desc())

    snap_result = await db.execute(snap_q)
    snap_map: Dict[uuid.UUID, BlockNsrSnapshot] = {}
    for s in snap_result.scalars().all():
        if s.block_id not in snap_map:
            snap_map[s.block_id] = s

    if not snap_map:
        return StatsResponse(
            import_id=str(import_id),
            total_blocks=len(blocks),
            viable_blocks=0,
            marginal_blocks=0,
            inviable_blocks=0,
            total_tonnage=sum(tonnage_map.values()),
            viable_tonnage=0.0,
            marginal_tonnage=0.0,
            inviable_tonnage=0.0,
            avg_nsr=0.0,
            min_nsr=0.0,
            max_nsr=0.0,
            cutoff_cost=0.0,
        )

    cutoff = list(snap_map.values())[0].cutoff_cost
    marginal_upper = cutoff * 1.10  # 10%
    viable = marginal = inviable = 0
    viable_t = marginal_t = inviable_t = total_t = 0.0
    nsr_sum = 0.0
    min_nsr = float("inf")
    max_nsr = float("-inf")
    snap_date = ""

    for block_id, s in snap_map.items():
        t = tonnage_map.get(block_id, 0.0)
        total_t += t
        nsr_sum += s.nsr_per_tonne
        min_nsr = min(min_nsr, s.nsr_per_tonne)
        max_nsr = max(max_nsr, s.nsr_per_tonne)
        if not snap_date:
            snap_date = s.calculated_at.isoformat()

        if s.is_viable:
            if s.nsr_per_tonne <= marginal_upper:
                marginal += 1
                marginal_t += t
            else:
                viable += 1
                viable_t += t
        else:
            inviable += 1
            inviable_t += t

    n = len(snap_map)
    return StatsResponse(
        import_id=str(import_id),
        snapshot_date=snap_date,
        total_blocks=len(blocks),
        viable_blocks=viable,
        marginal_blocks=marginal,
        inviable_blocks=inviable,
        total_tonnage=total_t,
        viable_tonnage=viable_t,
        marginal_tonnage=marginal_t,
        inviable_tonnage=inviable_t,
        avg_nsr=nsr_sum / n if n else 0.0,
        min_nsr=min_nsr if min_nsr != float("inf") else 0.0,
        max_nsr=max_nsr if max_nsr != float("-inf") else 0.0,
        cutoff_cost=cutoff,
    )


@router.get("/imports/{import_id}/viability-timeline", response_model=ViabilityTimelineResponse)
async def viability_timeline(
    import_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Viability evolution over time — one point per snapshot date."""
    # Get all blocks & their tonnage
    blocks_result = await db.execute(
        select(Block.id, Block.tonnage).where(Block.import_id == import_id)
    )
    block_rows = blocks_result.fetchall()
    if not block_rows:
        return ViabilityTimelineResponse(import_id=str(import_id), points=[])

    block_ids = [r[0] for r in block_rows]
    tonnage_map = {r[0]: r[1] or 0.0 for r in block_rows}

    # Get all snapshots grouped by date
    snap_result = await db.execute(
        select(BlockNsrSnapshot)
        .where(BlockNsrSnapshot.block_id.in_(block_ids))
        .order_by(BlockNsrSnapshot.calculated_at)
    )
    snapshots = list(snap_result.scalars().all())

    # Group by date
    from collections import defaultdict

    by_date: Dict[str, List[BlockNsrSnapshot]] = defaultdict(list)
    for s in snapshots:
        date_key = s.calculated_at.strftime("%Y-%m-%d %H:%M")
        by_date[date_key].append(s)

    points: List[ViabilityTimelinePoint] = []
    for date_key in sorted(by_date.keys()):
        snaps = by_date[date_key]
        cutoff = snaps[0].cutoff_cost
        marginal_upper = cutoff * 1.10
        viable = marginal = inv = 0
        viable_t = marginal_t = inv_t = 0.0
        nsr_sum = 0.0
        cu_price = snaps[0].cu_price
        au_price = snaps[0].au_price
        ag_price = snaps[0].ag_price

        for s in snaps:
            t = tonnage_map.get(s.block_id, 0.0)
            nsr_sum += s.nsr_per_tonne
            if s.is_viable:
                if s.nsr_per_tonne <= marginal_upper:
                    marginal += 1
                    marginal_t += t
                else:
                    viable += 1
                    viable_t += t
            else:
                inv += 1
                inv_t += t

        n = len(snaps)
        points.append(
            ViabilityTimelinePoint(
                snapshot_date=date_key,
                viable_tonnage=viable_t,
                marginal_tonnage=marginal_t,
                inviable_tonnage=inv_t,
                viable_blocks=viable,
                marginal_blocks=marginal,
                inviable_blocks=inv,
                avg_nsr=nsr_sum / n if n else 0.0,
                cu_price=cu_price,
                au_price=au_price,
                ag_price=ag_price,
            )
        )

    return ViabilityTimelineResponse(import_id=str(import_id), points=points)


# ──────────────────────────────────────────────────────────
# Export
# ──────────────────────────────────────────────────────────


@router.get("/imports/{import_id}/export")
async def export_csv(
    import_id: uuid.UUID,
    snapshot: Optional[str] = Query(default=None, description="Snapshot date"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export blocks + NSR as CSV for re-import into Deswik."""
    # Load import for column mapping
    imp_result = await db.execute(
        select(BlockImport).where(BlockImport.id == import_id)
    )
    bi = imp_result.scalar_one_or_none()
    if not bi:
        raise HTTPException(404, "Import not found")

    # Load blocks
    blocks_result = await db.execute(
        select(Block).where(Block.import_id == import_id)
    )
    blocks = list(blocks_result.scalars().all())

    # Load snapshots
    block_ids = [b.id for b in blocks]
    snap_q = select(BlockNsrSnapshot).where(
        BlockNsrSnapshot.block_id.in_(block_ids)
    )
    if snapshot:
        snap_q = snap_q.where(
            func.date(BlockNsrSnapshot.calculated_at) == snapshot
        )
    snap_q = snap_q.order_by(BlockNsrSnapshot.calculated_at.desc())
    snap_result = await db.execute(snap_q)
    snap_map: Dict[uuid.UUID, BlockNsrSnapshot] = {}
    for s in snap_result.scalars().all():
        if s.block_id not in snap_map:
            snap_map[s.block_id] = s

    # Build inverse mapping: internal_field -> csv_header
    inv_mapping = {v: k for k, v in bi.column_mapping.items()}

    # Determine CSV columns: original headers + NSR columns
    original_headers = list(bi.column_mapping.keys())
    # Add extra attribute columns from first block
    extra_keys: List[str] = []
    for b in blocks:
        if b.extra_attributes:
            extra_keys = sorted(b.extra_attributes.keys())
            break

    nsr_headers = [
        "nsr_per_tonne", "nsr_cu", "nsr_au", "nsr_ag",
        "is_viable", "cutoff_cost", "margin", "calculated_at",
    ]
    all_headers = original_headers + extra_keys + nsr_headers

    # Internal field -> block attribute
    field_attr_map = {
        "x": "x", "y": "y", "z": "z",
        "dx": "dx", "dy": "dy", "dz": "dz",
        "cu_grade": "cu_grade", "au_grade": "au_grade", "ag_grade": "ag_grade",
        "density": "density", "tonnage": "tonnage",
        "rock_type": "rock_type", "zone": "zone",
        "deswik_block_id": "deswik_block_id",
    }

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(all_headers)

    for b in blocks:
        row = []
        # Original mapped columns
        for header in original_headers:
            field = bi.column_mapping.get(header, "")
            attr = field_attr_map.get(field)
            if attr:
                row.append(getattr(b, attr, ""))
            else:
                row.append("")

        # Extra attributes
        for key in extra_keys:
            val = (b.extra_attributes or {}).get(key, "")
            row.append(val)

        # NSR columns
        s = snap_map.get(b.id)
        if s:
            row.extend([
                s.nsr_per_tonne,
                s.nsr_cu,
                s.nsr_au,
                s.nsr_ag,
                s.is_viable,
                s.cutoff_cost,
                s.margin,
                s.calculated_at.isoformat() if s.calculated_at else "",
            ])
        else:
            row.extend([""] * len(nsr_headers))

        writer.writerow(row)

    output.seek(0)
    filename = f"{bi.name.replace(' ', '_')}_nsr_export.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
