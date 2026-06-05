"""
Error alerts — проверяем ошибки каждые 5 минут, уведомляем суперадмина.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.monitoring.models import ErrorEvent

logger = logging.getLogger(__name__)


async def check_error_alerts() -> None:
    """
    Каждые 5 минут проверяем есть ли новые/всплески ошибок.
    Уведомляем суперадмина через Telegram бот.
    """
    from app.core.database import async_session_factory
    from app.core.config import settings

    async with async_session_factory() as db:
        try:
            now = datetime.now(timezone.utc)
            window = now - timedelta(minutes=5)

            # 1. Новые critical-ошибки (не уведомляли)
            result = await db.execute(
                select(ErrorEvent).where(
                    ErrorEvent.severity == "critical",
                    ErrorEvent.status == "new",
                    ErrorEvent.notified_at.is_(None),
                    ErrorEvent.first_seen >= window,
                )
            )
            critical_new = list(result.scalars().all())

            # 2. Ошибки с резким ростом (5+ раз за 5 мин)
            spike_result = await db.execute(
                select(ErrorEvent)
                .where(
                    ErrorEvent.last_seen >= window,
                    ErrorEvent.count >= 5,
                )
                .order_by(ErrorEvent.count.desc())
                .limit(3)
            )
            spikes = list(spike_result.scalars().all())

            if not critical_new and not spikes:
                return

            msg = _build_alert_message(critical_new, spikes)
            logger.info(f"Sending error alert: {len(critical_new)} critical, {len(spikes)} spikes")

            # Отправляем через notification service
            try:
                from app.modules.notifications.service import NotificationService

                for admin_id in settings.superadmin_list:
                    try:
                        await NotificationService.send_to_admin(
                            platform_id=admin_id,
                            text=msg,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to notify admin {admin_id}: {e}")
            except ImportError:
                logger.warning("NotificationService not available, logging alert only")
                logger.warning(msg)

            # Отмечаем что уведомили
            for e in critical_new + spikes:
                e.notified_at = now
            await db.commit()

        except Exception as e:
            logger.error(f"check_error_alerts failed: {e}")


def _build_alert_message(critical: list, spikes: list) -> str:
    lines = ["🚨 BookMaster Pro — Алёрт\n"]
    if critical:
        lines.append(f"🔴 Критические ошибки ({len(critical)}):")
        for e in critical[:3]:
            lines.append(f"  • {e.error_type} в {e.module}")
            lines.append(f"    {e.error_msg[:80]}")
    if spikes:
        lines.append(f"⚠️ Всплески ({len(spikes)}):")
        for e in spikes[:2]:
            lines.append(f"  • {e.error_type}: {e.count}× за 5 мин")
    return "\n".join(lines)
