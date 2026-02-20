"""Feature toggle guard — FastAPI dependency.

Usage::

    @router.post("/blocks/upload", dependencies=[Depends(require_feature("block_model"))])
    async def upload_blocks(mine_id: uuid.UUID, ...):
        ...
"""

import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.mine_feature import MineFeature
from app.features import FEATURE_CATALOG


def require_feature(feature_key: str) -> Callable:
    """Return a FastAPI dependency that enforces *feature_key* is enabled for a mine.

    The protected endpoint **must** receive ``mine_id: uuid.UUID`` as a path or
    query parameter so the guard can look it up.
    """
    async def _guard(
        mine_id: uuid.UUID,
        db: AsyncSession = Depends(get_db),
    ) -> None:
        catalog_entry = FEATURE_CATALOG.get(feature_key)
        if not catalog_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown feature: {feature_key}",
            )

        result = await db.execute(
            select(MineFeature).where(
                MineFeature.mine_id == mine_id,
                MineFeature.feature_key == feature_key,
            )
        )
        record = result.scalar_one_or_none()

        if record is None:
            # No explicit record — fall back to catalog default
            if not catalog_entry["default_enabled"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"Feature '{catalog_entry['name']}' is not enabled for this mine. "
                        "Contact your administrator to activate it."
                    ),
                )
            # default_enabled=True and no override → allow
            return

        if not record.enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Feature '{catalog_entry['name']}' is disabled for this mine. "
                    "Contact your administrator to re-enable it."
                ),
            )

    return _guard
