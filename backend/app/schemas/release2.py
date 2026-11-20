from datetime import date, datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.orders import OrderLineIn


class DiningTableIn(BaseModel):
    area_name: str = Field(default="Main Hall", min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=60)
    capacity: int = Field(default=4, ge=1, le=50)
    status: Literal["available", "occupied", "reserved", "blocked"] = "available"


class DiningTableUpdateIn(BaseModel):
    area_name: str | None = Field(default=None, min_length=1, max_length=80)
    label: str | None = Field(default=None, min_length=1, max_length=60)
    capacity: int | None = Field(default=None, ge=1, le=50)
    status: Literal["available", "occupied", "reserved", "blocked"] | None = None
    is_active: bool | None = None


class DiningTableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    area_name: str
    label: str
    capacity: int
    status: str
    qr_token: str
    is_active: bool
    created_at: datetime


class PublicTableOut(BaseModel):
    restaurant_slug: str
    restaurant_name: str
    table_id: uuid.UUID
    area_name: str
    table_label: str
    capacity: int


class KitchenStationIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=40)


class KitchenStationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    code: str
    is_active: bool
    created_at: datetime


class KitchenTicketLineOut(BaseModel):
    id: uuid.UUID
    name: str
    quantity: int
    kitchen_station: str | None = None
    modifiers_snapshot: list[dict] | None = None


class KitchenTicketOut(BaseModel):
    id: uuid.UUID
    customer_name: str
    service_mode: str
    table_label: str | None = None
    status: str
    created_at: datetime
    special_instructions: str | None = None
    stations: list[str]
    lines: list[KitchenTicketLineOut]


class PosOrderIn(BaseModel):
    customer_name: str = Field(default="Walk-in Guest", min_length=1, max_length=200)
    service_mode: Literal["dine-in", "pickup", "delivery"] = "dine-in"
    table_label: str | None = Field(default=None, max_length=50)
    payment_method: Literal["cash", "card", "paypal"] = "cash"
    mark_paid: bool = True
    coupon_code: str | None = Field(default=None, max_length=40)
    special_instructions: str | None = None
    lines: list[OrderLineIn] = Field(min_length=1)


class CashSessionOpenIn(BaseModel):
    opening_balance_minor: int = Field(default=0, ge=0)
    notes: str | None = Field(default=None, max_length=300)


class CashSessionCloseIn(BaseModel):
    counted_cash_minor: int = Field(ge=0)
    notes: str | None = Field(default=None, max_length=300)


class CashSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    opened_by_user_id: uuid.UUID | None = None
    closed_by_user_id: uuid.UUID | None = None
    opening_balance_minor: int
    expected_cash_minor: int
    counted_cash_minor: int | None = None
    variance_minor: int | None = None
    status: str
    notes: str | None = None
    opened_at: datetime
    closed_at: datetime | None = None


class DeliveryAssignIn(BaseModel):
    order_id: uuid.UUID
    rider_user_id: uuid.UUID
    notes: str | None = Field(default=None, max_length=300)


class DeliveryStatusIn(BaseModel):
    status: Literal["picked_up", "en_route", "delivered", "failed"]
    notes: str | None = Field(default=None, max_length=300)


class DeliveryAssignmentOut(BaseModel):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    order_id: uuid.UUID
    rider_user_id: uuid.UUID
    rider_name: str | None = None
    customer_name: str
    customer_phone: str | None = None
    delivery_address: str | None = None
    order_status: str
    total_minor: int
    status: str
    notes: str | None = None
    assigned_at: datetime
    picked_up_at: datetime | None = None
    en_route_at: datetime | None = None
    delivered_at: datetime | None = None


class ExpenseIn(BaseModel):
    category: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=2, max_length=300)
    amount_minor: int = Field(gt=0)
    incurred_on: date


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    category: str
    description: str
    amount_minor: int
    incurred_on: date
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime
