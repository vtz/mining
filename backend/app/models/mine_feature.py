"""Mine feature toggle model for add-on management."""

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class MineFeature(Base):
    """Feature toggle per mine — supports add-on monetisation."""

    __tablename__ = "mine_features"
    __table_args__ = (
        UniqueConstraint("mine_id", "feature_key", name="uq_mine_feature"),
    )

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
    feature_key: Mapped[str] = mapped_column(
        String(50), nullable=False
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Audit
    enabled_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    enabled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    disabled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # e.g. "Trial until 2026-06-01", "Paid annual plan"

    # Relationships
    mine: Mapped["Mine"] = relationship("Mine", foreign_keys=[mine_id])
    enabled_by_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[enabled_by]
    )

    def __repr__(self) -> str:
        status = "ON" if self.enabled else "OFF"
        return f"<MineFeature {self.feature_key}={status} mine={self.mine_id}>"
