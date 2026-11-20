import json
import time

from app.core.config import settings
from app.core.security import sign_webhook_payload, verify_webhook_signature
from app.models import MenuCategory, MenuItem
from tests.helpers import add_member, make_restaurant, make_user


def test_webhook_hmac_verification_rejects_forged_and_replayed_timestamps():
    secret = "unit_test_secret_value"
    raw = b'{"event_id":"e1","provider_reference":"ref1","event_type":"payment.succeeded"}'
    now = 1_700_000_000
    valid_sig = sign_webhook_payload(secret, str(now), raw)

    assert verify_webhook_signature(secret, valid_sig, str(now), raw, tolerance_seconds=300, now_ts=now) is True
    assert verify_webhook_signature(secret, valid_sig, str(now), raw + b" ", tolerance_seconds=300, now_ts=now) is False
    assert verify_webhook_signature(secret, "sha256=" + "0" * 64, str(now), raw, tolerance_seconds=300, now_ts=now) is False
    assert verify_webhook_signature(secret, valid_sig, str(now - 600), raw, tolerance_seconds=300, now_ts=now) is False
    assert verify_webhook_signature(secret, valid_sig, None, raw, tolerance_seconds=300, now_ts=now) is False


def test_payment_checkout_enforces_tenant_ownership_and_order_state(client, db):
    r1 = make_restaurant(db, "bistro-a", "Bistro A", status="active")
    make_restaurant(db, "bistro-b", "Bistro B", status="active")
    u = make_user(db, "owner-a@test.com")
    add_member(db, r1, u, "owner")

    cat = MenuCategory(restaurant_id=r1.id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(restaurant_id=r1.id, category_id=cat.id, name="Burger", price_minor=1500, is_published=True, is_available=True)
    db.add(item)
    db.commit()

    order = client.post(
        "/api/v1/public/orders?slug=bistro-a",
        json={
            "customer_name": "Sam",
            "service_mode": "pickup",
            "payment_method": "card",
            "lines": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
    ).json()

    cross = client.post(
        "/api/v1/payments/checkout",
        json={"order_id": order["id"], "slug": "bistro-b", "provider": "stripe"},
    )
    assert cross.status_code == 404

    client.post(
        f"/api/v1/public/orders/{order['id']}/cancel?slug=bistro-a",
        json={"reason": "Changed mind"},
    )
    cancelled_pay = client.post(
        "/api/v1/payments/checkout",
        json={"order_id": order["id"], "slug": "bistro-a", "provider": "stripe"},
    )
    assert cancelled_pay.status_code == 409


def test_webhook_endpoint_rejects_invalid_signature_and_stale_timestamp(client, db):
    payload = json.dumps({
        "event_id": "evt_forged_1",
        "provider_reference": "pay_stripe_missing",
        "event_type": "payment.succeeded",
    }).encode("utf-8")

    forged = client.post(
        "/api/v1/payments/webhooks/stripe",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Timestamp": str(int(time.time())),
            "X-Webhook-Signature": "sig_not_valid_hmac",
        },
    )
    assert forged.status_code == 401

    stale_ts = str(int(time.time()) - 900)
    stale_sig = sign_webhook_payload(settings.payment_webhook_secret, stale_ts, payload)
    stale = client.post(
        "/api/v1/payments/webhooks/stripe",
        content=payload,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Timestamp": stale_ts,
            "X-Webhook-Signature": stale_sig,
        },
    )
    assert stale.status_code == 401


def test_public_rate_limit_and_api_csp_header(client, db):
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.headers.get("Content-Security-Policy") == "default-src 'none'; frame-ancestors 'none'"

    for _ in range(settings.auth_rate_limit_max_requests):
        res = client.post("/api/v1/auth/password/forgot", json={"email": "nobody@example.com"})
        assert res.status_code == 200

    blocked = client.post("/api/v1/auth/password/forgot", json={"email": "nobody@example.com"})
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
