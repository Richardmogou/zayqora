from fastapi import APIRouter, Depends

from app.permissions.deps import TenantContext, get_tenant
from app.schemas.auth import RestaurantOut

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("/me", response_model=RestaurantOut)
def my_restaurant(ctx: TenantContext = Depends(get_tenant)):
    """Restaurant du contexte courant. Sert aussi de preuve de l'isolation entre locataires."""
    return ctx.restaurant
