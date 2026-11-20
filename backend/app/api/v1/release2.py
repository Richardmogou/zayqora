from datetime import date as Date, datetime, timezone
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.orders import _attach_lines, _build_lines, evaluate_coupon
from app.core.config import settings
from app.core.db import SessionLocal, get_db
from app.core.security import hash_token
from app.models import (
    AuditLog,
    CashSession,
    DeliveryAssignment,
    DiningTable,
    Expense,
    KitchenStation,
    MenuItem,
    Order,
    OrderLine,
    Restaurant,
    RestaurantMember,
    User,
    UserSession,
)
from app.models.release2 import generate_qr_token
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.orders import OrderOut, OrderStatusIn, STATUS_TRANSITIONS
from app.schemas.release2 import (
    CashSessionCloseIn,
    CashSessionOpenIn,
    CashSessionOut,
    DeliveryAssignIn,
    DeliveryAssignmentOut,
    DeliveryStatusIn,
    DiningTableIn,
    DiningTableOut,
    DiningTableUpdateIn,
    ExpenseIn,
    ExpenseOut,
    KitchenStationIn,
    KitchenStationOut,
    KitchenTicketLineOut,
    KitchenTicketOut,
    PosOrderIn,
    PublicTableOut,
)
from app.services.notifications import notify_restaurant_staff
from app.services.realtime import hub

_MANAGERS = (Role.OWNER, Role.MANAGER)
_POS_ROLES = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)
_CASH_ROLES = (Role.OWNER, Role.MANAGER, Role.CASHIER)
_KITCHEN_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN, Role.WAITER)
_KITCHEN_EDITORS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN)
_DELIVERY_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.RIDER)
_DELIVERY_ASSIGNERS = (Role.OWNER, Role.MANAGER, Role.CASHIER)
_FINANCE_ROLES = (Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
_TABLE_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)

_CODE_RE = re.compile(r"[^a-z0-9_-]+")


# ---------------------------------------------------------------------------
# Dining Tables & QR Table Ordering
# ---------------------------------------------------------------------------

tables_router = APIRouter(prefix="/tables", tags=["tables"])
public_tables_router = APIRouter(prefix="/public/tables", tags=["public"])


@tables_router.get("", response_model=list[DiningTableOut])
def list_tables(
    ctx: TenantContext = Depends(require_roles(*_TABLE_VIEWERS)),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(DiningTable)
        .where(DiningTable.restaurant_id == ctx.restaurant.id)
        .order_by(DiningTable.area_name, DiningTable.label)
    ).all()


@tables_router.post("", response_model=DiningTableOut, status_code=201)
def create_table(
    body: DiningTableIn,
    ctx: TenantContext = Depends(require_roles(*_MANAGERS)),
    db: Session = Depends(get_db),
):
    table = DiningTable(
        restaurant_id=ctx.restaurant.id,
        area_name=body.area_name.strip(),
        label=body.label.strip(),
        capacity=body.capacity,
        status=body.status,
    )
    db.add(table)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Table label already exists") from exc
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="table.create",
        entity_type="dining_table",
        entity_id=str(table.id),
    ))
    db.commit()
    db.refresh(table)
    return table


@tables_router.patch("/{table_id}", response_model=DiningTableOut)
def update_table(
    table_id: uuid.UUID,
    body: DiningTableUpdateIn,
    ctx: TenantContext = Depends(require_roles(*_TABLE_VIEWERS)),
    db: Session = Depends(get_db),
):
    table = db.scalar(
        select(DiningTable).where(DiningTable.id == table_id, DiningTable.restaurant_id == ctx.restaurant.id)
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    updates = body.model_dump(exclude_unset=True)
    if ctx.member.role in {Role.WAITER.value, Role.CASHIER.value} and set(updates.keys()) - {"status"}:
        raise HTTPException(status_code=403, detail="Only owners and managers can modify table configuration")
    for field, value in updates.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(table, field, value)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="table.update",
        entity_type="dining_table",
        entity_id=str(table.id),
        data=updates,
    ))
    db.commit()
    db.refresh(table)
    return table


@tables_router.post("/{table_id}/rotate-qr", response_model=DiningTableOut)
def rotate_table_qr(
    table_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_MANAGERS)),
    db: Session = Depends(get_db),
):
    table = db.scalar(
        select(DiningTable).where(DiningTable.id == table_id, DiningTable.restaurant_id == ctx.restaurant.id)
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    table.qr_token = generate_qr_token()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="table.qr.rotate",
        entity_type="dining_table",
        entity_id=str(table.id),
    ))
    db.commit()
    db.refresh(table)
    return table


