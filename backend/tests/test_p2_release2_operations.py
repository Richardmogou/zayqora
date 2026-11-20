from datetime import date

from app.models import MenuCategory, MenuItem
from tests.helpers import add_member, login, make_restaurant, make_user


def _setup_owner(db, client, slug="bistro-r2"):
    r = make_restaurant(db, slug, "Bistro R2", status="active")
    u = make_user(db, f"owner-{slug}@example.com")
    add_member(db, r, u, "owner")
    login(client, f"owner-{slug}@example.com")
    return r, u


def test_dining_tables_qr_resolution_rotation_and_role_guard(client, db):
    r, _ = _setup_owner(db, client, "qr-bistro")
    headers = {"X-Restaurant-Id": str(r.id)}

    created = client.post(
        "/api/v1/tables",
        headers=headers,
        json={"area_name": "Terrace", "label": "Table T1", "capacity": 4},
    )
    assert created.status_code == 201
    table = created.json()
    old_token = table["qr_token"]
    assert len(old_token) >= 24

    resolved = client.get(f"/api/v1/public/tables/{old_token}")
    assert resolved.status_code == 200
    assert resolved.json()["restaurant_slug"] == "qr-bistro"
    assert resolved.json()["table_label"] == "Table T1"

    rotated = client.post(f"/api/v1/tables/{table['id']}/rotate-qr", headers=headers)
    assert rotated.status_code == 200
    new_token = rotated.json()["qr_token"]
    assert new_token != old_token

    assert client.get(f"/api/v1/public/tables/{old_token}").status_code == 404
    assert client.get(f"/api/v1/public/tables/{new_token}").status_code == 200

    waiter = make_user(db, "waiter-qr@example.com")
    add_member(db, r, waiter, "waiter")
    login(client, "waiter-qr@example.com")
    assert client.patch(f"/api/v1/tables/{table['id']}", headers=headers, json={"status": "occupied"}).status_code == 200
    assert client.patch(f"/api/v1/tables/{table['id']}", headers=headers, json={"capacity": 8}).status_code == 403


def test_kitchen_stations_routing_and_ticket_updates(client, db):
    r, _ = _setup_owner(db, client, "kds-bistro")
    headers = {"X-Restaurant-Id": str(r.id)}

    st = client.post("/api/v1/kitchen/stations", headers=headers, json={"name": "Grill", "code": "grill"})
    assert st.status_code == 201

    cat = MenuCategory(restaurant_id=r.id, name="Menu")
    db.add(cat)
    db.flush()
    steak = MenuItem(
        restaurant_id=r.id, category_id=cat.id, name="Ribeye", price_minor=2800,
        kitchen_station="Grill", is_published=True, is_available=True,
    )
    soda = MenuItem(
        restaurant_id=r.id, category_id=cat.id, name="Lemonade", price_minor=500,
        kitchen_station="Bar", is_published=True, is_available=True,
    )
    db.add_all([steak, soda])
    db.commit()

    order = client.post(
        "/api/v1/public/orders?slug=kds-bistro",
        json={
            "customer_name": "Lea",
            "service_mode": "dine-in",
            "table_label": "Table 2",
            "payment_method": "card",
            "lines": [
                {"menu_item_id": str(steak.id), "quantity": 1},
                {"menu_item_id": str(soda.id), "quantity": 2},
            ],
        },
    ).json()

    grill_tickets = client.get("/api/v1/kitchen/tickets?station=Grill", headers=headers)
    assert grill_tickets.status_code == 200
    assert len(grill_tickets.json()) == 1
    assert [l["name"] for l in grill_tickets.json()[0]["lines"]] == ["Ribeye"]

    upd = client.patch(f"/api/v1/kitchen/tickets/{order['id']}", headers=headers, json={"status": "in_preparation"})
    assert upd.status_code == 200
    assert upd.json()["status"] == "in_preparation"


