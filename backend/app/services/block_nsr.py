"""Batch NSR calculation service for block models."""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.block_model import Block, BlockImport, BlockNsrSnapshot
from app.models.mine import Mine
from app.nsr_engine.calculations import compute_nsr_complete
from app.nsr_engine.models import NSRInput
from app.nsr_engine.constants import (
    DEFAULT_CU_PRICE_PER_LB,
    DEFAULT_AU_PRICE_PER_OZ,
    DEFAULT_AG_PRICE_PER_OZ,
    RECOVERY_PARAMS,
    DEFAULT_RECOVERY_PARAMS,
)

logger = logging.getLogger(__name__)


# Marginal threshold: blocks within this % of cutoff are "marginal"
MARGINAL_THRESHOLD_PCT = 10.0  # 10% above cutoff


def _resolve_area(block: Block, mine: Mine) -> str:
    """Determine the recovery area for a block.

    Priority:
    1. block.zone (if it matches a known recovery area)
    2. First area in mine recovery_params
    3. Mine name as fallback
    """
    if block.zone and block.zone in RECOVERY_PARAMS:
        return block.zone

    # Check if mine has custom recovery_params with areas
    if mine.recovery_params and isinstance(mine.recovery_params, dict):
        areas = mine.recovery_params.get("areas", {})
        if block.zone and block.zone in areas:
            return block.zone
        # Use first area as default
        if areas:
            return next(iter(areas))

    return mine.name


async def calculate_nsr_for_import(
    db: AsyncSession,
    import_id: uuid.UUID,
    cutoff_cost: float,
    cu_price: Optional[float] = None,
    au_price: Optional[float] = None,
    ag_price: Optional[float] = None,
) -> Dict[str, Any]:
    """Calculate NSR for every block in an import and create snapshots.

    Args:
        db: Database session
        import_id: BlockImport UUID
        cutoff_cost: $/t cost cutoff for viability
        cu_price, au_price, ag_price: Metal prices (uses defaults if None)

    Returns:
        Summary statistics dict
    """
    # Resolve prices
    cu_price = cu_price or DEFAULT_CU_PRICE_PER_LB
    au_price = au_price or DEFAULT_AU_PRICE_PER_OZ
    ag_price = ag_price or DEFAULT_AG_PRICE_PER_OZ

    # Load import and its mine
    result = await db.execute(
        select(BlockImport).where(BlockImport.id == import_id)
    )
    block_import = result.scalar_one_or_none()
    if not block_import:
        raise ValueError(f"BlockImport {import_id} not found.")

    result = await db.execute(
        select(Mine).where(Mine.id == block_import.mine_id)
    )
    mine = result.scalar_one_or_none()
    if not mine:
        raise ValueError(f"Mine {block_import.mine_id} not found.")

    # Load all blocks for this import
    result = await db.execute(
        select(Block).where(Block.import_id == import_id)
    )
    blocks = list(result.scalars().all())

    if not blocks:
        raise ValueError("No blocks found for this import.")

    now = datetime.now(timezone.utc)
    snapshots: List[BlockNsrSnapshot] = []
    stats = {
        "total_blocks": len(blocks),
        "viable_blocks": 0,
        "marginal_blocks": 0,
        "inviable_blocks": 0,
        "viable_tonnage": 0.0,
        "marginal_tonnage": 0.0,
        "inviable_tonnage": 0.0,
        "total_tonnage": 0.0,
        "avg_nsr": 0.0,
        "min_nsr": float("inf"),
        "max_nsr": float("-inf"),
    }

    nsr_sum = 0.0
    marginal_upper = cutoff_cost * (1 + MARGINAL_THRESHOLD_PCT / 100.0)

    # Extract commercial terms from the mine (if available)
    ct = mine.commercial_terms or {}

    for block in blocks:
        area = _resolve_area(block, mine)
        tonnage = block.tonnage or 0.0

        try:
            nsr_input = NSRInput(
                mine=mine.name,
                area=area,
                cu_grade=block.cu_grade,
                au_grade=block.au_grade or 0.0,
                ag_grade=block.ag_grade or 0.0,
                ore_tonnage=tonnage if tonnage > 0 else 1.0,
                cu_price=cu_price,
                au_price=au_price,
                ag_price=ag_price,
                # Commercial terms from mine config
                cu_payability=ct.get("cu_payability"),
                cu_tc=ct.get("cu_tc"),
                cu_rc=ct.get("cu_rc"),
                cu_freight=ct.get("cu_freight"),
                au_payability=ct.get("au_payability"),
                au_rc=ct.get("au_rc"),
                ag_payability=ct.get("ag_payability"),
                ag_rc=ct.get("ag_rc"),
                cu_conc_grade=ct.get("cu_conc_grade"),
                mine_dilution=ct.get("mine_dilution", 0.14),
                ore_recovery=ct.get("ore_recovery", 0.98),
            )
            nsr_result = compute_nsr_complete(nsr_input)
        except Exception as exc:
            logger.warning(
                "NSR calc failed for block %s: %s", block.id, exc
            )
            # Create a zero-NSR snapshot so the block isn't silently skipped
            nsr_result = None

        nsr_per_tonne = nsr_result.nsr_per_tonne if nsr_result else 0.0
        nsr_cu = nsr_result.nsr_cu if nsr_result else 0.0
        nsr_au = nsr_result.nsr_au if nsr_result else 0.0
        nsr_ag = nsr_result.nsr_ag if nsr_result else 0.0
        margin = nsr_per_tonne - cutoff_cost
        is_viable = nsr_per_tonne >= cutoff_cost

        snapshot = BlockNsrSnapshot(
            id=uuid.uuid4(),
            block_id=block.id,
            calculated_at=now,
            nsr_per_tonne=nsr_per_tonne,
            nsr_cu=nsr_cu,
            nsr_au=nsr_au,
            nsr_ag=nsr_ag,
            cu_price=cu_price,
            au_price=au_price,
            ag_price=ag_price,
            cutoff_cost=cutoff_cost,
            is_viable=is_viable,
            margin=margin,
        )
        snapshots.append(snapshot)

        # Accumulate stats
        nsr_sum += nsr_per_tonne
        stats["total_tonnage"] += tonnage
        stats["min_nsr"] = min(stats["min_nsr"], nsr_per_tonne)
        stats["max_nsr"] = max(stats["max_nsr"], nsr_per_tonne)

        if is_viable:
            if nsr_per_tonne <= marginal_upper:
                stats["marginal_blocks"] += 1
                stats["marginal_tonnage"] += tonnage
            else:
                stats["viable_blocks"] += 1
                stats["viable_tonnage"] += tonnage
        else:
            stats["inviable_blocks"] += 1
            stats["inviable_tonnage"] += tonnage

    db.add_all(snapshots)
    await db.flush()

    stats["avg_nsr"] = nsr_sum / len(blocks) if blocks else 0.0
    if stats["min_nsr"] == float("inf"):
        stats["min_nsr"] = 0.0
    if stats["max_nsr"] == float("-inf"):
        stats["max_nsr"] = 0.0
    stats["snapshot_date"] = now.isoformat()
    stats["prices_used"] = {
        "cu_price": cu_price,
        "au_price": au_price,
        "ag_price": ag_price,
    }
    stats["cutoff_cost"] = cutoff_cost

    return stats
