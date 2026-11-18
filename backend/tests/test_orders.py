import uuid
from app.models import MenuCategory, MenuItem, Modifier, ModifierGroup
from tests.helpers import add_member, login, make_restaurant, make_user

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup(db, client, role="owner"):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    u = make_user(db, "owner@example.com")
    add_member(db, r, u, role)
    login(client, "owner@example.com")
    return r


def _make_item(db, restaurant_id, price_minor=2400, published=True, available=True):
    cat = MenuCategory(restaurant_id=restaurant_id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(
        restaurant_id=restaurant_id, category_id=cat.id,
        name="Salmon", price_minor=price_minor,
        is_published=published, is_available=available,
    )
    db.add(item)
    db.commit()
    return item


def _make_item_with_modifier(db, restaurant_id):
    item = _make_item(db, restaurant_id)
    group = ModifierGroup(item_id=item.id, name="Sauce", required=False, multi_select=False)
    db.add(group)
    db.flush()
    mod = Modifier(group_id=group.id, name="Extra sauce", price_delta_minor=100)
    db.add(mod)
    db.commit()
    return item, mod


def _order_payload(item_id, service_mode="pickup", modifier_ids=None, idempotency_key=None):
    payload = {
        "customer_name": "Alice",
        "customer_phone": "+33600000000",
        "customer_email": "alice@example.com",
        "service_mode": service_mode,
        "payment_method": "card",
        "lines": [{"menu_item_id": str(item_id), "quantity": 2, "modifier_ids": [str(m) for m in (modifier_ids or [])]}],
    }
    if idempotency_key:
        payload["idempotency_key"] = idempotency_key
    return payload


# ---------------------------------------------------------------------------
# Storefront — create order (server-side pricing)
# ---------------------------------------------------------------------------

def test_create_order_server_computes_price(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id, price_minor=2400)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    assert res.status_code == 201
    body = res.json()
    assert body["subtotal_minor"] == 4800   # 2400 * 2, server-computed
    assert body["total_minor"] == 4800
    assert body["lines"][0]["unit_price_minor"] == 2400
    assert body["lines"][0]["line_total_minor"] == 4800
    assert body["payment_status"] == "pending"


def test_create_order_with_modifier_adds_delta(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item, mod = _make_item_with_modifier(db, r.id)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"},
                      json=_order_payload(item.id, modifier_ids=[mod.id]))
    assert res.status_code == 201
    body = res.json()
    # unit = 2400 + 100 = 2500, qty=2 → 5000
    assert body["lines"][0]["unit_price_minor"] == 2500
    assert body["lines"][0]["line_total_minor"] == 5000
    assert body["lines"][0]["modifiers_snapshot"][0]["name"] == "Extra sauce"


def test_modifier_from_other_item_rejected(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item1 = _make_item(db, r.id)
    item2, mod2 = _make_item_with_modifier(db, r.id)
    # try to apply mod2 (belongs to item2) to item1
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"},
                      json=_order_payload(item1.id, modifier_ids=[mod2.id]))
    assert res.status_code == 422


def test_required_modifier_group_cannot_be_skipped(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    group = ModifierGroup(item_id=item.id, name="Size", required=True, multi_select=False)
    db.add(group)
    db.flush()
    db.add(Modifier(group_id=group.id, name="Regular", price_delta_minor=0))
    db.commit()

    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    assert res.status_code == 422


def test_single_select_modifier_group_rejects_multiple_choices(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    group = ModifierGroup(item_id=item.id, name="Size", required=False, multi_select=False)
    db.add(group)
    db.flush()
    regular = Modifier(group_id=group.id, name="Regular", price_delta_minor=0)
    large = Modifier(group_id=group.id, name="Large", price_delta_minor=200)
    db.add_all([regular, large])
    db.commit()

    res = client.post(
        "/api/v1/public/orders",
        params={"slug": "bistro"},
        json=_order_payload(item.id, modifier_ids=[regular.id, large.id]),
    )
    assert res.status_code == 422


def test_unpublished_item_rejected(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id, published=False)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    assert res.status_code == 422


def test_unavailable_item_rejected(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id, available=False)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    assert res.status_code == 422


def test_cross_tenant_item_rejected(client, db):
    r = make_restaurant(db, "bistro", status="active")
    other = make_restaurant(db, "other", status="active")
    item = _make_item(db, other.id)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    assert res.status_code == 422


def test_create_order_delivery_adds_fee(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id, "delivery"))
    assert res.status_code == 201
    assert res.json()["delivery_fee_minor"] == 400
    assert res.json()["total_minor"] == 5200


def test_create_order_unknown_restaurant(client, db):
    res = client.post("/api/v1/public/orders", params={"slug": "ghost"}, json=_order_payload(uuid.uuid4()))
    assert res.status_code == 404


def test_create_order_suspended_restaurant(client, db):
    r = make_restaurant(db, "suspended", status="suspended")
    item = _make_item(db, r.id)
    res = client.post("/api/v1/public/orders", params={"slug": "suspended"}, json=_order_payload(item.id))
    assert res.status_code == 404


def test_create_order_empty_lines_rejected(client, db):
    make_restaurant(db, "bistro", status="active")
    payload = _order_payload(uuid.uuid4())
    payload["lines"] = []
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=payload)
    assert res.status_code == 422


def test_create_order_invalid_service_mode(client, db):
    make_restaurant(db, "bistro", status="active")
    payload = _order_payload(uuid.uuid4())
    payload["service_mode"] = "teleport"
    res = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=payload)
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def test_idempotency_key_returns_same_order(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    key = str(uuid.uuid4())
    res1 = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id, idempotency_key=key))
    res2 = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id, idempotency_key=key))
    assert res1.status_code == 201
    assert res2.status_code == 201
    assert res1.json()["id"] == res2.json()["id"]


