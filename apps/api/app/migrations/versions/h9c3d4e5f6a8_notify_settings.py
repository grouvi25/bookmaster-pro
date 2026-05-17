"""Add notification setting columns to masters

Revision ID: h9c3d4e5f6a8
Revises: g8b2c3d4e5f7
Create Date: 2026-05-17 09:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "h9c3d4e5f6a8"
down_revision = "g8b2c3d4e5f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("masters", sa.Column("notify_new_booking", sa.Boolean(), server_default=sa.text("true"), nullable=True))
    op.add_column("masters", sa.Column("notify_cancel", sa.Boolean(), server_default=sa.text("true"), nullable=True))
    op.add_column("masters", sa.Column("notify_reminder", sa.Boolean(), server_default=sa.text("true"), nullable=True))
    op.add_column("masters", sa.Column("notify_review", sa.Boolean(), server_default=sa.text("true"), nullable=True))
    op.add_column("masters", sa.Column("notify_no_show", sa.Boolean(), server_default=sa.text("true"), nullable=True))


def downgrade() -> None:
    op.drop_column("masters", "notify_no_show")
    op.drop_column("masters", "notify_review")
    op.drop_column("masters", "notify_reminder")
    op.drop_column("masters", "notify_cancel")
    op.drop_column("masters", "notify_new_booking")
