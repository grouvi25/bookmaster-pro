"""Create rental_listings and rental_requests tables.

Revision ID: s0t1u2v3w4x5
Revises: r9s0t1u2v3w4
Create Date: 2026-06-08
"""
from alembic import op
import sqlalchemy as sa

revision = "s0t1u2v3w4x5"
down_revision = "r9s0t1u2v3w4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rental_listings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("listing_type", sa.String(30), nullable=False, server_default="chair"),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("latitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitude", sa.Numeric(10, 7), nullable=True),
        sa.Column("price_monthly", sa.Numeric(10, 2), nullable=False),
        sa.Column("price_daily", sa.Numeric(10, 2), nullable=True),
        sa.Column("deposit", sa.Numeric(10, 2), nullable=True),
        sa.Column("amenities", sa.JSON(), server_default="[]"),
        sa.Column("photo_urls", sa.JSON(), server_default="[]"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("available_from", sa.Date(), nullable=True),
        sa.Column("max_tenants", sa.Integer(), server_default="1"),
        sa.Column("current_tenants", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "rental_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("listing_id", sa.Integer(), sa.ForeignKey("rental_listings.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("moved_in_at", sa.Date(), nullable=True),
        sa.Column("moved_out_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("rental_requests")
    op.drop_table("rental_listings")