@tables_router.delete("/{table_id}", status_code=204)
def delete_table(
    table_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_MANAGERS)),
    db: Session = Depends(get_db),
):
    table = db.scalar(
        select(DiningTable).where(DiningTable.id == table_id, DiningTable.restaurant_id == ctx.restaurant.id)
    )
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    db.delete(table)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="table.delete",
        entity_type="dining_table",
        entity_id=str(table_id),
    ))
    db.commit()


@public_tables_router.get("/{qr_token}", response_model=PublicTableOut)
def resolve_public_table(qr_token: str, db: Session = Depends(get_db)):
    row = db.execute(
        select(DiningTable, Restaurant)
        .join(Restaurant, Restaurant.id == DiningTable.restaurant_id)
        .where(
            DiningTable.qr_token == qr_token,
            DiningTable.is_active.is_(True),
            Restaurant.status == "active",
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Table QR code is invalid or inactive")
    table, restaurant = row
    return PublicTableOut(
        restaurant_slug=restaurant.slug,
        restaurant_name=restaurant.name,
        table_id=table.id,
        area_name=table.area_name,
        table_label=table.label,
        capacity=table.capacity,
    )


# ---------------------------------------------------------------------------
# Kitchen Stations & Station-Routed Tickets
# ---------------------------------------------------------------------------

kitchen_router = APIRouter(prefix="/kitchen", tags=["kitchen"])


@kitchen_router.get("/stations", response_model=list[KitchenStationOut])
def list_kitchen_stations(
    ctx: TenantContext = Depends(require_roles(*_KITCHEN_VIEWERS)),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(KitchenStation)
        .where(KitchenStation.restaurant_id == ctx.restaurant.id, KitchenStation.is_active.is_(True))
        .order_by(KitchenStation.name)
    ).all()


@kitchen_router.post("/stations", response_model=KitchenStationOut, status_code=201)
def create_kitchen_station(
    body: KitchenStationIn,
    ctx: TenantContext = Depends(require_roles(*_MANAGERS)),
    db: Session = Depends(get_db),
):
    code = _CODE_RE.sub("-", body.code.strip().lower()).strip("-")[:40]
    if not code:
        raise HTTPException(status_code=422, detail="Station code must contain alphanumeric characters")
    station = KitchenStation(restaurant_id=ctx.restaurant.id, name=body.name.strip(), code=code)
    db.add(station)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Kitchen station code already exists") from exc
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="kitchen.station.create",
        entity_type="kitchen_station",
        entity_id=str(station.id),
    ))
    db.commit()
    db.refresh(station)
    return station


@kitchen_router.delete("/stations/{station_id}", status_code=204)
def delete_kitchen_station(
    station_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_MANAGERS)),
    db: Session = Depends(get_db),
):
    station = db.scalar(
        select(KitchenStation).where(
            KitchenStation.id == station_id, KitchenStation.restaurant_id == ctx.restaurant.id
        )
    )
    if not station:
        raise HTTPException(status_code=404, detail="Kitchen station not found")
    db.delete(station)
    db.commit()


