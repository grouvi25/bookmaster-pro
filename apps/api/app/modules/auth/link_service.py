"""
Account link service — кросс-платформенная привязка аккаунтов.
Один пользователь → несколько платформ → одни данные.
"""

import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import Identity, IdentityLinkCode
from app.modules.masters.models import Master
from app.modules.clients.models import Client

LINK_CODE_TTL_MINUTES = 15


class AccountLinkService:

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Генерация кода ────────────────────────────────────────────

    async def generate_link_code(self, identity_id: int) -> str:
        """
        Генерирует 6-значный код привязки.
        Пользователь вводит его в другом мессенджере.
        Код действует 15 минут, одноразовый.
        """
        # Инвалидируем старые коды этой идентичности
        await self.db.execute(
            update(IdentityLinkCode)
            .where(
                IdentityLinkCode.identity_id == identity_id,
                IdentityLinkCode.used == False,  # noqa: E712
            )
            .values(used=True)
        )

        # Генерируем уникальный код
        code = ""
        for _ in range(10):  # макс 10 попыток
            code = "".join(random.choices(string.digits, k=6))
            existing = await self.db.execute(
                select(IdentityLinkCode).where(
                    IdentityLinkCode.code == code,
                    IdentityLinkCode.used == False,  # noqa: E712
                )
            )
            if not existing.scalar_one_or_none():
                break

        link_code = IdentityLinkCode(
            code=code,
            identity_id=identity_id,
            expires_at=datetime.now(timezone.utc)
            + timedelta(minutes=LINK_CODE_TTL_MINUTES),
        )
        self.db.add(link_code)
        await self.db.flush()
        return code

    # ── Применение кода ───────────────────────────────────────────

    async def apply_link_code(
        self,
        code: str,
        current_identity_id: int,
    ) -> dict:
        """
        Пользователь вводит код на Платформе B.
        Текущая идентичность (Platform B) привязывается
        к первичной (Platform A).
        """
        # Находим код
        result = await self.db.execute(
            select(IdentityLinkCode).where(
                IdentityLinkCode.code == code,
                IdentityLinkCode.used == False,  # noqa: E712
            )
        )
        link_code = result.scalar_one_or_none()

        if not link_code:
            raise ValueError("Код не найден или уже использован")

        if link_code.expires_at < datetime.now(timezone.utc):
            raise ValueError("Код истёк. Сгенерируйте новый.")

        if link_code.identity_id == current_identity_id:
            raise ValueError("Нельзя привязать аккаунт к самому себе")

        # Определяем первичную идентичность (владелец кода)
        primary = await self.db.get(Identity, link_code.identity_id)
        if not primary:
            raise ValueError("Аккаунт не найден")

        # Если владелец кода сам вторичный — берём его primary
        if primary.linked_identity_id:
            real_primary = await self.db.get(Identity, primary.linked_identity_id)
            if real_primary:
                primary = real_primary

        # Проверяем конфликт (оба — мастера или оба — клиенты с данными)
        current = await self.db.get(Identity, current_identity_id)
        if not current:
            raise ValueError("Текущий аккаунт не найден")

        conflict = await self._check_conflict(primary, current)
        if conflict:
            raise ValueError(
                f"Оба аккаунта уже зарегистрированы как {conflict}. "
                f"Обратитесь в поддержку для объединения данных."
            )

        # Привязываем текущую идентичность к первичной
        current.linked_identity_id = primary.id
        current.role = primary.role  # синхронизируем роль

        # Помечаем код использованным
        link_code.used = True

        await self.db.flush()

        return {
            "status": "linked",
            "primary_platform": primary.platform,
            "message": f"Аккаунт успешно привязан к профилю в {primary.platform.title()}",
        }

    # ── Отвязка ───────────────────────────────────────────────────

    async def unlink_account(self, secondary_identity_id: int) -> None:
        """Отвязать вторичную платформу от первичной.
        Сбрасывает роль на 'new' и удаляет stale master/client записи,
        чтобы при следующем identify() юзер попал на Register.
        """
        identity = await self.db.get(Identity, secondary_identity_id)
        if not identity or not identity.linked_identity_id:
            raise ValueError("Этот аккаунт не является вторичным")

        # Удаляем master/client записи вторичной identity (если есть).
        # Реальные данные всегда на primary, здесь только дубли.
        from sqlalchemy import delete as sa_delete
        await self.db.execute(
            sa_delete(Master).where(Master.identity_id == secondary_identity_id)
        )
        await self.db.execute(
            sa_delete(Client).where(Client.identity_id == secondary_identity_id)
        )

        identity.linked_identity_id = None
        identity.role = "new"  # после отвязки — новый пользователь
        await self.db.flush()

    # ── Список платформ ───────────────────────────────────────────

    async def get_linked_platforms(self, primary_id: int) -> list[dict]:
        """Все платформы привязанные к этой первичной идентичности."""
        primary = await self.db.get(Identity, primary_id)
        if not primary:
            return []

        result = await self.db.execute(
            select(Identity.id, Identity.platform).where(
                Identity.linked_identity_id == primary_id
            )
        )
        secondary = result.all()

        platforms = [
            {"platform": primary.platform, "is_primary": True, "identity_id": primary.id}
        ]
        for sid, splatform in secondary:
            platforms.append(
                {"platform": splatform, "is_primary": False, "identity_id": sid}
            )

        return platforms

    # ── Проверка конфликта ────────────────────────────────────────

    async def _check_conflict(
        self, primary: Identity, current: Identity
    ) -> Optional[str]:
        """Проверяем нет ли конфликта (оба — мастера или оба — клиенты с данными)."""
        # Если текущий — новый (role='new') — конфликта нет
        if current.role in ("new", "new_pending", "client"):
            # Клиентов можно мержить автоматически (или просто привязать)
            # Проверяем только мастер-конфликт
            return None

        if current.role == "master" and primary.role == "master":
            # Оба мастера — проверяем есть ли реально Master записи
            r1 = await self.db.execute(
                select(Master).where(Master.identity_id == primary.id)
            )
            r2 = await self.db.execute(
                select(Master).where(Master.identity_id == current.id)
            )
            if r1.scalar_one_or_none() and r2.scalar_one_or_none():
                return "мастер"

        return None
