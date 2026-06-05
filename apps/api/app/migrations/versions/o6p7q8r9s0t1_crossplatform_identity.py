"""Add cross-platform identity linking.

linked_identity_id on identities + identity_link_codes table.

Revision ID: o6p7q8r9s0t1
Revises: n5f6a7b8c9d0
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "o6p7q8r9s0t1"
down_revision = "n5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add linked_identity_id to identities
    op.add_column(
        "identities",
        sa.Column(
            "linked_identity_id",
            sa.Integer(),
            sa.ForeignKey("identities.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "idx_identities_linked",
        "identities",
        ["linked_identity_id"],
    )

    # 2. Create identity_link_codes table
    op.create_table(
        "identity_link_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(6), nullable=False, unique=True),
        sa.Column(
            "identity_id",
            sa.Integer(),
            sa.ForeignKey("identities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("identity_link_codes")
    op.drop_index("idx_identities_linked", table_name="identities")
    op.drop_column("identities", "linked_identity_id")
