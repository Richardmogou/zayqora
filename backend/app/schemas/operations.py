import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.orders import OrderLineIn


class BranchIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    timezone: str | None = Field(default=None, max_length=64)
    is_default: bool = False


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    address: str | None
    timezone: str | None
    is_default: bool
    created_at: datetime


class CouponIn(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    discount_type: Literal["percentage", "fixed", "free_delivery"]
    discount_value: int = Field(default=0, ge=0)
    min_order_minor: int = Field(default=0, ge=0)
    max_uses: int | None = Field(default=None, ge=1)
    is_active: bool = True
    expires_at: datetime | None = None


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    code: str
    discount_type: str
    discount_value: int
    min_order_minor: int
    max_uses: int | None
    used_count: int
    is_active: bool
    expires_at: datetime | None
    created_at: datetime


class CartValidateIn(BaseModel):
    service_mode: str = Field(default="pickup", pattern="^(delivery|pickup|dine-in)$")
    coupon_code: str | None = Field(default=None, max_length=40)
    lines: list[OrderLineIn] = Field(min_length=1)


class CartQuoteLineOut(BaseModel):
    menu_item_id: uuid.UUID | None
    name: str
    unit_price_minor: int
    quantity: int
    modifiers_snapshot: list[dict] | None
    line_total_minor: int


class CartQuoteOut(BaseModel):
    currency: str
    subtotal_minor: int
    discount_minor: int
    delivery_fee_minor: int
    total_minor: int
    coupon_code: str | None = None
    lines: list[CartQuoteLineOut]


class PaymentCheckoutIn(BaseModel):
    order_id: uuid.UUID
    provider: Literal["sandbox", "stripe", "paypal"] = "sandbox"
    idempotency_key: str | None = Field(default=None, max_length=64)


class PaymentTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    order_id: uuid.UUID
    provider: str
    provider_reference: str
    amount_minor: int
    refunded_amount_minor: int
    currency: str
    status: str
    created_at: datetime


class WebhookEventIn(BaseModel):
    event_id: str = Field(min_length=2, max_length=120)
    provider_reference: str = Field(min_length=2, max_length=120)
    event_type: Literal["payment.succeeded", "payment.failed"]


class WebhookAckOut(BaseModel):
    status: str = "processed"
    deduplicated: bool = False
    payment_status: str | None = None


class RefundIn(BaseModel):
    amount_minor: int | None = Field(default=None, ge=1)
    reason: str = Field(min_length=2, max_length=300)


class RefundOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    payment_id: uuid.UUID
    order_id: uuid.UUID
    amount_minor: int
    reason: str
    status: str
    created_at: datetime


class IngredientIn(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(default="General", min_length=1, max_length=80)
    unit: str = Field(default="kg", min_length=1, max_length=20)
    quantity_minor: int = Field(default=0, ge=0)
    threshold_minor: int = Field(default=100, ge=0)


class IngredientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    name: str
    category: str
    unit: str
    quantity_minor: int
    threshold_minor: int
    stock_status: str = "in_stock"
    created_at: datetime


class StockMovementIn(BaseModel):
    ingredient_id: uuid.UUID
    delta_minor: int
    reason: str = Field(min_length=2, max_length=200)


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    ingredient_id: uuid.UUID
    delta_minor: int
    reason: str
    actor_user_id: uuid.UUID | None
    created_at: datetime


class ReviewIn(BaseModel):
    order_id: uuid.UUID | None = None
    customer_name: str = Field(min_length=2, max_length=200)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewModerateIn(BaseModel):
    status: Literal["pending", "approved", "rejected"] | None = None
    owner_response: str | None = Field(default=None, max_length=1000)


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID
    order_id: uuid.UUID | None
    customer_name: str
    rating: int
    comment: str | None
    status: str
    owner_response: str | None
    created_at: datetime


class PublicReviewsOut(BaseModel):
    average_rating: float
    total_reviews: int
    reviews: list[ReviewOut]
