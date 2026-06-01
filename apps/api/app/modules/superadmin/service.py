"""
Superadmin service — платформенная аналитика, управление мастерами,
реальный health-check (ТЗ 12.2), полный dashboard (ТЗ 12.3), broadcast.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case

from app.modules.masters.models import Master
from app.modules.auth.models import Identity
from app.modules.booking.models import Appointment
from app.modules.payments.models import Payment, MasterSubscription
from app.modules.clients.models import Client
from app.modules.superadmin.models import AdminAuditLog
from app.core.config import settings

logger = logging.getLogger(__name__)

from app.modules.payments.service import PLAN_PRICES  # noqa: E402 — single source of truth


# Допустимые ключи системных настроек, которые SA может менять без деплоя.
# Соответствует ТЗ 8.5 / 12.3: AI-провайдер, тарифы, комиссии, лимиты,
# поддержка, окружение.
ALLOWED_SETTINGS_KEYS = {
    "ai_provider",                # openai | yandexgpt
    "ai_default_model",
    "ai_fallback_enabled",        # 'true' | 'false'
    "timezone",
    "commission_default_bp",      # 0..10000
    "max_free_bookings",
    "min_plan_price",
    "support_email",
    "support_telegram",
    "marketplace_featured_price", # руб/мес
    "trial_duration_days",        # 1..90
    "platform_fee_percent",
    "maintenance_mode",           # 'true' | 'false'
    "maintenance_message",
}


# SLA пороги (часы)
SLA_FIRST_RESPONSE_HIGH_H = 1     # high priority: первый ответ
SLA_FIRST_RESPONSE_MEDIUM_H = 4
SLA_FIRST_RESPONSE_LOW_H = 24
SLA_RESOLVE_HIGH_H = 24
SLA_RESOLVE_MEDIUM_H = 72
SLA_RESOLVE_LOW_H = 168


class SuperadminService:

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Дашборд (ТЗ 12.3) ────────────────────────────────────

    async def get_dashboard(self) -> dict:
        """Полный дашборд платформы согласно ТЗ 12.3 + 8.5."""
        from app.modules.support.models import SupportTicket
        from app.modules.nps.models import NPSSurvey

        now = datetime.now(timezone.utc)
        today = now.date()
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)
        month_start = today.replace(day=1)

        # Total / active / new masters
        total_masters = (await self.db.execute(
            select(func.count(Master.id))
        )).scalar() or 0

        active_masters = (await self.db.execute(
            select(func.count(func.distinct(Appointment.master_id)))
            .where(Appointment.created_at >= month_ago)
        )).scalar() or 0

        new_masters_30d = (await self.db.execute(
            select(func.count(Master.id)).where(Master.created_at >= month_ago)
        )).scalar() or 0

        new_masters_week = (await self.db.execute(
            select(func.count(Master.id)).where(Master.created_at >= week_ago)
        )).scalar() or 0

        # Clients
        total_clients = (await self.db.execute(
            select(func.count(Client.id))
        )).scalar() or 0

        # Appointments
        total_appointments = (await self.db.execute(
            select(func.count(Appointment.id))
        )).scalar() or 0

        # ТЗ 8.5: записей сегодня
        today_bookings = (await self.db.execute(
            select(func.count(Appointment.id)).where(Appointment.date == today)
        )).scalar() or 0

        # Total revenue за всё время
        total_revenue = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0))
            .where(Payment.status == "succeeded")
        )).scalar() or 0)

        # Месячная выручка (сумма платежей за текущий календарный месяц)
        month_revenue = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0))
            .where(
                Payment.status == "succeeded",
                Payment.created_at >= month_ago,
            )
        )).scalar() or 0)

        # ТЗ 12.3: Transaction Revenue — комиссии с оплат (тариф A)
        # = сумма amount_service за месяц
        transaction_revenue_month = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_service), 0))
            .where(
                Payment.status == "succeeded",
                Payment.created_at >= month_start,
            )
        )).scalar() or 0)

        # MRR — активные подписки тарифа B
        mrr = float((await self.db.execute(
            select(func.coalesce(func.sum(MasterSubscription.price), 0))
            .where(MasterSubscription.status == "active")
        )).scalar() or 0)

        # Plan distribution
        plan_r = await self.db.execute(
            select(Master.current_plan, func.count(Master.id))
            .group_by(Master.current_plan)
        )
        plan_distribution = {(row[0] or "start"): row[1] for row in plan_r.all()}

        # Churn rate (мастера без активности за 30 дней)
        churn_rate = 0.0
        if total_masters > 0:
            inactive = total_masters - active_masters
            churn_rate = round(inactive / total_masters * 100, 1)

        # ТЗ 12.3: Конверсия регистрации = identities → масте́р создал первую запись
        # Считаем долю мастеров, у которых есть хотя бы один appointment
        masters_with_bookings = (await self.db.execute(
            select(func.count(func.distinct(Appointment.master_id)))
        )).scalar() or 0
        conversion_rate = (
            round(masters_with_bookings / total_masters * 100, 1)
            if total_masters else 0.0
        )

        # ТЗ 12.3: LTV — средняя выручка с мастера за всё время
        # Рассматриваем все succeeded payments агрегированные по мастеру
        ltv_avg = 0.0
        if total_masters > 0:
            ltv_r = await self.db.execute(
                select(
                    func.coalesce(func.sum(Payment.amount_paid), 0)
                ).where(Payment.status == "succeeded")
            )
            total_paid = float(ltv_r.scalar() or 0)
            ltv_avg = round(total_paid / total_masters, 2)

        # ТЗ 12.3: NPS мастеров — текущий квартал
        nps_quarter = f"{today.year}-Q{(today.month - 1) // 3 + 1}"
        nps_responses = (await self.db.execute(
            select(NPSSurvey.score).where(
                NPSSurvey.quarter == nps_quarter,
                NPSSurvey.status == "responded",
                NPSSurvey.score.isnot(None),
            )
        )).scalars().all()
        nps_score = self._calculate_nps(list(nps_responses))

        # Open tickets + SLA breach
        open_tickets = (await self.db.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.in_(["open", "in_progress", "waiting_user"])
            )
        )).scalar() or 0

        sla_breached = await self._count_sla_breached_tickets()

        # Записи по дням за 30 дней
        days_r = await self.db.execute(
            select(
                Appointment.date,
                func.count(Appointment.id),
            )
            .where(Appointment.date >= month_ago.date())
            .group_by(Appointment.date)
            .order_by(Appointment.date)
        )
        appointments_by_day = [
            {"date": str(row[0]), "count": row[1]} for row in days_r.all()
        ]

        return {
            # Финансы
            "mrr": mrr,
            "arr": mrr * 12,
            "month_revenue": month_revenue,
            "total_revenue": total_revenue,
            "transaction_revenue_month": transaction_revenue_month,
            "avg_revenue_per_master": (
                round(total_revenue / total_masters, 2) if total_masters else 0
            ),
            "ltv_avg": ltv_avg,

            # Мастера / клиенты
            "total_masters": total_masters,
            "active_masters": active_masters,
            "new_masters_30d": new_masters_30d,
            "new_masters_week": new_masters_week,
            "total_clients": total_clients,
            "plan_distribution": plan_distribution,

            # Записи
            "total_appointments": total_appointments,
            "today_bookings": today_bookings,
            "appointments_by_day": appointments_by_day,

            # Воронка / удержание
            "churn_rate_30d": churn_rate,
            "conversion_rate": conversion_rate,

            # Поддержка
            "open_tickets": open_tickets,
            "sla_breached_tickets": sla_breached,

            # NPS
            "nps_score": nps_score,
            "nps_quarter": nps_quarter,
            "nps_responses": len(nps_responses),
        }

    @staticmethod
    def _calculate_nps(scores: List[int]) -> Optional[float]:
        """NPS = % промоутеров (9-10) − % детракторов (0-6)."""
        if not scores:
            return None
        promoters = sum(1 for s in scores if s >= 9)
        detractors = sum(1 for s in scores if s <= 6)
        return round((promoters - detractors) / len(scores) * 100, 1)

    async def _count_sla_breached_tickets(self) -> int:
        """Тикеты, у которых нарушен SLA (нет первого ответа дольше нормы)."""
        from app.modules.support.models import SupportTicket
        now = datetime.now(timezone.utc)

        priorities = [
            ("high", SLA_FIRST_RESPONSE_HIGH_H),
            ("medium", SLA_FIRST_RESPONSE_MEDIUM_H),
            ("low", SLA_FIRST_RESPONSE_LOW_H),
        ]
        total = 0
        for priority, hours_limit in priorities:
            cutoff = now - timedelta(hours=hours_limit)
            r = await self.db.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.status == "open",
                    SupportTicket.priority == priority,
                    SupportTicket.first_response_at.is_(None),
                    SupportTicket.created_at < cutoff,
                )
            )
            total += int(r.scalar() or 0)
        return total

    # ── Управление мастерами ─────────────────────────────────

    async def get_masters_list(
        self,
        plan_filter: Optional[str] = None,
        verified_filter: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[Master], int]:
        q = select(Master)
        count_q = select(func.count(Master.id))

        if plan_filter:
            q = q.where(Master.current_plan == plan_filter)
            count_q = count_q.where(Master.current_plan == plan_filter)
        if verified_filter is not None:
            q = q.where(Master.is_verified == verified_filter)
            count_q = count_q.where(Master.is_verified == verified_filter)
        if search:
            like = f"%{search}%"
            q = q.where(Master.display_name.ilike(like))
            count_q = count_q.where(Master.display_name.ilike(like))

        q = q.order_by(Master.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

        masters = list((await self.db.execute(q)).scalars().all())
        total = (await self.db.execute(count_q)).scalar() or 0
        return masters, total

    async def update_master(
        self,
        master_id: int,
        is_verified: Optional[bool] = None,
        is_active: Optional[bool] = None,
        current_plan: Optional[str] = None,
        admin_id: str = "system",
    ) -> Optional[Master]:
        master = await self.db.get(Master, master_id)
        if not master:
            return None

        changes = {}
        if is_verified is not None:
            master.is_verified = is_verified
            changes["is_verified"] = is_verified
        if is_active is not None:
            master.is_active = is_active
            changes["is_active"] = is_active
        if current_plan is not None:
            master.current_plan = current_plan
            changes["current_plan"] = current_plan

        if changes:
            await self.log_action(
                admin_id=admin_id,
                action="update_master",
                entity_type="master",
                entity_id=master_id,
                payload=changes,
            )

        await self.db.flush()
        return master

    # ── Health Check (ТЗ 12.2) ───────────────────────────────

    async def run_health_checks(self) -> dict:
        """Реальные проверки сервисов с измерением времени отклика.

        ТЗ 12.2:
        - PostgreSQL: ping + время запроса
        - Redis: ping + SET/GET round-trip
        - TG Bot: getMe (минимально валидный тест без побочных эффектов)
        - MAX: GET /health (если webhook не настроен — not_configured)
        - ЮKassa: getMe (Configuration + me-эндпоинт)
        - OpenAI: minimal completion
        - Yandex STT: проверка credentials (полный тест аудио — слишком дорого
          для health-эндпоинта, делаем validate-токен)
        - S3: Upload + Download тест-файла
        - Scheduler: количество задач в Redis jobstore
        """
        # Запускаем все проверки конкурентно — health-эндпоинт должен быть быстрым
        tasks = [
            ("database", self._check_database()),
            ("redis", self._check_redis()),
            ("scheduler", self._check_scheduler()),
            ("s3", self._check_s3()),
            ("openai", self._check_openai()),
            ("yandex_gpt", self._check_yandex_gpt()),
            ("yandex_stt", self._check_yandex_stt()),
            ("yookassa", self._check_yookassa()),
            ("telegram_bot", self._check_telegram_bot()),
            ("max_bot", self._check_max_bot()),
        ]
        results = await asyncio.gather(
            *[t[1] for t in tasks], return_exceptions=True
        )

        checks = {}
        for (name, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                checks[name] = {"status": "error", "detail": str(result)}
            else:
                checks[name] = result

        # Общий статус
        statuses = [c.get("status") for c in checks.values()]
        if all(s == "ok" or s == "not_configured" for s in statuses):
            overall = "healthy"
        elif any(s == "error" for s in statuses):
            overall = "degraded"
        else:
            overall = "ok"

        return {
            "status": overall,
            "checks": checks,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }

    async def _check_database(self) -> dict:
        try:
            t0 = time.perf_counter()
            r = await self.db.execute(select(func.now()))
            r.scalar()
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {"status": "ok", "response_time_ms": elapsed_ms}
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_redis(self) -> dict:
        try:
            from app.core.redis import get_redis
            redis = await get_redis()
            t0 = time.perf_counter()
            await redis.ping()
            ping_ms = round((time.perf_counter() - t0) * 1000, 1)
            # SET/GET round-trip
            key = f"health:{uuid.uuid4().hex[:8]}"
            t0 = time.perf_counter()
            await redis.set(key, "1", ex=10)
            value = await redis.get(key)
            await redis.delete(key)
            rt_ms = round((time.perf_counter() - t0) * 1000, 1)
            if value != "1":
                return {"status": "error", "detail": "SET/GET roundtrip failed"}
            return {
                "status": "ok",
                "ping_ms": ping_ms,
                "roundtrip_ms": rt_ms,
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_scheduler(self) -> dict:
        """Сколько задач в Redis jobstore APScheduler.

        APScheduler RedisJobStore хранит задачи в Redis-ХЕШЕ
        (ключ bookmaster:scheduler:jobs), поэтому считаем через HLEN.
        Раньше тут был ZCARD → Redis отвечал WRONGTYPE, и проверка
        ошибочно показывала error при полностью рабочем планировщике.
        """
        try:
            from app.core.redis import get_redis
            redis = await get_redis()
            count = await redis.hlen("bookmaster:scheduler:jobs")
            return {
                "status": "ok" if count > 0 else "error",
                "jobs_count": int(count),
                "detail": (
                    "no jobs in store — scheduler worker not running?"
                    if count == 0 else None
                ),
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_s3(self) -> dict:
        if not (settings.S3_ACCESS_KEY_ID and settings.S3_SECRET_ACCESS_KEY):
            return {"status": "not_configured"}
        try:
            import aioboto3  # type: ignore
            t0 = time.perf_counter()
            session = aioboto3.Session(
                aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            )
            test_key = f".health-check/{uuid.uuid4().hex}.txt"
            test_data = b"ok"
            async with session.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                region_name="ru-central1",
            ) as s3:
                await s3.put_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=test_key,
                    Body=test_data,
                )
                resp = await s3.get_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=test_key,
                )
                async with resp["Body"] as stream:
                    body = await stream.read()
                await s3.delete_object(
                    Bucket=settings.S3_BUCKET_NAME,
                    Key=test_key,
                )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            if body != test_data:
                return {"status": "error", "detail": "upload/download mismatch"}
            return {
                "status": "ok",
                "bucket": settings.S3_BUCKET_NAME,
                "response_time_ms": elapsed_ms,
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_openai(self) -> dict:
        if not settings.OPENAI_API_KEY:
            return {"status": "not_configured"}
        try:
            import openai
            # Используем тот же путь, что и боевые AI-провайдеры: если задан
            # Railway-прокси (AI_PROXY_URL) — ходим через него. Иначе прямой
            # вызов из РФ-региона YC даёт 403 unsupported_country, хотя само
            # приложение работает через прокси. (см. providers.OpenAIProvider)
            kwargs: dict = {"api_key": settings.OPENAI_API_KEY, "timeout": 10}
            via_proxy = False
            if settings.AI_PROXY_URL:
                kwargs["base_url"] = settings.AI_PROXY_URL
                via_proxy = True
                if settings.AI_PROXY_SECRET:
                    kwargs["default_headers"] = {
                        "X-Proxy-Secret": settings.AI_PROXY_SECRET,
                    }
            client = openai.AsyncOpenAI(**kwargs)
            t0 = time.perf_counter()
            # минимальный completion для проверки end-to-end
            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL_FAST or "gpt-4o-mini",
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "status": "ok",
                "model": resp.model,
                "via_proxy": via_proxy,
                "response_time_ms": elapsed_ms,
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_yandex_gpt(self) -> dict:
        if not (settings.YANDEX_GPT_API_KEY and (
            settings.YANDEX_FOLDER_ID or settings.YANDEX_GPT_FOLDER_ID
        )):
            return {"status": "not_configured"}
        try:
            import httpx
            folder_id = settings.YANDEX_GPT_FOLDER_ID or settings.YANDEX_FOLDER_ID
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
                    headers={
                        "Authorization": f"Api-Key {settings.YANDEX_GPT_API_KEY}",
                        "x-folder-id": folder_id,
                    },
                    json={
                        "modelUri": f"gpt://{folder_id}/yandexgpt-lite/latest",
                        "completionOptions": {
                            "stream": False,
                            "temperature": 0,
                            "maxTokens": "1",
                        },
                        "messages": [{"role": "user", "text": "ping"}],
                    },
                )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code == 200:
                return {"status": "ok", "response_time_ms": elapsed_ms}
            return {
                "status": "error",
                "detail": f"HTTP {resp.status_code}: {resp.text[:120]}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_yandex_stt(self) -> dict:
        """Проверка валидности API-ключа Yandex SpeechKit без отправки аудио."""
        if not settings.YANDEX_STT_API_KEY:
            return {"status": "not_configured"}
        try:
            import httpx
            # IAM-проверка через operations endpoint — лёгкий запрос
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.post(
                    "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize",
                    headers={
                        "Authorization": f"Api-Key {settings.YANDEX_STT_API_KEY}",
                    },
                    content=b"",  # пустое аудио → 400, но 401/403 = плохой ключ
                )
            if resp.status_code in (200, 400):
                return {"status": "ok"}
            if resp.status_code in (401, 403):
                return {"status": "error", "detail": "Invalid API key"}
            return {"status": "error", "detail": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_yookassa(self) -> dict:
        if not (settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY):
            return {"status": "not_configured"}
        try:
            import httpx
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=10) as client:
                # me-эндпоинт ЮKassa возвращает данные магазина по credentials
                resp = await client.get(
                    "https://api.yookassa.ru/v3/me",
                    auth=(
                        settings.YOOKASSA_SHOP_ID,
                        settings.YOOKASSA_SECRET_KEY,
                    ),
                )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "status": "ok",
                    "shop_id": data.get("account_id"),
                    "test_mode": data.get("test", False),
                    "response_time_ms": elapsed_ms,
                }
            return {
                "status": "error",
                "detail": f"HTTP {resp.status_code}: {resp.text[:120]}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_telegram_bot(self) -> dict:
        if not settings.TG_BOT_TOKEN:
            return {"status": "not_configured"}
        try:
            import httpx
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://api.telegram.org/bot{settings.TG_BOT_TOKEN}/getMe"
                )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code == 200 and resp.json().get("ok"):
                bot = resp.json().get("result", {})
                return {
                    "status": "ok",
                    "username": bot.get("username"),
                    "response_time_ms": elapsed_ms,
                }
            return {
                "status": "error",
                "detail": f"HTTP {resp.status_code}: {resp.text[:120]}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    async def _check_max_bot(self) -> dict:
        """MAX webhook health: GET /health на собственный webhook (если задан)."""
        if not settings.MAX_BOT_TOKEN:
            return {"status": "not_configured"}
        try:
            import httpx
            t0 = time.perf_counter()
            # Проверяем доступность MAX Bot API через me-метод
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    "https://botapi.max.ru/v1/me",
                    headers={
                        "Authorization": f"Bearer {settings.MAX_BOT_TOKEN}"
                    },
                )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
            if resp.status_code in (200, 201):
                return {
                    "status": "ok",
                    "response_time_ms": elapsed_ms,
                }
            if resp.status_code in (401, 403):
                return {"status": "error", "detail": "Invalid MAX token"}
            return {
                "status": "error",
                "detail": f"HTTP {resp.status_code}",
            }
        except Exception as e:
            return {"status": "error", "detail": str(e)[:200]}

    # ── Audit ────────────────────────────────────────────────

    async def log_action(
        self,
        admin_id: str,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        payload: Optional[dict] = None,
    ):
        log = AdminAuditLog(
            admin_id=admin_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
        self.db.add(log)
        await self.db.flush()

    # ── Финансы ──────────────────────────────────────────────

    async def get_finance_dashboard(
        self,
        period_days: int = 30,
    ) -> dict:
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=period_days)

        total_revenue = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0))
            .where(Payment.status == "succeeded")
        )).scalar() or 0)

        period_revenue = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0))
            .where(
                Payment.status == "succeeded",
                Payment.created_at >= period_start,
            )
        )).scalar() or 0)

        # Платформенная комиссия (тариф A) за период
        period_commission = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_service), 0))
            .where(
                Payment.status == "succeeded",
                Payment.created_at >= period_start,
            )
        )).scalar() or 0)

        total_refunds = float((await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0))
            .where(Payment.status == "refunded")
        )).scalar() or 0)

        tx_count = int((await self.db.execute(
            select(func.count(Payment.id)).where(
                Payment.status == "succeeded",
                Payment.created_at >= period_start,
            )
        )).scalar() or 0)

        mrr = float((await self.db.execute(
            select(func.coalesce(func.sum(MasterSubscription.price), 0))
            .where(MasterSubscription.status == "active")
        )).scalar() or 0)

        # Просроченные подписки
        overdue_subs = int((await self.db.execute(
            select(func.count(MasterSubscription.id)).where(
                MasterSubscription.status == "active",
                MasterSubscription.next_billing < now.date(),
            )
        )).scalar() or 0)

        by_day_r = await self.db.execute(
            select(
                func.date_trunc("day", Payment.created_at).label("day"),
                func.sum(Payment.amount_paid),
                func.count(Payment.id),
            )
            .where(
                Payment.status == "succeeded",
                Payment.created_at >= period_start,
            )
            .group_by("day")
            .order_by("day")
        )
        revenue_by_day = [
            {
                "date": str(r[0].date()) if r[0] else "",
                "revenue": float(r[1] or 0),
                "count": r[2],
            }
            for r in by_day_r.all()
        ]

        return {
            "total_revenue": total_revenue,
            "period_revenue": period_revenue,
            "period_commission": period_commission,
            "total_refunds": total_refunds,
            "transaction_count": tx_count,
            "mrr": mrr,
            "arr": mrr * 12,
            "mrr_forecast_3m": mrr * 3,
            "overdue_subscriptions": overdue_subs,
            "revenue_by_day": revenue_by_day,
        }

    # ── Тикеты ──────────────────────────────────────────────

    async def get_tickets_queue(
        self,
        status_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> dict:
        from app.modules.support.models import SupportTicket

        q = select(SupportTicket)
        count_q = select(func.count(SupportTicket.id))

        if status_filter:
            q = q.where(SupportTicket.status == status_filter)
            count_q = count_q.where(SupportTicket.status == status_filter)
        if priority_filter:
            q = q.where(SupportTicket.priority == priority_filter)
            count_q = count_q.where(SupportTicket.priority == priority_filter)

        # Сортируем по приоритету, потом по дате (high → low → старые наверху)
        priority_order = case(
            (SupportTicket.priority == "high", 1),
            (SupportTicket.priority == "medium", 2),
            (SupportTicket.priority == "low", 3),
            else_=4,
        )
        q = (
            q.order_by(priority_order, SupportTicket.created_at)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )

        tickets = (await self.db.execute(q)).scalars().all()
        total = (await self.db.execute(count_q)).scalar() or 0

        # Метрика: открытых тикетов
        open_count = int((await self.db.execute(
            select(func.count(SupportTicket.id)).where(
                SupportTicket.status.in_(["open", "in_progress"])
            )
        )).scalar() or 0)

        sla_breached = await self._count_sla_breached_tickets()

        # Считаем age тикета и факт SLA-нарушения
        now = datetime.now(timezone.utc)
        sla_first_resp = {
            "high": SLA_FIRST_RESPONSE_HIGH_H,
            "medium": SLA_FIRST_RESPONSE_MEDIUM_H,
            "low": SLA_FIRST_RESPONSE_LOW_H,
        }

        ticket_items = []
        for t in tickets:
            created = t.created_at or now
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_hours = (now - created).total_seconds() / 3600
            sla_h = sla_first_resp.get(t.priority or "low", SLA_FIRST_RESPONSE_LOW_H)
            sla_breach = (
                t.first_response_at is None
                and t.status == "open"
                and age_hours > sla_h
            )
            ticket_items.append({
                "id": t.id,
                "ticket_code": t.ticket_code,
                "initiator_role": t.initiator_role,
                "initiator_id": t.initiator_id,
                "category": t.category,
                "subject": t.subject,
                "status": t.status,
                "priority": t.priority,
                "created_at": str(t.created_at),
                "first_response_at": (
                    str(t.first_response_at) if t.first_response_at else None
                ),
                "resolved_at": str(t.resolved_at) if t.resolved_at else None,
                "age_hours": round(age_hours, 1),
                "sla_breach": sla_breach,
            })

        return {
            "tickets": ticket_items,
            "total": total,
            "open_count": open_count,
            "sla_breached": sla_breached,
            "page": page,
            "per_page": per_page,
        }

    async def get_ticket_detail(self, ticket_id: int) -> Optional[dict]:
        """Полная информация о тикете для SA: тикет + все сообщения."""
        from app.modules.support.models import SupportTicket, TicketMessage

        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return None

        messages_r = await self.db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.created_at)
        )
        messages = messages_r.scalars().all()

        return {
            "id": ticket.id,
            "ticket_code": ticket.ticket_code,
            "initiator_role": ticket.initiator_role,
            "initiator_id": ticket.initiator_id,
            "category": ticket.category,
            "subject": ticket.subject,
            "status": ticket.status,
            "priority": ticket.priority,
            "created_at": str(ticket.created_at),
            "first_response_at": (
                str(ticket.first_response_at) if ticket.first_response_at else None
            ),
            "resolved_at": str(ticket.resolved_at) if ticket.resolved_at else None,
            "satisfaction": ticket.satisfaction,
            "messages": [
                {
                    "id": m.id,
                    "sender_type": m.sender_type,
                    "sender_id": m.sender_id,
                    "text": m.text,
                    "attachment_url": m.attachment_url,
                    "created_at": str(m.created_at),
                }
                for m in messages
            ],
        }

    async def reply_to_ticket(
        self, ticket_id: int, admin_id: str, text: str
    ) -> dict:
        """Ответ суперадмина в тикет (ТЗ 8.5: быстрый ответ).
        Обновляет first_response_at, ставит in_progress, добавляет message."""
        from app.modules.support.models import SupportTicket, TicketMessage

        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return {"error": "not_found"}

        msg = TicketMessage(
            ticket_id=ticket_id,
            sender_type="admin",
            sender_id=None,
            text=text,
        )
        self.db.add(msg)

        now = datetime.now(timezone.utc)
        if not ticket.first_response_at:
            ticket.first_response_at = now
        if ticket.status == "open":
            ticket.status = "in_progress"

        await self.log_action(
            admin_id=admin_id,
            action="reply_ticket",
            entity_type="ticket",
            entity_id=ticket_id,
            payload={"text_len": len(text)},
        )

        # Уведомление инициатору
        await self._notify_ticket_initiator(ticket, text)

        await self.db.flush()
        return {"id": ticket.id, "status": ticket.status}

    async def _notify_ticket_initiator(self, ticket, text: str) -> None:
        """Послать пуш инициатору тикета (мастеру или клиенту)."""
        try:
            from app.modules.notifications.service import NotificationService
            preview = text[:200] + ("…" if len(text) > 200 else "")
            body = f"💬 Ответ поддержки по #{ticket.ticket_code}:\n\n{preview}"
            if ticket.initiator_role == "master":
                await NotificationService.send_by_master_id(
                    self.db, ticket.initiator_id, body,
                    button_text="Открыть тикет",
                    button_url=f"{settings.APP_URL}?startParam=ticket_{ticket.id}",
                )
            elif ticket.initiator_role == "client":
                await NotificationService.send_by_client_id(
                    self.db, ticket.initiator_id, body,
                    button_text="Открыть тикет",
                    button_url=f"{settings.APP_URL}?startParam=ticket_{ticket.id}",
                )
        except Exception as e:
            logger.warning(f"Failed to notify ticket initiator {ticket.id}: {e}")

    async def escalate_ticket(self, ticket_id: int, admin_id: str) -> dict:
        from app.modules.support.models import SupportTicket

        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return {"error": "not_found"}

        ticket.status = "escalated"
        await self.log_action(
            admin_id=admin_id,
            action="escalate_ticket",
            entity_type="ticket",
            entity_id=ticket_id,
        )
        await self.db.flush()
        return {"id": ticket.id, "status": ticket.status}

    async def get_sla_stats(self) -> dict:
        """SLA-сводка по тикетам."""
        from app.modules.support.models import SupportTicket
        now = datetime.now(timezone.utc)

        result: dict = {"by_priority": {}}
        for priority, first_h, resolve_h in [
            ("high", SLA_FIRST_RESPONSE_HIGH_H, SLA_RESOLVE_HIGH_H),
            ("medium", SLA_FIRST_RESPONSE_MEDIUM_H, SLA_RESOLVE_MEDIUM_H),
            ("low", SLA_FIRST_RESPONSE_LOW_H, SLA_RESOLVE_LOW_H),
        ]:
            total = int((await self.db.execute(
                select(func.count(SupportTicket.id))
                .where(SupportTicket.priority == priority)
            )).scalar() or 0)

            first_breach = int((await self.db.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.priority == priority,
                    SupportTicket.first_response_at.is_(None),
                    SupportTicket.status == "open",
                    SupportTicket.created_at < (now - timedelta(hours=first_h)),
                )
            )).scalar() or 0)

            resolve_breach = int((await self.db.execute(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.priority == priority,
                    SupportTicket.status.in_(["open", "in_progress"]),
                    SupportTicket.created_at < (now - timedelta(hours=resolve_h)),
                )
            )).scalar() or 0)

            result["by_priority"][priority] = {
                "total": total,
                "first_response_breach": first_breach,
                "resolve_breach": resolve_breach,
                "first_response_sla_hours": first_h,
                "resolve_sla_hours": resolve_h,
            }
        return result

    # ── Настройки платформы ──────────────────────────────────

    async def get_platform_settings(self) -> dict:
        from app.modules.core.models import SystemSetting

        active_subs = int((await self.db.execute(
            select(func.count(MasterSubscription.id))
            .where(MasterSubscription.status == "active")
        )).scalar() or 0)

        # Подгружаем все system_settings из БД (override env)
        rows = (await self.db.execute(select(SystemSetting))).scalars().all()
        custom = {row.key: row.value for row in rows}

        return {
            "plan_prices": {k: float(v) for k, v in PLAN_PRICES.items()},
            "active_subscriptions": active_subs,
            # Эффективные значения: БД override -> .env default
            "ai_provider": custom.get(
                "ai_provider",
                getattr(settings, "AI_DEFAULT_PROVIDER", "openai"),
            ),
            "ai_default_model": custom.get(
                "ai_default_model",
                getattr(settings, "OPENAI_MODEL_FAST", "gpt-4o-mini"),
            ),
            "ai_fallback_enabled": custom.get("ai_fallback_enabled", "true"),
            "timezone": custom.get(
                "timezone", getattr(settings, "TIMEZONE", "Europe/Moscow")
            ),
            "trial_duration_days": custom.get("trial_duration_days", "14"),
            "support_email": custom.get("support_email", ""),
            "support_telegram": custom.get("support_telegram", ""),
            "maintenance_mode": custom.get("maintenance_mode", "false"),
            "maintenance_message": custom.get("maintenance_message", ""),
            "environment": getattr(settings, "ENVIRONMENT", "production"),
            "debug": getattr(settings, "DEBUG", False),
            "allowed_keys": sorted(ALLOWED_SETTINGS_KEYS),
        }

    async def update_platform_settings(
        self, updates: dict, admin_id: str
    ) -> dict:
        """Обновить системные настройки. Применяются к рантайму немедленно
        для AI-провайдера и timezone — без рестарта."""
        from app.modules.core.models import SystemSetting

        if not isinstance(updates, dict):
            raise ValueError("updates must be an object")

        updated = {}
        rejected = []
        for key, value in updates.items():
            if key not in ALLOWED_SETTINGS_KEYS:
                rejected.append(key)
                continue
            self._validate_setting(key, value)

            r = await self.db.execute(
                select(SystemSetting).where(SystemSetting.key == key)
            )
            setting = r.scalar_one_or_none()
            if setting:
                setting.value = str(value)
            else:
                setting = SystemSetting(key=key, value=str(value))
                self.db.add(setting)
            updated[key] = str(value)

        if updated:
            # Apply runtime overrides (AI provider кэш в памяти инвалидируем)
            if "ai_provider" in updated or "ai_fallback_enabled" in updated:
                try:
                    from app.modules.ai import providers as ai_providers
                    ai_providers.invalidate_provider_cache()
                except Exception:
                    pass
            await self.log_action(
                admin_id=admin_id,
                action="update_settings",
                entity_type="system_settings",
                entity_id=0,
                payload=updated,
            )
            await self.db.flush()

        return {
            "status": "ok",
            "updated": updated,
            "rejected_keys": rejected,
        }

    @staticmethod
    def _validate_setting(key: str, value) -> None:
        """Минимальная валидация значения настройки."""
        s = str(value).strip()
        if key == "ai_provider":
            if s not in ("openai", "yandexgpt"):
                raise ValueError("ai_provider must be 'openai' or 'yandexgpt'")
        elif key in ("ai_fallback_enabled", "maintenance_mode"):
            if s.lower() not in ("true", "false"):
                raise ValueError(f"{key} must be 'true' or 'false'")
        elif key in ("commission_default_bp", "max_free_bookings"):
            if not s.isdigit() or int(s) < 0 or int(s) > 10000:
                raise ValueError(f"{key} must be 0..10000")
        elif key == "trial_duration_days":
            if not s.isdigit() or int(s) < 1 or int(s) > 90:
                raise ValueError("trial_duration_days must be 1..90")
        elif key == "platform_fee_percent":
            try:
                v = float(s)
                if v < 0 or v > 50:
                    raise ValueError
            except ValueError:
                raise ValueError("platform_fee_percent must be 0..50")

    # ── Broadcast от платформы (ТЗ 8.5) ──────────────────────

    async def broadcast_to_masters(
        self,
        admin_id: str,
        text: str,
        plan_filter: Optional[str] = None,
        only_active: bool = True,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> dict:
        """Системная рассылка от платформы по мастерам.
        Отправляется в реальном времени. Логируется в audit."""
        from app.modules.notifications.service import NotificationService

        q = select(Master.id)
        if plan_filter:
            q = q.where(Master.current_plan == plan_filter)
        if only_active:
            q = q.where(Master.is_active.is_(True))

        master_ids = list((await self.db.execute(q)).scalars().all())

        delivered = 0
        failed = 0
        for mid in master_ids:
            ok = await NotificationService.send_by_master_id(
                self.db, mid, text,
                button_text=button_text,
                button_url=button_url or settings.APP_URL,
            )
            if ok:
                delivered += 1
            else:
                failed += 1

        await self.log_action(
            admin_id=admin_id,
            action="platform_broadcast",
            entity_type="masters",
            entity_id=0,
            payload={
                "plan_filter": plan_filter,
                "only_active": only_active,
                "total": len(master_ids),
                "delivered": delivered,
                "failed": failed,
                "text_len": len(text),
            },
        )
        return {
            "total": len(master_ids),
            "delivered": delivered,
            "failed": failed,
        }

    # ── Аналитика роста ──────────────────────────────────────

    async def get_growth_analytics(self, period_days: int = 90) -> dict:
        now = datetime.now(timezone.utc)
        period_start = now - timedelta(days=period_days)

        total_identities = int((await self.db.execute(
            select(func.count(Identity.id))
            .where(Identity.created_at >= period_start)
        )).scalar() or 0)

        total_new_masters = int((await self.db.execute(
            select(func.count(Master.id))
            .where(Master.created_at >= period_start)
        )).scalar() or 0)

        # Конверсия = масте́р создал >=1 запись
        masters_with_bookings_in_period = int((await self.db.execute(
            select(func.count(func.distinct(Appointment.master_id))).where(
                Appointment.master_id.in_(
                    select(Master.id).where(
                        Master.created_at >= period_start
                    )
                )
            )
        )).scalar() or 0)

        by_week_r = await self.db.execute(
            select(
                func.date_trunc("week", Master.created_at).label("week"),
                func.count(Master.id),
            )
            .where(Master.created_at >= period_start)
            .group_by("week")
            .order_by("week")
        )
        masters_by_week = [
            {"week": str(r[0].date()) if r[0] else "", "count": r[1]}
            for r in by_week_r.all()
        ]

        retention_months = []
        for i in range(3):
            m_start = now - timedelta(days=30 * (i + 1))
            m_end = now - timedelta(days=30 * i)
            ret = int((await self.db.execute(
                select(func.count(func.distinct(Appointment.master_id)))
                .where(
                    Appointment.created_at >= m_start,
                    Appointment.created_at < m_end,
                )
            )).scalar() or 0)
            retention_months.append({
                "month_offset": i,
                "active_masters": ret,
            })

        revenue_by_plan_r = await self.db.execute(
            select(
                Master.current_plan,
                func.coalesce(func.sum(MasterSubscription.price), 0),
            )
            .join(MasterSubscription, MasterSubscription.master_id == Master.id)
            .where(MasterSubscription.status == "active")
            .group_by(Master.current_plan)
        )
        revenue_by_plan = {
            (r[0] or "start"): float(r[1]) for r in revenue_by_plan_r.all()
        }

        # Топ-города и топ-специализации
        cities_r = await self.db.execute(
            select(Master.city, func.count(Master.id))
            .where(Master.city.isnot(None))
            .group_by(Master.city)
            .order_by(func.count(Master.id).desc())
            .limit(10)
        )
        top_cities = [
            {"city": r[0], "count": r[1]} for r in cities_r.all()
        ]

        spec_r = await self.db.execute(
            select(Master.specialization, func.count(Master.id))
            .where(Master.specialization.isnot(None))
            .group_by(Master.specialization)
            .order_by(func.count(Master.id).desc())
            .limit(10)
        )
        top_specs = [
            {"specialization": r[0], "count": r[1]} for r in spec_r.all()
        ]

        return {
            "period_days": period_days,
            "total_identities": total_identities,
            "total_new_masters": total_new_masters,
            "conversion_rate": round(
                masters_with_bookings_in_period / total_new_masters * 100, 1
            ) if total_new_masters else 0,
            "masters_by_week": masters_by_week,
            "retention_cohorts": retention_months,
            "revenue_by_plan": revenue_by_plan,
            "top_cities": top_cities,
            "top_specializations": top_specs,
        }
