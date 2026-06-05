"""
Auth service — identify user, register, create JWT.
"""

import re
from datetime import date, time, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, is_superadmin
from app.modules.auth.models import Identity
from app.modules.masters.models import Master
from app.modules.clients.models import Client
from app.modules.core.models import AccessGrant, FeatureFlags
from app.modules.booking.models import ScheduleTemplate


_TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def _transliterate(text: str) -> str:
    result = []
    for ch in text.lower():
        result.append(_TRANSLIT.get(ch, ch))
    return "".join(result)


def generate_slug(display_name: str, identity_id: int) -> str:
    slug = _transliterate(display_name)
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug.strip())
    if not slug:
        slug = "master"
    return f"{slug}-{identity_id}"


# Роли, которым identify() доверяет из БД напрямую. Любая другая роль
# (включая залежавшийся 'superadmin') НЕ выдаётся без проверки SUPERADMIN_IDS.
_VALID_USER_ROLES = {"master", "client", "moderator", "superadmin", "new"}


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def identify(
        self, platform: str, platform_id: str
    ) -> dict:
        """
        Определить роль пользователя.
        Возвращает роль + JWT токен если пользователь существует.
        """
        # Проверяем суперадмина
        if is_superadmin(platform_id):
            # Проверяем есть ли identity
            identity = await self._get_identity(platform, platform_id)
            if identity:
                token = self._create_token(identity, "superadmin")
                return {
                    "role": "superadmin",
                    "token": token,
                    "user_id": identity.id,
                    "display_name": "SuperAdmin",
                    "master_id": None,
                }
            # Автоматически создаём identity для суперадмина
            identity = Identity(
                platform=platform,
                platform_id=platform_id,
                role="superadmin",
            )
            self.db.add(identity)
            await self.db.flush()
            token = self._create_token(identity, "superadmin")
            return {
                "role": "superadmin",
                "token": token,
                "user_id": identity.id,
                "display_name": "SuperAdmin",
                "master_id": None,
            }

        # Ищем существующего пользователя (с кросс-платформенной привязкой)
        found, primary = await self._get_primary_identity(platform, platform_id)
        if not found:
            return {"role": "new", "token": None, "user_id": None, "display_name": None, "master_id": None}

        # Забаненный пользователь — без токена.
        # Проверяем оба: и найденный и первичный
        if found.is_banned or primary.is_banned:
            return {"role": "banned", "token": None, "user_id": found.id, "display_name": None, "master_id": None}

        # Жёсткая привязка привилегий к конфигу: если в БД осталась роль
        # 'superadmin' (или любая другая вне whitelist), но platform_id уже
        # не в SUPERADMIN_IDS — НЕ доверяем БД. Пользователь проходит онбординг.
        # Если роль "new" — пользователь не зарегистрирован, не выдаём токен.
        if primary.role == "new":
            return {"role": "new", "token": None, "user_id": found.id, "display_name": None, "master_id": None}

        if primary.role not in _VALID_USER_ROLES:
            return {"role": "new", "token": None, "user_id": found.id, "display_name": None, "master_id": None}

        # Получаем display_name и токен от ПЕРВИЧНОЙ идентичности
        display_name = await self._get_display_name(primary)
        token = self._create_token(primary, primary.role)

        master_id = None
        if primary.role == "master":
            result = await self.db.execute(
                select(Master).where(Master.identity_id == primary.id)
            )
            master = result.scalar_one_or_none()
            if master:
                master_id = master.id
            else:
                # Master-запись удалена (через суперадмин-панель) — пользователь
                # должен пройти онбординг заново как новый.
                return {"role": "new", "token": None, "user_id": found.id, "display_name": None, "master_id": None}

        return {
            "role": primary.role,
            "token": token,
            "user_id": primary.id,
            "display_name": display_name,
            "master_id": master_id,
            "is_secondary": found.id != primary.id,
        }

    async def register(
        self,
        platform: str,
        platform_id: str,
        role: str,
        display_name: str,
        specialization: Optional[str] = None,
        phone: Optional[str] = None,
        city: Optional[str] = None,
    ) -> dict:
        """Регистрация нового мастера или клиента."""
        # Проверяем что identity не существует
        existing = await self._get_identity(platform, platform_id)
        if existing:
            # Если Identity осталась после удаления мастера (orphan) —
            # удаляем её и разрешаем повторную регистрацию.
            is_orphan = False
            if existing.role == "master":
                m = (await self.db.execute(
                    select(Master).where(Master.identity_id == existing.id)
                )).scalar_one_or_none()
                if not m:
                    is_orphan = True
            elif existing.role == "client":
                c = (await self.db.execute(
                    select(Client).where(Client.identity_id == existing.id)
                )).scalar_one_or_none()
                if not c:
                    is_orphan = True
            elif existing.role not in _VALID_USER_ROLES:
                # Невалидная роль — тоже orphan
                is_orphan = True

            if is_orphan:
                await self.db.delete(existing)
                await self.db.flush()
            else:
                raise ValueError("User already registered")

        # Создаём identity
        identity = Identity(
            platform=platform,
            platform_id=platform_id,
            role=role,
        )
        self.db.add(identity)
        await self.db.flush()

        if role == "master":
            slug = generate_slug(display_name, identity.id)
            master = Master(
                identity_id=identity.id,
                display_name=display_name,
                slug=slug,
                specialization=specialization,
                phone=phone,
                city=city,
            )
            self.db.add(master)
            await self.db.flush()

            # Создаём feature flags с полным Pro-доступом (пробный период)
            flags = FeatureFlags(
                master_id=master.id,
                crm_basic=True,
                crm_advanced=True,
                promo_enabled=True,
                loyalty_enabled=True,
                client_subscriptions=True,
                waitlist_enabled=True,
                analytics_enabled=True,
                ai_advisor=True,
                ai_client_bot=True,
                ai_voice=True,
                portfolio_enabled=True,
                marketplace_enabled=True,
                widget_enabled=True,
                consultations_enabled=True,
                reviews_enabled=True,
                broadcast_enabled=True,
                max_bookings_per_month=999,
                max_services=50,
                ai_tokens_monthly=50000,
            )
            self.db.add(flags)

            # Пробный период 14 дней — план Pro
            trial_grant = AccessGrant(
                master_id=master.id,
                grant_type="trial",
                plan="pro",
                valid_until=date.today() + timedelta(days=14),
                granted_by="system",
                note="Пробный период 14 дней при регистрации",
            )
            self.db.add(trial_grant)

            # Расписание по умолчанию Пн-Сб 9:00-18:00
            for dow in range(6):
                tmpl = ScheduleTemplate(
                    master_id=master.id,
                    day_of_week=dow,
                    start_time=time(9, 0),
                    end_time=time(18, 0),
                    break_start=time(13, 0),
                    break_end=time(14, 0),
                    is_active=True,
                )
                self.db.add(tmpl)

        elif role == "client":
            client = Client(
                identity_id=identity.id,
                display_name=display_name,
                phone=phone,
            )
            self.db.add(client)

        await self.db.flush()
        token = self._create_token(identity, role)

        return {
            "role": role,
            "token": token,
            "user_id": identity.id,
            "display_name": display_name,
        }

    async def _get_identity(
        self, platform: str, platform_id: str
    ) -> Optional[Identity]:
        result = await self.db.execute(
            select(Identity).where(
                Identity.platform == platform,
                Identity.platform_id == platform_id,
            )
        )
        return result.scalar_one_or_none()


    async def _get_primary_identity(
        self, platform: str, platform_id: str
    ) -> tuple:
        """
        Кросс-платформенная идентификация.
        Возвращает (found_identity, primary_identity).
        Если не привязан: оба = одна identity.
        Если вторичный: found=вторичная, primary=первичная.
        """
        identity = await self._get_identity(platform, platform_id)
        if not identity:
            return None, None

        if identity.linked_identity_id:
            # Вторичная — загружаем первичную
            result = await self.db.execute(
                select(Identity).where(Identity.id == identity.linked_identity_id)
            )
            primary = result.scalar_one_or_none()
            if not primary:
                # Первичная удалена — сбрасываем ссылку
                identity.linked_identity_id = None
                await self.db.flush()
                return identity, identity
            return identity, primary

        return identity, identity  # первичная = она сама

    async def _get_display_name(self, identity: Identity) -> str:
        if identity.role == "master":
            result = await self.db.execute(
                select(Master).where(Master.identity_id == identity.id)
            )
            master = result.scalar_one_or_none()
            return master.display_name if master else "Master"
        elif identity.role == "client":
            result = await self.db.execute(
                select(Client).where(Client.identity_id == identity.id)
            )
            client = result.scalar_one_or_none()
            return client.display_name if client else "Client"
        return identity.role

    async def switch_role(self, identity_id: int, target_role: str) -> dict:
        """Switch superadmin to master/client role.
        Auto-creates Master/Client record if missing.
        """
        result = await self.db.execute(
            select(Identity).where(Identity.id == identity_id)
        )
        identity = result.scalar_one_or_none()
        if not identity:
            raise ValueError("Identity not found")

        display_name = "SuperAdmin"
        master_id = None

        if target_role == "superadmin":
            token = self._create_token(identity, "superadmin")
            return {
                "role": "superadmin",
                "token": token,
                "user_id": identity.id,
                "display_name": display_name,
                "master_id": None,
            }

        if target_role == "master":
            result = await self.db.execute(
                select(Master).where(Master.identity_id == identity.id)
            )
            master = result.scalar_one_or_none()
            if not master:
                slug = generate_slug("Admin Master", identity.id)
                master = Master(
                    identity_id=identity.id,
                    display_name="Admin Master",
                    slug=slug,
                    specialization="Тестирование",
                    city="Москва",
                )
                self.db.add(master)
                await self.db.flush()
                flags = FeatureFlags(
                    master_id=master.id,
                    crm_basic=True,
                    crm_advanced=True,
                    promo_enabled=True,
                    loyalty_enabled=True,
                    client_subscriptions=True,
                    waitlist_enabled=True,
                    analytics_enabled=True,
                    ai_advisor=True,
                    ai_client_bot=True,
                    ai_voice=True,
                    portfolio_enabled=True,
                    widget_enabled=True,
                    consultations_enabled=True,
                    multi_location=True,
                    reviews_enabled=True,
                    broadcast_enabled=True,
                    max_bookings_per_month=9999,
                    max_services=999,
                    max_locations=99,
                    ai_tokens_monthly=100000,
                )
                self.db.add(flags)
                await self.db.flush()
            # Ensure schedule templates exist (for new and existing masters)
            sched_result = await self.db.execute(
                select(ScheduleTemplate).where(
                    ScheduleTemplate.master_id == master.id
                ).limit(1)
            )
            if not sched_result.scalar_one_or_none():
                for dow in range(6):  # Mon-Sat
                    tmpl = ScheduleTemplate(
                        master_id=master.id,
                        day_of_week=dow,
                        start_time=time(9, 0),
                        end_time=time(20, 0),
                        break_start=time(13, 0),
                        break_end=time(14, 0),
                        is_active=True,
                    )
                    self.db.add(tmpl)
                await self.db.flush()
            display_name = master.display_name
            master_id = master.id
            token = self._create_token(identity, "master")

        elif target_role == "client":
            result = await self.db.execute(
                select(Client).where(Client.identity_id == identity.id)
            )
            client = result.scalar_one_or_none()
            if not client:
                client = Client(
                    identity_id=identity.id,
                    display_name="Admin Client",
                )
                self.db.add(client)
                await self.db.flush()
            display_name = client.display_name
            token = self._create_token(identity, "client")

        else:
            raise ValueError(f"Invalid role: {target_role}")

        await self.db.commit()
        return {
            "role": target_role,
            "token": token,
            "user_id": identity.id,
            "display_name": display_name,
            "master_id": master_id,
        }

    def _create_token(self, identity: Identity, role: str) -> str:
        return create_access_token(
            data={
                "sub": str(identity.id),
                "identity_id": identity.id,
                "platform": identity.platform,
                "platform_id": identity.platform_id,
                "role": role,
            }
        )
