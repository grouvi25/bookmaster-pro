"""Reset orphaned superadmin identities.

Находит все identities с role='superadmin', чьи platform_id НЕ входят в
текущий SUPERADMIN_IDS из конфига, и сбрасывает им роль на 'new_pending'.
При следующем входе identify() вернёт таким пользователям role='new'
(роль вне whitelist {master, client, moderator}), и они пройдут онбординг.

Это разовая чистка данных в дополнение к правке identify(): даже без миграции
бэкенд уже не выдаёт superadmin-токен по залежавшейся роли, но миграция
приводит сами данные в БД в консистентное состояние.

Revision ID: k2c3d4e5f6a9
Revises: j1b2c3d4e5f6
Create Date: 2026-06-01
"""

from alembic import op
import sqlalchemy as sa

from app.core.config import settings


revision = "k2c3d4e5f6a9"
down_revision = "j1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    superadmin_ids = settings.superadmin_list

    identities = sa.table(
        "identities",
        sa.column("id", sa.Integer),
        sa.column("platform_id", sa.String),
        sa.column("role", sa.String),
    )

    if superadmin_ids:
        stmt = (
            sa.update(identities)
            .where(
                identities.c.role == "superadmin",
                identities.c.platform_id.notin_(superadmin_ids),
            )
            .values(role="new_pending")
        )
    else:
        # SUPERADMIN_IDS пуст — ни одна запись не должна оставаться superadmin.
        stmt = (
            sa.update(identities)
            .where(identities.c.role == "superadmin")
            .values(role="new_pending")
        )

    result = bind.execute(stmt)
    count = result.rowcount if result.rowcount is not None else 0
    print(f"[fix_superadmin_orphans] Reset {count} orphaned superadmin identity(ies).")
    print("# These users will see the onboarding on next login.")


def downgrade() -> None:
    # Необратимо по смыслу: восстановить, кто именно был superadmin, нельзя.
    # Роль 'new_pending' остаётся — пользователи просто пройдут онбординг.
    pass
