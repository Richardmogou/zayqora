import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AuditLog, Order, Reservation, Restaurant, RestaurantMember, User
from app.permissions.deps import require_platform_admin
from app.schemas.reports import (
    AuditLogOut,
    PlanSummaryOut,
    PlatformOverviewOut,
    PlatformTenantOut,
    TenantStatusUpdateIn,
)

router = APIRouter(prefix="/platform", tags=["platform"])

PLAN_CATALOG = [
    ("starter", "Starter", 29, "One branch, public website, digital menu and contact options."),
    ("growth", "Growth", 59, "Online orders, table reservations, promotions and standard reports."),
    ("professional", "Professional", 99, "Staff permissions, KDS, CRM and advanced reporting."),
    ("enterprise", "Enterprise", 199, "Multi-branch, custom domains, priority support and SLA."),
]


def _build_tenant_out(db: Session, restaurant: Restaurant) -> PlatformTenantOut:
    owner_row = db.execute(
        select(User)
        .join(RestaurantMember, RestaurantMember.user_id == User.id)
        .where(
            RestaurantMember.restaurant_id == restaurant.id,
            RestaurantMember.role == "owner",
            RestaurantMember.is_active.is_(True),
        )
        .limit(1)
    ).scalar_one_or_none()

    members_count = db.scalar(
        select(func.count(RestaurantMember.id)).where(
            RestaurantMember.restaurant_id == restaurant.id,
            RestaurantMember.is_active.is_(True),
        )
    ) or 0

    orders_count = db.scalar(
        select(func.count(Order.id)).where(Order.restaurant_id == restaurant.id)
    ) or 0

    gross_sales = db.scalar(
        select(func.coalesce(func.sum(Order.total_minor), 0)).where(
            Order.restaurant_id == restaurant.id,
            Order.status != "cancelled",
        )
    ) or 0

    reservations_count = db.scalar(
        select(func.count(Reservation.id)).where(Reservation.restaurant_id == restaurant.id)
    ) or 0

    return PlatformTenantOut(
        id=restaurant.id,
        slug=restaurant.slug,
        name=restaurant.name,
        status=restaurant.status,
        plan=restaurant.plan or "growth",
        country=restaurant.country,
        currency=restaurant.currency,
        timezone=restaurant.timezone,
        owner_email=owner_row.email if owner_row else None,
        owner_name=owner_row.full_name if owner_row else None,
        members_count=int(members_count),
        orders_count=int(orders_count),
        reservations_count=int(reservations_count),
        gross_sales_minor=int(gross_sales),
        created_at=restaurant.created_at,
    )


@router.get("/overview", response_model=PlatformOverviewOut)
def platform_overview(
    _admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    restaurants = db.scalars(select(Restaurant)).all()
    total_tenants = len(restaurants)
    active_tenants = sum(1 for r in restaurants if r.status == "active")
    pending_tenants = sum(1 for r in restaurants if r.status == "pending")
    suspended_tenants = sum(1 for r in restaurants if r.status == "suspended")

    total_users = db.scalar(select(func.count(User.id))) or 0
    total_orders = db.scalar(select(func.count(Order.id))) or 0
    total_reservations = db.scalar(select(func.count(Reservation.id))) or 0
    gross_volume = db.scalar(
        select(func.coalesce(func.sum(Order.total_minor), 0)).where(Order.status != "cancelled")
    ) or 0

    plan_counts: dict[str, int] = {}
    for r in restaurants:
        code = (r.plan or "growth").lower()
        plan_counts[code] = plan_counts.get(code, 0) + 1

    plans = [
        PlanSummaryOut(
            code=code,
            name=name,
            price_monthly_eur=price,
            description=desc,
            tenants_count=plan_counts.get(code, 0),
        )
        for code, name, price, desc in PLAN_CATALOG
    ]

    recent_logs = db.scalars(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(25)
    ).all()

    return PlatformOverviewOut(
        total_tenants=total_tenants,
        active_tenants=active_tenants,
        pending_tenants=pending_tenants,
        suspended_tenants=suspended_tenants,
        total_users=int(total_users),
        total_orders=int(total_orders),
        total_reservations=int(total_reservations),
        platform_gross_volume_minor=int(gross_volume),
        plans=plans,
        recent_audit_logs=[AuditLogOut.model_validate(log) for log in recent_logs],
    )


@router.get("/tenants", response_model=list[PlatformTenantOut])
def list_platform_tenants(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    _admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    stmt = select(Restaurant).order_by(Restaurant.created_at.desc())
    if status:
        stmt = stmt.where(Restaurant.status == status)
    restaurants = db.scalars(stmt).all()
    items = [_build_tenant_out(db, r) for r in restaurants]
    query = (q or "").strip().lower()
    if query:
        items = [
            t
            for t in items
            if query in t.name.lower()
            or query in t.slug.lower()
            or (t.owner_email and query in t.owner_email.lower())
        ]
    return items


@router.patch("/tenants/{restaurant_id}/status", response_model=PlatformTenantOut)
def update_tenant_status(
    restaurant_id: uuid.UUID,
    body: TenantStatusUpdateIn,
    admin: User = Depends(require_platform_admin),
    db: Session = Depends(get_db),
):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.id == restaurant_id))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    old_status = restaurant.status
    old_plan = restaurant.plan
    restaurant.status = body.status
    if body.plan is not None:
        restaurant.plan = body.plan

    db.add(AuditLog(
        actor_user_id=admin.id,
        restaurant_id=restaurant.id,
        action="platform.tenant.status_update",
        entity_type="restaurant",
        entity_id=str(restaurant.id),
        data={
            "old_status": old_status,
            "new_status": body.status,
            "old_plan": old_plan,
            "new_plan": restaurant.plan,
            "reason": body.reason.strip(),
        },
    ))
    db.commit()
    db.refresh(restaurant)
    return _build_tenant_out(db, restaurant)
