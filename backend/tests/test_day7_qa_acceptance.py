from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from tests.helpers import add_member, login, make_restaurant, make_user


def test_security_headers_and_request_correlation_id(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert res.headers.get("permissions-policy") == "geolocation=(), microphone=(), camera=()"
    assert res.headers.get("x-request-id")

    custom_id = "req-trace-day7-001"
    traced = client.get("/api/v1/health", headers={"X-Request-Id": custom_id})
    assert traced.headers.get("x-request-id") == custom_id


def test_mvp_end_to_end_journey(client, db):
    # 1. Owner registers a new restaurant workspace
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Elena Rostova",
            "email": "elena@olive-garden.fr",
            "password": "StrongPassword!2026",
            "restaurant_name": "L'Olivier Doré",
        },
    )
    assert reg.status_code == 201
    membership = reg.json()["memberships"][0]
    restaurant_id = membership["restaurant_id"]
    slug = membership["restaurant_slug"]
    headers = {"X-Restaurant-Id": restaurant_id}

    # 2. Owner configures localization and publishes the public website
    pub = client.patch(
        "/api/v1/restaurants/me",
        json={"country": "FR", "currency": "EUR", "timezone": "Europe/Paris", "status": "active"},
        headers=headers,
    )
    assert pub.status_code == 200
    assert pub.json()["status"] == "active"

    # 3. Owner creates a menu category and a published dish with a required modifier group
    cat = client.post(
        "/api/v1/menu/categories",
        json={"name": "Signatures", "position": 0},
        headers=headers,
    )
    assert cat.status_code == 201
    cat_id = cat.json()["id"]

    dish = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": cat_id,
            "name": "Sea Bass Fillet",
            "description": "Wild sea bass with fennel confit",
            "price_minor": 2600,
            "discounted_price_minor": 2300,
            "tax_rate": "10",
            "prep_time_minutes": 18,
            "kitchen_station": "Hot Kitchen / Grill",
            "dietary_tags": "Gluten-Free,Halal",
            "is_featured": True,
            "is_published": True,
            "is_available": True,
            "modifier_groups": [
                {
                    "name": "Garnish",
                    "required": True,
                    "multi_select": False,
                    "modifiers": [
                        {"name": "Saffron rice", "price_delta_minor": 0, "is_default": True},
                        {"name": "Grilled asparagus", "price_delta_minor": 300, "is_default": False},
                    ],
                }
            ],
        },
        headers=headers,
    )
    assert dish.status_code == 201
    dish_body = dish.json()
    dish_id = dish_body["id"]
    asparagus_id = dish_body["modifier_groups"][0]["modifiers"][1]["id"]

    # 4. Customer browses public menu and submits an idempotent online order
    pub_menu = client.get(f"/api/v1/public/restaurants/{slug}/menu")
    assert pub_menu.status_code == 200
    assert len(pub_menu.json()) == 1
    assert pub_menu.json()[0]["items"][0]["name"] == "Sea Bass Fillet"

    order_payload = {
        "idempotency_key": "e2e-checkout-key-001",
        "customer_name": "Lucas Moreau",
        "customer_email": "lucas.moreau@example.fr",
        "customer_phone": "+33611223344",
        "service_mode": "delivery",
        "delivery_address": "10 Rue de Rivoli, Paris",
        "payment_method": "card",
        "lines": [{"menu_item_id": dish_id, "quantity": 2, "modifier_ids": [asparagus_id]}],
    }
    order_res = client.post(f"/api/v1/public/orders?slug={slug}", json=order_payload)
    order_retry = client.post(f"/api/v1/public/orders?slug={slug}", json=order_payload)
    assert order_res.status_code == 201
    assert order_retry.status_code == 201
    assert order_res.json()["id"] == order_retry.json()["id"]

    order_id = order_res.json()["id"]
    # Effective unit price = 2300 (discounted) + 300 (asparagus) = 2600; x2 = 5200 + 400 delivery = 5600
    assert order_res.json()["subtotal_minor"] == 5200
    assert order_res.json()["delivery_fee_minor"] == 400
    assert order_res.json()["total_minor"] == 5600

    # 5. Kitchen & staff process the order through its lifecycle
    for next_status in ("confirmed", "in_preparation", "ready", "served"):
        step = client.patch(
            f"/api/v1/orders/{order_id}/status",
            json={"status": next_status},
            headers=headers,
        )
        assert step.status_code == 200
        assert step.json()["status"] == next_status

    # 6. Customer tracks the completed order publicly
    tracking = client.get(f"/api/v1/public/orders/{order_id}?slug={slug}")
    assert tracking.status_code == 200
    assert tracking.json()["status"] == "served"

    # 7. Customer books a table reservation
    tz = ZoneInfo("Europe/Paris")
    day = datetime.now(tz).date() + timedelta(days=1)
    while day.weekday() == 0:
        day += timedelta(days=1)
    slot_iso = datetime.combine(day, time(19, 30), tz).isoformat()
    booking = client.post(
        f"/api/v1/public/reservations?slug={slug}",
        json={
            "idempotency_key": "e2e-booking-001",
            "customer_name": "Lucas Moreau",
            "customer_email": "lucas.moreau@example.fr",
            "guests": 2,
            "reserved_at": slot_iso,
        },
    )
    assert booking.status_code == 201

    # 8. Owner checks sales report and CRM customer segmentation (Lucas has 1 order + 1 booking => repeat)
    report = client.get("/api/v1/reports/sales?period=7d", headers=headers)
    assert report.status_code == 200
    assert report.json()["orders_count"] == 1
    assert report.json()["gross_sales_minor"] == 5600

    crm = client.get("/api/v1/customers", headers=headers)
    assert crm.status_code == 200
    assert crm.json()["total_customers"] == 1
    assert crm.json()["repeat_customers"] == 1


