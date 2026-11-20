from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rate_limit import enforce_rate_limit
from app.models import AuditLog, Coupon, MenuItem, Modifier, ModifierGroup, Order, OrderLine, Restaurant
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.orders import (
    ALL_STATUSES, STATUS_TRANSITIONS,
    OrderCancelIn, OrderIn, OrderListOut, OrderOut, OrderStatusIn,
)
from app.services.email import send_order_confirmation_email
from app.services.notifications import notify_restaurant_staff
from app.services.realtime import hub

router = APIRouter(prefix="/orders", tags=["orders"])

_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN, Role.WAITER, Role.ACCOUNTANT)
_EDITORS = (Role.OWNER, Role.MANAGER, Role.CASHIER)
_STATUS_EDITORS = (*_EDITORS, Role.KITCHEN)

# Flat delivery fee in minor units — will be replaced by restaurant config in Day 6
_DELIVERY_FEE_MINOR = 400


def _load_order(db: Session, order_id: uuid.UUID, restaurant_id: uuid.UUID) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _attach_lines(db: Session, order: Order) -> Order:
    order.lines = list(db.scalars(select(OrderLine).where(OrderLine.order_id == order.id)))
    return order


def _build_lines(db: Session, restaurant_id: uuid.UUID, line_inputs) -> list[OrderLine]:
    """
    Resolve each line against the DB:
    - item must belong to restaurant, be published and available
    - each modifier_id must belong to a group of that item
    - prices are taken from DB, never from client input
    """
    lines: list[OrderLine] = []
    for li in line_inputs:
        item = db.scalar(
            select(MenuItem).where(
                MenuItem.id == li.menu_item_id,
                MenuItem.restaurant_id == restaurant_id,
                MenuItem.is_published.is_(True),
                MenuItem.is_available.is_(True),
            )
        )
        if not item:
            raise HTTPException(
                status_code=422,
                detail=f"Item {li.menu_item_id} not found, unavailable or not published",
            )

        # Resolve modifiers against this item's groups and enforce their selection rules.
        modifiers_snapshot = []
        modifier_total = 0
        if li.modifier_ids:
            if len(set(li.modifier_ids)) != len(li.modifier_ids):
                raise HTTPException(status_code=422, detail="Duplicate modifiers are not allowed")

        groups = db.scalars(
            select(ModifierGroup).where(ModifierGroup.item_id == item.id)
        ).all()
        group_by_id = {group.id: group for group in groups}
        selected_counts = {group.id: 0 for group in groups}
        selected_modifiers: list[Modifier] = []
        if li.modifier_ids:
            mods = db.scalars(select(Modifier).where(Modifier.id.in_(li.modifier_ids))).all()
            modifiers_by_id = {modifier.id: modifier for modifier in mods}
            if len(modifiers_by_id) != len(li.modifier_ids):
                raise HTTPException(status_code=422, detail="One or more modifiers do not exist")
            for modifier_id in li.modifier_ids:
                mod = modifiers_by_id[modifier_id]
                group = group_by_id.get(mod.group_id)
                if group is None:
                    raise HTTPException(
                        status_code=422,
                        detail=f"Modifier {mod.id} does not belong to item {item.id}",
                    )
                selected_counts[group.id] += 1
                selected_modifiers.append(mod)

        for group in groups:
            count = selected_counts[group.id]
            if group.required and count == 0:
                raise HTTPException(status_code=422, detail=f"A selection is required for '{group.name}'")
            if not group.multi_select and count > 1:
                raise HTTPException(status_code=422, detail=f"Only one option may be selected for '{group.name}'")

        for mod in selected_modifiers:
            modifier_total += mod.price_delta_minor
            modifiers_snapshot.append({"name": mod.name, "price_delta_minor": mod.price_delta_minor})

        base_price = item.discounted_price_minor if item.discounted_price_minor is not None else item.price_minor
        unit_price = base_price + modifier_total
        line_total = unit_price * li.quantity

        lines.append(OrderLine(
            menu_item_id=item.id,
            name=item.name,
            unit_price_minor=unit_price,
            quantity=li.quantity,
            modifiers_snapshot=modifiers_snapshot if modifiers_snapshot else None,
            line_total_minor=line_total,
        ))
    return lines


