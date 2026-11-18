"""day 4b orders hardening

Revision ID: 0004_day4b_orders_hardening
Revises: 0003_day4_orders
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_day4b_orders_hardening"
down_revision = "0003_day4_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("idempotency_key", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_orders_idempotency_key", "orders", ["idempotency_key"])
    op.create_index("ix_orders_idempotency_key", "orders", ["idempotency_key"])
    op.add_column("orders", sa.Column("payment_status", sa.String(20), nullable=False, server_default="pending"))


def downgrade() -> None:
    op.drop_index("ix_orders_idempotency_key", "orders")
    op.drop_constraint("uq_orders_idempotency_key", "orders")
    op.drop_column("orders", "idempotency_key")
    op.drop_column("orders", "payment_status")
