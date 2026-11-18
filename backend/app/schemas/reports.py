import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DailySalesPointOut(BaseModel):
    date: str
    label: str
    orders_count: int
    gross_sales_minor: int


class TopItemOut(BaseModel):
    name: str
    quantity: int
    revenue_minor: int


class BreakdownOut(BaseModel):
    key: str
    count: int
    total_minor: int


class SalesReportOut(BaseModel):
    period: str
    currency: str
    timezone: str
    orders_count: int
    cancelled_orders_count: int
    gross_sales_minor: int
    net_sales_minor: int
    delivery_fees_minor: int
    estimated_tax_minor: int
    cancelled_minor: int
    average_order_value_minor: int
    covers_served: int
    daily_series: list[DailySalesPointOut]
    top_items: list[TopItemOut]
    by_payment_method: list[BreakdownOut]
    by_service_mode: list[BreakdownOut]


class CustomerSummaryOut(BaseModel):
    key: str
    customer_name: str
    customer_email: str | None = None
    customer_phone: str | None = None
    orders_count: int
    reservations_count: int
    total_spent_minor: int
    last_activity_at: datetime
    segment: Literal["new", "repeat"]


class CustomerListOut(BaseModel):
    total_customers: int
    repeat_customers: int
    new_customers: int
    total_revenue_minor: int
    customers: list[CustomerSummaryOut]


class PlanSummaryOut(BaseModel):
    code: str
    name: str
    price_monthly_eur: int
    description: str
    tenants_count: int


class PlatformTenantOut(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    status: str
    plan: str
    country: str
    currency: str
    timezone: str
    owner_email: str | None = None
    owner_name: str | None = None
    members_count: int
    orders_count: int
    reservations_count: int
    gross_sales_minor: int
    created_at: datetime


class TenantStatusUpdateIn(BaseModel):
    status: Literal["active", "pending", "suspended"]
    reason: str = Field(min_length=3, max_length=300)
    plan: Literal["starter", "growth", "professional", "enterprise"] | None = None


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    restaurant_id: uuid.UUID | None = None
    actor_user_id: uuid.UUID | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    data: dict | None = None
    created_at: datetime


class PlatformOverviewOut(BaseModel):
    total_tenants: int
    active_tenants: int
    pending_tenants: int
    suspended_tenants: int
    total_users: int
    total_orders: int
    total_reservations: int
    platform_gross_volume_minor: int
    plans: list[PlanSummaryOut]
    recent_audit_logs: list[AuditLogOut]
