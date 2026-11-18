"""Modèles complémentaires de la spécification : coupons, paiements/webhooks/remboursements, inventaire et avis clients."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def _pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _now():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "code", name="uq_coupons_restaurant_code"),
        Index("ix_coupons_restaurant_active", "restaurant_id", "is_active"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(40))
    discount_type: Mapped[str] = mapped_column(String(20))  # percentage | fixed | free_delivery
    discount_value: Mapped[int] = mapped_column(Integer, default=0)
    min_order_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    max_uses: Mapped[int | None] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = _now()


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "idempotency_key", name="uq_payments_restaurant_idempotency"),
        Index("ix_payments_restaurant_order", "restaurant_id", "order_id"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30), default="sandbox")
    provider_reference: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(64))
    amount_minor: Mapped[int] = mapped_column(Integer)
    refunded_amount_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending | paid | failed | partially_refunded | refunded
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class PaymentWebhookEvent(Base):
    __tablename__ = "provider_webhook_events"
    __table_args__ = (
        UniqueConstraint("provider", "event_id", name="uq_webhook_provider_event_id"),
    )
    id: Mapped[uuid.UUID] = _pk()
    provider: Mapped[str] = mapped_column(String(30))
    event_id: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    processed_at: Mapped[datetime] = _now()


class Refund(Base):
    __tablename__ = "refunds"
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    payment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payment_transactions.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    amount_minor: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(20), default="succeeded")
    created_at: Mapped[datetime] = _now()


class Ingredient(Base):
    __tablename__ = "ingredients"
    __table_args__ = (
        Index("ix_ingredients_restaurant_name", "restaurant_id", "name"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(80), default="General")
    unit: Mapped[str] = mapped_column(String(20), default="kg")
    quantity_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")  # en centièmes d'unité (ex: 450 = 4.50 kg)
    threshold_minor: Mapped[int] = mapped_column(Integer, default=100, server_default="100")
    created_at: Mapped[datetime] = _now()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_stock_movements_restaurant_created", "restaurant_id", "created_at"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    ingredient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ingredients.id", ondelete="CASCADE"), index=True)
    delta_minor: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(200))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = _now()


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        Index("ix_reviews_restaurant_status", "restaurant_id", "status"),
    )
    id: Mapped[uuid.UUID] = _pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("orders.id", ondelete="SET NULL"))
    customer_name: Mapped[str] = mapped_column(String(200))
    rating: Mapped[int] = mapped_column(Integer)  # 1..5
    comment: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected
    owner_response: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = _now()
