"""Add theme_config and cover_image_url to master_pages.

Revision ID: i0d4e5f6g7h8
Revises: h9c3d4e5f6a8
Create Date: 2026-05-20 12:00:00.000000+00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "i0d4e5f6g7h8"
down_revision = "h9c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_pages",
        sa.Column("theme_config", sa.JSON(), server_default="{}", nullable=True),
    )
    op.add_column(
        "master_pages",
        sa.Column("cover_image_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("master_pages", "cover_image_url")
    op.drop_column("master_pages", "theme_config")
