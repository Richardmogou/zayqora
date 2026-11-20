import uuid
from datetime import date as Date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.rate_limit import enforce_rate_limit
from app.core.security import hash_password
from app.models import AuditLog, Reservation, ReservationBlock, Restaurant, RestaurantMember, User
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.reservations import (
    MemberInviteIn, MemberOut,
    PublicReservationIn, ReservationAvailabilityOut, ReservationBlockIn, ReservationBlockOut,
    ReservationIn, ReservationOut, ReservationSettingsIn, ReservationSettingsOut, ReservationStatusIn,
    ReservationUpdateIn,
    RESERVATION_STATUSES, RESERVATION_TRANSITIONS,
)
from app.services.email import send_reservation_email
from app.services.notifications import notify_restaurant_staff
from app.services.realtime import hub

router = APIRouter(prefix="/reservations", tags=["reservations"])
members_router = APIRouter(prefix="/members", tags=["team"])
public_router = APIRouter(prefix="/public/reservations", tags=["public"])

_EDITORS = (Role.OWNER, Role.MANAGER)
_STATUS_EDITORS = (Role.OWNER, Role.MANAGER, Role.WAITER)
_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)


def _get_reservation(db: Session, res_id: uuid.UUID, restaurant_id: uuid.UUID) -> Reservation:
    r = db.scalar(select(Reservation).where(
        Reservation.id == res_id, Reservation.restaurant_id == restaurant_id
    ))
    if not r:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return r


def _restaurant_timezone(restaurant: Restaurant) -> ZoneInfo:
    try:
        return ZoneInfo(restaurant.timezone)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Restaurant timezone is not a valid IANA timezone") from exc


def _opening_windows(restaurant: Restaurant, day: Date):
    timezone_info = _restaurant_timezone(restaurant)
    raw_windows = (restaurant.reservation_opening_hours or {}).get(str(day.weekday()), [])
    result = []
    for raw_open, raw_close in raw_windows:
        try:
            starts = datetime.combine(day, time.fromisoformat(raw_open), timezone_info)
            ends = datetime.combine(day, time.fromisoformat(raw_close), timezone_info)
        except (TypeError, ValueError):
            raise HTTPException(status_code=500, detail="Restaurant reservation hours are invalid")
        if ends <= starts:
            raise HTTPException(status_code=500, detail="Restaurant reservation hours are invalid")
        result.append((starts, ends))
    return result


def _capacity_for_start(db: Session, restaurant: Restaurant, starts_at: datetime, guests: int) -> int:
    duration = restaurant.reservation_duration_minutes + restaurant.reservation_buffer_minutes
    ends_at = starts_at + timedelta(minutes=duration)
    search_from = starts_at - timedelta(minutes=duration)
    existing = db.scalars(select(Reservation).where(
        Reservation.restaurant_id == restaurant.id,
        Reservation.status.in_(["pending", "confirmed", "seated"]),
        Reservation.reserved_at >= search_from,
        Reservation.reserved_at < ends_at,
    )).all()
    occupied = 0
    for reservation in existing:
        existing_start = reservation.reserved_at
        if existing_start.tzinfo is None:
            existing_start = existing_start.replace(tzinfo=timezone.utc)
        existing_end = existing_start + timedelta(minutes=duration)
        if existing_start < ends_at and existing_end > starts_at:
            occupied += reservation.guests

    blocks = db.scalars(select(ReservationBlock).where(
        ReservationBlock.restaurant_id == restaurant.id,
        ReservationBlock.starts_at < ends_at,
        ReservationBlock.ends_at > starts_at,
    )).all()
    if blocks:
        return 0
    return max(restaurant.reservation_capacity - occupied, 0)


def _valid_slot_start(restaurant: Restaurant, starts_at: datetime) -> bool:
    tz = _restaurant_timezone(restaurant)
    local_start = starts_at.astimezone(tz)
    interval = restaurant.reservation_slot_interval_minutes
    duration = restaurant.reservation_duration_minutes
    for window_start, window_end in _opening_windows(restaurant, local_start.date()):
        offset_seconds = int((local_start - window_start).total_seconds())
        if (
            offset_seconds >= 0
            and offset_seconds % (interval * 60) == 0
            and local_start + timedelta(minutes=duration) <= window_end
        ):
            return True
    return False


