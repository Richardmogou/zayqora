"""Modèles commandes du jour 4 : Order et OrderLine."""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_restaurant_created", "restaurant_id", "created_at"),
        Index("ix_orders_restaurant_status", "restaurant_id", "status"),
        UniqueConstraint("restaurant_id", "idempotency_key", name="uq_orders_restaurant_idempotency_key"),
    )
    id: Mapped[uuid.UUID] = _pk()
    idempotency_key: Mapped[str | None] = mapped_column(String(64))
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    # customer (anonymous for storefront)
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str | None] = mapped_column(String(30))
    customer_email: Mapped[str | None] = mapped_column(String(320))
    # service
    service_mode: Mapped[str] = mapped_column(String(20))   # delivery | pickup | dine-in
    table_label: Mapped[str | None] = mapped_column(String(50))
    delivery_address: Mapped[str | None] = mapped_column(Text)
    # payment
    payment_method: Mapped[str] = mapped_column(String(20))  # card | paypal | cash
    payment_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")  # pending | paid | failed
    # amounts (minor units)
    subtotal_minor: Mapped[int] = mapped_column(Integer)
    discount_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    delivery_fee_minor: Mapped[int] = mapped_column(Integer, default=0)
    total_minor: Mapped[int] = mapped_column(Integer)
    coupon_code: Mapped[str | None] = mapped_column(String(40))
    # status
    status: Mapped[str] = mapped_column(String(30), default="received")
    # received | confirmed | in_preparation | ready | served | cancelled
    cancellation_reason: Mapped[str | None] = mapped_column(String(300))
    special_instructions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class OrderLine(Base):
    __tablename__ = "order_lines"
    id: Mapped[uuid.UUID] = _pk()
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    menu_item_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("menu_items.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(200))          # snapshot at order time
    unit_price_minor: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
    modifiers_snapshot: Mapped[dict | None] = mapped_column(JSONB)  # [{name, price_delta_minor}]
    line_total_minor: Mapped[int] = mapped_column(Integer)
