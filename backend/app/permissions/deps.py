import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.security import hash_token
from app.models import Restaurant, RestaurantMember, User, UserSession
from app.permissions.roles import Role

ACTIVE_RESTAURANT_STATUSES = ("pending", "active")  # un restaurant suspendu perd l'accès


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=401, detail="Not authenticated")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise _unauthorized()
    row = db.execute(
        select(UserSession, User).join(User, User.id == UserSession.user_id).where(UserSession.token_hash == hash_token(token))
    ).first()
    if row is None:
        raise _unauthorized()
    session, user = row
    if session.revoked_at is not None or session.expires_at <= datetime.now(timezone.utc) or not user.is_active:
        raise _unauthorized()
    return user


@dataclass
class TenantContext:
    user: User
    restaurant: Restaurant
    member: RestaurantMember


def get_tenant(
    restaurant_id: uuid.UUID | None = Header(default=None, alias="X-Restaurant-Id"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantContext:
    """Le restaurant n'est JAMAIS pris tel quel du client : l'appartenance est vérifiée côté serveur."""
    stmt = (
        select(RestaurantMember, Restaurant)
        .join(Restaurant, Restaurant.id == RestaurantMember.restaurant_id)
        .where(
            RestaurantMember.user_id == user.id,
            RestaurantMember.is_active.is_(True),
            Restaurant.status.in_(ACTIVE_RESTAURANT_STATUSES),
        )
    )
    if restaurant_id is not None:
        stmt = stmt.where(Restaurant.id == restaurant_id)
    rows = db.execute(stmt).all()

    if not rows:
        # Avec un identifiant fourni : 404 pour ne pas révéler l'existence d'un restaurant d'autrui
        raise HTTPException(status_code=404, detail="Restaurant not found") if restaurant_id else HTTPException(
            status_code=403, detail="No restaurant access"
        )
    if len(rows) > 1:
        raise HTTPException(status_code=400, detail="X-Restaurant-Id header required")
    member, restaurant = rows[0]
    return TenantContext(user=user, restaurant=restaurant, member=member)


def require_roles(*roles: Role):
    allowed = {r.value for r in roles}

    def dependency(ctx: TenantContext = Depends(get_tenant)) -> TenantContext:
        if ctx.member.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return ctx

    return dependency


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Platform administrator only")
    return user