def evaluate_coupon(
    db: Session,
    restaurant_id: uuid.UUID,
    raw_code: str | None,
    subtotal_minor: int,
    delivery_fee_minor: int,
) -> tuple[Coupon | None, int]:
    if not raw_code or not raw_code.strip():
        return None, 0
    code = raw_code.strip().upper()
    coupon = db.scalar(
        select(Coupon).where(
            Coupon.restaurant_id == restaurant_id,
            Coupon.code == code,
            Coupon.is_active.is_(True),
        )
    )
    if not coupon:
        raise HTTPException(status_code=422, detail=f"Promo code '{code}' is invalid or inactive")
    now = datetime.now(timezone.utc)
    if coupon.expires_at is not None:
        exp = coupon.expires_at if coupon.expires_at.tzinfo else coupon.expires_at.replace(tzinfo=timezone.utc)
        if exp <= now:
            raise HTTPException(status_code=422, detail=f"Promo code '{code}' has expired")
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=422, detail=f"Promo code '{code}' has reached its redemption limit")
    if subtotal_minor < coupon.min_order_minor:
        raise HTTPException(
            status_code=422,
            detail=f"Promo code '{code}' requires a minimum subtotal of {coupon.min_order_minor / 100:.2f}",
        )

    if coupon.discount_type == "percentage":
        discount = round(subtotal_minor * min(max(coupon.discount_value, 0), 100) / 100)
    elif coupon.discount_type == "fixed":
        discount = min(coupon.discount_value, subtotal_minor)
    elif coupon.discount_type == "free_delivery":
        discount = delivery_fee_minor
    else:
        discount = 0
    return coupon, max(discount, 0)


# ---------------------------------------------------------------------------
# Workspace — list & detail
# ---------------------------------------------------------------------------

@router.get("", response_model=list[OrderListOut])
def list_orders(
    status: str | None = Query(default=None),
    service_mode: str | None = Query(default=None),
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    q = select(Order).where(Order.restaurant_id == ctx.restaurant.id)
    if status:
        q = q.where(Order.status == status)
    if service_mode:
        q = q.where(Order.service_mode == service_mode)
    q = q.order_by(Order.created_at.desc()).limit(200)
    return db.scalars(q).all()


@router.get("/kitchen", response_model=list[OrderOut])
def list_kitchen_orders(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    orders = db.scalars(select(Order).where(
        Order.restaurant_id == ctx.restaurant.id,
        Order.status.in_(["received", "confirmed", "in_preparation"]),
    ).order_by(Order.created_at)).all()
    return [_attach_lines(db, order) for order in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: uuid.UUID, ctx: TenantContext = Depends(require_roles(*_VIEWERS)), db: Session = Depends(get_db)):
    return _attach_lines(db, _load_order(db, order_id, ctx.restaurant.id))


@router.patch("/{order_id}/status", response_model=OrderOut)
def update_status(
    order_id: uuid.UUID,
    body: OrderStatusIn,
    ctx: TenantContext = Depends(require_roles(*_STATUS_EDITORS)),
    db: Session = Depends(get_db),
):
    if body.status not in ALL_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {sorted(ALL_STATUSES)}")
    order = _load_order(db, order_id, ctx.restaurant.id)
    if ctx.member.role == Role.KITCHEN.value and body.status not in {"in_preparation", "ready"}:
        raise HTTPException(status_code=403, detail="Kitchen staff can only start or complete preparation")
    allowed = STATUS_TRANSITIONS.get(order.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition from '{order.status}' to '{body.status}'. Allowed: {sorted(allowed) or 'none (terminal state)'}",
        )
    order.status = body.status
    notify_restaurant_staff(
        db, restaurant_id=ctx.restaurant.id, event_type="order.status_changed",
        title="Order status updated", body=f"Order #{str(order.id)[:8].upper()} is now {body.status.replace('_', ' ')}.",
        entity_type="order", entity_id=str(order.id),
        dedupe_key=f"order:{order.id}:status:{body.status}", data={"status": body.status},
    )
    db.add(AuditLog(
        actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
        action="order.status.update", entity_type="order", entity_id=str(order_id),
        data={"status": body.status},
    ))
    db.commit()
    db.refresh(order)
    hub.publish(str(ctx.restaurant.id), "order.status_changed", {"order_id": str(order.id), "status": order.status})
    return _attach_lines(db, order)


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: uuid.UUID,
    body: OrderCancelIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    order = _load_order(db, order_id, ctx.restaurant.id)
    if "cancelled" not in STATUS_TRANSITIONS.get(order.status, set()):
        raise HTTPException(status_code=409, detail=f"Cannot cancel order in '{order.status}' state")
    order.status = "cancelled"
    order.cancellation_reason = body.reason.strip()
    notify_restaurant_staff(
        db,
        restaurant_id=ctx.restaurant.id,
        event_type="order.status_changed",
        title="Order cancelled",
        body=f"Order #{str(order.id)[:8].upper()} was cancelled ({order.cancellation_reason}).",
        entity_type="order",
        entity_id=str(order.id),
        dedupe_key=f"order:{order.id}:status:cancelled",
        data={"status": "cancelled", "reason": order.cancellation_reason},
    )
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="order.cancel",
        entity_type="order",
        entity_id=str(order.id),
        data={"reason": order.cancellation_reason},
    ))
    db.commit()
    db.refresh(order)
    hub.publish(str(ctx.restaurant.id), "order.status_changed", {"order_id": str(order.id), "status": order.status})
    return _attach_lines(db, order)


