from datetime import datetime, time, timezone, timedelta
from zoneinfo import ZoneInfo
from tests.helpers import add_member, login, make_restaurant, make_user

FUTURE = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()


def _setup(db, client, role="owner"):
    r = make_restaurant(db, "bistro", "Bistro", status="active")
    u = make_user(db, "owner@example.com")
    add_member(db, r, u, role)
    login(client, "owner@example.com")
    return r


def _res_payload(**kwargs):
    return {"customer_name": "Alice", "guests": 2, "reserved_at": FUTURE, **kwargs}


def _create(client, restaurant_id, **kwargs):
    return client.post(
        "/api/v1/reservations",
        json=_res_payload(**kwargs),
        headers={"X-Restaurant-Id": str(restaurant_id)},
    )


def _next_open_day():
    local_day = datetime.now(ZoneInfo("Asia/Karachi")).date() + timedelta(days=1)
    while local_day.weekday() == 0:
        local_day += timedelta(days=1)
    return local_day


def _public_slot(local_day, hour=19):
    return datetime.combine(local_day, time(hour, 0), ZoneInfo("Asia/Karachi")).isoformat()


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def test_owner_can_create_reservation(client, db):
    r = _setup(db, client)
    res = _create(client, r.id)
    assert res.status_code == 201
    assert res.json()["status"] == "pending"
    assert res.json()["customer_name"] == "Alice"


def test_reservation_scoped_to_restaurant(client, db):
    r = _setup(db, client)
    _create(client, r.id)
    other = make_restaurant(db, "other", status="active")
    res = client.get("/api/v1/reservations", headers={"X-Restaurant-Id": str(other.id)})
    assert res.status_code == 404  # not a member


