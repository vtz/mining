"""Goal Seek scenario CRUD endpoints and NSR time series history."""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Any, Dict

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.session import get_db
from app.models.user import User
from app.models.goal_seek import GoalSeekScenario, NsrSnapshot
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/goal-seek-scenarios", tags=["Goal Seek"])


# ──────────────────────────────────────────────────────────
# Request / Response Models
# ──────────────────────────────────────────────────────────


class ScenarioCreateRequest(BaseModel):
    """Request to create a Goal Seek scenario."""

    name: str = Field(..., min_length=1, max_length=255)
    mine_id: Optional[str] = Field(default=None, description="Optional mine UUID")
    base_inputs: Dict[str, Any] = Field(..., description="Full NSRInput snapshot")
    target_variable: str = Field(..., description="Variable solved for")
    target_nsr: float = Field(default=0.0, description="Target NSR value ($/t)")
    threshold_value: float = Field(..., description="Computed threshold value")
    alert_enabled: bool = Field(default=False)
    alert_email: Optional[str] = Field(default=None)
    alert_frequency: str = Field(
        default="daily", description="hourly | daily | weekly"
    )


class ScenarioAlertUpdateRequest(BaseModel):
    """Request to update alert settings on a scenario."""

    alert_enabled: Optional[bool] = None
    alert_email: Optional[str] = None
    alert_frequency: Optional[str] = Field(
        default=None, description="hourly | daily | weekly"
    )


class ScenarioResponse(BaseModel):
    """Response for a single Goal Seek scenario."""

    id: str
    name: str
    mine_id: Optional[str]
    base_inputs: Dict[str, Any]
    target_variable: str
    target_nsr: float
    threshold_value: float
    alert_enabled: bool
    alert_email: Optional[str]
    alert_frequency: str
    alert_triggered_at: Optional[str]
    last_nsr_value: Optional[float]
    created_at: str
    updated_at: str


class ScenarioListResponse(BaseModel):
    """Response for listing scenarios."""

    scenarios: List[ScenarioResponse]
    total: int


class SnapshotResponse(BaseModel):
    """Response for a single NSR snapshot."""

    timestamp: str
    nsr_per_tonne: float
    nsr_cu: float
    nsr_au: float
    nsr_ag: float
    cu_price: float
    au_price: float
    ag_price: float
    cu_tc: float
    cu_rc: float
    cu_freight: float
    is_viable: bool


class SnapshotHistoryResponse(BaseModel):
    """Response for snapshot time series."""

    scenario_id: str
    target_nsr: float
    snapshots: List[SnapshotResponse]
    total: int


# ──────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────

VALID_FREQUENCIES = {"hourly", "daily", "weekly"}


def _scenario_to_response(s: GoalSeekScenario) -> ScenarioResponse:
    return ScenarioResponse(
        id=str(s.id),
        name=s.name,
        mine_id=str(s.mine_id) if s.mine_id else None,
        base_inputs=s.base_inputs,
        target_variable=s.target_variable,
        target_nsr=s.target_nsr,
        threshold_value=s.threshold_value,
        alert_enabled=s.alert_enabled,
        alert_email=s.alert_email,
        alert_frequency=s.alert_frequency,
        alert_triggered_at=(
            s.alert_triggered_at.isoformat() if s.alert_triggered_at else None
        ),
        last_nsr_value=s.last_nsr_value,
        created_at=s.created_at.isoformat(),
        updated_at=s.updated_at.isoformat(),
    )


# ──────────────────────────────────────────────────────────
# CRUD Endpoints
# ──────────────────────────────────────────────────────────


