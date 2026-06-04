"""Mineral catalog and mine-mineral association models."""

import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List, TYPE_CHECKING

from sqlalchemy import (
    String, Boolean, Float, DateTime, ForeignKey, JSON,
    func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class Mineral(Base):
    """Admin-managed mineral catalog entry (replaces hardcoded SUPPORTED_METALS)."""

    __tablename__ = "minerals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(10), unique=True, nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    default_price: Mapped[float] = mapped_column(Float, nullable=False)
    grade_unit: Mapped[str] = mapped_column(String(20), nullable=False, default="%")
    implemented: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(),
    )

    created_by_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by],
    )
    mine_minerals: Mapped[List["MineMineral"]] = relationship(
        "MineMineral", back_populates="mineral", cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Mineral {self.code} ({self.name})>"


class MineMineral(Base):
    """Associates a mine with its minerals (primary + byproducts)."""

    __tablename__ = "mine_minerals"
    __table_args__ = (
        UniqueConstraint("mine_id", "mineral_id", name="uq_mine_mineral"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    mine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mineral_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("minerals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recovery_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    commercial_terms: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True,
    )

    mine: Mapped["Mine"] = relationship("Mine", back_populates="mine_minerals")
    mineral: Mapped["Mineral"] = relationship("Mineral", back_populates="mine_minerals")

    def __repr__(self) -> str:
        role = "PRIMARY" if self.is_primary else "byproduct"
        return f"<MineMineral mine={self.mine_id} mineral={self.mineral_id} {role}>"
