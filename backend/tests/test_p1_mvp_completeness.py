from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Coupon, MenuCategory, MenuItem, Notification
from app.services.email import clear_outbox, outbox
from tests.helpers import add_member, login, make_restaurant, make_user


def test_email_verification_flow_and_replay_rejection(client, db):
    clear_outbox()
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Claire Moreau",
            "email": "claire@bistro.example.com",
            "password": "StrongPassword!123",
            "restaurant_name": "Le Jardin",
            "country": "FR",
            "currency": "EUR",
            "timezone": "Europe/Paris",
        },
    )
    assert reg.status_code == 201
    assert reg.json()["user"]["email_verified_at"] is None
    assert any(m.to == "claire@bistro.example.com" and "Verify" in m.subject for m in outbox)

    resend = client.post("/api/v1/auth/email/resend")
    assert resend.status_code == 200
    token = resend.json()["verification_token"]
    assert token

    verify = client.post("/api/v1/auth/email/verify", json={"token": token})
    assert verify.status_code == 200
    assert verify.json()["verified"] is True

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["user"]["email_verified_at"] is not None

    replay = client.post("/api/v1/auth/email/verify", json={"token": token})
    assert replay.status_code == 400


def test_restaurant_profile_branding_delivery_fee_and_tax_propagation(client, db):
    clear_outbox()
    r = make_restaurant(db, "l-atelier", "L'Atelier", status="active")
    u = make_user(db, "owner@atelier.example.com")
    add_member(db, r, u, "owner")
    login(client, "owner@atelier.example.com")

    patch = client.patch(
        "/api/v1/restaurants/me",
        headers={"X-Restaurant-Id": str(r.id)},
        json={
            "tagline": "Seasonal French bistro",
            "description": "Crafted daily with local produce.",
            "cuisine": "French Bistro",
            "phone": "+33 1 42 00 00 00",
            "contact_email": "hello@atelier.example.com",
            "address": "15 Rue Oberkampf, Paris",
            "delivery_fee_minor": 650,
            "tax_rate_bps": 2000,
            "privacy_policy": "Custom privacy notice.",
            "refund_policy": "Custom refund rules.",
        },
    )
    assert patch.status_code == 200
    body = patch.json()
    assert body["tagline"] == "Seasonal French bistro"
    assert body["delivery_fee_minor"] == 650
    assert body["tax_rate_bps"] == 2000

    cat = MenuCategory(restaurant_id=r.id, name="Mains", position=1, is_active=True)
    db.add(cat)
    db.flush()
    item = MenuItem(
        restaurant_id=r.id,
        category_id=cat.id,
        name="Steak Frites",
        price_minor=2000,
        is_published=True,
        is_available=True,
    )
    db.add(item)
    db.commit()

    quote = client.post(
        "/api/v1/cart/validate?slug=l-atelier",
        json={"service_mode": "delivery", "lines": [{"menu_item_id": str(item.id), "quantity": 1}]},
    )
    assert quote.status_code == 200
    q = quote.json()
    assert q["delivery_fee_minor"] == 650
    assert q["tax_rate_bps"] == 2000
    assert q["estimated_tax_minor"] == 400
    assert q["total_minor"] == 2650

    order = client.post(
        "/api/v1/public/orders?slug=l-atelier",
        json={
            "customer_name": "Marc",
            "customer_email": "marc@guest.example.com",
            "service_mode": "delivery",
            "delivery_address": "10 Rue de Lyon",
            "payment_method": "card",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    )
    assert order.status_code == 201
    assert order.json()["delivery_fee_minor"] == 650
    assert order.json()["total_minor"] == 2650
    assert any(m.to == "marc@guest.example.com" and "Order #" in m.subject for m in outbox)

    report = client.get("/api/v1/reports/sales?period=today", headers={"X-Restaurant-Id": str(r.id)})
    assert report.status_code == 200
    assert report.json()["estimated_tax_minor"] == 400


def test_public_directory_offers_and_contact_form(client, db):
    clear_outbox()
    active_r = make_restaurant(db, "public-active", "Active Bistro", status="active")
    draft_r = make_restaurant(db, "public-draft", "Draft Bistro", status="pending")
    active_r.contact_email = "team@active-bistro.example.com"
    owner = make_user(db, "owner@active-bistro.example.com")
    add_member(db, active_r, owner, "owner")
    db.add(Coupon(restaurant_id=active_r.id, code="WELCOME15", discount_type="percentage", discount_value=15, is_active=True))
    db.add(
        Coupon(
            restaurant_id=active_r.id,
            code="EXPIRED",
            discount_type="percentage",
            discount_value=50,
            is_active=True,
            expires_at=datetime.now(timezone.utc) - timedelta(days=1),
        )
    )
    db.commit()

    directory = client.get("/api/v1/public/restaurants")
    assert directory.status_code == 200
    slugs = [row["slug"] for row in directory.json()]
    assert "public-active" in slugs
    assert draft_r.slug not in slugs

    offers = client.get("/api/v1/public/restaurants/public-active/offers")
    assert offers.status_code == 200
    codes = [o["code"] for o in offers.json()]
    assert codes == ["WELCOME15"]

    contact = client.post(
        "/api/v1/public/restaurants/public-active/contact",
        json={
            "name": "Nadia",
            "email": "nadia@guest.example.com",
            "message": "Do you accommodate gluten-free group menus?",
        },
    )
    assert contact.status_code == 201
    notif = db.scalar(select(Notification).where(Notification.restaurant_id == active_r.id, Notification.event_type == "contact.message"))
    assert notif is not None
    assert any(m.to == "team@active-bistro.example.com" and "New contact message" in m.subject for m in outbox)
