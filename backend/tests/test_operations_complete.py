from sqlalchemy import select

from app.core.config import settings
from app.models import AuditLog, MenuCategory, MenuItem
from tests.helpers import PASSWORD, add_member, login, make_restaurant, make_user


def _setup(db, client, role="owner"):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    u = make_user(db, "owner@example.com")
    add_member(db, r, u, role)
    login(client, "owner@example.com")
    return r, u


def test_session_refresh_rotates_token_and_revokes_previous(client, db):
    make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    old_token = client.cookies.get(settings.session_cookie_name)

    res = client.post("/api/v1/auth/refresh")
    assert res.status_code == 200
    new_token = client.cookies.get(settings.session_cookie_name)
    assert new_token and new_token != old_token
    assert client.get("/api/v1/auth/me").status_code == 200

    # Replaying old session cookie is rejected
    client.cookies.set(settings.session_cookie_name, old_token)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_password_forgot_and_reset_revokes_active_sessions(client, db):
    make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    old_cookie = client.cookies.get(settings.session_cookie_name)

    forgot = client.post("/api/v1/auth/password/forgot", json={"email": "owner@example.com"})
    assert forgot.status_code == 200
    reset_token = forgot.json()["reset_token"]
    assert reset_token

    # Unknown email returns same 200 ok status without leaking existence
    unknown = client.post("/api/v1/auth/password/forgot", json={"email": "unknown@example.com"})
    assert unknown.status_code == 200

    reset = client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "new_password": "BrandNewPassword!123"},
    )
    assert reset.status_code == 200

    # Existing session was revoked on password change
    client.cookies.set(settings.session_cookie_name, old_cookie)
    assert client.get("/api/v1/auth/me").status_code == 401

    # Can log in with new password
    assert login(client, "owner@example.com", "BrandNewPassword!123").status_code == 200


