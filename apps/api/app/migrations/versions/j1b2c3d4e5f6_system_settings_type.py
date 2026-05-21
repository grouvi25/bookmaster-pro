"""Add type column to system_settings.

Revision ID: j1b2c3d4e5f6
Revises: i0a1b2c3d4e5
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa

revision = "j1b2c3d4e5f6"
down_revision = "i0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "system_settings",
        sa.Column("type", sa.String(20), server_default="string", nullable=True),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "type")
