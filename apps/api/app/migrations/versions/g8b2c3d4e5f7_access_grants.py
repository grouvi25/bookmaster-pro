"""Add access_grants and platform_promo_codes tables.

Revision ID: g8b2c3d4e5f7
Revises: f7a1b234c5d9
Create Date: 2026-05-15 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "g8b2c3d4e5f7"
down_revision = "a8b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "access_grants",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "master_id",
            sa.Integer,
            sa.ForeignKey("masters.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("grant_type", sa.String(20), nullable=False),
        sa.Column("plan", sa.String(20), nullable=False, server_default="pro"),
        sa.Column("valid_until", sa.Date, nullable=False),
        sa.Column("promo_code", sa.String(50), nullable=True),
        sa.Column("granted_by", sa.String(100), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "platform_promo_codes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(50), unique=True, nullable=False, index=True),
        sa.Column("plan", sa.String(20), nullable=False),
        sa.Column("duration_days", sa.Integer, nullable=False),
        sa.Column("max_uses", sa.Integer, nullable=True),
        sa.Column("used_count", sa.Integer, server_default="0"),
        sa.Column("valid_until", sa.Date, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("platform_promo_codes")
    op.drop_table("access_grants")
