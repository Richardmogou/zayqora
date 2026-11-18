from sqlalchemy import select

from app.core.config import settings
from app.models import AuditLog, Branch, Restaurant, RestaurantMember, User, UserSession
from tests.helpers import PASSWORD, login, make_restaurant, make_user

PAYLOAD = {
    "full_name": "Alice Owner",
    "email": "alice@example.com",
    "password": "Str0ng!Pass",
    "restaurant_name": "Alice Bistro",
}


def register(client, **overrides):
    return client.post("/api/v1/auth/register", json={**PAYLOAD, **overrides})


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_register_creates_user_restaurant_branch_member(client, db):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "alice@example.com"
    assert len(body["memberships"]) == 1
    assert body["memberships"][0]["role"] == "owner"
    assert body["memberships"][0]["restaurant_slug"] == "alice-bistro"

    user = db.scalar(select(User).where(User.email == "alice@example.com"))
    assert user is not None
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == "alice-bistro"))
    assert restaurant is not None and restaurant.status == "pending"
    branch = db.scalar(select(Branch).where(Branch.restaurant_id == restaurant.id))
    assert branch is not None and branch.is_default is True
    member = db.scalar(select(RestaurantMember).where(RestaurantMember.user_id == user.id))
    assert member is not None and member.role == "owner"


def test_register_sets_httponly_cookie_and_me_works(client, db):
    r = register(client)
    assert r.status_code == 201
    assert "httponly" in r.headers["set-cookie"].lower()
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "alice@example.com"


def test_register_writes_audit_log(client, db):
    register(client)
    log = db.scalar(select(AuditLog).where(AuditLog.action == "auth.register"))
    assert log is not None


def test_register_stores_session_token_hashed(client, db):
    register(client)
    token = client.cookies.get(settings.session_cookie_name)
    session = db.query(UserSession).one()
    assert token and session.token_hash != token and len(session.token_hash) == 64


# ---------------------------------------------------------------------------
# Slug generation
# ---------------------------------------------------------------------------

def test_slug_is_slugified_from_restaurant_name(client, db):
    r = register(client, restaurant_name="Le Café du Coin!")
    assert r.status_code == 201
    assert r.json()["memberships"][0]["restaurant_slug"] == "le-caf-du-coin"


def test_duplicate_restaurant_name_gets_unique_slug(client, db):
    make_restaurant(db, "alice-bistro", "Alice Bistro")
    r = register(client)
    assert r.status_code == 201
    slug = r.json()["memberships"][0]["restaurant_slug"]
    assert slug == "alice-bistro-1"


def test_two_registrations_with_same_restaurant_name_get_different_slugs(client, db):
    r1 = register(client, email="a@example.com")
    r2 = register(client, email="b@example.com")
    assert r1.status_code == r2.status_code == 201
    slugs = {r1.json()["memberships"][0]["restaurant_slug"], r2.json()["memberships"][0]["restaurant_slug"]}
    assert len(slugs) == 2


# ---------------------------------------------------------------------------
# Validation & conflict
# ---------------------------------------------------------------------------

def test_duplicate_email_returns_409(client, db):
    register(client)
    r = register(client)
    assert r.status_code == 409


def test_short_password_is_rejected(client, db):
    r = register(client, password="short")
    assert r.status_code == 422


def test_invalid_email_is_rejected(client, db):
    r = register(client, email="not-an-email")
    assert r.status_code == 422


def test_missing_restaurant_name_is_rejected(client, db):
    payload = {k: v for k, v in PAYLOAD.items() if k != "restaurant_name"}
    r = client.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Tenant isolation after registration
# ---------------------------------------------------------------------------

def test_new_owner_cannot_access_another_restaurant(client, db):
    other = make_restaurant(db, "other-place", "Other Place")
    register(client)
    r = client.get("/api/v1/restaurants/me", headers={"X-Restaurant-Id": str(other.id)})
    assert r.status_code == 404


def test_registered_owner_sees_only_own_restaurant(client, db):
    make_restaurant(db, "other-place", "Other Place")
    register(client)
    body = client.get("/api/v1/restaurants/me").json()
    assert body["slug"] == "alice-bistro"


def test_unauthenticated_register_then_logout_blocks_me(client, db):
    register(client)
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/me").status_code == 401