def _availability(db: Session, restaurant: Restaurant, day: Date, guests: int):
    tz = _restaurant_timezone(restaurant)
    now_local = datetime.now(timezone.utc).astimezone(tz)
    slots = []
    for window_start, window_end in _opening_windows(restaurant, day):
        cursor = window_start
        while cursor + timedelta(minutes=restaurant.reservation_duration_minutes) <= window_end:
            if cursor > now_local:
                starts_at = cursor.astimezone(timezone.utc)
                remaining = _capacity_for_start(db, restaurant, starts_at, guests)
                if remaining >= guests:
                    slots.append({"starts_at": starts_at, "remaining_guests": remaining})
            cursor += timedelta(minutes=restaurant.reservation_slot_interval_minutes)
    return {"date": day.isoformat(), "timezone": restaurant.timezone, "slots": slots}


def _validate_opening_hours(hours: dict[str, list[tuple[str, str]]]) -> None:
    for weekday, windows in hours.items():
        if weekday not in {str(index) for index in range(7)}:
            raise HTTPException(status_code=422, detail="Opening hours keys must be weekdays 0 through 6")
        parsed = []
        for start_text, end_text in windows:
            try:
                start, end = time.fromisoformat(start_text), time.fromisoformat(end_text)
            except ValueError as exc:
                raise HTTPException(status_code=422, detail="Opening hours must use HH:MM times") from exc
            if end <= start:
                raise HTTPException(status_code=422, detail="Closing time must be after opening time")
            parsed.append((start, end))
        parsed.sort()
        if any(parsed[index][1] > parsed[index + 1][0] for index in range(len(parsed) - 1)):
            raise HTTPException(status_code=422, detail="Opening hour windows cannot overlap")


