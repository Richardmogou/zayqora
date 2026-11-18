import re
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.menu import UPLOAD_ROOT
from app.core.db import get_db
from app.models import MenuCategory, MenuItem, Modifier, ModifierGroup, Restaurant
from app.schemas.auth import RestaurantOut
from app.schemas.menu import PublicCategoryOut, PublicMenuItemOut, PublicModifierGroupOut

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


@router.get("/restaurants/{slug}", response_model=RestaurantOut)
def public_restaurant(slug: str, db: Session = Depends(get_db)):
    return _get_active_restaurant(slug, db)


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
