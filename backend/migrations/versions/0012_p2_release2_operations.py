"""Add dining_tables, kitchen_stations, cash_sessions, delivery_assignments, and expenses tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012_p2_release2_operations"
down_revision = "0011_p1_mvp_completeness"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dining_tables",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("area_name", sa.String(80), nullable=False, server_default="Main Hall"),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("qr_token", sa.String(64), nullable=False, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("restaurant_id", "label", name="uq_dining_table_restaurant_label"),
    )
    op.create_index("ix_dining_tables_restaurant_id", "dining_tables", ["restaurant_id"])
    op.create_index("ix_dining_tables_restaurant_status", "dining_tables", ["restaurant_id", "status"])
    op.create_index("ix_dining_tables_qr_token", "dining_tables", ["qr_token"], unique=True)

    op.create_table(
        "kitchen_stations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(40), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("restaurant_id", "code", name="uq_kitchen_station_code"),
    )
    op.create_index("ix_kitchen_stations_restaurant_id", "kitchen_stations", ["restaurant_id"])

    op.create_table(
        "cash_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("opened_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("closed_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("opening_balance_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expected_cash_minor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("counted_cash_minor", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("notes", sa.String(300), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_cash_sessions_restaurant_id", "cash_sessions", ["restaurant_id"])
    op.create_index("ix_cash_sessions_restaurant_status", "cash_sessions", ["restaurant_id", "status"])

    op.create_table(
        "delivery_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("rider_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="assigned"),
        sa.Column("notes", sa.String(300), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("picked_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("en_route_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_delivery_assignments_restaurant_id", "delivery_assignments", ["restaurant_id"])
    op.create_index("ix_delivery_assignments_restaurant_status", "delivery_assignments", ["restaurant_id", "status"])
    op.create_index("ix_delivery_assignments_rider_status", "delivery_assignments", ["rider_user_id", "status"])
    op.create_index("ix_delivery_assignments_order_id", "delivery_assignments", ["order_id"], unique=True)

    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("description", sa.String(300), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("incurred_on", sa.Date(), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_expenses_restaurant_id", "expenses", ["restaurant_id"])
    op.create_index("ix_expenses_restaurant_incurred", "expenses", ["restaurant_id", "incurred_on"])


def downgrade() -> None:
    op.drop_table("expenses")
    op.drop_table("delivery_assignments")
    op.drop_table("cash_sessions")
    op.drop_table("kitchen_stations")
    op.drop_table("dining_tables")
