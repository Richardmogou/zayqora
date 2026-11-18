import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models import Notification
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.notifications import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])
_STAFF = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN, Role.WAITER, Role.RIDER, Role.ACCOUNTANT)


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    ctx: TenantContext = Depends(require_roles(*_STAFF)),
    db: Session = Depends(get_db),
):
    query = select(Notification).where(
        Notification.restaurant_id == ctx.restaurant.id,
        Notification.user_id == ctx.user.id,
    )
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    return db.scalars(query.order_by(Notification.created_at.desc()).limit(100)).all()


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_STAFF)),
    db: Session = Depends(get_db),
):
    notification = db.scalar(select(Notification).where(
        Notification.id == notification_id,
        Notification.restaurant_id == ctx.restaurant.id,
        Notification.user_id == ctx.user.id,
    ))
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.read_at is None:
        notification.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
    return notification
