from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.config import settings
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from tests.helpers import add_member, login, make_restaurant, make_user


def test_member_sees_own_restaurant(client, db):
    r = make_restaurant(db, "alpha", "Alpha")
    add_member(db, r, make_user(db, "a@example.com"))
    login(client, "a@example.com")
    body = client.get("/api/v1/restaurants/me").json()
    assert body["slug"] == "alpha"


def test_other_tenant_id_is_hidden(client, db):
    alpha, beta = make_restaurant(db, "alpha"), make_restaurant(db, "beta")
    add_member(db, alpha, make_user(db, "a@example.com"))
    login(client, "a@example.com")
    r = client.get("/api/v1/restaurants/me", headers={"X-Restaurant-Id": str(beta.id)})
    assert r.status_code == 404  # on ne révèle pas que ce restaurant existe


def test_user_without_membership_is_forbidden(client, db):
    make_user(db, "lonely@example.com")
    login(client, "lonely@example.com")
    assert client.get("/api/v1/restaurants/me").status_code == 403


def test_several_memberships_require_explicit_choice(client, db):
    alpha, beta = make_restaurant(db, "alpha"), make_restaurant(db, "beta")
    user = make_user(db, "multi@example.com")
    add_member(db, alpha, user)
    add_member(db, beta, user, "manager")
    login(client, "multi@example.com")
    assert client.get("/api/v1/restaurants/me").status_code == 400
    ok = client.get("/api/v1/restaurants/me", headers={"X-Restaurant-Id": str(beta.id)})
    assert ok.status_code == 200 and ok.json()["slug"] == "beta"


def test_suspended_restaurant_blocks_access(client, db):
    r = make_restaurant(db, "alpha", status="suspended")
    add_member(db, r, make_user(db, "a@example.com"))
    login(client, "a@example.com")
    assert client.get("/api/v1/restaurants/me").status_code == 403


def test_role_guard_blocks_wrong_role(client, db):
    r = make_restaurant(db, "alpha")
    add_member(db, r, make_user(db, "owner@example.com"), "owner")
    add_member(db, r, make_user(db, "waiter@example.com"), "waiter")

    probe = FastAPI()

    @probe.get("/owner-only")
    def owner_only(ctx: TenantContext = Depends(require_roles(Role.OWNER))):
        return {"role": ctx.member.role}

    for email, expected in (("owner@example.com", 200), ("waiter@example.com", 403)):
        login(client, email)
        with TestClient(probe) as p:
            p.cookies.set(settings.session_cookie_name, client.cookies.get(settings.session_cookie_name))
            assert p.get("/owner-only").status_code == expected
        client.cookies.clear()
