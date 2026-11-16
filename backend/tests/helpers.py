from app.core.security import hash_password
from app.models import Restaurant, RestaurantMember, User

PASSWORD = "Passw0rd!Passw0rd"


def make_user(db, email, *, password=PASSWORD, full_name="Test User", **kw) -> User:
    user = User(email=email.lower(), full_name=full_name, password_hash=hash_password(password), **kw)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_restaurant(db, slug, name=None, status="active") -> Restaurant:
    r = Restaurant(slug=slug, name=name or slug.title(), status=status)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def add_member(db, restaurant, user, role="owner") -> RestaurantMember:
    m = RestaurantMember(restaurant_id=restaurant.id, user_id=user.id, role=role)
    db.add(m)
    db.commit()
    return m


def login(client, email, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})