# ---------------------------------------------------------------------------
# Public storefront — create order
# ---------------------------------------------------------------------------

public_router = APIRouter(prefix="/public/orders", tags=["public"])


@public_router.post("", response_model=OrderOut, status_code=201)
def create_order(
    body: OrderIn,
    request: Request,
    slug: str = Query(..., description="Restaurant slug"),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "public_order_create")
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    # Idempotency: return existing order if key already used
    if body.idempotency_key:
        existing = db.scalar(select(Order).where(
            Order.restaurant_id == restaurant.id,
            Order.idempotency_key == body.idempotency_key,
        ))
        if existing:
            return _attach_lines(db, existing)

    # Build lines with server-side price resolution
    lines = _build_lines(db, restaurant.id, body.lines)

    subtotal = sum(l.line_total_minor for l in lines)
    delivery_fee = restaurant.delivery_fee_minor if body.service_mode == "delivery" else 0
    coupon, discount_minor = evaluate_coupon(db, restaurant.id, body.coupon_code, subtotal, delivery_fee)
    total = max(subtotal + delivery_fee - discount_minor, 0)
    if coupon is not None:
        coupon.used_count += 1

    order = Order(
        idempotency_key=body.idempotency_key,
        restaurant_id=restaurant.id,
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        service_mode=body.service_mode,
        table_label=body.table_label,
        delivery_address=body.delivery_address,
        payment_method=body.payment_method,
        payment_status="pending",
        subtotal_minor=subtotal,
        discount_minor=discount_minor,
        delivery_fee_minor=delivery_fee,
        total_minor=total,
        coupon_code=coupon.code if coupon else None,
        special_instructions=body.special_instructions,
        status="received",
    )
    db.add(order)
    db.flush()

    for line in lines:
        line.order_id = order.id
    db.add_all(lines)
    notify_restaurant_staff(
        db, restaurant_id=restaurant.id, event_type="order.created",
        title="New order", body=f"{order.customer_name} placed a new {order.service_mode} order.",
        entity_type="order", entity_id=str(order.id), dedupe_key=f"order:{order.id}:created",
    )
    try:
        db.commit()
    except IntegrityError:
        # A concurrent retry may have committed the same tenant-scoped key first.
        db.rollback()
        if body.idempotency_key:
            existing = db.scalar(select(Order).where(
                Order.restaurant_id == restaurant.id,
                Order.idempotency_key == body.idempotency_key,
            ))
            if existing:
                return _attach_lines(db, existing)
        raise
    db.refresh(order)
    hub.publish(str(restaurant.id), "order.created", {"order_id": str(order.id), "status": order.status})
    if order.customer_email:
        send_order_confirmation_email(
            order.customer_email,
            order.customer_name,
            restaurant.name,
            restaurant.slug,
            str(order.id),
            f"{restaurant.currency} {order.total_minor / 100:.2f}",
        )
    return _attach_lines(db, order)


@public_router.get("/{order_id}", response_model=OrderOut)
def get_public_order(order_id: uuid.UUID, slug: str = Query(...), db: Session = Depends(get_db)):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    order = db.scalar(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _attach_lines(db, order)


@public_router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_public_order(
    order_id: uuid.UUID,
    body: OrderCancelIn,
    request: Request,
    slug: str = Query(...),
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "public_order_cancel")
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    order = db.scalar(select(Order).where(Order.id == order_id, Order.restaurant_id == restaurant.id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in {"received", "confirmed"}:
        raise HTTPException(
            status_code=409,
            detail="Order can no longer be cancelled online once kitchen preparation has started",
        )
    order.status = "cancelled"
    order.cancellation_reason = body.reason.strip()
    notify_restaurant_staff(
        db,
        restaurant_id=restaurant.id,
        event_type="order.status_changed",
        title="Customer cancelled order",
        body=f"Order #{str(order.id)[:8].upper()} was cancelled by customer ({order.cancellation_reason}).",
        entity_type="order",
        entity_id=str(order.id),
        dedupe_key=f"order:{order.id}:status:cancelled",
        data={"status": "cancelled", "reason": order.cancellation_reason},
    )
    db.commit()
    db.refresh(order)
    hub.publish(str(restaurant.id), "order.status_changed", {"order_id": str(order.id), "status": order.status})
    return _attach_lines(db, order)