@kitchen_router.get("/tickets", response_model=list[KitchenTicketOut])
def list_kitchen_tickets(
    station: str | None = Query(default=None),
    status: str | None = Query(default=None),
    service_mode: str | None = Query(default=None),
    ctx: TenantContext = Depends(require_roles(*_KITCHEN_VIEWERS)),
    db: Session = Depends(get_db),
):
    stmt = select(Order).where(
        Order.restaurant_id == ctx.restaurant.id,
        Order.status.in_(["received", "confirmed", "in_preparation"]),
    )
    if status:
        stmt = stmt.where(Order.status == status)
    if service_mode:
        stmt = stmt.where(Order.service_mode == service_mode)
    orders = db.scalars(stmt.order_by(Order.created_at)).all()
    if not orders:
        return []

    order_ids = [o.id for o in orders]
    lines = db.scalars(select(OrderLine).where(OrderLine.order_id.in_(order_ids))).all()
    item_ids = {l.menu_item_id for l in lines if l.menu_item_id is not None}
    station_by_item: dict[uuid.UUID, str | None] = {}
    if item_ids:
        for item_id, kitchen_station in db.execute(
            select(MenuItem.id, MenuItem.kitchen_station).where(MenuItem.id.in_(item_ids))
        ).all():
            station_by_item[item_id] = kitchen_station

    lines_by_order: dict[uuid.UUID, list[KitchenTicketLineOut]] = {}
    for line in lines:
        line_station = station_by_item.get(line.menu_item_id) if line.menu_item_id else None
        lines_by_order.setdefault(line.order_id, []).append(
            KitchenTicketLineOut(
                id=line.id,
                name=line.name,
                quantity=line.quantity,
                kitchen_station=line_station,
                modifiers_snapshot=line.modifiers_snapshot,
            )
        )

    station_filter = station.strip().lower() if station and station.strip() else None
    tickets: list[KitchenTicketOut] = []
    for order in orders:
        order_lines = lines_by_order.get(order.id, [])
        stations = sorted({l.kitchen_station for l in order_lines if l.kitchen_station})
        if station_filter:
            matching_lines = [
                l for l in order_lines if (l.kitchen_station or "").lower() == station_filter
            ]
            if not matching_lines:
                continue
            order_lines = matching_lines
        tickets.append(
            KitchenTicketOut(
                id=order.id,
                customer_name=order.customer_name,
                service_mode=order.service_mode,
                table_label=order.table_label,
                status=order.status,
                created_at=order.created_at,
                special_instructions=order.special_instructions,
                stations=stations,
                lines=order_lines,
            )
        )
    return tickets


@kitchen_router.patch("/tickets/{order_id}", response_model=OrderOut)
def update_kitchen_ticket(
    order_id: uuid.UUID,
    body: OrderStatusIn,
    ctx: TenantContext = Depends(require_roles(*_KITCHEN_EDITORS)),
    db: Session = Depends(get_db),
):
    order = db.scalar(select(Order).where(Order.id == order_id, Order.restaurant_id == ctx.restaurant.id))
    if not order:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ctx.member.role == Role.KITCHEN.value and body.status not in {"in_preparation", "ready"}:
        raise HTTPException(status_code=403, detail="Kitchen staff can only start or complete preparation")
    allowed = STATUS_TRANSITIONS.get(order.status, set())
    if body.status not in allowed:
        raise HTTPException(status_code=409, detail=f"Cannot transition from '{order.status}' to '{body.status}'")
    order.status = body.status
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="kitchen.ticket.update",
        entity_type="order",
        entity_id=str(order.id),
        data={"status": body.status},
    ))
    db.commit()
    db.refresh(order)
    hub.publish(str(ctx.restaurant.id), "kitchen.ticket.updated", {"order_id": str(order.id), "status": order.status})
    return _attach_lines(db, order)


# ---------------------------------------------------------------------------
# POS-Lite & Cash Drawer Sessions
# ---------------------------------------------------------------------------

pos_router = APIRouter(prefix="/pos", tags=["pos"])


def _compute_expected_cash(db: Session, session: CashSession, until: datetime) -> int:
    cash_orders = db.scalars(
        select(Order).where(
            Order.restaurant_id == session.restaurant_id,
            Order.payment_method == "cash",
            Order.status != "cancelled",
            Order.created_at >= session.opened_at,
            Order.created_at <= until,
        )
    ).all()
    return session.opening_balance_minor + sum(o.total_minor for o in cash_orders)


def _session_out(session: CashSession) -> CashSessionOut:
    out = CashSessionOut.model_validate(session)
    if session.counted_cash_minor is not None:
        out.variance_minor = session.counted_cash_minor - session.expected_cash_minor
    return out


@pos_router.get("/sessions", response_model=list[CashSessionOut])
def list_cash_sessions(
    ctx: TenantContext = Depends(require_roles(*_CASH_ROLES)),
    db: Session = Depends(get_db),
):
    sessions = db.scalars(
        select(CashSession)
        .where(CashSession.restaurant_id == ctx.restaurant.id)
        .order_by(CashSession.opened_at.desc())
        .limit(30)
    ).all()
    now = datetime.now(timezone.utc)
    result = []
    for s in sessions:
        if s.status == "open":
            s.expected_cash_minor = _compute_expected_cash(db, s, now)
        result.append(_session_out(s))
    return result


