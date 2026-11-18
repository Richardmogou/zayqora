from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.models import AuditLog, MenuCategory, MenuItem, Order, OrderLine, Reservation
from tests.helpers import add_member, login, make_restaurant, make_user


def _seed_tenant_activity(db, restaurant):
    cat = MenuCategory(restaurant_id=restaurant.id, name="Mains", position=0, is_active=True)
    db.add(cat)
    db.flush()
    item = MenuItem(
        restaurant_id=restaurant.id,
        category_id=cat.id,
        name="Grilled Salmon",
        price_minor=2400,
        is_published=True,
        is_available=True,
    )
    db.add(item)
    db.flush()

    o1 = Order(
        restaurant_id=restaurant.id,
        customer_name="Alice Martin",
        customer_email="alice@example.com",
        customer_phone="+33600000001",
        service_mode="delivery",
        payment_method="card",
        subtotal_minor=4800,
        delivery_fee_minor=400,
        total_minor=5200,
        status="served",
    )
    o2 = Order(
        restaurant_id=restaurant.id,
        customer_name="Bob Dupont",
        customer_email="bob@example.com",
        service_mode="pickup",
        payment_method="cash",
        subtotal_minor=2400,
        delivery_fee_minor=0,
        total_minor=2400,
        status="cancelled",
    )
    db.add_all([o1, o2])
    db.flush()
    db.add_all([
        OrderLine(
            order_id=o1.id,
            menu_item_id=item.id,
            name="Grilled Salmon",
            unit_price_minor=2400,
            quantity=2,
            line_total_minor=4800,
        ),
        OrderLine(
            order_id=o2.id,
            menu_item_id=item.id,
            name="Grilled Salmon",
            unit_price_minor=2400,
            quantity=1,
            line_total_minor=2400,
        ),
    ])

    res = Reservation(
        restaurant_id=restaurant.id,
        customer_name="Alice Martin",
        customer_email="alice@example.com",
        guests=4,
        reserved_at=datetime.now(timezone.utc) + timedelta(hours=2),
        status="confirmed",
    )
    db.add(res)
    db.commit()


def test_sales_report_calculates_kpis_and_excludes_cancelled(client, db):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    owner = make_user(db, "owner@example.com")
    add_member(db, r, owner, "owner")
    _seed_tenant_activity(db, r)

    login(client, "owner@example.com")
    res = client.get("/api/v1/reports/sales?period=7d", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    body = res.json()
    assert body["orders_count"] == 1
    assert body["cancelled_orders_count"] == 1
    assert body["gross_sales_minor"] == 5200
    assert body["delivery_fees_minor"] == 400
    assert body["estimated_tax_minor"] == 480
    assert body["net_sales_minor"] == 4320
    assert body["cancelled_minor"] == 2400
    assert body["average_order_value_minor"] == 5200
    assert body["covers_served"] == 4
    assert len(body["top_items"]) == 1
    assert body["top_items"][0]["name"] == "Grilled Salmon"
    assert body["top_items"][0]["quantity"] == 2


def test_sales_csv_export_writes_audit_log_and_blocks_waiter(client, db):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    owner = make_user(db, "owner@example.com")
    waiter = make_user(db, "waiter@example.com")
    add_member(db, r, owner, "owner")
    add_member(db, r, waiter, "waiter")
    _seed_tenant_activity(db, r)

    login(client, "waiter@example.com")
    blocked = client.get("/api/v1/reports/sales/export?period=7d", headers={"X-Restaurant-Id": str(r.id)})
    assert blocked.status_code == 403

    login(client, "owner@example.com")
    exported = client.get("/api/v1/reports/sales/export?period=7d", headers={"X-Restaurant-Id": str(r.id)})
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")
    assert "ZAYQORA Sales Report" in exported.text

    log = db.scalar(select(AuditLog).where(AuditLog.action == "report.sales.export"))
    assert log is not None


def test_customers_crm_aggregates_and_segments(client, db):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    owner = make_user(db, "owner@example.com")
    add_member(db, r, owner, "owner")
    _seed_tenant_activity(db, r)

    login(client, "owner@example.com")
    res = client.get("/api/v1/customers", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    body = res.json()
    assert body["total_customers"] == 2
    assert body["repeat_customers"] == 1
    assert body["new_customers"] == 1
    assert body["total_revenue_minor"] == 5200

    repeat_only = client.get("/api/v1/customers?segment=repeat", headers={"X-Restaurant-Id": str(r.id)}).json()
    assert len(repeat_only["customers"]) == 1
    assert repeat_only["customers"][0]["customer_email"] == "alice@example.com"
    assert repeat_only["customers"][0]["orders_count"] == 1
    assert repeat_only["customers"][0]["reservations_count"] == 1


def test_platform_super_admin_controls_and_audit(client, db):
    r1 = make_restaurant(db, "alpha-bistro", "Alpha Bistro", status="active")
    r2 = make_restaurant(db, "beta-cafe", "Beta Cafe", status="pending")
    owner = make_user(db, "owner@example.com", is_platform_admin=False)
    admin = make_user(db, "platform@example.com", is_platform_admin=True)
    add_member(db, r1, owner, "owner")

    login(client, "owner@example.com")
    assert client.get("/api/v1/platform/overview").status_code == 403
    assert client.get("/api/v1/platform/tenants").status_code == 403

    login(client, "platform@example.com")
    overview = client.get("/api/v1/platform/overview")
    assert overview.status_code == 200
    assert overview.json()["total_tenants"] == 2
    assert overview.json()["active_tenants"] == 1
    assert overview.json()["pending_tenants"] == 1

    tenants = client.get("/api/v1/platform/tenants")
    assert tenants.status_code == 200
    assert len(tenants.json()) == 2

    suspend_res = client.patch(
        f"/api/v1/platform/tenants/{r1.id}/status",
        json={"status": "suspended", "plan": "enterprise", "reason": "Overdue invoice verification"},
    )
    assert suspend_res.status_code == 200
    assert suspend_res.json()["status"] == "suspended"
    assert suspend_res.json()["plan"] == "enterprise"

    log = db.scalar(
        select(AuditLog).where(
            AuditLog.action == "platform.tenant.status_update",
            AuditLog.entity_id == str(r1.id),
        )
    )
    assert log is not None and log.data["reason"] == "Overdue invoice verification"

    # Suspended tenant is blocked from public storefront and workspace
    assert client.get("/api/v1/public/restaurants/alpha-bistro").status_code == 404
    login(client, "owner@example.com")
    assert client.get("/api/v1/restaurants/me").status_code == 403
    assert client.get("/api/v1/restaurants/me", headers={"X-Restaurant-Id": str(r1.id)}).status_code == 404
