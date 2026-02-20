"""Block model data models for Deswik integration."""

import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List, TYPE_CHECKING

from sqlalchemy import (
    String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, func, JSON, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class BlockImport(Base):
    """A batch import of blocks from a Deswik CSV export."""

    __tablename__ = "block_imports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    mine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    source_filename: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    column_mapping: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False
    )  # {"XCENTRE": "x", "CU_PCT": "cu_grade", ...}
    block_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    # Audit
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    mine: Mapped["Mine"] = relationship("Mine", foreign_keys=[mine_id])
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[created_by]
    )
    blocks: Mapped[List["Block"]] = relationship(
        "Block",
        back_populates="block_import",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<BlockImport {self.name} ({self.block_count} blocks)>"


class Block(Base):
    """Individual block from a Deswik block model."""

    __tablename__ = "blocks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    import_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("block_imports.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Spatial (from Deswik)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    z: Mapped[float] = mapped_column(Float, nullable=False)
    dx: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    dz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Geology (from Deswik)
    cu_grade: Mapped[float] = mapped_column(Float, nullable=False)  # %
    au_grade: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # g/t
    ag_grade: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # g/t
    density: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # t/m3
    tonnage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # t
    rock_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    zone: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Deswik reference (for round-trip)
    deswik_block_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )

    # Extra CSV columns not mapped to specific fields
    extra_attributes: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )

    # Relationships
    block_import: Mapped["BlockImport"] = relationship(
        "BlockImport", back_populates="blocks"
    )
    nsr_snapshots: Mapped[List["BlockNsrSnapshot"]] = relationship(
        "BlockNsrSnapshot",
        back_populates="block",
        cascade="all, delete-orphan",
        order_by="BlockNsrSnapshot.calculated_at.desc()",
    )

    __table_args__ = (
        Index("ix_blocks_import_z", "import_id", "z"),
        Index("ix_blocks_import_id", "import_id"),
    )

    def __repr__(self) -> str:
        return f"<Block ({self.x}, {self.y}, {self.z}) Cu={self.cu_grade}%>"


class BlockNsrSnapshot(Base):
    """NSR calculation result for a block at a point in time."""

    __tablename__ = "block_nsr_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    block_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blocks.id", ondelete="CASCADE"),
        nullable=False,
    )
    calculated_at: Mapped[datetime] = mapped_column(
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

    # Viability
    cutoff_cost: Mapped[float] = mapped_column(Float, nullable=False)  # $/t
    is_viable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    margin: Mapped[float] = mapped_column(Float, nullable=False)  # nsr - cutoff

    # Relationship
    block: Mapped["Block"] = relationship(
        "Block", back_populates="nsr_snapshots"
    )

    __table_args__ = (
        Index("ix_block_nsr_snapshots_block_calc", "block_id", "calculated_at"),
        Index("ix_block_nsr_snapshots_calc", "calculated_at"),
    )

    def __repr__(self) -> str:
        return f"<BlockNsrSnapshot block={self.block_id} NSR={self.nsr_per_tonne}>"