@pos_router.post("/sessions/open", response_model=CashSessionOut, status_code=201)
def open_cash_session(
    body: CashSessionOpenIn,
    ctx: TenantContext = Depends(require_roles(*_CASH_ROLES)),
    db: Session = Depends(get_db),
):
    existing_open = db.scalar(
        select(CashSession).where(
            CashSession.restaurant_id == ctx.restaurant.id,
            CashSession.status == "open",
        )
    )
    if existing_open:
        raise HTTPException(status_code=409, detail="A cash session is already open for this restaurant")
    session = CashSession(
        restaurant_id=ctx.restaurant.id,
        opened_by_user_id=ctx.user.id,
        opening_balance_minor=body.opening_balance_minor,
        expected_cash_minor=body.opening_balance_minor,
        status="open",
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(session)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="pos.cash_session.open",
        entity_type="cash_session",
        entity_id=str(session.id),
        data={"opening_balance_minor": body.opening_balance_minor},
    ))
    db.commit()
    db.refresh(session)
    return _session_out(session)


@pos_router.post("/sessions/{session_id}/close", response_model=CashSessionOut)
def close_cash_session(
    session_id: uuid.UUID,
    body: CashSessionCloseIn,
    ctx: TenantContext = Depends(require_roles(*_CASH_ROLES)),
    db: Session = Depends(get_db),
):
    session = db.scalar(
        select(CashSession).where(
            CashSession.id == session_id, CashSession.restaurant_id == ctx.restaurant.id
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Cash session not found")
    if session.status != "open":
        raise HTTPException(status_code=409, detail="Cash session is already closed")

    now = datetime.now(timezone.utc)
    expected = _compute_expected_cash(db, session, now)
    session.expected_cash_minor = expected
    session.counted_cash_minor = body.counted_cash_minor
    session.closed_by_user_id = ctx.user.id
    session.closed_at = now
    session.status = "closed"
    if body.notes:
        session.notes = body.notes.strip()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="pos.cash_session.close",
        entity_type="cash_session",
        entity_id=str(session.id),
        data={
            "expected_cash_minor": expected,
            "counted_cash_minor": body.counted_cash_minor,
            "variance_minor": body.counted_cash_minor - expected,
        },
    ))
    db.commit()
    db.refresh(session)
    return _session_out(session)


@pos_router.post("/orders", response_model=OrderOut, status_code=201)
def create_pos_order(
    body: PosOrderIn,
    ctx: TenantContext = Depends(require_roles(*_POS_ROLES)),
    db: Session = Depends(get_db),
):
    lines = _build_lines(db, ctx.restaurant.id, body.lines)
    subtotal = sum(l.line_total_minor for l in lines)
    delivery_fee = ctx.restaurant.delivery_fee_minor if body.service_mode == "delivery" else 0
    coupon, discount_minor = evaluate_coupon(db, ctx.restaurant.id, body.coupon_code, subtotal, delivery_fee)
    total = max(subtotal + delivery_fee - discount_minor, 0)
    if coupon is not None:
        coupon.used_count += 1

    order = Order(
        restaurant_id=ctx.restaurant.id,
        customer_name=body.customer_name.strip(),
        service_mode=body.service_mode,
        table_label=body.table_label.strip() if body.table_label else None,
        payment_method=body.payment_method,
        payment_status="paid" if body.mark_paid else "pending",
        subtotal_minor=subtotal,
        discount_minor=discount_minor,
        delivery_fee_minor=delivery_fee,
        total_minor=total,
        coupon_code=coupon.code if coupon else None,
        special_instructions=body.special_instructions,
        status="confirmed",
    )
    db.add(order)
    db.flush()
    for line in lines:
        line.order_id = order.id
    db.add_all(lines)
    notify_restaurant_staff(
        db,
        restaurant_id=ctx.restaurant.id,
        event_type="order.created",
        title="New POS order",
        body=f"POS {order.service_mode} order for {order.customer_name}.",
        entity_type="order",
        entity_id=str(order.id),
        dedupe_key=f"order:{order.id}:created",
    )
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="pos.order.create",
        entity_type="order",
        entity_id=str(order.id),
        data={"total_minor": total, "payment_method": order.payment_method},
    ))
    db.commit()
    db.refresh(order)
    hub.publish(str(ctx.restaurant.id), "order.created", {"order_id": str(order.id), "status": order.status})
    return _attach_lines(db, order)


# ---------------------------------------------------------------------------
# Delivery Operations & Rider Workflow
# ---------------------------------------------------------------------------

deliveries_router = APIRouter(prefix="/deliveries", tags=["deliveries"])

_DELIVERY_TRANSITIONS: dict[str, set[str]] = {
    "assigned": {"picked_up", "failed"},
    "picked_up": {"en_route", "delivered", "failed"},
    "en_route": {"delivered", "failed"},
    "delivered": set(),
    "failed": set(),
}


