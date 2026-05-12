"""Add missing tables: system_settings, master_pages, client_profiles, client_tags, client_notes, client_master_scores

Revision ID: b3c7d5e9f012
Revises: fee948a7f4c0
Create Date: 2026-05-12 15:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b3c7d5e9f012"
down_revision = "fee948a7f4c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("key", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "master_pages",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("master_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("theme", sa.String(50), server_default="default"),
        sa.Column("custom_links", sa.JSON(), server_default="[]"),
        sa.Column("show_reviews", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("show_portfolio", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("show_services", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("bio_text", sa.Text(), nullable=True),
        sa.Column("seo_title", sa.String(200), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "client_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("physical_params", sa.JSON(), server_default="{}"),
        sa.Column("preferences", sa.JSON(), server_default="{}"),
        sa.Column("allergies", sa.JSON(), server_default="[]"),
        sa.Column("source", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "client_tags",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("master_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "client_notes",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("master_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "client_master_scores",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("master_id", sa.Integer(), sa.ForeignKey("masters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), server_default="5.0"),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("client_master_scores")
    op.drop_table("client_notes")
    op.drop_table("client_tags")
    op.drop_table("client_profiles")
    op.drop_table("master_pages")
    op.drop_table("system_settings")
