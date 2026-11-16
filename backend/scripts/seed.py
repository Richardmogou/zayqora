"""Données de démonstration (développement uniquement) :  python -m scripts.seed"""
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import Branch, Restaurant, RestaurantMember, User

DEV_PASSWORD = "ChangeMe123!"

USERS = [
    ("platform@example.com", "Platform Admin", True),
    ("owner@example.com", "Demo Owner", False),
    ("manager@example.com", "Demo Manager", False),
    ("owner2@example.com", "Other Owner", False),
]
RESTAURANTS = [
    ("demo-bistro", "Demo Bistro", [("owner@example.com", "owner"), ("manager@example.com", "manager")]),
    ("other-cafe", "Other Cafe", [("owner2@example.com", "owner")]),
]


def main() -> None:
    if settings.is_production:
        raise SystemExit("Refusing to seed demo data in production.")
    with SessionLocal() as db:
        users: dict[str, User] = {}
        for email, name, is_admin in USERS:
            u = db.scalar(select(User).where(User.email == email))
            if u is None:
                u = User(email=email, full_name=name, is_platform_admin=is_admin, password_hash=hash_password(DEV_PASSWORD))
                db.add(u)
            users[email] = u
        db.flush()

        for slug, name, members in RESTAURANTS:
            r = db.scalar(select(Restaurant).where(Restaurant.slug == slug))
            if r is None:
                r = Restaurant(slug=slug, name=name, status="active")
                db.add(r)
                db.flush()
                db.add(Branch(restaurant_id=r.id, name="Main branch", is_default=True))
            for email, role in members:
                exists = db.scalar(select(RestaurantMember).where(
                    RestaurantMember.restaurant_id == r.id, RestaurantMember.user_id == users[email].id))
                if exists is None:
                    db.add(RestaurantMember(restaurant_id=r.id, user_id=users[email].id, role=role))
        db.commit()
    print("Seed done. Dev password for every account:", DEV_PASSWORD)
    for email, _, _ in USERS:
        print(" -", email)


if __name__ == "__main__":
    main()
