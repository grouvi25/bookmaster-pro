"""add unique constraint on client_master_links(master_id, client_id)

Revision ID: t1u2v3w4x5y6
Revises: b1c2d3e4f5g6
Create Date: 2026-06-09
"""
from alembic import op

revision = "t1u2v3w4x5y6"
down_revision = "b1c2d3e4f5g6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_client_master_link",
        "client_master_links",
        ["master_id", "client_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_client_master_link", "client_master_links", type_="unique")
