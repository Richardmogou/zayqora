"""Add email verification tokens and restaurant storefront profile/branding/policy columns."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_p1_mvp_completeness"
down_revision = "0010_complete_spec_modules"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"])
    op.create_index("ix_email_verification_tokens_token_hash", "email_verification_tokens", ["token_hash"], unique=True)

    op.add_column("restaurants", sa.Column("tagline", sa.String(240), nullable=True))
    op.add_column("restaurants", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("restaurants", sa.Column("cuisine", sa.String(100), nullable=True))
    op.add_column("restaurants", sa.Column("phone", sa.String(40), nullable=True))
    op.add_column("restaurants", sa.Column("contact_email", sa.String(320), nullable=True))
    op.add_column("restaurants", sa.Column("address", sa.String(300), nullable=True))
    op.add_column("restaurants", sa.Column("logo_url", sa.String(500), nullable=True))
    op.add_column("restaurants", sa.Column("cover_image_url", sa.String(500), nullable=True))
    op.add_column("restaurants", sa.Column("delivery_fee_minor", sa.Integer(), nullable=False, server_default="400"))
    op.add_column("restaurants", sa.Column("tax_rate_bps", sa.Integer(), nullable=False, server_default="1000"))
    op.add_column("restaurants", sa.Column("privacy_policy", sa.Text(), nullable=True))
    op.add_column("restaurants", sa.Column("terms_of_service", sa.Text(), nullable=True))
    op.add_column("restaurants", sa.Column("refund_policy", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("restaurants", "refund_policy")
    op.drop_column("restaurants", "terms_of_service")
    op.drop_column("restaurants", "privacy_policy")
    op.drop_column("restaurants", "tax_rate_bps")
    op.drop_column("restaurants", "delivery_fee_minor")
    op.drop_column("restaurants", "cover_image_url")
    op.drop_column("restaurants", "logo_url")
    op.drop_column("restaurants", "address")
    op.drop_column("restaurants", "contact_email")
    op.drop_column("restaurants", "phone")
    op.drop_column("restaurants", "cuisine")
    op.drop_column("restaurants", "description")
    op.drop_column("restaurants", "tagline")
    op.drop_index("ix_email_verification_tokens_token_hash", table_name="email_verification_tokens")
    op.drop_index("ix_email_verification_tokens_user_id", table_name="email_verification_tokens")
    op.drop_table("email_verification_tokens")
