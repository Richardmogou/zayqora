"""Add configurable booking capacity, manual blocks, and staff notifications."""
import json

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_day5_booking_notifications"
down_revision = "0006_merge_day4_day5"
branch_labels = None
depends_on = None

DEFAULT_HOURS = json.dumps(
    {
        "0": [],
        **{str(day): [["12:00", "14:30"], ["19:00", "22:00"]] for day in range(1, 7)},
    },
    separators=(",", ":"),
)


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("reservation_capacity", sa.Integer(), nullable=False, server_default="40"))
    op.add_column("restaurants", sa.Column("reservation_duration_minutes", sa.Integer(), nullable=False, server_default="90"))
    op.add_column("restaurants", sa.Column("reservation_slot_interval_minutes", sa.Integer(), nullable=False, server_default="30"))
    op.add_column("restaurants", sa.Column("reservation_buffer_minutes", sa.Integer(), nullable=False, server_default="15"))
    op.add_column(
        "restaurants",
        sa.Column(
            "reservation_opening_hours", postgresql.JSONB(), nullable=False,
            server_default=sa.text(f"'{DEFAULT_HOURS}'::jsonb"),
        ),
    )
    op.add_column("reservations", sa.Column("idempotency_key", sa.String(64), nullable=True))
    op.create_unique_constraint(
        "uq_reservations_restaurant_idempotency_key", "reservations", ["restaurant_id", "idempotency_key"]
    )

    op.create_table(
        "reservation_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_reservation_blocks_restaurant_id", "reservation_blocks", ["restaurant_id"])
    op.create_index("ix_reservation_blocks_restaurant_time", "reservation_blocks", ["restaurant_id", "starts_at", "ends_at"])

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("restaurant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.String(500), nullable=False),
        sa.Column("entity_type", sa.String(50)),
        sa.Column("entity_id", sa.String(64)),
        sa.Column("data", postgresql.JSONB()),
        sa.Column("dedupe_key", sa.String(160), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "dedupe_key", name="uq_notifications_user_dedupe"),
    )
    op.create_index("ix_notifications_restaurant_id", "notifications", ["restaurant_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("reservation_blocks")
    op.drop_constraint("uq_reservations_restaurant_idempotency_key", "reservations", type_="unique")
    op.drop_column("reservations", "idempotency_key")
    op.drop_column("restaurants", "reservation_opening_hours")
    op.drop_column("restaurants", "reservation_buffer_minutes")
    op.drop_column("restaurants", "reservation_slot_interval_minutes")
    op.drop_column("restaurants", "reservation_duration_minutes")
    op.drop_column("restaurants", "reservation_capacity")
