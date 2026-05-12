"""Add consultations module: consultation_slots, consultations tables + service fields

Revision ID: c4d8e2f1a567
Revises: b3c7d5e9f012
Create Date: 2026-05-12 17:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c4d8e2f1a567"
down_revision = "b3c7d5e9f012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Consultation slots
    op.create_table(
        "consultation_slots",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "master_id",
            sa.Integer(),
            sa.ForeignKey("masters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "service_id",
            sa.Integer(),
            sa.ForeignKey("services.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("slot_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "is_available",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
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
        "idx_consultation_slots_master",
        "consultation_slots",
        ["master_id", "slot_start"],
    )

    # Consultations
    op.create_table(
        "consultations",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "master_id",
            sa.Integer(),
            sa.ForeignKey("masters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            sa.Integer(),
            sa.ForeignKey("clients.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "service_id",
            sa.Integer(),
            sa.ForeignKey("services.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "slot_id",
            sa.Integer(),
            sa.ForeignKey("consultation_slots.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("slot_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("slot_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(30), server_default="pending", nullable=False
        ),
        sa.Column("meeting_url", sa.String(500), nullable=True),
        sa.Column("client_note", sa.Text(), nullable=True),
        sa.Column("master_note", sa.Text(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column(
            "converted_appointment_id",
            sa.Integer(),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.String(300), nullable=True),
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
        "idx_consultations_master_status",
        "consultations",
        ["master_id", "status"],
    )
    op.create_index(
        "idx_consultations_client",
        "consultations",
        ["client_id"],
    )

    # Add consultation fields to services table
    op.add_column(
        "services",
        sa.Column(
            "is_consultation",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "services",
        sa.Column("consultation_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("services", "consultation_url")
    op.drop_column("services", "is_consultation")
    op.drop_index("idx_consultations_client", table_name="consultations")
    op.drop_index(
        "idx_consultations_master_status", table_name="consultations"
    )
    op.drop_table("consultations")
    op.drop_index(
        "idx_consultation_slots_master", table_name="consultation_slots"
    )
    op.drop_table("consultation_slots")
