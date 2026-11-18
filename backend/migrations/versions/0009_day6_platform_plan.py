"""Add subscription plan column to restaurants for Day 6."""
from alembic import op
import sqlalchemy as sa

revision = "0009_day6_platform_plan"
down_revision = "0008_menu_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("restaurants", sa.Column("plan", sa.String(30), nullable=False, server_default="growth"))


def downgrade() -> None:
    op.drop_column("restaurants", "plan")
