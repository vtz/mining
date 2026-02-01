"""UserMine association model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class UserMine(Base):
    """Association table for user-mine access with roles."""
    
    __tablename__ = "user_mines"
    __table_args__ = (
        UniqueConstraint("user_id", "mine_id", name="uq_user_mine"),
    )
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    mine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mines.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Role within the mine
    role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="viewer"
    )  # admin, editor, viewer
    
    # Timestamps
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="mine_access"
    )
    mine: Mapped["Mine"] = relationship(
        "Mine",
        back_populates="user_access"
    )
    
    def __repr__(self) -> str:
        return f"<UserMine user={self.user_id} mine={self.mine_id} role={self.role}>"
