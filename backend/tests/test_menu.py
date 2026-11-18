import base64
import uuid
from sqlalchemy import select
from app.models import AuditLog, MenuCategory, MenuItem
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


def _make_category(client, restaurant_id, name="Starters"):
    return client.post(
        "/api/v1/menu/categories",
        json={"name": name, "position": 0},
        headers={"X-Restaurant-Id": str(restaurant_id)},
    )


def _make_item(client, restaurant_id, category_id, name="Salad", price=1200):
    return client.post(
        "/api/v1/menu/items",
        json={"category_id": str(category_id), "name": name, "price_minor": price},
        headers={"X-Restaurant-Id": str(restaurant_id)},
    )


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

def test_owner_can_create_category(client, db):
    r = _setup(db, client)
    res = _make_category(client, r.id)
    assert res.status_code == 201
    assert res.json()["name"] == "Starters"


def test_category_is_scoped_to_restaurant(client, db):
    r = _setup(db, client)
    _make_category(client, r.id)
    cats = db.scalars(select(MenuCategory).where(MenuCategory.restaurant_id == r.id)).all()
    assert len(cats) == 1


def test_waiter_cannot_create_category(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "w@example.com")
    add_member(db, r, u, "waiter")
    login(client, "w@example.com")
    res = _make_category(client, r.id)
    assert res.status_code == 403


