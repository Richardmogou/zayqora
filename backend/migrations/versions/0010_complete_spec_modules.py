"""Add password_reset_tokens, coupons, payments, webhooks, refunds, inventory, and reviews tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010_complete_spec_modules"
down_revision = "0009_day6_platform_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("discount_minor", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("coupon_code", sa.String(40), nullable=True))
    op.add_column("orders", sa.Column("cancellation_reason", sa.String(300), nullable=True))

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])
    op.create_index("ix_password_reset_tokens_token_hash", "password_reset_tokens", ["token_hash"], unique=True)

    op.create_table(
        "coupons",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("discount_type", sa.String(20), nullable=False),
        sa.Column("discount_value", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_order_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("used_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("restaurant_id", "code", name="uq_coupons_restaurant_code"),
    )
    op.create_index("ix_coupons_restaurant_id", "coupons", ["restaurant_id"])
    op.create_index("ix_coupons_restaurant_active", "coupons", ["restaurant_id", "is_active"])

    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(30), nullable=False, server_default="sandbox"),
        sa.Column("provider_reference", sa.String(120), nullable=False, unique=True),
        sa.Column("idempotency_key", sa.String(64), nullable=True),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("refunded_amount_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("restaurant_id", "idempotency_key", name="uq_payments_restaurant_idempotency"),
    )
    op.create_index("ix_payment_transactions_restaurant_id", "payment_transactions", ["restaurant_id"])
    op.create_index("ix_payment_transactions_order_id", "payment_transactions", ["order_id"])
    op.create_index("ix_payments_restaurant_order", "payment_transactions", ["restaurant_id", "order_id"])

    op.create_table(
        "provider_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("event_id", sa.String(120), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "event_id", name="uq_webhook_provider_event_id"),
    )

    op.create_table(
        "refunds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("payment_transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="succeeded"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_refunds_restaurant_id", "refunds", ["restaurant_id"])
    op.create_index("ix_refunds_payment_id", "refunds", ["payment_id"])
    op.create_index("ix_refunds_order_id", "refunds", ["order_id"])

    op.create_table(
        "ingredients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(80), nullable=False, server_default="General"),
        sa.Column("unit", sa.String(20), nullable=False, server_default="kg"),
        sa.Column("quantity_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("threshold_minor", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ingredients_restaurant_id", "ingredients", ["restaurant_id"])
    op.create_index("ix_ingredients_restaurant_name", "ingredients", ["restaurant_id", "name"])

    op.create_table(
        "stock_movements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ingredient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ingredients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("delta_minor", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(200), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_stock_movements_restaurant_id", "stock_movements", ["restaurant_id"])
    op.create_index("ix_stock_movements_ingredient_id", "stock_movements", ["ingredient_id"])
    op.create_index("ix_stock_movements_restaurant_created", "stock_movements", ["restaurant_id", "created_at"])

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("owner_response", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reviews_restaurant_id", "reviews", ["restaurant_id"])
    op.create_index("ix_reviews_restaurant_status", "reviews", ["restaurant_id", "status"])


def downgrade() -> None:
    op.drop_table("reviews")
    op.drop_table("stock_movements")
    op.drop_table("ingredients")
    op.drop_table("refunds")
    op.drop_table("provider_webhook_events")
    op.drop_table("payment_transactions")
    op.drop_table("coupons")
    op.drop_table("password_reset_tokens")
    op.drop_column("orders", "cancellation_reason")
    op.drop_column("orders", "coupon_code")
    op.drop_column("orders", "discount_minor")
