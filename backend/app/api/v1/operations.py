import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.orders import _DELIVERY_FEE_MINOR, _build_lines, evaluate_coupon
from app.core.db import get_db
from app.models import (
    AuditLog,
    Branch,
    Coupon,
    Ingredient,
    Order,
    PaymentTransaction,
    PaymentWebhookEvent,
    Refund,
    Restaurant,
    Review,
    StockMovement,
)
from app.permissions.deps import TenantContext, require_roles
from app.permissions.roles import Role
from app.schemas.operations import (
    BranchIn,
    BranchOut,
    CartQuoteLineOut,
    CartQuoteOut,
    CartValidateIn,
    CouponIn,
    CouponOut,
    IngredientIn,
    IngredientOut,
    PaymentCheckoutIn,
    PaymentTransactionOut,
    PublicReviewsOut,
    RefundIn,
    RefundOut,
    ReviewIn,
    ReviewModerateIn,
    ReviewOut,
    StockMovementIn,
    StockMovementOut,
    WebhookAckOut,
    WebhookEventIn,
)
from app.services.notifications import notify_restaurant_staff

_EDITORS = (Role.OWNER, Role.MANAGER)
_VIEWERS = (Role.OWNER, Role.MANAGER, Role.CASHIER, Role.KITCHEN, Role.WAITER, Role.ACCOUNTANT)
_INVENTORY_ROLES = (Role.OWNER, Role.MANAGER, Role.KITCHEN)
_PAYMENT_ROLES = (Role.OWNER, Role.MANAGER, Role.CASHIER)

# ---------------------------------------------------------------------------
# Branches (/api/v1/branches)
# ---------------------------------------------------------------------------

branches_router = APIRouter(prefix="/branches", tags=["branches"])


@branches_router.get("", response_model=list[BranchOut])
def list_branches(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Branch).where(Branch.restaurant_id == ctx.restaurant.id).order_by(Branch.created_at)
    ).all()


@branches_router.post("", response_model=BranchOut, status_code=201)
def create_branch(
    body: BranchIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    if body.is_default:
        existing_defaults = db.scalars(
            select(Branch).where(Branch.restaurant_id == ctx.restaurant.id, Branch.is_default.is_(True))
        ).all()
        for b in existing_defaults:
            b.is_default = False

    branch = Branch(
        restaurant_id=ctx.restaurant.id,
        name=body.name.strip(),
        address=body.address.strip() if body.address else None,
        timezone=body.timezone,
        is_default=body.is_default,
    )
    db.add(branch)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="branch.create",
        entity_type="branch",
        entity_id=str(branch.id),
        data={"name": branch.name},
    ))
    db.commit()
    db.refresh(branch)
    return branch


# ---------------------------------------------------------------------------
# Coupons (/api/v1/coupons) & Cart validation (/api/v1/cart/validate)
# ---------------------------------------------------------------------------

coupons_router = APIRouter(prefix="/coupons", tags=["coupons"])
cart_router = APIRouter(prefix="/cart", tags=["cart"])


@coupons_router.get("", response_model=list[CouponOut])
def list_coupons(
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(Coupon).where(Coupon.restaurant_id == ctx.restaurant.id).order_by(Coupon.created_at.desc())
    ).all()


@coupons_router.post("", response_model=CouponOut, status_code=201)
def create_coupon(
    body: CouponIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    code = body.code.strip().upper()
    if body.discount_type == "percentage" and (body.discount_value < 1 or body.discount_value > 100):
        raise HTTPException(status_code=422, detail="Percentage discount must be between 1 and 100")
    existing = db.scalar(
        select(Coupon).where(Coupon.restaurant_id == ctx.restaurant.id, Coupon.code == code)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists for this restaurant")

    coupon = Coupon(
        restaurant_id=ctx.restaurant.id,
        code=code,
        discount_type=body.discount_type,
        discount_value=body.discount_value,
        min_order_minor=body.min_order_minor,
        max_uses=body.max_uses,
        is_active=body.is_active,
        expires_at=body.expires_at,
    )
    db.add(coupon)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="coupon.create",
        entity_type="coupon",
        entity_id=str(coupon.id),
        data={"code": code, "discount_type": coupon.discount_type, "discount_value": coupon.discount_value},
    ))
    db.commit()
    db.refresh(coupon)
    return coupon


