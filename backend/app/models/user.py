"""User model."""

import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.region import Region
    from app.models.mine import Mine
    from app.models.user_mine import UserMine


class User(Base):
    """User model for authentication and authorization."""
    
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), 
        unique=True, 
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(512), nullable=True)
    
    # Authentication
    auth_provider: Mapped[str] = mapped_column(
        String(50), 
        nullable=False,
        default="google"
    )
    auth_provider_id: Mapped[str] = mapped_column(
        String(255), 
        nullable=True
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), 
        nullable=True
    )  # For local auth fallback
    
    # Authorization
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    last_login: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Relationships
    created_regions: Mapped[List["Region"]] = relationship(
        "Region",
        back_populates="created_by_user",
        foreign_keys="Region.created_by"
    )
    created_mines: Mapped[List["Mine"]] = relationship(
        "Mine",
        back_populates="created_by_user",
        foreign_keys="Mine.created_by"
    )
    mine_access: Mapped[List["UserMine"]] = relationship(
        "UserMine",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User {self.email}>"
