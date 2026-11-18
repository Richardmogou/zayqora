import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import limiter
from app.core.security import burn_verification_time, hash_password, hash_token, new_session_token, verify_password
from app.models import AuditLog, Branch, PasswordResetToken, Restaurant, RestaurantMember, User, UserSession
from app.permissions.deps import get_current_user
from app.schemas.auth import (
    ForgotPasswordIn,
    LoginIn,
    MembershipOut,
    MeOut,
    PasswordResetStatusOut,
    RegisterIn,
    ResetPasswordIn,
    UserOut,
)

_SLUG_RE = re.compile(r"[^a-z0-9]+")

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def build_me(db: Session, user: User) -> MeOut:
    rows = db.execute(
        select(RestaurantMember, Restaurant)
        .join(Restaurant, Restaurant.id == RestaurantMember.restaurant_id)
        .where(RestaurantMember.user_id == user.id, RestaurantMember.is_active.is_(True))
        .order_by(Restaurant.name)
    ).all()
    return MeOut(
        user=UserOut.model_validate(user),
        memberships=[
            MembershipOut(
                restaurant_id=r.id, restaurant_name=r.name, restaurant_slug=r.slug,
                restaurant_status=r.status, role=m.role,
            )
            for m, r in rows
        ],
    )


def _slugify(name: str) -> str:
    return _SLUG_RE.sub("-", name.lower().strip()).strip("-")[:80]


@router.post("/register", response_model=MeOut, status_code=201)
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")

    slug_base = _slugify(body.restaurant_name)
    slug = slug_base
    counter = 1
    while db.scalar(select(Restaurant).where(Restaurant.slug == slug)):
        slug = f"{slug_base}-{counter}"
        counter += 1

    user = User(
        email=email,
        full_name=body.full_name.strip(),
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.flush()

    restaurant = Restaurant(
        slug=slug,
        name=body.restaurant_name.strip(),
        status="pending",
        country=body.country.upper(),
        currency=body.currency.upper(),
        timezone=body.timezone,
    )
    db.add(restaurant)
    db.flush()

    db.add(Branch(restaurant_id=restaurant.id, name="Main branch", is_default=True))
    db.add(RestaurantMember(restaurant_id=restaurant.id, user_id=user.id, role="owner"))
    db.add(AuditLog(actor_user_id=user.id, restaurant_id=restaurant.id, action="auth.register"))
    db.commit()

    token = new_session_token()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip=request.client.host if request.client else "unknown",
    ))
    db.commit()

    response.set_cookie(
        settings.session_cookie_name, token,
        max_age=settings.session_days * 86400, httponly=True, samesite="lax",
        secure=settings.is_production, path="/",
    )
    return build_me(db, user)


@router.post("/login", response_model=MeOut)
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    key = f"{_client_ip(request)}|{email}"
    if limiter.blocked(key):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        burn_verification_time(body.password)
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        limiter.record_failure(key)
        raise HTTPException(status_code=401, detail="Invalid email or password")  # message identique dans tous les cas

    limiter.reset(key)
    token = new_session_token()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.session_days),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip=_client_ip(request),
    ))
    db.add(AuditLog(actor_user_id=user.id, action="auth.login"))
    db.commit()

    response.set_cookie(
        settings.session_cookie_name, token,
        max_age=settings.session_days * 86400, httponly=True, samesite="lax",
        secure=settings.is_production, path="/",
    )
    return build_me(db, user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        session = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
        if session is not None and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_me(db, user)


@router.post("/refresh", response_model=MeOut)
def refresh_session(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    old_token = request.cookies.get(settings.session_cookie_name)
    now = datetime.now(timezone.utc)
    if old_token:
        old_session = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(old_token)))
        if old_session is not None and old_session.revoked_at is None:
            old_session.revoked_at = now

    new_token = new_session_token()
    db.add(UserSession(
        user_id=user.id,
        token_hash=hash_token(new_token),
        expires_at=now + timedelta(days=settings.session_days),
        user_agent=(request.headers.get("user-agent") or "")[:300],
        ip=_client_ip(request),
    ))
    db.add(AuditLog(actor_user_id=user.id, action="auth.refresh"))
    db.commit()

    response.set_cookie(
        settings.session_cookie_name,
        new_token,
        max_age=settings.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
        path="/",
    )
    return build_me(db, user)


@router.post("/password/forgot", response_model=PasswordResetStatusOut)
def forgot_password(body: ForgotPasswordIn, request: Request, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email, User.is_active.is_(True)))
    raw_token: str | None = None
    if user is not None:
        raw_token = new_session_token()
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        db.add(AuditLog(actor_user_id=user.id, action="auth.password.forgot", data={"ip": _client_ip(request)}))
        db.commit()
    else:
        burn_verification_time(email)
    return PasswordResetStatusOut(
        status="ok",
        reset_token=None if settings.is_production else raw_token,
    )


@router.post("/password/reset", response_model=PasswordResetStatusOut)
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    token_row = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(body.token.strip()))
    )
    if token_row is None or token_row.used_at is not None or token_row.expires_at <= now:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    user = db.scalar(select(User).where(User.id == token_row.user_id, User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    token_row.used_at = now
    user.password_hash = hash_password(body.new_password)

    # Revoke all active sessions on password change (Section 17.1)
    active_sessions = db.scalars(
        select(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None))
    ).all()
    for sess in active_sessions:
        sess.revoked_at = now

    db.add(AuditLog(actor_user_id=user.id, action="auth.password.reset"))
    db.commit()
    return PasswordResetStatusOut(status="ok")