@coupons_router.delete("/{coupon_id}", status_code=204)
def delete_coupon(
    coupon_id: uuid.UUID,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    coupon = db.scalar(
        select(Coupon).where(Coupon.id == coupon_id, Coupon.restaurant_id == ctx.restaurant.id)
    )
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    db.delete(coupon)
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="coupon.delete",
        entity_type="coupon",
        entity_id=str(coupon_id),
    ))
    db.commit()


@cart_router.post("/validate", response_model=CartQuoteOut)
def validate_cart(
    body: CartValidateIn,
    slug: str = Query(..., description="Restaurant slug"),
    db: Session = Depends(get_db),
):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    lines = _build_lines(db, restaurant.id, body.lines)
    subtotal = sum(l.line_total_minor for l in lines)
    delivery_fee = _DELIVERY_FEE_MINOR if body.service_mode == "delivery" else 0
    coupon, discount_minor = evaluate_coupon(db, restaurant.id, body.coupon_code, subtotal, delivery_fee)
    total = max(subtotal + delivery_fee - discount_minor, 0)

    return CartQuoteOut(
        currency=restaurant.currency,
        subtotal_minor=subtotal,
        discount_minor=discount_minor,
        delivery_fee_minor=delivery_fee,
        total_minor=total,
        coupon_code=coupon.code if coupon else None,
        lines=[
            CartQuoteLineOut(
                menu_item_id=l.menu_item_id,
                name=l.name,
                unit_price_minor=l.unit_price_minor,
                quantity=l.quantity,
                modifiers_snapshot=l.modifiers_snapshot,
                line_total_minor=l.line_total_minor,
            )
            for l in lines
        ],
    )


# ---------------------------------------------------------------------------
# Payments (/api/v1/payments)
# ---------------------------------------------------------------------------

payments_router = APIRouter(prefix="/payments", tags=["payments"])


