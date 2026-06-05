"""Monitoring + CRM: event_type, error_events, error_solutions

Revision ID: n5f6a7b8c9d0
Revises: m4e5f6a7b8c1
Create Date: 2026-06-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "n5f6a7b8c9d0"
down_revision = "m4e5f6a7b8c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. event_type в appointments ──────────────────────────
    op.add_column(
        "appointments",
        sa.Column(
            "event_type",
            sa.String(30),
            nullable=False,
            server_default="service",
        ),
    )

    # ── 2. error_events — агрегированные ошибки ───────────────
    op.create_table(
        "error_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fingerprint", sa.Text(), nullable=False, unique=True),
        sa.Column("error_type", sa.Text(), nullable=False),
        sa.Column("error_msg", sa.Text(), nullable=False),
        sa.Column("module", sa.Text(), nullable=True),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        sa.Column("first_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("count", sa.Integer(), server_default="1"),
        sa.Column("status", sa.String(30), server_default="new"),
        sa.Column("severity", sa.String(30), server_default="error"),
        sa.Column("request_id", sa.Text(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_error_events_status", "error_events", ["status", "severity"]
    )
    op.create_index(
        "idx_error_events_last", "error_events", [sa.text("last_seen DESC")]
    )

    # ── 3. error_solutions — база знаний решений ──────────────
    op.create_table(
        "error_solutions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("solution", sa.Text(), nullable=False),
        sa.Column("added_by", sa.String(30), nullable=True),
        sa.Column("is_verified", sa.Boolean(), server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("error_solutions")
    op.drop_index("idx_error_events_last", table_name="error_events")
    op.drop_index("idx_error_events_status", table_name="error_events")
    op.drop_table("error_events")
    op.drop_column("appointments", "event_type")
