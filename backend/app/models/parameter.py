"""Parameter definition and mine parameter models."""

import uuid
from datetime import datetime
from typing import Optional, Any, Dict, TYPE_CHECKING

from sqlalchemy import (
    String, Boolean, Integer, Text, DateTime, ForeignKey, JSON,
    func, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.mine import Mine


class ParameterDefinition(Base):
    """Reusable parameter template that can be assigned to mines."""

    __tablename__ = "parameter_definitions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    key: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, default="general", index=True,
    )
    data_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="float",
    )
    unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    default_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validation_rules: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True,
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

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

    def __repr__(self) -> str:
        return f"<ParameterDefinition {self.key} ({self.data_type})>"


class MineParameter(Base):
    """Concrete parameter value for a specific mine."""

    __tablename__ = "mine_parameters"
    __table_args__ = (
        UniqueConstraint("mine_id", "parameter_id", name="uq_mine_parameter"),
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
    parameter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parameter_definitions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    value: Mapped[str] = mapped_column(Text, nullable=False)

    set_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    set_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )

    mine: Mapped["Mine"] = relationship("Mine", back_populates="mine_parameters")
    parameter: Mapped["ParameterDefinition"] = relationship(
        "ParameterDefinition", foreign_keys=[parameter_id],
    )
    set_by_user: Mapped[Optional["User"]] = relationship(
        "User", foreign_keys=[set_by],
    )

    def __repr__(self) -> str:
        return f"<MineParameter mine={self.mine_id} param={self.parameter_id}>"