def test_branches_list_and_create(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}
    created = client.post(
        "/api/v1/branches",
        json={"name": "Left Bank Branch", "address": "12 Boulevard Saint-Germain", "is_default": True},
        headers=headers,
    )
    assert created.status_code == 201
    assert created.json()["name"] == "Left Bank Branch"
    assert created.json()["is_default"] is True

    listed = client.get("/api/v1/branches", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1


def test_coupons_cart_validate_and_checkout_discount(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}

    cat = MenuCategory(restaurant_id=r.id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(
        restaurant_id=r.id,
        category_id=cat.id,
        name="Pasta",
        price_minor=2000,
        is_published=True,
        is_available=True,
    )
    db.add(item)
    db.commit()

    coupon = client.post(
        "/api/v1/coupons",
        json={
            "code": "welcome20",
            "discount_type": "percentage",
            "discount_value": 20,
            "min_order_minor": 1500,
            "max_uses": 1,
        },
        headers=headers,
    )
    assert coupon.status_code == 201
    assert coupon.json()["code"] == "WELCOME20"

    quote = client.post(
        "/api/v1/cart/validate?slug=bistro",
        json={
            "service_mode": "delivery",
            "coupon_code": "welcome20",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert quote.status_code == 200
    q_body = quote.json()
    assert q_body["subtotal_minor"] == 2000
    assert q_body["discount_minor"] == 400
    assert q_body["delivery_fee_minor"] == 400
    assert q_body["total_minor"] == 2000

    order = client.post(
        "/api/v1/public/orders?slug=bistro",
        json={
            "customer_name": "Emma",
            "service_mode": "delivery",
            "payment_method": "card",
            "coupon_code": "WELCOME20",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert order.status_code == 201
    assert order.json()["discount_minor"] == 400
    assert order.json()["total_minor"] == 2000
    assert order.json()["coupon_code"] == "WELCOME20"

    # Max uses = 1 reached -> second use rejected with 422
    exhausted = client.post(
        "/api/v1/cart/validate?slug=bistro",
        json={
            "service_mode": "pickup",
            "coupon_code": "WELCOME20",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert exhausted.status_code == 422


def test_order_cancellation_endpoint_with_reason(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}
    cat = MenuCategory(restaurant_id=r.id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(restaurant_id=r.id, category_id=cat.id, name="Burger", price_minor=1500, is_published=True, is_available=True)
    db.add(item)
    db.commit()

    order = client.post(
        "/api/v1/public/orders?slug=bistro",
        json={
            "customer_name": "Paul",
            "service_mode": "pickup",
            "payment_method": "cash",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    ).json()

    cancelled = client.post(
        f"/api/v1/orders/{order['id']}/cancel",
        json={"reason": "Customer requested change of time"},
        headers=headers,
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["cancellation_reason"] == "Customer requested change of time"


def test_payments_checkout_webhook_deduplication_and_refund(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}
    cat = MenuCategory(restaurant_id=r.id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(restaurant_id=r.id, category_id=cat.id, name="Risotto", price_minor=2200, is_published=True, is_available=True)
    db.add(item)
    db.commit()

    order = client.post(
        "/api/v1/public/orders?slug=bistro",
        json={
            "customer_name": "Nadia",
            "service_mode": "pickup",
            "payment_method": "card",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    ).json()

    # 1. Create idempotent payment intent
    pay1 = client.post(
        "/api/v1/payments/checkout",
        json={"order_id": order["id"], "provider": "stripe", "idempotency_key": "pay-idem-1"},
    )
    pay2 = client.post(
        "/api/v1/payments/checkout",
        json={"order_id": order["id"], "provider": "stripe", "idempotency_key": "pay-idem-1"},
    )
    assert pay1.status_code == 201
    assert pay1.json()["id"] == pay2.json()["id"]
    payment_id = pay1.json()["id"]
    provider_ref = pay1.json()["provider_reference"]

    # 2. Webhook delivered twice -> second is deduplicated (Section 20.3)
    wh_payload = {
        "event_id": "evt_stripe_0001",
        "provider_reference": provider_ref,
        "event_type": "payment.succeeded",
    }
    wh1 = client.post(
        "/api/v1/payments/webhooks/stripe",
        json=wh_payload,
        headers={"X-Webhook-Signature": "sig_verified_2026"},
    )
    wh2 = client.post(
        "/api/v1/payments/webhooks/stripe",
        json=wh_payload,
        headers={"X-Webhook-Signature": "sig_verified_2026"},
    )
    assert wh1.status_code == 200 and wh1.json()["deduplicated"] is False
    assert wh2.status_code == 200 and wh2.json()["deduplicated"] is True
    assert wh1.json()["payment_status"] == "paid"

    # Order payment_status is now 'paid'
    updated_order = client.get(f"/api/v1/orders/{order['id']}", headers=headers).json()
    assert updated_order["payment_status"] == "paid"

    # 3. Authorized refund
    refund = client.post(
        f"/api/v1/payments/{payment_id}/refund",
        json={"amount_minor": 2200, "reason": "Item unavailable after payment"},
        headers=headers,
    )
    assert refund.status_code == 201
    assert refund.json()["amount_minor"] == 2200

    refunded_order = client.get(f"/api/v1/orders/{order['id']}", headers=headers).json()
    assert refunded_order["payment_status"] == "refunded"


def test_inventory_items_movements_and_low_stock_alert(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}

    ing = client.post(
        "/api/v1/inventory/items",
        json={
            "name": "Fresh Atlantic Salmon",
            "category": "Fish & Seafood",
            "unit": "kg",
            "quantity_minor": 600,
            "threshold_minor": 300,
        },
        headers=headers,
    )
    assert ing.status_code == 201
    assert ing.json()["stock_status"] == "in_stock"
    ing_id = ing.json()["id"]

    # Consume 4.00 kg -> remaining 2.00 kg <= 3.00 kg threshold -> triggers low_stock notification
    mov = client.post(
        "/api/v1/inventory/movements",
        json={"ingredient_id": ing_id, "delta_minor": -400, "reason": "Evening dinner service"},
        headers=headers,
    )
    assert mov.status_code == 201

    items = client.get("/api/v1/inventory/items", headers=headers).json()
    assert items[0]["quantity_minor"] == 200
    assert items[0]["stock_status"] == "low_stock"

    notifs = client.get("/api/v1/notifications", headers=headers).json()
    assert any(n["event_type"] == "inventory.threshold_reached" for n in notifs)


def test_reviews_submission_moderation_and_public_listing(client, db):
    r, _ = _setup(db, client)
    headers = {"X-Restaurant-Id": str(r.id)}

    submitted = client.post(
        "/api/v1/public/restaurants/bistro/reviews",
        json={"customer_name": "Hugo", "rating": 5, "comment": "Exceptional salmon and warm service!"},
    )
    assert submitted.status_code == 201
    review_id = submitted.json()["id"]
    assert submitted.json()["status"] == "pending"

    # Pending reviews are not shown publicly yet
    pub_before = client.get("/api/v1/public/restaurants/bistro/reviews").json()
    assert pub_before["total_reviews"] == 0

    # Owner approves review and adds response
    moderated = client.patch(
        f"/api/v1/reviews/{review_id}",
        json={"status": "approved", "owner_response": "Thank you for dining with us, Hugo!"},
        headers=headers,
    )
    assert moderated.status_code == 200

    pub_after = client.get("/api/v1/public/restaurants/bistro/reviews").json()
    assert pub_after["total_reviews"] == 1
    assert pub_after["average_rating"] == 5.0
    assert pub_after["reviews"][0]["owner_response"] == "Thank you for dining with us, Hugo!"
