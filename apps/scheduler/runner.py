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
import app.modules.monitoring.models  # noqa: F401

from app.modules.monitoring.alerts import check_error_alerts
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

from app.core.logging_setup import setup_logging
setup_logging(debug=settings.DEBUG, service_name="bookmaster-scheduler")
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

    # Мониторинг: проверка ошибок и алёрты суперадмину (TZ2 §3,5)
    scheduler.add_job(
        check_error_alerts, "interval", minutes=5,
        id="error_alerts", replace_existing=True,
    )

    return scheduler



async def cleanup_expired_link_codes():
    """Удаляем истёкшие коды привязки аккаунтов (ежедневно)."""
    from datetime import datetime, timezone
    from sqlalchemy import delete
    from app.modules.auth.models import IdentityLinkCode
    from app.core.database import async_session_factory
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                delete(IdentityLinkCode).where(
                    IdentityLinkCode.expires_at < datetime.now(timezone.utc)
                )
            )
            await db.commit()
            if result.rowcount:
                logger.info(f"Cleaned up {result.rowcount} expired link codes")
    except Exception as e:
        logger.error(f"Error cleaning up link codes: {e}")



async def verify_backup():
    """Проверяем что бэкап за сегодня существует и не нулевой в S3."""
    from datetime import date
    import time as _time
    try:
        import aioboto3
    except ImportError:
        logger.warning("aioboto3 not installed, skipping backup verification")
        return

    today = date.today().isoformat()
    logger.info(f"Verifying backup for {today}...")

    try:
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        ) as s3:
            try:
                resp = await s3.head_object(
                    Bucket="bookmaster-backups",
                    Key=f"daily/{today}/manifest.json",
                )
                size = resp.get("ContentLength", 0)
                if size < 10:
                    raise ValueError(f"Manifest too small: {size} bytes")
                logger.info(f"Backup verified OK: {today} (manifest {size} bytes)")
                # Update Prometheus metric
                try:
                    from app.core.metrics import LAST_BACKUP_TIMESTAMP
                    LAST_BACKUP_TIMESTAMP.set(_time.time())
                except Exception:
                    pass
            except s3.exceptions.ClientError as e:
                if "404" in str(e) or "NoSuchKey" in str(e):
                    await _alert_backup_missing(today, "manifest.json not found in S3")
                else:
                    await _alert_backup_missing(today, str(e))
            except ValueError as e:
                await _alert_backup_missing(today, str(e))
    except Exception as e:
        logger.error(f"verify_backup error: {e}")
        await _alert_backup_missing(today, str(e))


async def _alert_backup_missing(date_str: str, reason: str):
    """Уведомить суперадмина что бэкап не найден."""
    msg = f"⚠️ Бэкап за {date_str} НЕ прошёл верификацию!\nПричина: {reason}"
    logger.error(msg)
    try:
        from app.modules.notifications.service import NotificationService
        for admin_id in settings.superadmin_list:
            try:
                await NotificationService.send_to_admin(
                    platform_id=admin_id,
                    text=msg,
                )
            except Exception as e:
                logger.warning(f"Failed to alert admin {admin_id}: {e}")
    except Exception as e:
        logger.warning(f"Could not send backup alert: {e}")

async def main():
    logger.info("Starting BookMaster Pro Scheduler worker...")
    scheduler = create_scheduler()
    # Кросс-платформа: чистка истёкших кодов привязки
    scheduler.add_job(
        cleanup_expired_link_codes, "cron", hour=4, minute=0,
        id="cleanup_link_codes", replace_existing=True,
    )

    # Мониторинг: верификация бэкапа (ТЗ3 — проверка что бэкап создался)
    scheduler.add_job(
        verify_backup, "cron", hour=1, minute=30,
        id="verify_backup", replace_existing=True,
    )

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
