"""Fix ТЗ gaps: add missing fields to masters, schedule_templates, appointments,
services, clients, marketplace_listings, master_pages.

Revision ID: f7a1b234c5d9
Revises: e6f0a123b4d8
Create Date: 2026-05-14 14:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR


revision = "f7a1b234c5d9"
down_revision = "e6f0a123b4d8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── masters ────────────────────────────────────────────────
    op.add_column("masters", sa.Column("specialization_tags", ARRAY(sa.String), server_default="{}"))
    op.add_column("masters", sa.Column("welcome_message", sa.Text, nullable=True))
    op.add_column("masters", sa.Column("tariff_type", sa.String(5), server_default="B"))

    # ── schedule_templates ─────────────────────────────────────
    op.alter_column("schedule_templates", "day_of_week", nullable=True)
    op.add_column("schedule_templates", sa.Column("specific_date", sa.Date, nullable=True))
    op.add_column("schedule_templates", sa.Column("slot_step_min", sa.Integer, server_default="30"))

    # ── appointments ───────────────────────────────────────────
    op.add_column("appointments", sa.Column("reminder_1d_sent", sa.Boolean, server_default="false"))
    op.add_column("appointments", sa.Column("reminder_2h_sent", sa.Boolean, server_default="false"))

    # ── services ───────────────────────────────────────────────
    op.add_column("services", sa.Column("deposit_type", sa.String(20), server_default="none"))
    op.add_column("services", sa.Column("deposit_value", sa.Float, nullable=True))

    # ── client_profiles ────────────────────────────────────────
    op.add_column("client_profiles", sa.Column("communication_pref", sa.String(20), server_default="any"))

    # ── client_master_links ────────────────────────────────────
    op.add_column("client_master_links", sa.Column("is_blocked", sa.Boolean, server_default="false"))

    # ── client_tags ────────────────────────────────────────────
    op.add_column("client_tags", sa.Column("color", sa.String(20), server_default="grey"))

    # ── client_notes ───────────────────────────────────────────
    op.add_column("client_notes", sa.Column("is_pinned", sa.Boolean, server_default="false"))

    # ── master_pages ───────────────────────────────────────────
    op.add_column("master_pages", sa.Column("show_prices", sa.Boolean, server_default="true"))
    op.add_column("master_pages", sa.Column("custom_domain", sa.String(200), nullable=True))

    # ── marketplace_listings (PostGIS + TSVECTOR) ──────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute(
        "ALTER TABLE marketplace_listings ADD COLUMN IF NOT EXISTS "
        "geo_point geometry(POINT,4326)"
    )
    op.add_column(
        "marketplace_listings",
        sa.Column("search_vector", TSVECTOR, nullable=True),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_marketplace_listings_geo "
        "ON marketplace_listings USING gist (geo_point)"
    )
    op.create_index(
        "ix_marketplace_listings_search",
        "marketplace_listings",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_marketplace_listings_search", table_name="marketplace_listings")
    op.drop_index("ix_marketplace_listings_geo", table_name="marketplace_listings")
    op.drop_column("marketplace_listings", "search_vector")
    op.drop_column("marketplace_listings", "geo_point")
    op.drop_column("master_pages", "custom_domain")
    op.drop_column("master_pages", "show_prices")
    op.drop_column("client_notes", "is_pinned")
    op.drop_column("client_tags", "color")
    op.drop_column("client_master_links", "is_blocked")
    op.drop_column("client_profiles", "communication_pref")
    op.drop_column("services", "deposit_value")
    op.drop_column("services", "deposit_type")
    op.drop_column("appointments", "reminder_2h_sent")
    op.drop_column("appointments", "reminder_1d_sent")
    op.drop_column("schedule_templates", "slot_step_min")
    op.drop_column("schedule_templates", "specific_date")
    op.alter_column("schedule_templates", "day_of_week", nullable=False)
    op.drop_column("masters", "tariff_type")
    op.drop_column("masters", "welcome_message")
    op.drop_column("masters", "specialization_tags")
