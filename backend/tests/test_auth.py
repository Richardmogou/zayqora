from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models import UserSession
from tests.helpers import PASSWORD, login, make_user


def test_password_hash_roundtrip():
    h = hash_password("secret123")
    assert verify_password("secret123", h)
    assert not verify_password("wrong", h)


def test_login_sets_httponly_cookie_and_me_works(client, db):
    make_user(db, "owner@example.com", full_name="Olivia Owner")
    r = login(client, "owner@example.com")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "owner@example.com"
    assert "httponly" in r.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").json()["user"]["full_name"] == "Olivia Owner"


def test_wrong_password_and_unknown_email_look_the_same(client, db):
    make_user(db, "owner@example.com")
    a = login(client, "owner@example.com", "bad-password")
    b = login(client, "nobody@example.com", "bad-password")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_me_requires_authentication(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_session_token_is_stored_hashed(client, db):
    make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    token = client.cookies.get(settings.session_cookie_name)
    stored = db.query(UserSession).one()
    assert token and stored.token_hash != token and len(stored.token_hash) == 64


def test_logout_revokes_the_session(client, db):
    make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    token = client.cookies.get(settings.session_cookie_name)
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(settings.session_cookie_name, token)  # on rejoue l'ancien cookie
    assert client.get("/api/v1/auth/me").status_code == 401


def test_deactivated_user_loses_access(client, db):
    user = make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    user.is_active = False
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401
    assert login(client, "owner@example.com").status_code == 401


def test_expired_session_is_rejected(client, db):
    make_user(db, "owner@example.com")
    login(client, "owner@example.com")
    db.execute(update(UserSession).values(expires_at=datetime.now(timezone.utc) - timedelta(hours=1)))
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_login_is_rate_limited(client, db):
    make_user(db, "owner@example.com")
    for _ in range(settings.login_max_attempts):
        assert login(client, "owner@example.com", "bad").status_code == 401
    assert login(client, "owner@example.com", PASSWORD).status_code == 429


def test_foreign_origin_is_blocked(client, db):
    make_user(db, "owner@example.com")
    r = client.post(
        "/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD},
        headers={"Origin": "https://evil.example.org"},
    )
    assert r.status_code == 403


def test_allowed_origin_is_accepted(client, db):
    make_user(db, "owner@example.com")
    r = client.post(
        "/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD},
        headers={"Origin": settings.allowed_origins[0]},
    )
    assert r.status_code == 200
