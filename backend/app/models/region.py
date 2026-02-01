"""Region model."""

import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING, Optional

from sqlalchemy import String, DateTime, Text, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class Region(Base):
    """Region model - geographic grouping of mines."""
    
    __tablename__ = "regions"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    
    # Geographic information
    country: Mapped[str] = mapped_column(
        String(100), 
        nullable=False,
        default="Brazil"
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    municipality: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    
    # Coordinates (decimal degrees)
    latitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(nullable=True)
    
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
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
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="created_regions",
        foreign_keys=[created_by]
    )
    mines: Mapped[List["Mine"]] = relationship(
        "Mine",
        back_populates="region",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Region {self.name}>"
