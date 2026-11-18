from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Order, Reservation
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.reports import CustomerListOut, CustomerSummaryOut

router = APIRouter(prefix="/customers", tags=["customers"])

_CRM_ROLES = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.ACCOUNTANT)


def _normalize_key(name: str, email: str | None, phone: str | None) -> str:
    if email and email.strip():
        return f"email:{email.strip().lower()}"
    if phone and phone.strip():
        return f"phone:{phone.strip()}"
    return f"name:{name.strip().lower()}"


@router.get("", response_model=CustomerListOut)
def list_customers(
    q: str | None = Query(default=None),
    segment: str = Query(default="all", pattern="^(all|new|repeat)$"),
    ctx: TenantContext = Depends(require_roles(*_CRM_ROLES)),
    db: Session = Depends(get_db),
):
    orders = db.scalars(
        select(Order).where(Order.restaurant_id == ctx.restaurant.id).order_by(Order.created_at)
    ).all()
    reservations = db.scalars(
        select(Reservation).where(Reservation.restaurant_id == ctx.restaurant.id).order_by(Reservation.created_at)
    ).all()

    records: dict[str, dict] = {}

    for order in orders:
        key = _normalize_key(order.customer_name, order.customer_email, order.customer_phone)
        ts = order.created_at if order.created_at.tzinfo else order.created_at.replace(tzinfo=timezone.utc)
        entry = records.setdefault(
            key,
            {
                "key": key,
                "customer_name": order.customer_name,
                "customer_email": order.customer_email,
                "customer_phone": order.customer_phone,
                "orders_count": 0,
                "reservations_count": 0,
                "total_spent_minor": 0,
                "last_activity_at": ts,
            },
        )
        entry["customer_name"] = order.customer_name or entry["customer_name"]
        entry["customer_email"] = order.customer_email or entry["customer_email"]
        entry["customer_phone"] = order.customer_phone or entry["customer_phone"]
        if order.status != "cancelled":
            entry["orders_count"] += 1
            entry["total_spent_minor"] += order.total_minor
        if ts > entry["last_activity_at"]:
            entry["last_activity_at"] = ts

    for res in reservations:
        key = _normalize_key(res.customer_name, res.customer_email, res.customer_phone)
        ts = res.created_at if res.created_at.tzinfo else res.created_at.replace(tzinfo=timezone.utc)
        entry = records.setdefault(
            key,
            {
                "key": key,
                "customer_name": res.customer_name,
                "customer_email": res.customer_email,
                "customer_phone": res.customer_phone,
                "orders_count": 0,
                "reservations_count": 0,
                "total_spent_minor": 0,
                "last_activity_at": ts,
            },
        )
        entry["customer_name"] = res.customer_name or entry["customer_name"]
        entry["customer_email"] = res.customer_email or entry["customer_email"]
        entry["customer_phone"] = res.customer_phone or entry["customer_phone"]
        entry["reservations_count"] += 1
        if ts > entry["last_activity_at"]:
            entry["last_activity_at"] = ts

    all_customers: list[CustomerSummaryOut] = []
    for entry in records.values():
        interactions = entry["orders_count"] + entry["reservations_count"]
        seg = "repeat" if interactions >= 2 else "new"
        all_customers.append(CustomerSummaryOut(**entry, segment=seg))

    all_customers.sort(key=lambda c: c.last_activity_at, reverse=True)

    total_customers = len(all_customers)
    repeat_customers = sum(1 for c in all_customers if c.segment == "repeat")
    new_customers = total_customers - repeat_customers
    total_revenue = sum(c.total_spent_minor for c in all_customers)

    query = (q or "").strip().lower()
    filtered = [
        c
        for c in all_customers
        if (segment == "all" or c.segment == segment)
        and (
            not query
            or query in c.customer_name.lower()
            or (c.customer_email and query in c.customer_email.lower())
            or (c.customer_phone and query in c.customer_phone.lower())
        )
    ]

    return CustomerListOut(
        total_customers=total_customers,
        repeat_customers=repeat_customers,
        new_customers=new_customers,
        total_revenue_minor=total_revenue,
        customers=filtered,
    )
