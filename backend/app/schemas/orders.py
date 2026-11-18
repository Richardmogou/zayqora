import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

# Allowed status transitions: key → set of valid next statuses
STATUS_TRANSITIONS: dict[str, set[str]] = {
    "received":       {"confirmed", "in_preparation", "cancelled"},
    "confirmed":      {"in_preparation", "cancelled"},
    "in_preparation": {"ready", "cancelled"},
    "ready":          {"served", "cancelled"},
    "served":         set(),   # terminal
    "cancelled":      set(),   # terminal
}
ALL_STATUSES = set(STATUS_TRANSITIONS.keys())


class OrderLineIn(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(ge=1, le=50)
    modifier_ids: list[uuid.UUID] = Field(default_factory=list)


class OrderIn(BaseModel):
    idempotency_key: str | None = Field(default=None, max_length=64)
    customer_name: str = Field(min_length=1, max_length=200)
    customer_phone: str | None = Field(default=None, max_length=30)
    customer_email: str | None = Field(default=None, max_length=320)
    service_mode: str = Field(pattern="^(delivery|pickup|dine-in)$")
    table_label: str | None = Field(default=None, max_length=50)
    delivery_address: str | None = None
    payment_method: str = Field(pattern="^(card|paypal|cash)$")
    coupon_code: str | None = Field(default=None, max_length=40)
    special_instructions: str | None = None
    lines: list[OrderLineIn] = Field(min_length=1)


class OrderStatusIn(BaseModel):
    status: str


class OrderCancelIn(BaseModel):
    reason: str = Field(default="Cancelled by request", min_length=2, max_length=300)


class OrderLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    menu_item_id: uuid.UUID | None
    name: str
    unit_price_minor: int
    quantity: int
    modifiers_snapshot: list[dict] | None
    line_total_minor: int


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    customer_name: str
    customer_phone: str | None
    customer_email: str | None
    service_mode: str
    table_label: str | None
    delivery_address: str | None
    payment_method: str
    payment_status: str
    subtotal_minor: int
    discount_minor: int = 0
    delivery_fee_minor: int
    total_minor: int
    coupon_code: str | None = None
    status: str
    cancellation_reason: str | None = None
    special_instructions: str | None
    created_at: datetime
    lines: list[OrderLineOut] = []


class OrderListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    customer_name: str
    service_mode: str
    table_label: str | None
    payment_method: str
    payment_status: str
    total_minor: int
    status: str
    cancellation_reason: str | None = None
    created_at: datetime
