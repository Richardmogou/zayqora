"""Modèle réservations du jour 5."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Reservation(Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "idempotency_key", name="uq_reservations_restaurant_idempotency_key"),
        Index("ix_reservations_restaurant_date", "restaurant_id", "reserved_at"),
        Index("ix_reservations_restaurant_status", "restaurant_id", "status"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("restaurants.id", ondelete="CASCADE"), index=True
    )
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(30))
    customer_email: Mapped[str | None] = mapped_column(String(320))
    guests: Mapped[int] = mapped_column(Integer)
    table_label: Mapped[str | None] = mapped_column(String(50))
    reserved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    # pending | confirmed | seated | completed | cancelled | no_show
    status: Mapped[str] = mapped_column(String(20), default="pending")
    idempotency_key: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
