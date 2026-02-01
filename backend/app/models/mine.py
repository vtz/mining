"""Mine model."""

import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING, Optional, Any, Dict

from sqlalchemy import String, DateTime, ForeignKey, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.region import Region
    from app.models.user_mine import UserMine


class Mine(Base):
    """Mine model - individual mining operation."""
    
    __tablename__ = "mines"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        nullable=False,
        index=True
    )
    
    # Region association
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("regions.id", ondelete="CASCADE"),
        nullable=False
    )
    
    # Mining details
    primary_metal: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="Cu"
    )  # Cu, Au, Zn, Ni, Fe
    
    mining_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="UG"
    )  # UG (underground) or OP (open pit)
    
    # Configuration stored as JSON
    recovery_params: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )  # {"areas": {"Area1": {"a": 2.8, "b": 92.5}, ...}}
    
    commercial_terms: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )  # {"payability": 0.965, "tc": 40, "rc": 1.9, ...}
    
    # Audit
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # Relationships
    region: Mapped["Region"] = relationship(
        "Region",
        back_populates="mines"
    )
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="created_mines",
        foreign_keys=[created_by]
    )
    user_access: Mapped[List["UserMine"]] = relationship(
        "UserMine",
        back_populates="mine",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Mine {self.name} ({self.primary_metal})>"
