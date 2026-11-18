"""Helpers for creating deduplicated staff notifications in the business transaction."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, RestaurantMember


def notify_restaurant_staff(
    db: Session,
    *,
    restaurant_id,
    event_type: str,
    title: str,
    body: str,
    entity_type: str,
    entity_id: str,
    dedupe_key: str,
    data: dict | None = None,
) -> None:
    member_ids = db.scalars(
        select(RestaurantMember.user_id).where(
            RestaurantMember.restaurant_id == restaurant_id,
            RestaurantMember.is_active.is_(True),
        )
    ).all()
    for user_id in member_ids:
        db.add(Notification(
            restaurant_id=restaurant_id,
            user_id=user_id,
            event_type=event_type,
            title=title,
            body=body,
            entity_type=entity_type,
            entity_id=entity_id,
            dedupe_key=f"{dedupe_key}:{user_id}",
            data=data,
        ))