@payments_router.post("/checkout", response_model=PaymentTransactionOut, status_code=201)
def create_payment_checkout(
    body: PaymentCheckoutIn,
    db: Session = Depends(get_db),
):
    order = db.scalar(select(Order).where(Order.id == body.order_id))
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    restaurant = db.scalar(select(Restaurant).where(Restaurant.id == order.restaurant_id))
    if not restaurant or restaurant.status != "active":
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if body.idempotency_key:
        existing = db.scalar(
            select(PaymentTransaction).where(
                PaymentTransaction.restaurant_id == restaurant.id,
                PaymentTransaction.idempotency_key == body.idempotency_key,
            )
        )
        if existing:
            return existing

    tx = PaymentTransaction(
        restaurant_id=restaurant.id,
        order_id=order.id,
        provider=body.provider,
        provider_reference=f"pay_{body.provider}_{uuid.uuid4().hex[:18]}",
        idempotency_key=body.idempotency_key,
        amount_minor=order.total_minor,
        currency=restaurant.currency,
        status="pending",
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


@payments_router.post("/webhooks/{provider}", response_model=WebhookAckOut)
def receive_payment_webhook(
    provider: str,
    body: WebhookEventIn,
    signature: str | None = Header(default=None, alias="X-Webhook-Signature"),
    db: Session = Depends(get_db),
):
    if not signature or len(signature.strip()) < 8:
        raise HTTPException(status_code=401, detail="Invalid or missing webhook signature")

    existing_event = db.scalar(
        select(PaymentWebhookEvent).where(
            PaymentWebhookEvent.provider == provider,
            PaymentWebhookEvent.event_id == body.event_id,
        )
    )
    if existing_event is not None:
        tx_existing = db.scalar(
            select(PaymentTransaction).where(PaymentTransaction.provider_reference == body.provider_reference)
        )
        return WebhookAckOut(
            status="processed",
            deduplicated=True,
            payment_status=tx_existing.status if tx_existing else None,
        )

    tx = db.scalar(
        select(PaymentTransaction).where(PaymentTransaction.provider_reference == body.provider_reference)
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Payment transaction not found")

    order = db.scalar(select(Order).where(Order.id == tx.order_id))
    next_state = "paid" if body.event_type == "payment.succeeded" else "failed"
    tx.status = next_state
    if order:
        order.payment_status = next_state

    db.add(PaymentWebhookEvent(
        provider=provider,
        event_id=body.event_id,
        payload=body.model_dump(),
    ))
    db.commit()
    return WebhookAckOut(status="processed", deduplicated=False, payment_status=tx.status)


@payments_router.post("/{payment_id}/refund", response_model=RefundOut, status_code=201)
def refund_payment(
    payment_id: uuid.UUID,
    body: RefundIn,
    ctx: TenantContext = Depends(require_roles(*_PAYMENT_ROLES)),
    db: Session = Depends(get_db),
):
    tx = db.scalar(
        select(PaymentTransaction).where(
            PaymentTransaction.id == payment_id,
            PaymentTransaction.restaurant_id == ctx.restaurant.id,
        )
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    if tx.status not in {"paid", "partially_refunded"}:
        raise HTTPException(status_code=409, detail=f"Cannot refund a payment in '{tx.status}' state")

    remaining = tx.amount_minor - tx.refunded_amount_minor
    refund_amount = body.amount_minor if body.amount_minor is not None else remaining
    if refund_amount <= 0 or refund_amount > remaining:
        raise HTTPException(status_code=422, detail="Refund amount exceeds refundable balance")

    tx.refunded_amount_minor += refund_amount
    tx.status = "refunded" if tx.refunded_amount_minor >= tx.amount_minor else "partially_refunded"

    order = db.scalar(select(Order).where(Order.id == tx.order_id))
    if order:
        order.payment_status = tx.status

    refund = Refund(
        restaurant_id=ctx.restaurant.id,
        payment_id=tx.id,
        order_id=tx.order_id,
        amount_minor=refund_amount,
        reason=body.reason.strip(),
        status="succeeded",
    )
    db.add(refund)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="payment.refund",
        entity_type="payment_transaction",
        entity_id=str(tx.id),
        data={"amount_minor": refund_amount, "reason": refund.reason, "payment_status": tx.status},
    ))
    db.commit()
    db.refresh(refund)
    return refund


# ---------------------------------------------------------------------------
# Inventory (/api/v1/inventory)
# ---------------------------------------------------------------------------

inventory_router = APIRouter(prefix="/inventory", tags=["inventory"])


def _ingredient_out(item: Ingredient) -> IngredientOut:
    out = IngredientOut.model_validate(item)
    if item.quantity_minor <= 0:
        out.stock_status = "out_of_stock"
    elif item.quantity_minor <= item.threshold_minor:
        out.stock_status = "low_stock"
    else:
        out.stock_status = "in_stock"
    return out


@inventory_router.get("/items", response_model=list[IngredientOut])
def list_inventory_items(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    items = db.scalars(
        select(Ingredient).where(Ingredient.restaurant_id == ctx.restaurant.id).order_by(Ingredient.name)
    ).all()
    return [_ingredient_out(i) for i in items]


@inventory_router.post("/items", response_model=IngredientOut, status_code=201)
def create_inventory_item(
    body: IngredientIn,
    ctx: TenantContext = Depends(require_roles(*_INVENTORY_ROLES)),
    db: Session = Depends(get_db),
):
    item = Ingredient(
        restaurant_id=ctx.restaurant.id,
        name=body.name.strip(),
        category=body.category.strip(),
        unit=body.unit.strip(),
        quantity_minor=body.quantity_minor,
        threshold_minor=body.threshold_minor,
    )
    db.add(item)
    db.flush()
    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="inventory.item.create",
        entity_type="ingredient",
        entity_id=str(item.id),
    ))
    db.commit()
    db.refresh(item)
    return _ingredient_out(item)


@inventory_router.post("/movements", response_model=StockMovementOut, status_code=201)
def record_stock_movement(
    body: StockMovementIn,
    ctx: TenantContext = Depends(require_roles(*_INVENTORY_ROLES)),
    db: Session = Depends(get_db),
):
    item = db.scalar(
        select(Ingredient).where(
            Ingredient.id == body.ingredient_id,
            Ingredient.restaurant_id == ctx.restaurant.id,
        )
    )
    if not item:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    if body.delta_minor == 0:
        raise HTTPException(status_code=422, detail="Movement delta cannot be zero")

    next_qty = max(item.quantity_minor + body.delta_minor, 0)
    item.quantity_minor = next_qty

    movement = StockMovement(
        restaurant_id=ctx.restaurant.id,
        ingredient_id=item.id,
        delta_minor=body.delta_minor,
        reason=body.reason.strip(),
        actor_user_id=ctx.user.id,
    )
    db.add(movement)
    db.flush()

    if item.quantity_minor <= item.threshold_minor:
        notify_restaurant_staff(
            db,
            restaurant_id=ctx.restaurant.id,
            event_type="inventory.threshold_reached",
            title="Low stock alert",
            body=f"{item.name} is at {item.quantity_minor / 100:.2f} {item.unit} (threshold: {item.threshold_minor / 100:.2f} {item.unit}).",
            entity_type="ingredient",
            entity_id=str(item.id),
            dedupe_key=f"inventory:{item.id}:low:{movement.id}",
        )

    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="inventory.movement.record",
        entity_type="ingredient",
        entity_id=str(item.id),
        data={"delta_minor": body.delta_minor, "new_quantity_minor": item.quantity_minor, "reason": movement.reason},
    ))
    db.commit()
    db.refresh(movement)
    return movement


