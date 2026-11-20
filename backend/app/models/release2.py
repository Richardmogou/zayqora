from datetime import date, datetime
import secrets
import uuid

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.models.core import now_col, pk


def generate_qr_token() -> str:
    return secrets.token_urlsafe(24)


class DiningTable(Base):
    __tablename__ = "dining_tables"
    __table_args__ = (
        UniqueConstraint("restaurant_id", "label", name="uq_dining_table_restaurant_label"),
        Index("ix_dining_tables_restaurant_status", "restaurant_id", "status"),
    )
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    area_name: Mapped[str] = mapped_column(String(80), default="Main Hall", server_default="Main Hall")
    label: Mapped[str] = mapped_column(String(60))
    capacity: Mapped[int] = mapped_column(Integer, default=4, server_default="4")
    status: Mapped[str] = mapped_column(String(20), default="available", server_default="available")
    qr_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=generate_qr_token)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = now_col()


class KitchenStation(Base):
    __tablename__ = "kitchen_stations"
    __table_args__ = (UniqueConstraint("restaurant_id", "code", name="uq_kitchen_station_code"),)
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    code: Mapped[str] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = now_col()


class CashSession(Base):
    __tablename__ = "cash_sessions"
    __table_args__ = (Index("ix_cash_sessions_restaurant_status", "restaurant_id", "status"),)
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    opened_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    closed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    opening_balance_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    expected_cash_minor: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    counted_cash_minor: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="open", server_default="open")
    notes: Mapped[str | None] = mapped_column(String(300))
    opened_at: Mapped[datetime] = now_col()
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeliveryAssignment(Base):
    __tablename__ = "delivery_assignments"
    __table_args__ = (
        Index("ix_delivery_assignments_restaurant_status", "restaurant_id", "status"),
        Index("ix_delivery_assignments_rider_status", "rider_user_id", "status"),
    )
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), unique=True, index=True)
    rider_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="assigned", server_default="assigned")
    notes: Mapped[str | None] = mapped_column(String(300))
    assigned_at: Mapped[datetime] = now_col()
    picked_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    en_route_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (Index("ix_expenses_restaurant_incurred", "restaurant_id", "incurred_on"),)
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(300))
    amount_minor: Mapped[int] = mapped_column(Integer)
    incurred_on: Mapped[date] = mapped_column(Date)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = now_col()