def _serialize_delivery(assignment: DeliveryAssignment, order: Order, rider: User | None) -> DeliveryAssignmentOut:
    return DeliveryAssignmentOut(
        id=assignment.id,
        restaurant_id=assignment.restaurant_id,
        order_id=assignment.order_id,
        rider_user_id=assignment.rider_user_id,
        rider_name=rider.full_name if rider else None,
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        delivery_address=order.delivery_address,
        order_status=order.status,
        total_minor=order.total_minor,
        status=assignment.status,
        notes=assignment.notes,
        assigned_at=assignment.assigned_at,
        picked_up_at=assignment.picked_up_at,
        en_route_at=assignment.en_route_at,
        delivered_at=assignment.delivered_at,
    )


@deliveries_router.get("", response_model=list[DeliveryAssignmentOut])
def list_deliveries(
    ctx: TenantContext = Depends(require_roles(*_DELIVERY_VIEWERS)),
    db: Session = Depends(get_db),
):
    stmt = (
        select(DeliveryAssignment, Order, User)
        .join(Order, Order.id == DeliveryAssignment.order_id)
        .outerjoin(User, User.id == DeliveryAssignment.rider_user_id)
        .where(DeliveryAssignment.restaurant_id == ctx.restaurant.id)
    )
    if ctx.member.role == Role.RIDER.value:
        stmt = stmt.where(DeliveryAssignment.rider_user_id == ctx.user.id)
    rows = db.execute(stmt.order_by(DeliveryAssignment.assigned_at.desc())).all()
    return [_serialize_delivery(a, o, u) for a, o, u in rows]


@deliveries_router.post("/assign", response_model=DeliveryAssignmentOut, status_code=201)
def assign_delivery(
    body: DeliveryAssignIn,
    ctx: TenantContext = Depends(require_roles(*_DELIVERY_ASSIGNERS)),
    db: Session = Depends(get_db),
):
    order = db.scalar(
        select(Order).where(Order.id == body.order_id, Order.restaurant_id == ctx.restaurant.id)
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.service_mode != "delivery":
        raise HTTPException(status_code=409, detail="Only delivery orders can be assigned to a rider")
    if order.status == "cancelled":
        raise HTTPException(status_code=409, detail="Cannot assign a cancelled order")

    member = db.scalar(
        select(RestaurantMember).where(
            RestaurantMember.restaurant_id == ctx.restaurant.id,
            RestaurantMember.user_id == body.rider_user_id,
            RestaurantMember.is_active.is_(True),
        )
    )
    if not member:
        raise HTTPException(status_code=404, detail="Rider member not found in this restaurant")
    rider = db.scalar(select(User).where(User.id == body.rider_user_id))

    existing = db.scalar(select(DeliveryAssignment).where(DeliveryAssignment.order_id == order.id))
    if existing:
        existing.rider_user_id = body.rider_user_id
        existing.status = "assigned"
        existing.notes = body.notes.strip() if body.notes else existing.notes
        assignment = existing
    else:
        assignment = DeliveryAssignment(
            restaurant_id=ctx.restaurant.id,
            order_id=order.id,
            rider_user_id=body.rider_user_id,
            status="assigned",
            notes=body.notes.strip() if body.notes else None,
        )
        db.add(assignment)
        db.flush()

    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="delivery.assign",
        entity_type="delivery_assignment",
        entity_id=str(assignment.id),
        data={"order_id": str(order.id), "rider_user_id": str(body.rider_user_id)},
    ))
    db.commit()
    db.refresh(assignment)
    hub.publish(str(ctx.restaurant.id), "delivery.updated", {"assignment_id": str(assignment.id), "status": assignment.status})
    return _serialize_delivery(assignment, order, rider)


