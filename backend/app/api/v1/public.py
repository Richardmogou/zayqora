from datetime import datetime, timezone
import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.menu import UPLOAD_ROOT
from app.core.db import get_db
from app.core.rate_limit import enforce_rate_limit
from app.models import Coupon, MenuCategory, MenuItem, Modifier, ModifierGroup, Restaurant
from app.schemas.auth import ContactMessageIn, PublicRestaurantDirectoryOut, RestaurantOut
from app.schemas.menu import PublicCategoryOut
from app.schemas.operations import CouponOut
from app.services.email import send_contact_message_email
from app.services.notifications import notify_restaurant_staff

router = APIRouter(prefix="/public", tags=["public"])
_SAFE_FILE_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$")
_MIME_BY_EXT = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}


def _get_active_restaurant(slug: str, db: Session) -> Restaurant:
    r = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return r


def _load_public_groups(db: Session, item_id) -> list:
    groups = db.scalars(select(ModifierGroup).where(ModifierGroup.item_id == item_id).order_by(ModifierGroup.position)).all()
    for g in groups:
        g.modifiers = db.scalars(select(Modifier).where(Modifier.group_id == g.id).order_by(Modifier.position)).all()
    return groups


@router.get("/restaurants", response_model=list[PublicRestaurantDirectoryOut])
def list_public_restaurants(db: Session = Depends(get_db)):
    return db.scalars(
        select(Restaurant).where(Restaurant.status == "active").order_by(Restaurant.name)
    ).all()


@router.get("/restaurants/{slug}", response_model=RestaurantOut)
def public_restaurant(slug: str, db: Session = Depends(get_db)):
    return _get_active_restaurant(slug, db)


@router.get("/restaurants/{slug}/offers", response_model=list[CouponOut])
def public_offers(slug: str, db: Session = Depends(get_db)):
    r = _get_active_restaurant(slug, db)
    now = datetime.now(timezone.utc)
    coupons = db.scalars(
        select(Coupon)
        .where(Coupon.restaurant_id == r.id, Coupon.is_active.is_(True))
        .order_by(Coupon.created_at.desc())
    ).all()
    active_offers = []
    for coupon in coupons:
        if coupon.expires_at is not None:
            exp = coupon.expires_at if coupon.expires_at.tzinfo else coupon.expires_at.replace(tzinfo=timezone.utc)
            if exp < now:
                continue
        if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
            continue
        active_offers.append(coupon)
    return active_offers


@router.post("/restaurants/{slug}/contact", status_code=201)
def submit_public_contact(slug: str, body: ContactMessageIn, request: Request, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "public_contact")
    r = _get_active_restaurant(slug, db)
    enquiry_id = str(uuid.uuid4())
    sender_name = body.name.strip()
    sender_email = body.email.strip().lower()
    message = body.message.strip()
    notify_restaurant_staff(
        db,
        restaurant_id=r.id,
        event_type="contact.message",
        title=f"Contact enquiry from {sender_name}",
        body=f"{sender_name} ({sender_email}): {message[:180]}",
        entity_type="contact",
        entity_id=enquiry_id,
        dedupe_key=f"contact:{enquiry_id}",
        data={"email": sender_email, "phone": body.phone},
    )
    db.commit()
    if r.contact_email:
        send_contact_message_email(r.contact_email, r.name, sender_name, sender_email, message)
    return {"status": "received", "id": enquiry_id}


@router.get("/restaurants/{slug}/menu", response_model=list[PublicCategoryOut])
def public_menu(slug: str, db: Session = Depends(get_db)):
    r = _get_active_restaurant(slug, db)
    categories = db.scalars(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == r.id, MenuCategory.is_active.is_(True))
        .order_by(MenuCategory.position)
    ).all()
    result = []
    for cat in categories:
        items = db.scalars(
            select(MenuItem)
            .where(
                MenuItem.category_id == cat.id,
                MenuItem.restaurant_id == r.id,
                MenuItem.is_published.is_(True),
                MenuItem.is_available.is_(True),
            )
            .order_by(MenuItem.position)
        ).all()
        for item in items:
            item.modifier_groups = _load_public_groups(db, item.id)
        cat.items = items
        result.append(cat)
    return result


@router.get("/uploads/{restaurant_id}/{filename}")
def get_uploaded_image(restaurant_id: uuid.UUID, filename: str):
    if not _SAFE_FILE_RE.match(filename):
        raise HTTPException(status_code=404, detail="File not found")
    target = UPLOAD_ROOT / str(restaurant_id) / filename
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    ext = filename.rsplit(".", 1)[-1]
    return Response(
        content=target.read_bytes(),
        media_type=_MIME_BY_EXT[ext],
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=86400",
        },
    )
