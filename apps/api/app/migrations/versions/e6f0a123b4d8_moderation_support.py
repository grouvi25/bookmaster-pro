"""Add moderation and support fields: hide_reason on reviews, subject on tickets

Revision ID: e6f0a123b4d8
Revises: d5e9f012a3c7
Create Date: 2026-05-14 13:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e6f0a123b4d8"
down_revision = "d5e9f012a3c7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "client_reviews",
        sa.Column("hide_reason", sa.String(500), nullable=True),
    )
    op.add_column(
        "support_tickets",
        sa.Column("subject", sa.String(300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("support_tickets", "subject")
    op.drop_column("client_reviews", "hide_reason")
