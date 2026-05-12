"""
Scheduler — фоновые задачи.

Фаза 1: remind_24h, remind_2h, cleanup_pending
Фаза 3: admin_daily, birthday_promo, reactivation,
         post_visit_review, billing_reminder, ai_reindex
"""

import logging
from datetime import datetime, timedelta, timezone, date

from sqlalchemy import select, and_, func
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


# ── Фаза 3: Дополнительные задачи ──────────────────────────────────


async def admin_daily():
    """
    Ежедневно в 9:00 — отправить мастеру список записей на сегодня.
    """
    async with async_session_factory() as db:
        today = datetime.now(timezone.utc).date()

        result = await db.execute(
            select(
                Appointment.master_id,
                func.count(Appointment.id).label("cnt"),
            )
            .where(
                Appointment.date == today,
                Appointment.status.in_([
                    AppointmentStatus.CONFIRMED.value,
                    AppointmentStatus.PAID.value,
                ]),
            )
            .group_by(Appointment.master_id)
        )
        masters_today = result.all()

        for master_id, count in masters_today:
            # Получаем список записей
            appts_result = await db.execute(
                select(Appointment)
                .where(
                    Appointment.master_id == master_id,
                    Appointment.date == today,
                    Appointment.status.in_([
                        AppointmentStatus.CONFIRMED.value,
                        AppointmentStatus.PAID.value,
                    ]),
                )
                .order_by(Appointment.time_start)
            )
            appts = appts_result.scalars().all()

            lines = [f"📋 У вас {count} записей на сегодня:"]
            for a in appts:
                t = a.time_start.strftime("%H:%M") if a.time_start else "?"
                lines.append(f"  • {t} — {a.client_name or 'Клиент'}")

            # TODO: отправить через бота
            logger.info(f"Daily schedule for master {master_id}: {count} appointments")

        logger.info(f"admin_daily: notified {len(masters_today)} masters")


async def birthday_promo():
    """
    Ежедневно в 8:00 — если у клиента ДР через 3 дня,
    отправить поздравление и бонус от мастера.
    """
    async with async_session_factory() as db:
        from app.modules.clients.models import Client, ClientMasterLink
        from app.modules.loyalty.models import LoyaltyAccount
        from app.modules.masters.models import Master

        target_date = datetime.now(timezone.utc).date() + timedelta(days=3)
        target_month_day = (target_date.month, target_date.day)

        # Ищем клиентов с ДР через 3 дня
        result = await db.execute(
            select(Client).where(
                func.extract("month", Client.birthday) == target_month_day[0],
                func.extract("day", Client.birthday) == target_month_day[1],
            )
        )
        birthday_clients = result.scalars().all()

        bonuses_sent = 0
        for client in birthday_clients:
            # Для каждого мастера, к которому клиент привязан
            links_result = await db.execute(
                select(ClientMasterLink).where(
                    ClientMasterLink.client_id == client.id
                )
            )
            links = links_result.scalars().all()

            for link in links:
                master = await db.get(Master, link.master_id)
                if not master or not master.loyalty_birthday_bonus:
                    continue

                # Начислить birthday_bonus
                acc_result = await db.execute(
                    select(LoyaltyAccount).where(
                        LoyaltyAccount.master_id == link.master_id,
                        LoyaltyAccount.client_id == client.id,
                    )
                )
                acc = acc_result.scalar_one_or_none()
                if acc:
                    acc.balance += master.loyalty_birthday_bonus
                    acc.total_earned += master.loyalty_birthday_bonus

                # TODO: отправить поздравление через бота
                logger.info(
                    f"Birthday bonus {master.loyalty_birthday_bonus} pts "
                    f"for client {client.id} from master {link.master_id}"
                )
                bonuses_sent += 1

        await db.commit()
        logger.info(f"birthday_promo: {bonuses_sent} bonuses sent")


async def reactivation():
    """
    Ежедневно в 11:00 — отправить персонализированное
    сообщение неактивным клиентам (нет визитов > 30 дней).
    """
    async with async_session_factory() as db:
        from app.modules.clients.models import ClientMasterLink

        cutoff = datetime.now(timezone.utc).date() - timedelta(days=30)

        result = await db.execute(
            select(ClientMasterLink).where(
                ClientMasterLink.last_visit_date < cutoff,
                ClientMasterLink.visit_count > 0,
            )
        )
        inactive_links = result.scalars().all()

        for link in inactive_links:
            days_inactive = (datetime.now(timezone.utc).date() - link.last_visit_date).days
            # TODO: AI-генерация персонализированного сообщения + отправка через бота
            logger.info(
                f"Reactivation: client {link.client_id} -> master {link.master_id}, "
                f"inactive {days_inactive} days"
            )

        logger.info(f"reactivation: {len(inactive_links)} inactive clients found")


async def post_visit_review():
    """
    Каждый час — через 1 час после завершённого визита отправить
    просьбу оставить отзыв.
    """
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(hours=1, minutes=15)
        window_end = now - timedelta(minutes=45)

        result = await db.execute(
            select(Appointment).where(
                Appointment.status == AppointmentStatus.COMPLETED.value,
                Appointment.completed_at.between(window_start, window_end),
            )
        )
        completed = result.scalars().all()

        for appt in completed:
            # Проверяем что отзыв ещё не оставлен
            from app.modules.reviews.models import ClientReview
            existing = await db.execute(
                select(ClientReview.id).where(
                    ClientReview.appointment_id == appt.id
                )
            )
            if existing.scalar_one_or_none():
                continue

            # TODO: отправить через бота просьбу оставить отзыв
            logger.info(
                f"Review request: appointment {appt.id}, "
                f"client {appt.client_id}"
            )

        logger.info(f"post_visit_review: {len(completed)} review requests")


async def billing_reminder():
    """
    Ежедневно — за 3 дня до next_billing отправить
    напоминание мастеру об оплате подписки.
    """
    async with async_session_factory() as db:
        from app.modules.payments.models import MasterSubscription
        from app.modules.masters.models import Master

        target_date = datetime.now(timezone.utc).date() + timedelta(days=3)

        result = await db.execute(
            select(MasterSubscription).where(
                MasterSubscription.next_billing == target_date,
                MasterSubscription.status == "active",
            )
        )
        subs = result.scalars().all()

        for sub in subs:
            master = await db.get(Master, sub.master_id)
            # TODO: отправить напоминание через бота
            logger.info(
                f"Billing reminder: master {sub.master_id}, "
                f"plan={sub.plan}, next_billing={sub.next_billing}"
            )

        logger.info(f"billing_reminder: {len(subs)} reminders sent")


async def ai_reindex():
    """
    Ежедневно в 3:00 — переиндексировать RAG базу
    для всех активных мастеров с включённым AI.
    """
    async with async_session_factory() as db:
        from app.modules.core.models import FeatureFlags
        from app.modules.ai.indexer import AIIndexer

        result = await db.execute(
            select(FeatureFlags.master_id).where(
                FeatureFlags.ai_advisor.is_(True),
            )
        )
        master_ids = [row[0] for row in result.all()]

        indexer = AIIndexer(db)
        total_chunks = 0

        for mid in master_ids:
            try:
                count = await indexer.index_master(mid)
                total_chunks += count
                logger.info(f"AI reindex: master {mid}, {count} chunks")
            except Exception as e:
                logger.error(f"AI reindex error for master {mid}: {e}")

        await db.commit()
        logger.info(f"ai_reindex: {len(master_ids)} masters, {total_chunks} total chunks")
