import base64
import binascii
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AuditLog, MenuCategory, MenuItem, Modifier, ModifierGroup
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.menu import (
    AvailabilityIn, CategoryIn, CategoryOut, CategoryUpdateIn,
    ImageUploadIn, ImageUploadOut,
    MenuItemIn, MenuItemOut, MenuItemUpdateIn,
    ModifierGroupIn, ModifierGroupOut,
)

router = APIRouter(prefix="/menu", tags=["menu"])

_EDITORS = (Role.OWNER, Role.MANAGER)
_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN, Role.WAITER)
_MAX_IMAGE_BYTES = 2 * 1024 * 1024
UPLOAD_ROOT = Path(__file__).resolve().parents[3] / "storage" / "uploads"


def _detect_image_ext(raw: bytes, declared_type: str) -> str:
    ct = declared_type.lower().strip()
    if raw.startswith(b"\x89PNG\r\n\x1a\n") and ct == "image/png":
        return "png"
    if raw.startswith(b"\xff\xd8\xff") and ct in {"image/jpeg", "image/jpg"}:
        return "jpg"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP" and ct == "image/webp":
        return "webp"
    raise HTTPException(status_code=422, detail="Only valid PNG, JPEG or WebP images are allowed")


def _get_item(db: Session, item_id: uuid.UUID, restaurant_id: uuid.UUID) -> MenuItem:
    item = db.scalar(select(MenuItem).where(MenuItem.id == item_id, MenuItem.restaurant_id == restaurant_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


def _load_groups(db: Session, item_id: uuid.UUID) -> list[ModifierGroup]:
    groups = db.scalars(select(ModifierGroup).where(ModifierGroup.item_id == item_id).order_by(ModifierGroup.position)).all()
    for g in groups:
        g.modifiers = db.scalars(select(Modifier).where(Modifier.group_id == g.id).order_by(Modifier.position)).all()
    return groups


def _save_groups(db: Session, item_id: uuid.UUID, groups: list[ModifierGroupIn]) -> None:
    existing = db.scalars(select(ModifierGroup).where(ModifierGroup.item_id == item_id)).all()
    for group in existing:
        db.delete(group)
    db.flush()
    for group_idx, group_in in enumerate(groups):
        group = ModifierGroup(
            item_id=item_id,
            name=group_in.name,
            required=group_in.required,
            multi_select=group_in.multi_select,
            position=group_in.position or group_idx,
        )
        db.add(group)
        db.flush()
        for mod_idx, mod_in in enumerate(group_in.modifiers):
            db.add(Modifier(
                group_id=group.id,
                name=mod_in.name,
                price_delta_minor=mod_in.price_delta_minor,
                is_default=mod_in.is_default,
                position=mod_in.position or mod_idx,
            ))


def _item_out(db: Session, item: MenuItem) -> MenuItemOut:
    item.modifier_groups = _load_groups(db, item.id)
    return MenuItemOut.model_validate(item)


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(ctx: TenantContext = Depends(require_roles(*_VIEWERS)), db: Session = Depends(get_db)):
    return db.scalars(
        select(MenuCategory)
        .where(MenuCategory.restaurant_id == ctx.restaurant.id)
        .order_by(MenuCategory.position)
    ).all()


@router.post("/categories", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryIn, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    cat = MenuCategory(restaurant_id=ctx.restaurant.id, **body.model_dump())
    db.add(cat)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id, action="menu.category.create", entity_type="menu_category"))
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: uuid.UUID, body: CategoryUpdateIn, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    cat = db.scalar(select(MenuCategory).where(MenuCategory.id == category_id, MenuCategory.restaurant_id == ctx.restaurant.id))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id, action="menu.category.update", entity_type="menu_category", entity_id=str(category_id)))
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(category_id: uuid.UUID, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    cat = db.scalar(select(MenuCategory).where(MenuCategory.id == category_id, MenuCategory.restaurant_id == ctx.restaurant.id))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id, action="menu.category.delete", entity_type="menu_category", entity_id=str(category_id)))
    db.commit()


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

@router.post("/images", response_model=ImageUploadOut, status_code=201)
def upload_menu_image(
    body: ImageUploadIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    encoded = body.data_base64.strip()
    if "," in encoded and encoded.startswith("data:"):
        encoded = encoded.split(",", 1)[1]
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Invalid base64 image payload") from exc
    if not raw or len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="Image size must be between 1 byte and 2 MB")
    ext = _detect_image_ext(raw, body.content_type)
    tenant_dir = UPLOAD_ROOT / str(ctx.restaurant.id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4()}.{ext}"
    (tenant_dir / stored_name).write_bytes(raw)
    image_url = f"/api/v1/public/uploads/{ctx.restaurant.id}/{stored_name}"
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="menu.image.upload",
        entity_type="media_asset",
        entity_id=stored_name,
        data={"filename": body.filename, "size_bytes": len(raw)},
    ))
    db.commit()
    return {"image_url": image_url}


