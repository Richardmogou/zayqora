"""Données de démonstration (développement uniquement) :  python -m scripts.seed"""
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import Branch, MenuCategory, MenuItem, Modifier, ModifierGroup, Restaurant, RestaurantMember, User

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
DEMO_MENU = [
    (
        "Starters",
        [
            ("Mediterranean Salad", "Fresh greens, feta cheese, Kalamata olives, and lemon herb dressing.", "/images/dish-salad-native.png", 1200, "Dairy", "Vegetarian,Gluten-Free", "Cold Station / Salads", True, True, True),
            ("Soup of the Day", "Chef's daily seasonal vegetable soup served with toasted sourdough.", "/images/dish-salad.jpg", 900, "Gluten", "Vegetarian,Vegan", "Hot Kitchen / Grill", False, True, True),
        ],
    ),
    (
        "Main courses",
        [
            ("Salmon Fillet", "Pan-seared Atlantic salmon with roasted asparagus and citrus butter.", "/images/dish-salmon-native.png", 2400, "Fish, Dairy", "Gluten-Free,Halal", "Hot Kitchen / Grill", True, True, True),
            ("Duck Breast", "Roasted duck breast with honey-spiced glaze and parsnip purée.", "/images/dish-salmon.jpg", 2400, "Dairy", "Gluten-Free", "Hot Kitchen / Grill", False, False, True),
        ],
    ),
    (
        "Desserts",
        [
            ("Chocolate Tart", "Dark 70% Valrhona chocolate ganache tart with sea salt.", "/images/dish-tart-native.png", 800, "Gluten, Dairy, Eggs", "Vegetarian", "Pastry & Desserts", True, True, True),
            ("Crème Brûlée", "Classic Madagascar vanilla bean custard with caramelized sugar crust.", "/images/dish-tart.jpg", 900, "Dairy, Eggs", "Vegetarian,Gluten-Free", "Pastry & Desserts", False, True, False),
        ],
    ),
    (
        "Drinks",
        [
            ("Fresh Orange Juice", "Cold-pressed Valencia oranges.", None, 500, None, "Vegan,Gluten-Free", "Bar & Beverages", False, True, True),
            ("Sparkling Water", "Chilled mineral sparkling water (75cl).", None, 400, None, "Vegan,Gluten-Free", "Bar & Beverages", False, True, True),
        ],
    ),
]


def _seed_demo_menu(db, restaurant: Restaurant) -> None:
    has_categories = db.scalar(select(MenuCategory).where(MenuCategory.restaurant_id == restaurant.id))
    if has_categories is not None:
        by_name = {
            name: (image_url, dietary_tags, station, is_featured)
            for _, items in DEMO_MENU
            for name, _, image_url, _, _, dietary_tags, station, is_featured, _, _ in items
        }
        existing_items = db.scalars(select(MenuItem).where(MenuItem.restaurant_id == restaurant.id)).all()
        for item in existing_items:
            if item.name in by_name and not item.image_url:
                item.image_url, item.dietary_tags, item.kitchen_station, item.is_featured = by_name[item.name]
        return
    for cat_pos, (cat_name, items) in enumerate(DEMO_MENU):
        category = MenuCategory(restaurant_id=restaurant.id, name=cat_name, position=cat_pos, is_active=True)
        db.add(category)
        db.flush()
        for item_pos, (name, description, image_url, price_minor, allergens, dietary_tags, station, is_featured, is_available, is_published) in enumerate(items):
            item = MenuItem(
                restaurant_id=restaurant.id,
                category_id=category.id,
                name=name,
                description=description,
                image_url=image_url,
                price_minor=price_minor,
                tax_rate="10",
                prep_time_minutes=15,
                kitchen_station=station,
                allergens=allergens,
                dietary_tags=dietary_tags,
                is_featured=is_featured,
                is_available=is_available,
                is_published=is_published,
                position=item_pos,
            )
            db.add(item)
            db.flush()
            if name == "Salmon Fillet":
                group = ModifierGroup(item_id=item.id, name="Side choice", required=True, multi_select=False, position=0)
                db.add(group)
                db.flush()
                db.add_all([
                    Modifier(group_id=group.id, name="Roasted seasonal vegetables", price_delta_minor=0, is_default=True, position=0),
                    Modifier(group_id=group.id, name="Truffle mashed potatoes", price_delta_minor=350, is_default=False, position=1),
                ])


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
                r = Restaurant(slug=slug, name=name, status="active", country="FR", currency="EUR", timezone="Europe/Paris")
                db.add(r)
                db.flush()
                db.add(Branch(restaurant_id=r.id, name="Main branch", is_default=True))
            for email, role in members:
                exists = db.scalar(select(RestaurantMember).where(
                    RestaurantMember.restaurant_id == r.id, RestaurantMember.user_id == users[email].id))
                if exists is None:
                    db.add(RestaurantMember(restaurant_id=r.id, user_id=users[email].id, role=role))
            if slug == "demo-bistro":
                _seed_demo_menu(db, r)
        db.commit()
    print("Seed done. Dev password for every account:", DEV_PASSWORD)
    for email, _, _ in USERS:
        print(" -", email)


if __name__ == "__main__":
    main()
