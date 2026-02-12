"""Goal Seek scenario and NSR snapshot models."""

import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List, TYPE_CHECKING

from sqlalchemy import String, Float, Boolean, DateTime, ForeignKey, func, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class GoalSeekScenario(Base):
    """Goal Seek scenario - saved viability analysis with optional alert."""

    __tablename__ = "goal_seek_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mine_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mines.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Goal Seek parameters
    base_inputs: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    target_variable: Mapped[str] = mapped_column(String(50), nullable=False)
    target_nsr: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)

    # Alert configuration
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    alert_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    alert_frequency: Mapped[str] = mapped_column(
        String(20), nullable=False, default="daily"
    )  # "hourly", "daily", "weekly"
    alert_last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    alert_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_nsr_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    mine: Mapped[Optional["Mine"]] = relationship("Mine", foreign_keys=[mine_id])
    snapshots: Mapped[List["NsrSnapshot"]] = relationship(
        "NsrSnapshot",
        back_populates="scenario",
        cascade="all, delete-orphan",
        order_by="NsrSnapshot.timestamp.desc()",
    )

    def __repr__(self) -> str:
        return f"<GoalSeekScenario {self.name} ({self.target_variable})>"


class NsrSnapshot(Base):
    """Periodic NSR computation snapshot for time series charting."""

    __tablename__ = "nsr_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("goal_seek_scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Timestamp
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # NSR values
    nsr_per_tonne: Mapped[float] = mapped_column(Float, nullable=False)
    nsr_cu: Mapped[float] = mapped_column(Float, nullable=False)
    nsr_au: Mapped[float] = mapped_column(Float, nullable=False)
    nsr_ag: Mapped[float] = mapped_column(Float, nullable=False)

    # Prices used
    cu_price: Mapped[float] = mapped_column(Float, nullable=False)
    au_price: Mapped[float] = mapped_column(Float, nullable=False)
    ag_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Costs used
    cu_tc: Mapped[float] = mapped_column(Float, nullable=False)
    cu_rc: Mapped[float] = mapped_column(Float, nullable=False)
    cu_freight: Mapped[float] = mapped_column(Float, nullable=False)

    # Viability
    is_viable: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # Extra data
    metadata_extra: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )

    # Relationship
    scenario: Mapped["GoalSeekScenario"] = relationship(
        "GoalSeekScenario", back_populates="snapshots"
    )

    __table_args__ = (
        Index("ix_nsr_snapshots_scenario_timestamp", "scenario_id", "timestamp"),
    )

    def __repr__(self) -> str:
        return f"<NsrSnapshot {self.timestamp} NSR={self.nsr_per_tonne}>"
