"""Add image_url, discounted_price_minor, kitchen_station, dietary_tags, and is_featured to menu_items."""
from alembic import op
import sqlalchemy as sa

revision = "0008_menu_enhancements"
down_revision = "0007_day5_booking_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("menu_items", sa.Column("image_url", sa.Text(), nullable=True))
    op.add_column("menu_items", sa.Column("discounted_price_minor", sa.Integer(), nullable=True))
    op.add_column("menu_items", sa.Column("kitchen_station", sa.String(100), nullable=True))
    op.add_column("menu_items", sa.Column("dietary_tags", sa.String(200), nullable=True))
    op.add_column("menu_items", sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("menu_items", "is_featured")
    op.drop_column("menu_items", "dietary_tags")
    op.drop_column("menu_items", "kitchen_station")
    op.drop_column("menu_items", "discounted_price_minor")
    op.drop_column("menu_items", "image_url")