def test_cross_tenant_reservation_hidden(client, db):
    r = _setup(db, client)
    other = make_restaurant(db, "other", status="active")
    u2 = make_user(db, "other@example.com")
    add_member(db, other, u2, "owner")
    login(client, "other@example.com")
    res_id = _create(client, other.id).json()["id"]
    login(client, "owner@example.com")
    res = client.get(f"/api/v1/reservations/{res_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 404


def test_owner_can_update_reservation(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    res = client.patch(
        f"/api/v1/reservations/{res_id}",
        json=_res_payload(guests=4, table_label="Table 5"),
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200
    assert res.json()["guests"] == 4
    assert res.json()["table_label"] == "Table 5"


def test_owner_can_delete_reservation(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    res = client.delete(f"/api/v1/reservations/{res_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 204


def test_waiter_can_list_reservations(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "waiter@example.com")
    add_member(db, r, u, "waiter")
    login(client, "waiter@example.com")
    res = client.get("/api/v1/reservations", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200


def test_waiter_cannot_create_reservation(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "waiter@example.com")
    add_member(db, r, u, "waiter")
    login(client, "waiter@example.com")
    res = _create(client, r.id)
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Status transitions
# ---------------------------------------------------------------------------

def test_valid_transition_pending_to_confirmed(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    res = client.patch(
        f"/api/v1/reservations/{res_id}/status",
        json={"status": "confirmed"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "confirmed"


def test_invalid_transition_pending_to_completed(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    res = client.patch(
        f"/api/v1/reservations/{res_id}/status",
        json={"status": "completed"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 409


def test_terminal_status_cannot_change(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    client.patch(f"/api/v1/reservations/{res_id}/status", json={"status": "cancelled"}, headers={"X-Restaurant-Id": str(r.id)})
    res = client.patch(f"/api/v1/reservations/{res_id}/status", json={"status": "confirmed"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 409


def test_invalid_status_name_rejected(client, db):
    r = _setup(db, client)
    res_id = _create(client, r.id).json()["id"]
    res = client.patch(
        f"/api/v1/reservations/{res_id}/status",
        json={"status": "flying"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 422


def test_public_availability_lists_open_slots(client, db):
    r = make_restaurant(db, "bistro", status="active")
    day = _next_open_day()
    res = client.get(f"/api/v1/public/reservations/availability?slug={r.slug}&date={day.isoformat()}&guests=2")
    assert res.status_code == 200
    assert res.json()["slots"]
    assert res.json()["timezone"] == "Asia/Karachi"


def test_owner_can_update_reservation_settings(client, db):
    r = _setup(db, client)
    current = client.get("/api/v1/reservations/settings", headers={"X-Restaurant-Id": str(r.id)})
    assert current.status_code == 200
    body = current.json()
    body["capacity"] = 24
    updated = client.put("/api/v1/reservations/settings", json=body, headers={"X-Restaurant-Id": str(r.id)})
    assert updated.status_code == 200
    assert updated.json()["capacity"] == 24


def test_public_booking_rechecks_capacity_and_is_idempotent(client, db):
    r = make_restaurant(db, "bistro", status="active")
    r.reservation_capacity = 4
    db.commit()
    day = _next_open_day()
    body = {"customer_name": "Alice", "guests": 4, "reserved_at": _public_slot(day), "idempotency_key": "booking-retry-1"}
    first = client.post(f"/api/v1/public/reservations?slug={r.slug}", json=body)
    retry = client.post(f"/api/v1/public/reservations?slug={r.slug}", json=body)
    assert first.status_code == 201
    assert retry.status_code == 201
    assert retry.json()["id"] == first.json()["id"]

    over_capacity = client.post(f"/api/v1/public/reservations?slug={r.slug}", json={
        "customer_name": "Bob", "guests": 1, "reserved_at": _public_slot(day),
    })
    assert over_capacity.status_code == 409


def test_manual_block_removes_slots_and_staff_gets_in_app_notice(client, db):
    r = _setup(db, client)
    day = _next_open_day()
    starts_at = datetime.combine(day, time(19, 0), ZoneInfo("Asia/Karachi"))
    block = client.post("/api/v1/reservations/blocks", json={
        "starts_at": starts_at.isoformat(), "ends_at": (starts_at + timedelta(minutes=45)).isoformat(),
        "reason": "Private event",
    }, headers={"X-Restaurant-Id": str(r.id)})
    assert block.status_code == 201

    availability = client.get(f"/api/v1/public/reservations/availability?slug={r.slug}&date={day.isoformat()}&guests=2").json()
    local_slot_times = {
        datetime.fromisoformat(slot["starts_at"].replace("Z", "+00:00"))
        .astimezone(ZoneInfo("Asia/Karachi")).strftime("%H:%M")
        for slot in availability["slots"]
    }
    assert "19:00" not in local_slot_times
    assert "19:30" not in local_slot_times

    booking = client.post(f"/api/v1/public/reservations?slug={r.slug}", json={
        "customer_name": "Alice", "guests": 2,
        "reserved_at": datetime.combine(day, time(20, 0), ZoneInfo("Asia/Karachi")).isoformat(),
    })
    assert booking.status_code == 201
    notifications = client.get("/api/v1/notifications", headers={"X-Restaurant-Id": str(r.id)})
    assert notifications.status_code == 200
    assert any(item["event_type"] == "reservation.created" for item in notifications.json())


# ---------------------------------------------------------------------------
# Team members
# ---------------------------------------------------------------------------

def test_owner_can_list_members(client, db):
    r = _setup(db, client)
    res = client.get("/api/v1/members", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 200
    assert len(res.json()) == 1
    assert res.json()[0]["email"] == "owner@example.com"


def test_owner_can_invite_new_member(client, db):
    r = _setup(db, client)
    res = client.post(
        "/api/v1/members",
        json={"email": "chef@example.com", "full_name": "Chef Bob", "role": "kitchen"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 201
    assert res.json()["role"] == "kitchen"
    assert res.json()["email"] == "chef@example.com"


def test_invite_existing_user_adds_membership(client, db):
    r = _setup(db, client)
    make_user(db, "existing@example.com")
    res = client.post(
        "/api/v1/members",
        json={"email": "existing@example.com", "full_name": "Existing User", "role": "waiter"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 201


def test_duplicate_invite_returns_409(client, db):
    r = _setup(db, client)
    client.post("/api/v1/members", json={"email": "chef@example.com", "full_name": "Chef", "role": "kitchen"}, headers={"X-Restaurant-Id": str(r.id)})
    res = client.post("/api/v1/members", json={"email": "chef@example.com", "full_name": "Chef", "role": "kitchen"}, headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 409


def test_owner_can_remove_member(client, db):
    r = _setup(db, client)
    member_id = client.post(
        "/api/v1/members",
        json={"email": "chef@example.com", "full_name": "Chef", "role": "kitchen"},
        headers={"X-Restaurant-Id": str(r.id)},
    ).json()["id"]
    res = client.delete(f"/api/v1/members/{member_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 204


def test_cannot_remove_yourself(client, db):
    r = _setup(db, client)
    own_member_id = client.get("/api/v1/members", headers={"X-Restaurant-Id": str(r.id)}).json()[0]["id"]
    res = client.delete(f"/api/v1/members/{own_member_id}", headers={"X-Restaurant-Id": str(r.id)})
    assert res.status_code == 409


def test_manager_cannot_invite(client, db):
    r = make_restaurant(db, "bistro", status="active")
    u = make_user(db, "mgr@example.com")
    add_member(db, r, u, "manager")
    login(client, "mgr@example.com")
    res = client.post(
        "/api/v1/members",
        json={"email": "new@example.com", "full_name": "New", "role": "waiter"},
        headers={"X-Restaurant-Id": str(r.id)},
    )
    assert res.status_code == 403
