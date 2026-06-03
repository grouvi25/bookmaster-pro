"""add auto_renew to master_subscriptions

Revision ID: f7a1b2c3d4e5
Revises: a8b2c3d4e5f6
Create Date: 2026-06-03 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "f7a1b2c3d4e5"
down_revision = "a8b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "master_subscriptions",
        sa.Column(
            "auto_renew",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("master_subscriptions", "auto_renew")