def test_uat_price_snapshot_immutable_after_menu_price_change(client, db):
    r = make_restaurant(db, "snapshot-bistro", "Snapshot Bistro", status="active")
    owner = make_user(db, "owner@snapshot.com")
    add_member(db, r, owner, "owner")
    login(client, "owner@snapshot.com")
    headers = {"X-Restaurant-Id": str(r.id)}

    cat_id = client.post("/api/v1/menu/categories", json={"name": "Mains"}, headers=headers).json()["id"]
    item_id = client.post(
        "/api/v1/menu/items",
        json={"category_id": cat_id, "name": "Steak Frites", "price_minor": 2000, "is_published": True},
        headers=headers,
    ).json()["id"]

    order = client.post(
        "/api/v1/public/orders?slug=snapshot-bistro",
        json={
            "customer_name": "Claire",
            "service_mode": "pickup",
            "payment_method": "card",
            "lines": [{"menu_item_id": item_id, "quantity": 1}],
        },
    ).json()
    assert order["total_minor"] == 2000

    # Restaurant increases menu price from 2000 to 2900
    updated_item = client.patch(
        f"/api/v1/menu/items/{item_id}",
        json={"price_minor": 2900},
        headers=headers,
    )
    assert updated_item.status_code == 200

    # Historical order keeps the purchased 2000 snapshot
    persisted = client.get(f"/api/v1/orders/{order['id']}", headers=headers).json()
    assert persisted["total_minor"] == 2000
    assert persisted["lines"][0]["unit_price_minor"] == 2000


def test_uat_cross_tenant_isolation_across_all_modules(client, db):
    tenant_a = make_restaurant(db, "tenant-a", "Tenant A", status="active")
    tenant_b = make_restaurant(db, "tenant-b", "Tenant B", status="active")
    owner_a = make_user(db, "a@example.com")
    owner_b = make_user(db, "b@example.com")
    add_member(db, tenant_a, owner_a, "owner")
    add_member(db, tenant_b, owner_b, "owner")

    login(client, "a@example.com")
    foreign_headers = {"X-Restaurant-Id": str(tenant_b.id)}

    for endpoint in (
        "/api/v1/restaurants/me",
        "/api/v1/menu/categories",
        "/api/v1/menu/items",
        "/api/v1/orders",
        "/api/v1/reservations",
        "/api/v1/notifications",
        "/api/v1/reports/sales",
        "/api/v1/customers",
    ):
        res = client.get(endpoint, headers=foreign_headers)
        assert res.status_code == 404, f"Expected 404 on cross-tenant {endpoint}, got {res.status_code}"
