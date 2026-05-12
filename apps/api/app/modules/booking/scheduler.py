"""
Scheduler — фоновые задачи для бронирований.
APScheduler jobs: remind_24h, remind_2h, cleanup_pending.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.modules.booking.models import Appointment, AppointmentStatus

logger = logging.getLogger(__name__)


async def remind_24h():
    """Напоминание за 24 часа до визита."""
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=24)
        window_start = target - timedelta(minutes=30)
        window_end = target + timedelta(minutes=30)

        result = await db.execute(
            select(Appointment).where(
                Appointment.time_start.between(window_start, window_end),
                Appointment.status.in_([
                    AppointmentStatus.CONFIRMED.value,
                    AppointmentStatus.PAID.value,
                ]),
            )
        )
        appointments = result.scalars().all()

        for appt in appointments:
            # TODO: Отправить уведомление через бота
            logger.info(
                f"24h reminder: appointment #{appt.id}, "
                f"client_id={appt.client_id}, master_id={appt.master_id}"
            )
        logger.info(f"24h reminders sent: {len(list(appointments))}")


async def remind_2h():
    """Напоминание за 2 часа до визита."""
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        target = now + timedelta(hours=2)
        window_start = target - timedelta(minutes=15)
        window_end = target + timedelta(minutes=15)

        result = await db.execute(
            select(Appointment).where(
                Appointment.time_start.between(window_start, window_end),
                Appointment.status.in_([
                    AppointmentStatus.CONFIRMED.value,
                    AppointmentStatus.PAID.value,
                ]),
            )
        )
        appointments = result.scalars().all()

        for appt in appointments:
            logger.info(
                f"2h reminder: appointment #{appt.id}, "
                f"client_id={appt.client_id}"
            )
        logger.info(f"2h reminders sent: {len(list(appointments))}")


async def cleanup_pending():
    """
    Автоотмена pending-записей, не подтверждённых в течение 30 минут.
    """
    async with async_session_factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)

        result = await db.execute(
            select(Appointment).where(
                Appointment.status == AppointmentStatus.PENDING.value,
                Appointment.created_at < cutoff,
            )
        )
        appointments = result.scalars().all()
        count = 0
        for appt in appointments:
            appt.status = AppointmentStatus.CANCELLED_BY_CLIENT.value
            appt.cancelled_at = datetime.now(timezone.utc)
            appt.cancel_reason = "Auto-cancelled: not confirmed in time"
            count += 1

        await db.commit()
        logger.info(f"Cleaned up {count} pending appointments")
