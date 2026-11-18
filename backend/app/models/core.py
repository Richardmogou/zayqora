"""Schéma de base du jour 1 : identité, locataires (restaurants) et journal d'audit."""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def pk():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def now_col():
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = pk()
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)  # toujours en minuscules
    full_name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_platform_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class UserSession(Base):
    __tablename__ = "user_sessions"
    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = now_col()
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent: Mapped[str | None] = mapped_column(String(300))
    ip: Mapped[str | None] = mapped_column(String(64))


class Restaurant(Base):
    __tablename__ = "restaurants"
    id: Mapped[uuid.UUID] = pk()
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | active | suspended
    country: Mapped[str] = mapped_column(String(2), default="PK")
    currency: Mapped[str] = mapped_column(String(3), default="PKR")
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Karachi")  # identifiant IANA
    reservation_capacity: Mapped[int] = mapped_column(Integer, default=40, server_default="40")
    reservation_duration_minutes: Mapped[int] = mapped_column(Integer, default=90, server_default="90")
    reservation_slot_interval_minutes: Mapped[int] = mapped_column(Integer, default=30, server_default="30")
    reservation_buffer_minutes: Mapped[int] = mapped_column(Integer, default=15, server_default="15")
    reservation_opening_hours: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "0": [],
            "1": [["12:00", "14:30"], ["19:00", "22:00"]],
            "2": [["12:00", "14:30"], ["19:00", "22:00"]],
            "3": [["12:00", "14:30"], ["19:00", "22:00"]],
            "4": [["12:00", "14:30"], ["19:00", "22:00"]],
            "5": [["12:00", "14:30"], ["19:00", "22:00"]],
            "6": [["12:00", "14:30"], ["19:00", "22:00"]],
        },
        nullable=False,
    )
    created_at: Mapped[datetime] = now_col()
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class RestaurantMember(Base):
    __tablename__ = "restaurant_members"
    __table_args__ = (UniqueConstraint("restaurant_id", "user_id"),)
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = now_col()


class Branch(Base):
    __tablename__ = "branches"
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(300))
    timezone: Mapped[str | None] = mapped_column(String(64))  # sinon celui du restaurant
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = now_col()


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_restaurant_created", "restaurant_id", "created_at"),)
    id: Mapped[uuid.UUID] = pk()
    restaurant_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("restaurants.id", ondelete="SET NULL"))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    data: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = now_col()
