"""Add legal document keys to system_settings (Robokassa compliance).

Revision ID: u2v3w4x5y6z7
Revises: t1u2v3w4x5y6
Create Date: 2026-06-19

Keys added:
- legal_terms_of_service   — условия оказания услуг
- legal_payment_conditions — условия оплаты и возврата
- legal_entity_name        — наименование юр. лица (ИП Фамилия Имя)
- legal_entity_inn         — ИНН / ОГРНИП
"""

from alembic import op
from sqlalchemy import text

revision = "u2v3w4x5y6z7"
down_revision = "t1u2v3w4x5y6"
branch_labels = None
depends_on = None

LEGAL_KEYS = [
    ("legal_terms_of_service", "string", "Условия оказания услуг (текст для страницы /legal/terms)"),
    ("legal_payment_conditions", "string", "Условия оплаты и возврата (текст для страницы /legal/payment)"),
    ("legal_entity_name", "string", "Наименование юр. лица (напр. ИП Иванов Иван Иванович)"),
    ("legal_entity_inn", "string", "ИНН / ОГРНИП юридического лица"),
]


def upgrade() -> None:
    conn = op.get_bind()
    for key, type_, description in LEGAL_KEYS:
        exists = conn.execute(
            text("SELECT 1 FROM system_settings WHERE key = :k"),
            {"k": key},
        ).scalar()
        if not exists:
            conn.execute(
                text(
                    "INSERT INTO system_settings (key, value, type, description) "
                    "VALUES (:k, '', :t, :d)"
                ),
                {"k": key, "t": type_, "d": description},
            )


def downgrade() -> None:
    conn = op.get_bind()
    for key, _, _ in LEGAL_KEYS:
        conn.execute(
            text("DELETE FROM system_settings WHERE key = :k"),
            {"k": key},
        )