@deliveries_router.patch("/{assignment_id}/status", response_model=DeliveryAssignmentOut)
def update_delivery_status(
    assignment_id: uuid.UUID,
    body: DeliveryStatusIn,
    ctx: TenantContext = Depends(require_roles(*_DELIVERY_VIEWERS)),
    db: Session = Depends(get_db),
):
    assignment = db.scalar(
        select(DeliveryAssignment).where(
            DeliveryAssignment.id == assignment_id,
            DeliveryAssignment.restaurant_id == ctx.restaurant.id,
        )
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Delivery assignment not found")
    if ctx.member.role == Role.RIDER.value and assignment.rider_user_id != ctx.user.id:
        raise HTTPException(status_code=404, detail="Delivery assignment not found")
    allowed = _DELIVERY_TRANSITIONS.get(assignment.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition delivery from '{assignment.status}' to '{body.status}'",
        )

    now = datetime.now(timezone.utc)
    assignment.status = body.status
    if body.notes:
        assignment.notes = body.notes.strip()
    if body.status == "picked_up":
        assignment.picked_up_at = now
    elif body.status == "en_route":
        assignment.en_route_at = now
    elif body.status == "delivered":
        assignment.delivered_at = now

    order = db.scalar(select(Order).where(Order.id == assignment.order_id))
    if order:
        if body.status == "en_route" and order.status == "ready":
            order.status = "out_for_delivery"
        elif body.status == "delivered" and order.status in {"ready", "out_for_delivery"}:
            order.status = "served"

    rider = db.scalar(select(User).where(User.id == assignment.rider_user_id))
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="delivery.status.update",
        entity_type="delivery_assignment",
        entity_id=str(assignment.id),
        data={"status": body.status},
    ))
    db.commit()
    db.refresh(assignment)
    if order:
        db.refresh(order)
    hub.publish(str(ctx.restaurant.id), "delivery.updated", {"assignment_id": str(assignment.id), "status": assignment.status})
    return _serialize_delivery(assignment, order, rider)


# ---------------------------------------------------------------------------
# Expenses (Finance & Reports)
# ---------------------------------------------------------------------------

expenses_router = APIRouter(prefix="/expenses", tags=["expenses"])


@expenses_router.get("", response_model=list[ExpenseOut])
def list_expenses(
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    ctx: TenantContext = Depends(require_roles(*_FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    stmt = select(Expense).where(Expense.restaurant_id == ctx.restaurant.id)
    if start_date:
        try:
            stmt = stmt.where(Expense.incurred_on >= Date.fromisoformat(start_date))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="start_date must be YYYY-MM-DD") from exc
    if end_date:
        try:
            stmt = stmt.where(Expense.incurred_on <= Date.fromisoformat(end_date))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="end_date must be YYYY-MM-DD") from exc
    return db.scalars(stmt.order_by(Expense.incurred_on.desc(), Expense.created_at.desc())).all()


@expenses_router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    body: ExpenseIn,
    ctx: TenantContext = Depends(require_roles(*_FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    expense = Expense(
        restaurant_id=ctx.restaurant.id,
        category=body.category.strip(),
        description=body.description.strip(),
        amount_minor=body.amount_minor,
        incurred_on=body.incurred_on,
        created_by_user_id=ctx.user.id,
    )
    db.add(expense)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="expense.create",
        entity_type="expense",
        entity_id=str(expense.id),
        data={"amount_minor": body.amount_minor, "category": expense.category},
    ))
    db.commit()
    db.refresh(expense)
    return expense


@expenses_router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_FINANCE_ROLES)),
    db: Session = Depends(get_db),
):
    expense = db.scalar(
        select(Expense).where(Expense.id == expense_id, Expense.restaurant_id == ctx.restaurant.id)
    )
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="expense.delete",
        entity_type="expense",
        entity_id=str(expense_id),
    ))
    db.commit()


# ---------------------------------------------------------------------------
# Authenticated Tenant WebSocket Stream
# ---------------------------------------------------------------------------

ws_router = APIRouter(prefix="/ws", tags=["realtime"])


@ws_router.websocket("/restaurant")
async def restaurant_realtime_stream(websocket: WebSocket, restaurant_id: str = Query(...)):
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
        await websocket.close(code=4401)
        return
    try:
        rid = uuid.UUID(restaurant_id)
    except ValueError:
        await websocket.close(code=4400)
        return

    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        session = db.scalar(
            select(UserSession).where(
                UserSession.token_hash == hash_token(token),
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
            )
        )
        if not session:
            await websocket.close(code=4401)
            return
        member = db.scalar(
            select(RestaurantMember).where(
                RestaurantMember.user_id == session.user_id,
                RestaurantMember.restaurant_id == rid,
                RestaurantMember.is_active.is_(True),
            )
        )
        if not member:
            await websocket.close(code=4403)
            return

    key = str(rid)
    await hub.connect(key, websocket)
    try:
        await websocket.send_json({"event": "connected", "restaurant_id": key})
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        hub.disconnect(key, websocket)
    except Exception:
        hub.disconnect(key, websocket)