@inventory_router.get("/movements", response_model=list[StockMovementOut])
def list_stock_movements(
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(StockMovement)
        .where(StockMovement.restaurant_id == ctx.restaurant.id)
        .order_by(StockMovement.created_at.desc())
        .limit(100)
    ).all()


# ---------------------------------------------------------------------------
# Reviews (/api/v1/reviews & /api/v1/public/restaurants/{slug}/reviews)
# ---------------------------------------------------------------------------

reviews_router = APIRouter(prefix="/reviews", tags=["reviews"])
public_reviews_router = APIRouter(prefix="/public/restaurants", tags=["public"])


@reviews_router.get("", response_model=list[ReviewOut])
def list_workspace_reviews(
    status: str | None = Query(default=None),
    ctx: TenantContext = Depends(require_roles(*_VIEWERS)),
    db: Session = Depends(get_db),
):
    stmt = select(Review).where(Review.restaurant_id == ctx.restaurant.id).order_by(Review.created_at.desc())
    if status:
        stmt = stmt.where(Review.status == status)
    return db.scalars(stmt).all()


@reviews_router.patch("/{review_id}", response_model=ReviewOut)
def moderate_review(
    review_id: uuid.UUID,
    body: ReviewModerateIn,
    ctx: TenantContext = Depends(require_roles(*_EDITORS)),
    db: Session = Depends(get_db),
):
    review = db.scalar(
        select(Review).where(Review.id == review_id, Review.restaurant_id == ctx.restaurant.id)
    )
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if body.status is not None:
        review.status = body.status
    if body.owner_response is not None:
        review.owner_response = body.owner_response.strip() or None

    db.add(AuditLog(
        actor_user_id=ctx.user.id,
        restaurant_id=ctx.restaurant.id,
        action="review.moderate",
        entity_type="review",
        entity_id=str(review.id),
        data={"status": review.status},
    ))
    db.commit()
    db.refresh(review)
    return review


@public_reviews_router.get("/{slug}/reviews", response_model=PublicReviewsOut)
def list_public_reviews(slug: str, db: Session = Depends(get_db)):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    approved = db.scalars(
        select(Review)
        .where(Review.restaurant_id == restaurant.id, Review.status == "approved")
        .order_by(Review.created_at.desc())
    ).all()
    total = len(approved)
    avg = round(sum(r.rating for r in approved) / total, 2) if total > 0 else 0.0
    return PublicReviewsOut(
        average_rating=avg,
        total_reviews=total,
        reviews=[ReviewOut.model_validate(r) for r in approved],
    )


@public_reviews_router.post("/{slug}/reviews", response_model=ReviewOut, status_code=201)
def submit_public_review(
    slug: str,
    body: ReviewIn,
    db: Session = Depends(get_db),
):
    restaurant = db.scalar(select(Restaurant).where(Restaurant.slug == slug, Restaurant.status == "active"))
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    if body.order_id is not None:
        order = db.scalar(
            select(Order).where(Order.id == body.order_id, Order.restaurant_id == restaurant.id)
        )
        if not order:
            raise HTTPException(status_code=404, detail="Order not found for this restaurant")

    review = Review(
        restaurant_id=restaurant.id,
        order_id=body.order_id,
        customer_name=body.customer_name.strip(),
        rating=body.rating,
        comment=body.comment.strip() if body.comment else None,
        status="pending",
    )
    db.add(review)
    db.flush()
    notify_restaurant_staff(
        db,
        restaurant_id=restaurant.id,
        event_type="review.submitted",
        title="New customer review",
        body=f"{review.customer_name} left a {review.rating}/5 review awaiting moderation.",
        entity_type="review",
        entity_id=str(review.id),
        dedupe_key=f"review:{review.id}:submitted",
    )
    db.commit()
    db.refresh(review)
    return review