def test_idempotency_keys_are_scoped_to_restaurant(client, db):
    restaurant_a = make_restaurant(db, "bistro-a", status="active")
    restaurant_b = make_restaurant(db, "bistro-b", status="active")
    item_a = _make_item(db, restaurant_a.id)
    item_b = _make_item(db, restaurant_b.id)
    key = str(uuid.uuid4())

    order_a = client.post(
        "/api/v1/public/orders", params={"slug": "bistro-a"},
        json=_order_payload(item_a.id, idempotency_key=key),
    )
    order_b = client.post(
        "/api/v1/public/orders", params={"slug": "bistro-b"},
        json=_order_payload(item_b.id, idempotency_key=key),
    )

    assert order_a.status_code == order_b.status_code == 201
    assert order_a.json()["id"] != order_b.json()["id"]
    assert order_b.json()["restaurant_id"] == str(restaurant_b.id)


def test_different_idempotency_keys_create_different_orders(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    res1 = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id, idempotency_key="key-a"))
    res2 = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id, idempotency_key="key-b"))
    assert res1.json()["id"] != res2.json()["id"]


# ---------------------------------------------------------------------------
# Workspace — list & detail
# ---------------------------------------------------------------------------

def test_owner_can_list_orders(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id))
    res = client.get("/api/v1/orders", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_cross_tenant_orders_hidden(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    item = _make_item(db, other.id)
    client.post("/api/v1/public/orders", params={"slug": "other"}, json=_order_payload(item.id))
    res = client.get("/api/v1/orders", headers={"X-Restaurant-Id": str(r.id)})
    assert len(res.json()) == 0


def test_owner_can_get_order_detail(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    res = client.get(f"/api/v1/orders/{order_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    assert len(res.json()["lines"]) == 1


def test_cross_tenant_order_detail_hidden(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    item = _make_item(db, other.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "other"}, json=_order_payload(item.id)).json()["id"]
    res = client.get(f"/api/v1/orders/{order_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

def test_valid_transition_received_to_confirmed(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "confirmed"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"


def test_invalid_transition_received_to_served(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "served"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 409


def test_terminal_status_cannot_be_changed(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "cancelled"}, headers={"X-Restaurant-Id": str(r.id)})
    res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "received"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 409


def test_invalid_status_name_rejected(client, db):
    r = _setup(db, client)
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "flying"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 422


def test_waiter_cannot_update_status(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "waiter@example.com")
    add_member(db, r, u, "waiter")
    login(client, "waiter@example.com")
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    res = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "confirmed"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 403


def test_kitchen_can_view_orders(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "chef@example.com")
    add_member(db, r, u, "kitchen")
    login(client, "chef@example.com")
    res = client.get("/api/v1/orders", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200


def test_kitchen_can_start_and_ready_tickets(client, db):
    r = make_restaurant(db, "bistro", status="active")
    item = _make_item(db, r.id)
    order_id = client.post("/api/v1/public/orders", params={"slug": "bistro"}, json=_order_payload(item.id)).json()["id"]
    chef = make_user(db, "chef@example.com")
    add_member(db, r, chef, "kitchen")
    login(client, "chef@example.com")

    board = client.get("/api/v1/orders/kitchen", headers={"X-Restaurant-Id": str(r.id)})
    assert board.status_code == 200
    assert board.json()[0]["id"] == order_id
    assert board.json()[0]["lines"][0]["name"] == "Salmon"

    start = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "in_preparation"}, headers={"X-Restaurant-Id": str(r.id)})
    ready = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "ready"}, headers={"X-Restaurant-Id": str(r.id)})
    cancel = client.patch(f"/api/v1/orders/{order_id}/status", json={"status": "cancelled"}, headers={"X-Restaurant-Id": str(r.id)})
    assert start.status_code == 200
    assert ready.status_code == 200
    assert cancel.status_code == 403
