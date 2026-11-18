"""Scope order idempotency keys to their restaurant."""
from alembic import op

revision = "0005_day4_order_integrity"
down_revision = "0004_day4b_orders_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_orders_idempotency_key", table_name="orders")
    op.drop_constraint("uq_orders_idempotency_key", "orders", type_="unique")
    op.create_unique_constraint(
        "uq_orders_restaurant_idempotency_key",
        "orders",
        ["restaurant_id", "idempotency_key"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_orders_restaurant_idempotency_key", "orders", type_="unique")
    op.create_unique_constraint("uq_orders_idempotency_key", "orders", ["idempotency_key"])
    op.create_index("ix_orders_idempotency_key", "orders", ["idempotency_key"])