@router.get("/items", response_model=list[MenuItemOut])
def list_items(ctx: TenantContext = Depends(require_roles(*_VIEWERS)), db: Session = Depends(get_db)):
    items = db.scalars(
        select(MenuItem)
        .where(MenuItem.restaurant_id == ctx.restaurant.id)
        .order_by(MenuItem.position)
    ).all()
    return [_item_out(db, i) for i in items]


@router.post("/items", response_model=MenuItemOut, status_code=201)
def create_item(body: MenuItemIn, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    cat = db.scalar(select(MenuCategory).where(MenuCategory.id == body.category_id, MenuCategory.restaurant_id == ctx.restaurant.id))
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if body.discounted_price_minor is not None and body.discounted_price_minor >= body.price_minor:
        raise HTTPException(status_code=422, detail="Discounted price must be lower than base price")
    payload = body.model_dump(exclude={"modifier_groups"})
    item = MenuItem(restaurant_id=ctx.restaurant.id, **payload)
    db.add(item)
    db.flush()
    if body.modifier_groups is not None:
        _save_groups(db, item.id, body.modifier_groups)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="menu.item.create",
        entity_type="menu_item",
        entity_id=str(item.id),
        data={"price_minor": item.price_minor, "discounted_price_minor": item.discounted_price_minor},
    ))
    db.commit()
    db.refresh(item)
    return _item_out(db, item)


@router.get("/items/{item_id}", response_model=MenuItemOut)
def get_item(item_id: uuid.UUID, ctx: TenantContext = Depends(require_roles(*_VIEWERS)), db: Session = Depends(get_db)):
    return _item_out(db, _get_item(db, item_id, ctx.restaurant.id))


@router.patch("/items/{item_id}", response_model=MenuItemOut)
def update_item(item_id: uuid.UUID, body: MenuItemUpdateIn, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    item = _get_item(db, item_id, ctx.restaurant.id)
    old_price = item.price_minor
    old_discount = item.discounted_price_minor
    data = body.model_dump(exclude_unset=True, exclude={"modifier_groups"})
    if "category_id" in data and data["category_id"] is not None:
        cat = db.scalar(select(MenuCategory).where(MenuCategory.id == data["category_id"], MenuCategory.restaurant_id == ctx.restaurant.id))
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")
    next_price = data.get("price_minor", item.price_minor)
    next_discount = data.get("discounted_price_minor", item.discounted_price_minor)
    if next_discount is not None and next_price is not None and next_discount >= next_price:
        raise HTTPException(status_code=422, detail="Discounted price must be lower than base price")
    for field, value in data.items():
        if value is not None or field in {"description", "image_url", "discounted_price_minor", "prep_time_minutes", "kitchen_station", "allergens", "dietary_tags"}:
            setattr(item, field, value)
    if body.modifier_groups is not None:
        _save_groups(db, item.id, body.modifier_groups)
    audit_data: dict = {}
    if item.price_minor != old_price or item.discounted_price_minor != old_discount:
        audit_data["old_price_minor"] = old_price
        audit_data["new_price_minor"] = item.price_minor
        audit_data["old_discounted_price_minor"] = old_discount
        audit_data["new_discounted_price_minor"] = item.discounted_price_minor
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="menu.item.update",
        entity_type="menu_item",
        entity_id=str(item_id),
        data=audit_data or None,
    ))
    db.commit()
    db.refresh(item)
    return _item_out(db, item)


@router.patch("/items/{item_id}/availability", response_model=MenuItemOut)
def update_availability(item_id: uuid.UUID, body: AvailabilityIn, ctx: TenantContext = Depends(require_roles(*_EDITORS, Role.KITCHEN)), db: Session = Depends(get_db)):
    item = _get_item(db, item_id, ctx.restaurant.id)
    item.is_available = body.is_available
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id, action="menu.item.availability", entity_type="menu_item", entity_id=str(item_id), data={"is_available": body.is_available}))
    db.commit()
    db.refresh(item)
    return _item_out(db, item)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: uuid.UUID, ctx: TenantContext = Depends(require_roles(*_EDITORS)), db: Session = Depends(get_db)):
    item = _get_item(db, item_id, ctx.restaurant.id)
    db.delete(item)
    db.add(AuditLog(actor_user_id=ctx.user.id, restaurant_id=ctx.restaurant.id, action="menu.item.delete", entity_type="menu_item", entity_id=str(item_id)))
    db.commit()
