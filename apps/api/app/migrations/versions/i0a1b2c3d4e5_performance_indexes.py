"""
Add performance indexes on hot queries.

Revision ID: i0a1b2c3d4e5
Revises: h9c3d4e5f6a8
Create Date: 2026-05-21

Индексы на таблицы, к которым идут частые запросы:
- appointments: master_id+date+status (слоты, дашборд, расписание)
- appointments: client_id+status (мои записи)
- appointments: status+created_at (scheduler cleanup)
- payments: master_id+status+created_at (финансовая аналитика)
- payments: yookassa_payment_id (webhook lookup)
- loyalty_transactions: master_id+client_id (баланс, история)
- client_master_links: last_visit_date (реактивация)
- waitlist_entries: status+created_at (scheduler)
- support_tickets: status+priority (модерация)
"""

from alembic import op

# revision identifiers
revision = "i0a1b2c3d4e5"
down_revision = "h9c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Appointments (самая горячая таблица) ──
    op.create_index(
        "idx_appointments_master_date_status",
        "appointments",
        ["master_id", "date", "status"],
    )
    op.create_index(
        "idx_appointments_client_status",
        "appointments",
        ["client_id", "status"],
    )
    op.create_index(
        "idx_appointments_status_created",
        "appointments",
        ["status", "created_at"],
    )

    # ── Payments ──
    op.create_index(
        "idx_payments_master_status_created",
        "payments",
        ["master_id", "status", "created_at"],
    )
    op.create_index(
        "idx_payments_yookassa_id",
        "payments",
        ["yookassa_payment_id"],
        unique=False,
    )

    # ── Loyalty ──
    op.create_index(
        "idx_loyalty_tx_master_client",
        "loyalty_transactions",
        ["master_id", "client_id"],
    )
    op.create_index(
        "idx_loyalty_accounts_master_client",
        "loyalty_accounts",
        ["master_id", "client_id"],
        unique=True,
    )

    # ── Client master links ──
    op.create_index(
        "idx_client_master_links_last_visit",
        "client_master_links",
        ["last_visit_date"],
    )

    # ── Waitlist ──
    op.create_index(
        "idx_waitlist_status_created",
        "waitlist_entries",
        ["status", "created_at"],
    )

    # ── Support tickets ──
    op.create_index(
        "idx_support_tickets_status_priority",
        "support_tickets",
        ["status", "priority"],
    )


def downgrade() -> None:
    op.drop_index("idx_support_tickets_status_priority", table_name="support_tickets")
    op.drop_index("idx_waitlist_status_created", table_name="waitlist_entries")
    op.drop_index("idx_client_master_links_last_visit", table_name="client_master_links")
    op.drop_index("idx_loyalty_accounts_master_client", table_name="loyalty_accounts")
    op.drop_index("idx_loyalty_tx_master_client", table_name="loyalty_transactions")
    op.drop_index("idx_payments_yookassa_id", table_name="payments")
    op.drop_index("idx_payments_master_status_created", table_name="payments")
    op.drop_index("idx_appointments_status_created", table_name="appointments")
    op.drop_index("idx_appointments_client_status", table_name="appointments")
    op.drop_index("idx_appointments_master_date_status", table_name="appointments")