# ---------------------------------------------------------------------------
# Reservations
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ReservationOut])
def list_reservations(
    date: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    status: str | None = Query(default=None),
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    q = select(Reservation).where(Reservation.restaurant_id == ctx.restaurant.id)
    if status:
        q = q.where(Reservation.status == status)
    if date:
        try:
            local_day = Date.fromisoformat(date)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Date must use YYYY-MM-DD") from exc
        tz = _restaurant_timezone(ctx.restaurant)
        local_start = datetime.combine(local_day, time.min, tz).astimezone(timezone.utc)
        local_end = datetime.combine(local_day + timedelta(days=1), time.min, tz).astimezone(timezone.utc)
        q = q.where(Reservation.reserved_at >= local_start, Reservation.reserved_at < local_end)
    q = q.order_by(Reservation.reserved_at)
    return db.scalars(q).all()


@router.post("", response_model=ReservationOut, status_code=201)
def create_reservation(
    body: ReservationIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    res = Reservation(restaurant_id=ctx.restaurant.id, **body.model_dump())
    db.add(res)
    db.flush()
    notify_restaurant_staff(
        db, restaurant_id=ctx.restaurant.id, event_type="reservation.created",
        title="New reservation", body=f"{res.customer_name} requested a table for {res.guests}.",
        entity_type="reservation", entity_id=str(res.id), dedupe_key=f"reservation:{res.id}:created",
    )
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.create", entity_type="reservation"))
    db.commit()
    db.refresh(res)
    return res


@router.get("/settings", response_model=ReservationSettingsOut)
def get_reservation_settings(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
):
    restaurant = ctx.restaurant
    return {
        "capacity": restaurant.reservation_capacity,
        "duration_minutes": restaurant.reservation_duration_minutes,
        "slot_interval_minutes": restaurant.reservation_slot_interval_minutes,
        "buffer_minutes": restaurant.reservation_buffer_minutes,
        "opening_hours": restaurant.reservation_opening_hours,
    }


@router.put("/settings", response_model=ReservationSettingsOut)
def update_reservation_settings(
    body: ReservationSettingsIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    _validate_opening_hours(body.opening_hours)
    restaurant = ctx.restaurant
    restaurant.reservation_capacity = body.capacity
    restaurant.reservation_duration_minutes = body.duration_minutes
    restaurant.reservation_slot_interval_minutes = body.slot_interval_minutes
    restaurant.reservation_buffer_minutes = body.buffer_minutes
    restaurant.reservation_opening_hours = body.opening_hours
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=restaurant.id,
                    action="reservation.settings.update", entity_type="restaurant"))
    db.commit()
    return get_reservation_settings(ctx)


@router.get("/blocks", response_model=list[ReservationBlockOut])
def list_reservation_blocks(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    return db.scalars(select(ReservationBlock).where(
        ReservationBlock.restaurant_id == ctx.restaurant.id,
        ReservationBlock.ends_at > datetime.now(timezone.utc),
    ).order_by(ReservationBlock.starts_at)).all()


@router.post("/blocks", response_model=ReservationBlockOut, status_code=201)
def create_reservation_block(
    body: ReservationBlockIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    if body.starts_at.tzinfo is None or body.ends_at.tzinfo is None or body.ends_at <= body.starts_at:
        raise HTTPException(status_code=422, detail="A block needs timezone-aware start and end times, with end after start")
    block = ReservationBlock(restaurant_id=ctx.restaurant.id, **body.model_dump())
    db.add(block)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.block.create", entity_type="reservation_block"))
    db.commit()
    db.refresh(block)
    return block


@router.delete("/blocks/{block_id}", status_code=204)
def delete_reservation_block(
    block_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    block = db.scalar(select(ReservationBlock).where(
        ReservationBlock.id == block_id, ReservationBlock.restaurant_id == ctx.restaurant.id
    ))
    if not block:
        raise HTTPException(status_code=404, detail="Reservation block not found")
    db.delete(block)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.block.delete", entity_type="reservation_block", entity_id=str(block_id)))
    db.commit()


@public_router.get("/availability", response_model=ReservationAvailabilityOut)
def public_reservation_availability(
    slug: str,
    date: str,
    guests: int = Query(ge=1, le=100),
    db: Session = Depends(get_db),
):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    try:
        day = Date.fromisoformat(date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Date must use YYYY-MM-DD") from exc
    if day < datetime.now(_restaurant_timezone(restaurant)).date():
        raise HTTPException(status_code=422, detail="Reservation date cannot be in the past")
    if guests > restaurant.reservation_capacity:
        return {"date": day.isoformat(), "timezone": restaurant.timezone, "slots": []}
    return _availability(db, restaurant, day, guests)


@public_router.post("", response_model=ReservationOut, status_code=201)
def create_public_reservation(
    body: PublicReservationIn,
    slug: str,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(request, "public_reservation_create")
    restaurant = db.scalar(select(Restaurant).where(
        Restaurant.slug == slug, Restaurant.status == "active"
    ).with_for_update())
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    if body.idempotency_key:
        existing = db.scalar(select(Reservation).where(
            Reservation.restaurant_id == restaurant.id,
            Reservation.idempotency_key == body.idempotency_key,
        ))
        if existing:
            return existing
    starts_at = body.reserved_at
    if starts_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="Reservation time must include a timezone")
    starts_at = starts_at.astimezone(timezone.utc)
    if starts_at <= datetime.now(timezone.utc) or not _valid_slot_start(restaurant, starts_at):
        raise HTTPException(status_code=409, detail="This reservation time is outside available booking hours")
    remaining = _capacity_for_start(db, restaurant, starts_at, body.guests)
    if body.guests > remaining:
        raise HTTPException(status_code=409, detail="This time is no longer available. Choose another slot.")

    reservation = Reservation(
        restaurant_id=restaurant.id,
        **body.model_dump(exclude={"idempotency_key", "reserved_at"}),
        reserved_at=starts_at,
        idempotency_key=body.idempotency_key,
        status="pending",
    )
    db.add(reservation)
    db.flush()
    notify_restaurant_staff(
        db, restaurant_id=restaurant.id, event_type="reservation.created",
        title="New reservation", body=f"{reservation.customer_name} requested a table for {reservation.guests}.",
        entity_type="reservation", entity_id=str(reservation.id),
        dedupe_key=f"reservation:{reservation.id}:created",
    )
    db.commit()
    db.refresh(reservation)
    hub.publish(str(restaurant.id), "reservation.created", {"reservation_id": str(reservation.id)})
    if reservation.customer_email:
        local_dt = reservation.reserved_at.astimezone(_restaurant_timezone(restaurant))
        send_reservation_email(
            reservation.customer_email,
            reservation.customer_name,
            restaurant.name,
            reservation.guests,
            local_dt.strftime("%Y-%m-%d %H:%M"),
            reservation.status,
        )
    return reservation


@router.get("/{res_id}", response_model=ReservationOut)
def get_reservation(
    res_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    return _get_reservation(db, res_id, ctx.restaurant.id)


@router.patch("/{res_id}", response_model=ReservationOut)
def update_reservation(
    res_id: uuid.UUID,
    body: ReservationUpdateIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    res = _get_reservation(db, res_id, ctx.restaurant.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field in {"customer_phone", "customer_email", "table_label", "notes"}:
            setattr(res, field, value)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.update", entity_type="reservation", entity_id=str(res_id)))
    db.commit()
    db.refresh(res)
    return res


@router.patch("/{res_id}/status", response_model=ReservationOut)
def update_reservation_status(
    res_id: uuid.UUID,
    body: ReservationStatusIn,
    ctx: TenantContext = Depends(require_roles(*_STATUS_EDITORS)),
    db: Session = Depends(get_db),
):
    if body.status not in RESERVATION_STATUSES:
        raise HTTPException(status_code=422, detail=f"Invalid status. Must be one of: {sorted(RESERVATION_STATUSES)}")
    if ctx.member.role == Role.WAITER.value and body.status not in {"seated", "completed"}:
        raise HTTPException(status_code=403, detail="Waiters can only mark reservations as seated or completed")
    res = _get_reservation(db, res_id, ctx.restaurant.id)
    allowed = RESERVATION_TRANSITIONS.get(res.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot transition from '{res.status}' to '{body.status}'. Allowed: {sorted(allowed) or 'none'}",
        )
    res.status = body.status
    notify_restaurant_staff(
        db, restaurant_id=ctx.restaurant.id, event_type="reservation.updated",
        title="Reservation updated", body=f"{res.customer_name}'s reservation is now {body.status.replace('_', ' ')}.",
        entity_type="reservation", entity_id=str(res_id),
        dedupe_key=f"reservation:{res_id}:status:{body.status}", data={"status": body.status},
    )
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.status.update", entity_type="reservation", entity_id=str(res_id),
                    data={"status": body.status}))
    db.commit()
    db.refresh(res)
    if res.customer_email and body.status in {"confirmed", "cancelled"}:
        local_dt = res.reserved_at.astimezone(_restaurant_timezone(ctx.restaurant))
        send_reservation_email(
            res.customer_email,
            res.customer_name,
            ctx.restaurant.name,
            res.guests,
            local_dt.strftime("%Y-%m-%d %H:%M"),
            res.status,
        )
    return res


@router.delete("/{res_id}", status_code=204)
def delete_reservation(
    res_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    res = _get_reservation(db, res_id, ctx.restaurant.id)
    db.delete(res)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="reservation.delete", entity_type="reservation", entity_id=str(res_id)))
    db.commit()


# ---------------------------------------------------------------------------
# Team members
# ---------------------------------------------------------------------------

def _member_out(member: RestaurantMember, user: User) -> MemberOut:
    out = MemberOut.model_validate(member)
    out.email = user.email
    out.full_name = user.full_name
    return out


@members_router.get("", response_model=list[MemberOut])
def list_members(
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(RestaurantMember, User)
        .join(User, User.id == RestaurantMember.user_id)
        .where(RestaurantMember.restaurant_id == ctx.restaurant.id,
               RestaurantMember.is_active.is_(True))
        .order_by(User.full_name)
    ).all()
    return [_member_out(m, u) for m, u in rows]


@members_router.post("", response_model=MemberOut, status_code=201)
def invite_member(
    body: MemberInviteIn,
    ctx: TenantContext = Depends(require_roles(Role.OWNER)),
    db: Session = Depends(get_db),
):
    """Create user if not exists, then add as member. Owner-only."""
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user:
        user = User(
            email=body.email.lower(),
            full_name=body.full_name,
            password_hash=hash_password(__import__("secrets").token_urlsafe(24)),
        )
        db.add(user)
        db.flush()

    existing = db.scalar(select(RestaurantMember).where(
        RestaurantMember.restaurant_id == ctx.restaurant.id,
        RestaurantMember.user_id == user.id,
    ))
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.role = body.role
            db.commit()
            db.refresh(existing)
            return _member_out(existing, user)
        raise HTTPException(status_code=409, detail="User is already a member")

    member = RestaurantMember(
        restaurant_id=ctx.restaurant.id,
        user_id=user.id,
        role=body.role,
    )
    db.add(member)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="member.invite", entity_type="restaurant_member",
                    data={"email": body.email, "role": body.role}))
    db.commit()
    db.refresh(member)
    return _member_out(member, user)


@members_router.delete("/{member_id}", status_code=204)
def remove_member(
    member_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(Role.OWNER)),
    db: Session = Depends(get_db),
):
    """Soft-delete (deactivate). Cannot remove yourself."""
    member = db.scalar(select(RestaurantMember).where(
        RestaurantMember.id == member_id,
        RestaurantMember.restaurant_id == ctx.restaurant.id,
    ))
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.user_id == ctx.user.id:
        raise HTTPException(status_code=409, detail="Cannot remove yourself")
    member.is_active = False
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id,
                    action="member.remove", entity_type="restaurant_member", entity_id=str(member_id)))
    db.commit()
