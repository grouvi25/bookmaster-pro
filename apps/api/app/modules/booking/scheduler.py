"""
Scheduler — фоновые задачи.

Фаза 1: remind_24h, remind_2h, cleanup_pending
Фаза 3: admin_daily, birthday_promo, reactivation,
         post_visit_review, billing_reminder, ai_reindex
Фаза 5: waitlist_notify
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func

from app.core.config import settings
from app.core.database import async_session_factory
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.notifications.service import NotificationService

logger = logging.getLogger(__name__)

notify = NotificationService


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
                Appointment.reminder_1d_sent == False,
            )
        )
        appointments = result.scalars().all()

        sent = 0
        for appt in appointments:
            time_str = appt.time_start.strftime("%H:%M") if appt.time_start else "?"
            date_str = appt.date.strftime("%d.%m") if appt.date else "завтра"
            text = (
                f"🔔 Напоминание: у вас запись {date_str} в {time_str}.\n"
                f"Если планы изменились — отмените заранее."
            )
            ok = await notify.send_by_client_id(
                db, appt.client_id, text,
                button_text="Мои записи",
                button_url=f"{settings.APP_URL}?startParam=my_bookings",
            )
            if ok:
                appt.reminder_1d_sent = True
                sent += 1
            logger.info(
                f"24h reminder: appointment #{appt.id}, "
                f"client_id={appt.client_id}, sent={ok}"
            )
        await db.commit()
        logger.info(f"24h reminders sent: {sent}/{len(appointments)}")


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
                Appointment.reminder_2h_sent == False,
            )
        )
        appointments = result.scalars().all()

        sent = 0
        for appt in appointments:
            time_str = appt.time_start.strftime("%H:%M") if appt.time_start else "?"
            text = (
                f"⏰ Через 2 часа у вас запись в {time_str}.\n"
                f"Ждём вас!"
            )
            ok = await notify.send_by_client_id(
                db, appt.client_id, text,
                button_text="Подробнее",
                button_url=f"{settings.APP_URL}?startParam=my_bookings",
            )
            if ok:
                appt.reminder_2h_sent = True
                sent += 1
            logger.info(
                f"2h reminder: appointment #{appt.id}, "
                f"client_id={appt.client_id}, sent={ok}"
            )
        await db.commit()
        logger.info(f"2h reminders sent: {sent}/{len(appointments)}")


async def cleanup_pending():
    """
    Автоотмена pending-записей, не подтверждённых в течение SLOT_RESERVE_MINUTES (5 мин по ТЗ).
    """
    async with async_session_factory() as db:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=settings.SLOT_RESERVE_MINUTES)

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

            message = "\n".join(lines)
            ok = await notify.send_by_master_id(
                db, master_id, message,
                button_text="Открыть расписание",
                button_url=f"{settings.APP_URL}?startParam=dashboard",
            )
            logger.info(f"Daily schedule for master {master_id}: {count} appointments, sent={ok}")

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

                text = (
                    f"🎂 {master.name or 'Ваш мастер'} поздравляет вас "
                    f"с наступающим днём рождения!\n"
                    f"Вам начислено {master.loyalty_birthday_bonus} бонусных баллов 🎁"
                )
                await notify.send_by_client_id(
                    db, client.id, text,
                    button_text="Записаться",
                    button_url=f"{settings.APP_URL}?startParam=m_{master.slug}" if master.slug else None,
                )
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

        sent = 0
        for link in inactive_links:
            days_inactive = (datetime.now(timezone.utc).date() - link.last_visit_date).days
            from app.modules.masters.models import Master
            master = await db.get(Master, link.master_id)
            master_name = master.name if master else "Ваш мастер"
            text = (
                f"💫 {master_name} давно вас не видел(а)!\n"
                f"Прошло уже {days_inactive} дней. "
                f"Запишитесь — для вас всегда найдётся время!"
            )
            ok = await notify.send_by_client_id(
                db, link.client_id, text,
                button_text="Записаться",
                button_url=f"{settings.APP_URL}?startParam=m_{master.slug}" if master and master.slug else None,
            )
            if ok:
                sent += 1
            logger.info(
                f"Reactivation: client {link.client_id} -> master {link.master_id}, "
                f"inactive {days_inactive} days, sent={ok}"
            )

        logger.info(f"reactivation: {sent}/{len(inactive_links)} reactivation messages sent")


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

            text = (
                "⭐ Как прошёл визит? Оставьте отзыв — "
                "это поможет мастеру стать лучше и другим клиентам сделать выбор!"
            )
            ok = await notify.send_by_client_id(
                db, appt.client_id, text,
                button_text="Оставить отзыв",
                button_url=f"{settings.APP_URL}?startParam=review_{appt.id}",
            )
            logger.info(
                f"Review request: appointment {appt.id}, "
                f"client {appt.client_id}, sent={ok}"
            )

        logger.info(f"post_visit_review: {len(completed)} review requests")


async def post_visit_rebooking():
    """
    Через 24 часа после визита — AI-приглашение записаться повторно.
    Отправляется только если клиент ещё не записался к этому мастеру.
    """
    async with async_session_factory() as db:
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(hours=25)
        window_end = now - timedelta(hours=23)

        result = await db.execute(
            select(Appointment).where(
                Appointment.status == AppointmentStatus.COMPLETED.value,
                Appointment.completed_at.between(window_start, window_end),
                Appointment.client_id.isnot(None),
            )
        )
        completed = result.scalars().all()

        sent = 0
        for appt in completed:
            future = await db.execute(
                select(Appointment.id).where(
                    Appointment.client_id == appt.client_id,
                    Appointment.master_id == appt.master_id,
                    Appointment.status.in_([
                        AppointmentStatus.CONFIRMED.value,
                        AppointmentStatus.PENDING.value,
                    ]),
                )
            )
            if future.scalar_one_or_none():
                continue

            from app.modules.masters.models import Master
            master_row = await db.execute(
                select(Master).where(Master.id == appt.master_id)
            )
            master = master_row.scalar_one_or_none()
            master_name = master.display_name if master else "мастеру"

            service_name = ""
            if appt.service:
                service_name = appt.service.name

            text = (
                f"✨ Вам понравился визит к {master_name}?"
            )
            if service_name:
                text += f"\nЗапишитесь снова на «{service_name}» — "
            else:
                text += "\nЗапишитесь снова — "
            text += "мастер будет рад вас видеть!"

            slug = master.slug if master else ""
            ok = await notify.send_by_client_id(
                db, appt.client_id, text,
                button_text="Записаться снова",
                button_url=f"{settings.APP_URL}?startParam=m_{slug}",
            )
            if ok:
                sent += 1

        logger.info(f"post_visit_rebooking: {sent} rebooking invites sent")


async def billing_reminder():
    """
    Ежедневно — за 3 дня до next_billing отправить
    напоминание мастеру об оплате подписки.
    """
    async with async_session_factory() as db:
        from app.modules.payments.models import MasterSubscription

        target_date = datetime.now(timezone.utc).date() + timedelta(days=3)

        result = await db.execute(
            select(MasterSubscription).where(
                MasterSubscription.next_billing == target_date,
                MasterSubscription.status == "active",
            )
        )
        subs = result.scalars().all()

        sent = 0
        for sub in subs:
            text = (
                f"💳 Напоминание: через 3 дня будет списание "
                f"за тариф «{sub.plan}».\n"
                f"Убедитесь, что карта привязана и на ней достаточно средств."
            )
            ok = await notify.send_by_master_id(
                db, sub.master_id, text,
                button_text="Управление тарифом",
                button_url=f"{settings.APP_URL}?startParam=billing",
            )
            if ok:
                sent += 1
            logger.info(
                f"Billing reminder: master {sub.master_id}, "
                f"plan={sub.plan}, next_billing={sub.next_billing}, sent={ok}"
            )

        logger.info(f"billing_reminder: {sent}/{len(subs)} reminders sent")


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


async def loyalty_expire():
    """
    Ежедневно — списание просроченных баллов лояльности (12 мес с начисления).
    """
    async with async_session_factory() as db:
        from app.modules.loyalty.service import LoyaltyService

        svc = LoyaltyService(db)
        count = await svc.expire_points()
        await db.commit()
        logger.info(f"loyalty_expire: {count} points expired")


async def loyalty_expiry_warn():
    """
    Ежедневно — уведомить клиентов о баллах, которые сгорят в ближайшие 30 дней.
    """
    async with async_session_factory() as db:
        from app.modules.loyalty.service import LoyaltyService, POINTS_EXPIRY_WARN_DAYS

        svc = LoyaltyService(db)
        expiring = await svc.get_expiring_soon(days=POINTS_EXPIRY_WARN_DAYS)

        sent = 0
        seen = set()
        for tx in expiring:
            key = (tx.master_id, tx.client_id)
            if key in seen:
                continue
            seen.add(key)

            text = (
                f"⚠️ Внимание: {tx.points} бонусных баллов сгорят "
                f"{tx.expires_at.strftime('%d.%m.%Y') if tx.expires_at else 'скоро'}.\n"
                f"Используйте их при следующей записи!"
            )
            ok = await notify.send_by_client_id(
                db, tx.client_id, text,
                button_text="Записаться",
                button_url=f"{settings.APP_URL}?startParam=book",
            )
            if ok:
                sent += 1

        await db.commit()
        logger.info(f"loyalty_expiry_warn: {sent} clients notified about expiring points")


async def waitlist_notify():
    """
    Каждые 5 мин — проверяем notified записи в waitlist.
    Если прошло > WAITLIST_CONFIRM_MINUTES без бронирования — expire.
    Также проверяем waiting записи — если появился слот, уведомляем первого.
    """
    async with async_session_factory() as db:
        from app.modules.waitlist.models import WaitlistEntry
        from app.modules.masters.models import Master

        now = datetime.now(timezone.utc)
        confirm_limit = timedelta(minutes=int(settings.WAITLIST_CONFIRM_MINUTES or 30))

        # Expire notified entries that didn't confirm in time
        result = await db.execute(
            select(WaitlistEntry).where(
                WaitlistEntry.status == "notified",
                WaitlistEntry.notified_at.isnot(None),
            )
        )
        notified = result.scalars().all()
        expired = 0
        for entry in notified:
            if entry.notified_at and (now - entry.notified_at) > confirm_limit:
                entry.status = "expired"
                expired += 1

        # Find waiting entries with matching available slots
        result = await db.execute(
            select(WaitlistEntry).where(
                WaitlistEntry.status == "waiting",
            ).order_by(WaitlistEntry.created_at)
        )
        waiting = result.scalars().all()
        notified_count = 0
        for entry in waiting:
            master = await db.get(Master, entry.master_id)
            if not master:
                continue

            entry.status = "notified"
            entry.notified_at = now
            entry.slot_reserved_until = now + confirm_limit

            text = (
                f"🎉 Освободилось место у мастера {master.name or 'вашего мастера'}!\n"
                f"У вас есть {settings.WAITLIST_CONFIRM_MINUTES or 30} мин, чтобы записаться."
            )
            await notify.send_by_client_id(
                db, entry.client_id, text,
                button_text="Записаться",
                button_url=f"{settings.APP_URL}?startParam=m_{master.slug}" if master.slug else None,
            )
            notified_count += 1
            break  # only first in queue per run

        await db.commit()
        logger.info(
            f"waitlist_notify: expired={expired}, notified={notified_count}"
        )