def test_cross_tenant_category_hidden(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    res = client.post(
        "/api/v1/menu/categories",
        json={"name": "Stolen", "position": 0},
        headers={"X-Restaurant-Id": str(other.id)},
    )
    assert res.status_code == 404


def test_owner_can_delete_category(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    res = client.delete(f"/api/v1/menu/categories/{cat_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 204


# ---------------------------------------------------------------------------
# Items
# ---------------------------------------------------------------------------

def test_owner_can_create_item(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    res = _make_item(client, r.id, cat_id)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Salad"
    assert body["price_minor"] == 1200
    assert body["is_published"] is False


def test_item_category_must_belong_to_restaurant(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    other_cat = MenuCategory(restaurant_id=other.id, name="Other Cat")
    db.add(other_cat)
    db.commit()
    res = _make_item(client, r.id, other_cat.id)
    assert res.status_code == 404


def test_owner_can_update_item(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    item_id = _make_item(client, r.id, cat_id).json()["id"]
    res = client.patch(
        f"/api/v1/menu/items/{item_id}",
        json={"name": "Updated Salad", "price_minor": 1500, "is_published": True},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Salad"
    assert res.json()["is_published"] is True


def test_owner_can_toggle_availability(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    item_id = _make_item(client, r.id, cat_id).json()["id"]
    res = client.patch(
        f"/api/v1/menu/items/{item_id}/availability",
        json={"is_available": False},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200
    assert res.json()["is_available"] is False


def test_kitchen_can_toggle_availability(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "chef@example.com")
    add_member(db, r, u, "kitchen")
    login(client, "chef@example.com")
    cat = MenuCategory(restaurant_id=r.id, name="Mains")
    db.add(cat)
    db.flush()
    item = MenuItem(restaurant_id=r.id, category_id=cat.id, name="Steak", price_minor=2800)
    db.add(item)
    db.commit()
    res = client.patch(
        f"/api/v1/menu/items/{item.id}/availability",
        json={"is_available": False},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200


def test_cross_tenant_item_hidden(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    other_cat = MenuCategory(restaurant_id=other.id, name="Cat")
    db.add(other_cat)
    db.flush()
    other_item = MenuItem(restaurant_id=other.id, category_id=other_cat.id, name="Stolen", price_minor=100)
    db.add(other_item)
    db.commit()
    res = client.get(f"/api/v1/menu/items/{other_item.id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 404


def test_owner_can_delete_item(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    item_id = _make_item(client, r.id, cat_id).json()["id"]
    res = client.delete(f"/api/v1/menu/items/{item_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 204


# ---------------------------------------------------------------------------
# Public menu
# ---------------------------------------------------------------------------

def test_public_menu_returns_only_published_items(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "owner@example.com")
    add_member(db, r, u, "owner")
    login(client, "owner@example.com")
    cat_id = _make_category(client, r.id).json()["id"]
    # published item
    client.patch(
        f"/api/v1/menu/items/{_make_item(client, r.id, cat_id, 'Visible').json()['id']}",
        json={"is_published": True},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    # draft item
    _make_item(client, r.id, cat_id, "Hidden")

    res = client.get("/api/v1/public/restaurants/bistro/menu")
    assert res.status_code == 200
    names = [i["name"] for cat in res.json() for i in cat["items"]]
    assert "Visible" in names
    assert "Hidden" not in names


def test_update_item_category_must_belong_to_restaurant(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    item_id = _make_item(client, r.id, cat_id).json()["id"]
    other = make_restaurant(db, "other2", status="active")
    other_cat = MenuCategory(restaurant_id=other.id, name="Other Cat")
    db.add(other_cat)
    db.commit()
    res = client.patch(
        f"/api/v1/menu/items/{item_id}",
        json={"category_id": str(other_cat.id)},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 404


def test_owner_can_update_category(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id).json()["id"]
    res = client.patch(
        f"/api/v1/menu/categories/{cat_id}",
        json={"name": "Updated Name"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Name"


def test_public_menu_excludes_unavailable_items(client, db):
    r = make_restaurant(db, "bistro2", status="active")
    u = make_user(db, "owner2@example.com")
    add_member(db, r, u, "owner")
    login(client, "owner2@example.com")
    cat_id = _make_category(client, r.id, "Mains").json()["id"]
    item_id = _make_item(client, r.id, cat_id, "Steak").json()["id"]
    # publish but mark unavailable
    client.patch(f"/api/v1/menu/items/{item_id}", json={"is_published": True}, headers={"X-Restaurant-Id": str(r.id)})
    client.patch(f"/api/v1/menu/items/{item_id}/availability", json={"is_available": False}, headers={"X-Restaurant-Id": str(r.id)})
    res = client.get("/api/v1/public/restaurants/bistro2/menu")
    names = [i["name"] for cat in res.json() for i in cat["items"]]
    assert "Steak" not in names


def test_public_menu_cross_tenant_item_not_leaked(client, db):
    r1 = make_restaurant(db, "resto-a", status="active")
    r2 = make_restaurant(db, "resto-b", status="active")
    u = make_user(db, "ownerA@example.com")
    add_member(db, r1, u, "owner")
    login(client, "ownerA@example.com")
    # create category in r1, then manually assign item to r2's category
    cat1_id = _make_category(client, r1.id, "Cat A").json()["id"]
    cat2 = MenuCategory(restaurant_id=r2.id, name="Cat B")
    db.add(cat2)
    db.flush()
    # item belongs to r2 but category_id points to cat2
    leaked = MenuItem(restaurant_id=r2.id, category_id=cat2.id, name="Leaked", price_minor=500, is_published=True, is_available=True)
    db.add(leaked)
    db.commit()
    res = client.get("/api/v1/public/restaurants/resto-a/menu")
    names = [i["name"] for cat in res.json() for i in cat["items"]]
    assert "Leaked" not in names


def test_public_restaurant_404_for_unknown_slug(client, db):
    assert client.get("/api/v1/public/restaurants/does-not-exist").status_code == 404


def test_public_restaurant_404_for_suspended(client, db):
    make_restaurant(db, "suspended-place", status="suspended")
    assert client.get("/api/v1/public/restaurants/suspended-place").status_code == 404


def test_create_and_update_item_with_modifier_groups(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id, "Mains").json()["id"]
    res = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": str(cat_id),
            "name": "Burger",
            "price_minor": 1600,
            "is_published": True,
            "modifier_groups": [
                {
                    "name": "Cooking",
                    "required": True,
                    "multi_select": False,
                    "modifiers": [
                        {"name": "Medium", "price_delta_minor": 0, "is_default": True},
                        {"name": "Well done", "price_delta_minor": 0, "is_default": False},
                    ],
                }
            ],
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["is_published"] is True
    assert len(body["modifier_groups"]) == 1
    assert body["modifier_groups"][0]["name"] == "Cooking"
    assert len(body["modifier_groups"][0]["modifiers"]) == 2

    update_res = client.patch(
        f"/api/v1/menu/items/{body['id']}",
        json={
            "modifier_groups": [
                {
                    "name": "Extras",
                    "required": False,
                    "multi_select": True,
                    "modifiers": [{"name": "Cheese", "price_delta_minor": 200}],
                }
            ]
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert len(updated["modifier_groups"]) == 1
    assert updated["modifier_groups"][0]["name"] == "Extras"


def test_upload_and_serve_valid_png_image(client, db):
    r = _setup(db, client)
    tiny_png = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    res = client.post(
        "/api/v1/menu/images",
        json={
            "filename": "dish.png",
            "content_type": "image/png",
            "data_base64": base64.b64encode(tiny_png).decode("ascii"),
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 201
    image_url = res.json()["image_url"]
    assert image_url.startswith(f"/api/v1/public/uploads/{r.id}/")

    serve_res = client.get(image_url)
    assert serve_res.status_code == 200
    assert serve_res.headers["content-type"] == "image/png"
    assert serve_res.headers["x-content-type-options"] == "nosniff"
    assert serve_res.content == tiny_png


def test_upload_rejects_invalid_image_signature(client, db):
    r = _setup(db, client)
    res = client.post(
        "/api/v1/menu/images",
        json={
            "filename": "fake.png",
            "content_type": "image/png",
            "data_base64": base64.b64encode(b"not-a-png-file").decode("ascii"),
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 422


def test_item_metadata_discounted_price_and_price_change_audit(client, db):
    r = _setup(db, client)
    cat_id = _make_category(client, r.id, "Specials").json()["id"]
    bad = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": str(cat_id),
            "name": "Ribeye",
            "price_minor": 3000,
            "discounted_price_minor": 3000,
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert bad.status_code == 422

    created = client.post(
        "/api/v1/menu/items",
        json={
            "category_id": str(cat_id),
            "name": "Ribeye",
            "price_minor": 3000,
            "discounted_price_minor": 2500,
            "kitchen_station": "Hot Kitchen / Grill",
            "dietary_tags": "Gluten-Free,Halal",
            "is_featured": True,
            "image_url": "/images/dish-salmon-native.png",
        },
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert created.json()["discounted_price_minor"] == 2500
    assert created.json()["kitchen_station"] == "Hot Kitchen / Grill"
    assert created.json()["dietary_tags"] == "Gluten-Free,Halal"
    assert created.json()["is_featured"] is True

    updated = client.patch(
        f"/api/v1/menu/items/{item_id}",
        json={"price_minor": 3200, "discounted_price_minor": 2700},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert updated.status_code == 200
    log = db.scalar(
        select(AuditLog)
        .where(AuditLog.action == "menu.item.update", AuditLog.entity_id == item_id)
        .order_by(AuditLog.created_at.desc())
    )
    assert log is not None and log.data is not None
    assert log.data["old_price_minor"] == 3000
    assert log.data["new_price_minor"] == 3200
    assert log.data["old_discounted_price_minor"] == 2500
    assert log.data["new_discounted_price_minor"] == 2700
