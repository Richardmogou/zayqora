from app.models import AuditLog
from sqlalchemy import select
from tests.helpers import add_member, login, make_restaurant, make_user


def _setup(db, client, role="owner"):
    r = make_restaurant(db, "my-bistro", "My Bistro")
    u = make_user(db, "owner@example.com")
    add_member(db, r, u, role)
    login(client, "owner@example.com")
    return r


def patch(client, restaurant_id, **fields):
    return client.patch(
        "/api/v1/restaurants/me",
        json=fields,
        headers={"X-Restaurant-Id": str(restaurant_id)},
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_owner_can_update_name(client, db):
    r = _setup(db, client)
    res = patch(client, r.id, name="New Name")
    assert res.status_code == 200
    assert res.json()["name"] == "New Name"


def test_owner_can_update_currency_and_timezone(client, db):
    r = _setup(db, client)
    res = patch(client, r.id, currency="EUR", timezone="Europe/Paris")
    assert res.status_code == 200
    body = res.json()
    assert body["currency"] == "EUR"
    assert body["timezone"] == "Europe/Paris"


def test_partial_update_leaves_other_fields_unchanged(client, db):
    r = _setup(db, client)
    patch(client, r.id, currency="GBP")
    body = client.get("/api/v1/restaurants/me", headers={"X-Restaurant-Id": str(r.id)}).json()
    assert body["currency"] == "GBP"
    assert body["name"] == "My Bistro"


def test_update_writes_audit_log(client, db):
    r = _setup(db, client)
    patch(client, r.id, name="Audited Name")
    log = db.scalar(select(AuditLog).where(AuditLog.action == "restaurant.update"))
    assert log is not None
    assert log.data.get("name") == "Audited Name"


def test_manager_can_update_restaurant(client, db):
    r = make_restaurant(db, "my-bistro", "My Bistro")
    u = make_user(db, "mgr@example.com")
    add_member(db, r, u, "manager")
    login(client, "mgr@example.com")
    res = patch(client, r.id, name="Manager Update")
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Authorization
# ---------------------------------------------------------------------------

def test_waiter_cannot_update_restaurant(client, db):
    r = make_restaurant(db, "my-bistro", "My Bistro")
    u = make_user(db, "waiter@example.com")
    add_member(db, r, u, "waiter")
    login(client, "waiter@example.com")
    res = patch(client, r.id, name="Hacked")
    assert res.status_code == 403


def test_unauthenticated_patch_is_rejected(client, db):
    r = make_restaurant(db, "my-bistro", "My Bistro")
    res = patch(client, r.id, name="No auth")
    assert res.status_code == 401


def test_cross_tenant_patch_is_hidden(client, db):
    alpha = make_restaurant(db, "alpha", "Alpha")
    beta = make_restaurant(db, "beta", "Beta")
    u = make_user(db, "a@example.com")
    add_member(db, alpha, u, "owner")
    login(client, "a@example.com")
    res = patch(client, beta.id, name="Stolen")
    assert res.status_code == 404
    # beta name unchanged
    db.refresh(beta)
    assert beta.name == "Beta"


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def test_empty_name_is_rejected(client, db):
    r = _setup(db, client)
    res = patch(client, r.id, name="x")   # min_length=2
    assert res.status_code == 422


def test_invalid_currency_length_is_rejected(client, db):
    r = _setup(db, client)
    res = patch(client, r.id, currency="EURO")  # max 3 chars
    assert res.status_code == 422


def test_owner_can_publish_and_unpublish_restaurant(client, db):
    r = _setup(db, client)
    res_pub = patch(client, r.id, status="active")
    assert res_pub.status_code == 200
    assert res_pub.json()["status"] == "active"

    res_draft = patch(client, r.id, status="pending")
    assert res_draft.status_code == 200
    assert res_draft.json()["status"] == "pending"


def test_owner_cannot_set_suspended_status(client, db):
    r = _setup(db, client)
    res = patch(client, r.id, status="suspended")
    assert res.status_code == 422
