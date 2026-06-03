"""agent scheme: payout fields + master_payouts table

Revision ID: m4e5f6a7b8c1
Revises: f7a1b2c3d4e5
Create Date: 2026-06-03 19:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "m4e5f6a7b8c1"
down_revision = "f7a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Поля для выплат в таблицу masters
    op.add_column("masters", sa.Column("payout_phone", sa.String(20), nullable=True))
    op.add_column("masters", sa.Column("payout_card", sa.String(20), nullable=True))
    op.add_column("masters", sa.Column("inn", sa.String(12), nullable=True))
    op.add_column(
        "masters",
        sa.Column("agent_agreement_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Таблица выплат мастерам
    op.create_table(
        "master_payouts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id"), nullable=False),
        sa.Column("master_id", sa.Integer(), sa.ForeignKey("masters.id"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(20), server_default="scheduled", nullable=False),
        sa.Column("scheduled_for", sa.Date(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("tbank_payment_id", sa.String(100), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
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
    op.create_index("ix_master_payouts_status_date", "master_payouts", ["status", "scheduled_for"])
    op.create_index("ix_master_payouts_master_id", "master_payouts", ["master_id"])


def downgrade() -> None:
    op.drop_index("ix_master_payouts_master_id", table_name="master_payouts")
    op.drop_index("ix_master_payouts_status_date", table_name="master_payouts")
    op.drop_table("master_payouts")
    op.drop_column("masters", "agent_agreement_at")
    op.drop_column("masters", "inn")
    op.drop_column("masters", "payout_card")
    op.drop_column("masters", "payout_phone")
