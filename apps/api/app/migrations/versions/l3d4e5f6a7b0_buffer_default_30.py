"""Set buffer_minutes default to 30 and backfill existing masters.

Меняем server_default поля masters.buffer_minutes с 0 на 30 (время на
уборку/подготовку после визита по умолчанию) и обновляем существующих
мастеров, у которых буфер ещё не настроен (buffer_minutes = 0).

Revision ID: l3d4e5f6a7b0
Revises: k2c3d4e5f6a9
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa


revision = "l3d4e5f6a7b0"
down_revision = "k2c3d4e5f6a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "masters",
        "buffer_minutes",
        existing_type=sa.Integer(),
        server_default="30",
    )
    # Обновляем существующих мастеров, у которых буфер не настроен.
    op.execute("UPDATE masters SET buffer_minutes = 30 WHERE buffer_minutes = 0")


def downgrade() -> None:
    op.alter_column(
        "masters",
        "buffer_minutes",
        existing_type=sa.Integer(),
        server_default="0",
    )
