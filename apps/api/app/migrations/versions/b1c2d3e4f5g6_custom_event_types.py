"""add custom_event_types to masters, widen event_type

Revision ID: b1c2d3e4f5g6
Revises: s0t1u2v3w4x5
Create Date: 2026-06-09
"""
from alembic import op
import sqlalchemy as sa

revision = "b1c2d3e4f5g6"
down_revision = "s0t1u2v3w4x5"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("masters", sa.Column("custom_event_types", sa.JSON(), server_default="[]", nullable=False))
    op.alter_column("appointments", "event_type", type_=sa.String(50), existing_type=sa.String(30))

def downgrade():
    op.drop_column("masters", "custom_event_types")
    op.alter_column("appointments", "event_type", type_=sa.String(30), existing_type=sa.String(50))
