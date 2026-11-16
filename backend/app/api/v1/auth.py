from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.core.rate_limit import limiter
from app.core.security import burn_verification_time, hash_token, new_session_token, verify_password
from app.models import AuditLog, Restaurant, RestaurantMember, User, UserSession
from app.permissions.deps import get_current_user
from app.schemas.auth import LoginIn, MembershipOut, MeOut, UserOut

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