def test_pos_order_and_cash_drawer_reconciliation(client, db):
    r, _ = _setup_owner(db, client, "pos-bistro")
    headers = {"X-Restaurant-Id": str(r.id)}
    cat = MenuCategory(restaurant_id=r.id, name="Counter")
    db.add(cat)
    db.flush()
    coffee = MenuItem(restaurant_id=r.id, category_id=cat.id, name="Espresso", price_minor=350, is_published=True, is_available=True)
    db.add(coffee)
    db.commit()

    opened = client.post("/api/v1/pos/sessions/open", headers=headers, json={"opening_balance_minor": 10000})
    assert opened.status_code == 201
    session_id = opened.json()["id"]

    dup = client.post("/api/v1/pos/sessions/open", headers=headers, json={"opening_balance_minor": 5000})
    assert dup.status_code == 409

    pos_order = client.post(
        "/api/v1/pos/orders",
        headers=headers,
        json={
            "customer_name": "Counter #1",
            "service_mode": "pickup",
            "payment_method": "cash",
            "mark_paid": True,
            "lines": [{"menu_item_id": str(coffee.id), "quantity": 2}],
        },
    )
    assert pos_order.status_code == 201
    assert pos_order.json()["status"] == "confirmed"
    assert pos_order.json()["payment_status"] == "paid"
    assert pos_order.json()["total_minor"] == 700

    closed = client.post(
        f"/api/v1/pos/sessions/{session_id}/close",
        headers=headers,
        json={"counted_cash_minor": 10650, "notes": "End of shift"},
    )
    assert closed.status_code == 200
    body = closed.json()
    assert body["expected_cash_minor"] == 10700
    assert body["variance_minor"] == -50
    assert body["status"] == "closed"


def test_delivery_assignment_rider_isolation_and_order_sync(client, db):
    r, _ = _setup_owner(db, client, "delivery-bistro")
    headers = {"X-Restaurant-Id": str(r.id)}
    rider_a = make_user(db, "rider-a@example.com")
    rider_b = make_user(db, "rider-b@example.com")
    add_member(db, r, rider_a, "rider")
    add_member(db, r, rider_b, "rider")

    cat = MenuCategory(restaurant_id=r.id, name="Pizza")
    db.add(cat)
    db.flush()
    pizza = MenuItem(restaurant_id=r.id, category_id=cat.id, name="Margherita", price_minor=1400, is_published=True, is_available=True)
    db.add(pizza)
    db.commit()

    order = client.post(
        "/api/v1/public/orders?slug=delivery-bistro",
        json={
            "customer_name": "Omar",
            "service_mode": "delivery",
            "delivery_address": "42 Avenue Foch",
            "payment_method": "card",
            "lines": [{"menu_item_id": str(pizza.id), "quantity": 1}],
        },
    ).json()
    client.patch(f"/api/v1/orders/{order['id']}/status", headers=headers, json={"status": "in_preparation"})
    client.patch(f"/api/v1/orders/{order['id']}/status", headers=headers, json={"status": "ready"})

    assigned = client.post(
        "/api/v1/deliveries/assign",
        headers=headers,
        json={"order_id": order["id"], "rider_user_id": str(rider_a.id), "notes": "Ring bell"},
    )
    assert assigned.status_code == 201
    assignment_id = assigned.json()["id"]

    # Rider B cannot see or mutate Rider A's assignment
    login(client, "rider-b@example.com")
    assert client.get("/api/v1/deliveries", headers=headers).json() == []
    assert client.patch(f"/api/v1/deliveries/{assignment_id}/status", headers=headers, json={"status": "picked_up"}).status_code == 404

    # Rider A completes the delivery lifecycle
    login(client, "rider-a@example.com")
    assert len(client.get("/api/v1/deliveries", headers=headers).json()) == 1
    assert client.patch(f"/api/v1/deliveries/{assignment_id}/status", headers=headers, json={"status": "picked_up"}).status_code == 200
    en_route = client.patch(f"/api/v1/deliveries/{assignment_id}/status", headers=headers, json={"status": "en_route"})
    assert en_route.status_code == 200
    assert en_route.json()["order_status"] == "out_for_delivery"
    delivered = client.patch(f"/api/v1/deliveries/{assignment_id}/status", headers=headers, json={"status": "delivered"})
    assert delivered.status_code == 200
    assert delivered.json()["order_status"] == "served"


def test_expenses_custom_report_range_and_authenticated_websocket(client, db):
    r, _ = _setup_owner(db, client, "fin-bistro")
    headers = {"X-Restaurant-Id": str(r.id)}
    today_iso = date.today().isoformat()

    exp = client.post(
        "/api/v1/expenses",
        headers=headers,
        json={"category": "Ingredients", "description": "Fresh produce", "amount_minor": 4500, "incurred_on": today_iso},
    )
    assert exp.status_code == 201

    report = client.get(
        f"/api/v1/reports/sales?period=custom&start_date={today_iso}&end_date={today_iso}",
        headers=headers,
    )
    assert report.status_code == 200
    data = report.json()
    assert data["period"] == "custom"
    assert data["expenses_minor"] == 4500
    assert data["estimated_profit_minor"] == data["net_sales_minor"] - 4500

    with client.websocket_connect(f"/api/v1/ws/restaurant?restaurant_id={r.id}") as ws:
        hello = ws.receive_json()
        assert hello["event"] == "connected"
        ws.send_text("ping")
        assert ws.receive_text() == "pong"
