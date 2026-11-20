from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import AuditLog
from app.permissions.deps import TenantContext, get_tenant, require_roles
from app.permissions.roles import Role
from app.schemas.auth import RestaurantOut, RestaurantUpdateIn

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("/me", response_model=RestaurantOut)
def my_restaurant(ctx: TenantContext = Depends(get_tenant)):
    """Restaurant du contexte courant."""
    return ctx.restaurant


_OPTIONAL_TEXT_FIELDS = {
    "tagline",
    "description",
    "cuisine",
    "phone",
    "contact_email",
    "address",
    "logo_url",
    "cover_image_url",
    "privacy_policy",
    "terms_of_service",
    "refund_policy",
}


@router.patch("/me", response_model=RestaurantOut)
def update_my_restaurant(
    body: RestaurantUpdateIn,
    ctx: TenantContext = Depends(require_roles(Role.OWNER, Role.MANAGER)),
    db: Session = Depends(get_db),
):
    r = ctx.restaurant
    updates = body.model_dump(exclude_unset=True)
    if updates.get("name") is not None:
        r.name = updates["name"].strip()
    if updates.get("country") is not None:
        r.country = updates["country"].upper()
    if updates.get("currency") is not None:
        r.currency = updates["currency"].upper()
    if updates.get("timezone") is not None:
        r.timezone = updates["timezone"]
    if updates.get("status") is not None:
        r.status = updates["status"]
    if updates.get("delivery_fee_minor") is not None:
        r.delivery_fee_minor = updates["delivery_fee_minor"]
    if updates.get("tax_rate_bps") is not None:
        r.tax_rate_bps = updates["tax_rate_bps"]
    for field in _OPTIONAL_TEXT_FIELDS:
        if field in updates:
            raw = updates[field]
            setattr(r, field, raw.strip() if isinstance(raw, str) and raw.strip() else None)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=r.id,
        action="restaurant.update",
        data={k: v for k, v in updates.items() if v is not None},
    ))
    db.commit()
    db.refresh(r)
    return r
