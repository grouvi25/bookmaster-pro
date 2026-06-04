"""
BookMaster Pro Scheduler — отдельный воркер для фоновых задач.

Запускается как отдельный процесс/контейнер.
Использует APScheduler + Redis jobstore для персистентности задач.

По ТЗ: scheduler/runner.py с Redis jobstore.
"""

import asyncio
import logging
import sys
import os

# Добавляем путь к API модулям
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore

from app.core.config import settings

# Загружаем ВСЕ ORM-модели до первого запроса, чтобы SQLAlchemy
# смог разрешить строковые relationship-ссылки между модулями.
import app.modules.auth.models  # noqa: F401
import app.modules.masters.models  # noqa: F401
import app.modules.clients.models  # noqa: F401
import app.modules.services.models  # noqa: F401
import app.modules.booking.models  # noqa: F401
import app.modules.payments.models  # noqa: F401
import app.modules.reviews.models  # noqa: F401
import app.modules.loyalty.models  # noqa: F401
import app.modules.promo.models  # noqa: F401
import app.modules.waitlist.models  # noqa: F401
import app.modules.consultations.models  # noqa: F401
import app.modules.broadcast.models  # noqa: F401
import app.modules.support.models  # noqa: F401
import app.modules.core.models  # noqa: F401
import app.modules.portfolio.models  # noqa: F401
import app.modules.nps.models  # noqa: F401
import app.modules.ai.models  # noqa: F401
import app.modules.marketplace.models  # noqa: F401
import app.modules.superadmin.models  # noqa: F401

from app.modules.booking.scheduler import (
    remind_24h,
    remind_2h,
    cleanup_pending,
    admin_daily,
    birthday_promo,
    reactivation,
    post_visit_review,
    post_visit_rebooking,
    billing_reminder,
    billing_auto_charge,
    ai_reindex,
    loyalty_expire,
    loyalty_expiry_warn,
    waitlist_notify,
    execute_master_payouts,
)

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("scheduler")


def parse_redis_url(url: str) -> dict:
    """Извлекаем host, port, db из REDIS_URL."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 6379,
        "db": int(parsed.path.lstrip("/") or "0"),
        "password": parsed.password,
    }


def create_scheduler() -> AsyncIOScheduler:
    redis_params = parse_redis_url(settings.REDIS_URL)
    jobstore = RedisJobStore(
        jobs_key="bookmaster:scheduler:jobs",
        run_times_key="bookmaster:scheduler:run_times",
        **redis_params,
    )

    scheduler = AsyncIOScheduler(
        jobstores={"default": jobstore},
        job_defaults={
            "coalesce": True,
            "max_instances": 1,
            "misfire_grace_time": 300,
        },
        timezone=settings.TIMEZONE,
    )

    # Фаза 1: напоминания и очистка
    scheduler.add_job(
        remind_24h, "interval", hours=1,
        id="remind_24h", replace_existing=True,
    )
    scheduler.add_job(
        remind_2h, "interval", minutes=30,
        id="remind_2h", replace_existing=True,
    )
    scheduler.add_job(
        cleanup_pending, "interval", minutes=1,
        id="cleanup_pending", replace_existing=True,
    )

    # Фаза 3: расширенные задачи
    scheduler.add_job(
        admin_daily, "cron", hour=9, minute=0,
        id="admin_daily", replace_existing=True,
    )
    scheduler.add_job(
        birthday_promo, "cron", hour=8, minute=0,
        id="birthday_promo", replace_existing=True,
    )
    scheduler.add_job(
        reactivation, "cron", hour=11, minute=0,
        id="reactivation", replace_existing=True,
    )
    scheduler.add_job(
        post_visit_review, "interval", hours=1,
        id="post_visit_review", replace_existing=True,
    )
    scheduler.add_job(
        post_visit_rebooking, "interval", hours=2,
        id="post_visit_rebooking", replace_existing=True,
    )
    scheduler.add_job(
        billing_reminder, "cron", hour=10, minute=0,
        id="billing_reminder", replace_existing=True,
    )
    scheduler.add_job(
        billing_auto_charge, "cron", hour=6, minute=0,
        id="billing_auto_charge", replace_existing=True,
    )
    scheduler.add_job(
        ai_reindex, "cron", hour=3, minute=0,
        id="ai_reindex", replace_existing=True,
    )

    # Лояльность: сгорание баллов и предупреждение
    scheduler.add_job(
        loyalty_expire, "cron", hour=2, minute=0,
        id="loyalty_expire", replace_existing=True,
    )
    scheduler.add_job(
        loyalty_expiry_warn, "cron", hour=10, minute=30,
        id="loyalty_expiry_warn", replace_existing=True,
    )

    # Агентская схема: выплаты мастерам через T-Bank (T+1)
    scheduler.add_job(
        execute_master_payouts, "cron", hour=11, minute=0,
        id="execute_master_payouts", replace_existing=True,
    )

    # Фаза 5: waitlist
    scheduler.add_job(
        waitlist_notify, "interval", minutes=5,
        id="waitlist_notify", replace_existing=True,
    )

    return scheduler


async def main():
    logger.info("Starting BookMaster Pro Scheduler worker...")
    scheduler = create_scheduler()
    scheduler.start()

    jobs = scheduler.get_jobs()
    logger.info(f"Scheduler started with {len(jobs)} jobs:")
    for job in jobs:
        logger.info(f"  - {job.id}: {job.trigger}")

    # Health check HTTP сервер — для Docker healthcheck
    # Минимальный asyncio HTTP server (без доп. зависимостей)
    import json as _json

    async def _handle_health(reader, writer):
        # Читаем запрос (минимально)
        await reader.read(4096)
        running = scheduler.running
        job_count = len(scheduler.get_jobs())
        status = "ok" if running and job_count > 0 else "unhealthy"
        code = 200 if status == "ok" else 503
        body = _json.dumps({"status": status, "jobs": job_count, "running": running})
        response = (
            f"HTTP/1.1 {code} {'OK' if code == 200 else 'Service Unavailable'}\r\n"
            f"Content-Type: application/json\r\n"
            f"Content-Length: {len(body)}\r\n"
            f"\r\n"
            f"{body}"
        )
        writer.write(response.encode())
        await writer.drain()
        writer.close()

    health_server = await asyncio.start_server(_handle_health, "0.0.0.0", 8090)
    logger.info("Scheduler health endpoint listening on :8090/health")

    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Shutting down scheduler...")
        health_server.close()
        await health_server.wait_closed()
        scheduler.shutdown(wait=True)
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    asyncio.run(main())
