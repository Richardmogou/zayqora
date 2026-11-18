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


@router.patch("/me", response_model=RestaurantOut)
def update_my_restaurant(
    body: RestaurantUpdateIn,
    ctx: TenantContext = Depends(require_roles(Role.OWNER, Role.MANAGER)),
    db: Session = Depends(get_db),
):
    r = ctx.restaurant
    if body.name is not None:
        r.name = body.name.strip()
    if body.country is not None:
        r.country = body.country.upper()
    if body.currency is not None:
        r.currency = body.currency.upper()
    if body.timezone is not None:
        r.timezone = body.timezone
    if body.status is not None:
        r.status = body.status
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=r.id,
        action="restaurant.update",
        data={k: v for k, v in body.model_dump().items() if v is not None},
    ))
    db.commit()
    db.refresh(r)
    return r
