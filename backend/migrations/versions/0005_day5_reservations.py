"""Create reservations table for Day 5."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_day5_reservations"
down_revision = "0004_day4b_orders_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "reservations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("customer_phone", sa.String(30), nullable=True),
        sa.Column("customer_email", sa.String(320), nullable=True),
        sa.Column("guests", sa.Integer(), nullable=False),
        sa.Column("table_label", sa.String(50), nullable=True),
        sa.Column("reserved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reservations_restaurant_id", "reservations", ["restaurant_id"])
    op.create_index("ix_reservations_restaurant_date", "reservations", ["restaurant_id", "reserved_at"])
    op.create_index("ix_reservations_restaurant_status", "reservations", ["restaurant_id", "status"])


def downgrade() -> None:
    op.drop_table("reservations")