@router.post("", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    request: ScenarioCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioResponse:
    """Create a new Goal Seek scenario."""
    if request.alert_frequency not in VALID_FREQUENCIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid frequency: {request.alert_frequency}. Must be one of {VALID_FREQUENCIES}",
        )

    mine_uuid = None
    if request.mine_id:
        try:
            mine_uuid = uuid.UUID(request.mine_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid mine_id UUID")

    scenario = GoalSeekScenario(
        user_id=current_user.id,
        mine_id=mine_uuid,
        name=request.name,
        base_inputs=request.base_inputs,
        target_variable=request.target_variable,
        target_nsr=request.target_nsr,
        threshold_value=request.threshold_value,
        alert_enabled=request.alert_enabled,
        alert_email=request.alert_email,
        alert_frequency=request.alert_frequency,
    )

    db.add(scenario)
    await db.flush()
    await db.refresh(scenario)

    return _scenario_to_response(scenario)


@router.get("", response_model=ScenarioListResponse)
async def list_scenarios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioListResponse:
    """List all Goal Seek scenarios for the current user."""
    result = await db.execute(
        select(GoalSeekScenario)
        .where(GoalSeekScenario.user_id == current_user.id)
        .order_by(GoalSeekScenario.created_at.desc())
    )
    scenarios = result.scalars().all()

    return ScenarioListResponse(
        scenarios=[_scenario_to_response(s) for s in scenarios],
        total=len(scenarios),
    )


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioResponse:
    """Get a single Goal Seek scenario."""
    try:
        sid = uuid.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scenario_id UUID")

    result = await db.execute(
        select(GoalSeekScenario).where(
            GoalSeekScenario.id == sid,
            GoalSeekScenario.user_id == current_user.id,
        )
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    return _scenario_to_response(scenario)


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a Goal Seek scenario and its snapshots."""
    try:
        sid = uuid.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scenario_id UUID")

    result = await db.execute(
        select(GoalSeekScenario).where(
            GoalSeekScenario.id == sid,
            GoalSeekScenario.user_id == current_user.id,
        )
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    await db.delete(scenario)


@router.patch("/{scenario_id}/alert", response_model=ScenarioResponse)
async def update_scenario_alert(
    scenario_id: str,
    request: ScenarioAlertUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScenarioResponse:
    """Update alert settings on a Goal Seek scenario."""
    try:
        sid = uuid.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scenario_id UUID")

    result = await db.execute(
        select(GoalSeekScenario).where(
            GoalSeekScenario.id == sid,
            GoalSeekScenario.user_id == current_user.id,
        )
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if request.alert_enabled is not None:
        scenario.alert_enabled = request.alert_enabled
    if request.alert_email is not None:
        scenario.alert_email = request.alert_email
    if request.alert_frequency is not None:
        if request.alert_frequency not in VALID_FREQUENCIES:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid frequency: {request.alert_frequency}",
            )
        scenario.alert_frequency = request.alert_frequency

    await db.flush()
    await db.refresh(scenario)

    return _scenario_to_response(scenario)


# ──────────────────────────────────────────────────────────
# Time Series History
# ──────────────────────────────────────────────────────────


@router.get("/{scenario_id}/history", response_model=SnapshotHistoryResponse)
async def get_scenario_history(
    scenario_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    from_date: Optional[str] = Query(
        default=None, alias="from", description="ISO date start (e.g., 2026-01-01)"
    ),
    to_date: Optional[str] = Query(
        default=None, alias="to", description="ISO date end"
    ),
    limit: int = Query(default=500, le=2000, description="Max snapshots to return"),
) -> SnapshotHistoryResponse:
    """
    Get NSR snapshot history for a scenario (time series data).

    Used to render the stock-chart-style NSR time series visualization.
    """
    try:
        sid = uuid.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid scenario_id UUID")

    # Verify ownership
    result = await db.execute(
        select(GoalSeekScenario).where(
            GoalSeekScenario.id == sid,
            GoalSeekScenario.user_id == current_user.id,
        )
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Build snapshot query
    query = select(NsrSnapshot).where(NsrSnapshot.scenario_id == sid)

    if from_date:
        try:
            from_dt = datetime.fromisoformat(from_date).replace(tzinfo=timezone.utc)
            query = query.where(NsrSnapshot.timestamp >= from_dt)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid 'from' date format")

    if to_date:
        try:
            to_dt = datetime.fromisoformat(to_date).replace(tzinfo=timezone.utc)
            query = query.where(NsrSnapshot.timestamp <= to_dt)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid 'to' date format")

    query = query.order_by(NsrSnapshot.timestamp.asc()).limit(limit)

    result = await db.execute(query)
    snapshots = result.scalars().all()

    return SnapshotHistoryResponse(
        scenario_id=str(sid),
        target_nsr=scenario.target_nsr,
        snapshots=[
            SnapshotResponse(
                timestamp=s.timestamp.isoformat(),
                nsr_per_tonne=s.nsr_per_tonne,
                nsr_cu=s.nsr_cu,
                nsr_au=s.nsr_au,
                nsr_ag=s.nsr_ag,
                cu_price=s.cu_price,
                au_price=s.au_price,
                ag_price=s.ag_price,
                cu_tc=s.cu_tc,
                cu_rc=s.cu_rc,
                cu_freight=s.cu_freight,
                is_viable=s.is_viable,
            )
            for s in snapshots
        ],
        total=len(snapshots),
    )
