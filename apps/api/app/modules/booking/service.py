"""
Booking service — создание, отмена, завершение записей.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.booking.models import (
    Appointment,
    AppointmentStatus,
    BlockedSlot,
)
from app.modules.booking.slot_service import SlotService
from app.modules.notifications.service import NotificationService
from app.modules.services.models import Service
from app.modules.clients.models import Client

logger = logging.getLogger(__name__)


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_appointment(
        self,
        master_id: int,
        service_id: int,
        target_date: date,
        time_start_str: str,
        client_id: Optional[int] = None,
        client_name: Optional[str] = None,
        client_phone: Optional[str] = None,
        client_comment: Optional[str] = None,
        location_id: Optional[int] = None,
        promotion_id: Optional[int] = None,
        source: str = "mini_app",
    ) -> Appointment:
        """Создать запись, проверив доступность слота и лимит тарифа."""
        from sqlalchemy import func
        from app.modules.core.models import FeatureFlags

        # Проверяем лимит записей по тарифу
        flags_result = await self.db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == master_id)
        )
        flags = flags_result.scalar_one_or_none()
        if flags and flags.max_bookings_per_month:
            month_start = date.today().replace(day=1)
            count_result = await self.db.execute(
                select(func.count(Appointment.id)).where(
                    Appointment.master_id == master_id,
                    Appointment.date >= month_start,
                    Appointment.status.notin_([
                        AppointmentStatus.CANCELLED_BY_CLIENT.value,
                        AppointmentStatus.CANCELLED_BY_MASTER.value,
                    ]),
                )
            )
            current_count = count_result.scalar() or 0
            if current_count >= flags.max_bookings_per_month:
                raise ValueError(
                    f"Лимит записей по тарифу исчерпан ({current_count}/{flags.max_bookings_per_month})"
                )

        # Получаем услугу
        result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            raise ValueError("Service not found")
        if service.master_id != master_id:
            raise ValueError("Service does not belong to this master")

        # Проверяем доступность слота
        slot_service = SlotService(self.db)
        slots = await slot_service.get_available_slots(
            master_id, target_date, service_id, location_id
        )

        available_slot = None
        for slot in slots:
            if slot["start"] == time_start_str and slot["available"]:
                available_slot = slot
                break

        if not available_slot:
            raise ValueError("Selected time slot is not available")

        # Вычисляем time_start и time_end
        hours, minutes = map(int, time_start_str.split(":"))
        time_start = datetime(
            target_date.year, target_date.month, target_date.day,
            hours, minutes,
            tzinfo=timezone.utc,
        )
        time_end = time_start + timedelta(minutes=service.duration_min)

        # Получаем имя клиента
        if client_id and not client_name:
            result = await self.db.execute(
                select(Client).where(Client.id == client_id)
            )
            client = result.scalar_one_or_none()
            if client:
                client_name = client.display_name

        # Создаём запись
        appointment = Appointment(
            master_id=master_id,
            client_id=client_id,
            service_id=service_id,
            location_id=location_id,
            date=target_date,
            time_start=time_start,
            time_end=time_end,
            status=AppointmentStatus.PENDING.value,
            client_name=client_name,
            client_phone=client_phone,
            client_comment=client_comment,
            price_final=int(service.price),
            promotion_id=promotion_id,
            source=source,
        )
        self.db.add(appointment)
        await self.db.flush()

        await self._notify_master_new_booking(
            appointment=appointment,
            service=service,
        )

        return appointment

    async def get_appointments_for_master(
        self,
        master_id: int,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        status: Optional[str] = None,
    ) -> List[Appointment]:
        """Список записей мастера с фильтрами."""
        query = select(Appointment).where(Appointment.master_id == master_id)
        if date_from:
            query = query.where(Appointment.date >= date_from)
        if date_to:
            query = query.where(Appointment.date <= date_to)
        if status:
            query = query.where(Appointment.status == status)
        query = query.order_by(Appointment.time_start)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_appointments_for_client(
        self, client_id: int
    ) -> List[Appointment]:
        """Список записей клиента."""
        result = await self.db.execute(
            select(Appointment)
            .where(Appointment.client_id == client_id)
            .order_by(Appointment.time_start.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, appointment_id: int) -> Optional[Appointment]:
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        return result.scalar_one_or_none()

    async def update_status(
        self,
        appointment: Appointment,
        new_status: str,
        cancel_reason: Optional[str] = None,
        master_comment: Optional[str] = None,
        price_final: Optional[int] = None,
    ) -> Appointment:
        """Обновить статус записи."""
        previous_status = appointment.status
        appointment.status = new_status

        if new_status in (
            AppointmentStatus.CANCELLED_BY_CLIENT.value,
            AppointmentStatus.CANCELLED_BY_MASTER.value,
        ):
            appointment.cancelled_at = datetime.now(timezone.utc)
            appointment.cancel_reason = cancel_reason

        if new_status == AppointmentStatus.COMPLETED.value:
            appointment.completed_at = datetime.now(timezone.utc)
            await self._on_complete(appointment)

        if new_status == AppointmentStatus.NO_SHOW.value:
            await self._on_no_show(appointment)

        if master_comment is not None:
            appointment.master_comment = master_comment
        if price_final is not None:
            appointment.price_final = price_final

        await self.db.flush()

        if new_status != previous_status:
            await self._notify_status_change(appointment, new_status, cancel_reason)

        return appointment

    async def _on_complete(self, appointment: Appointment) -> None:
        """При завершении визита: начислить баллы, проверить стрик, первый визит."""
        if not appointment.client_id:
            return

        from app.modules.clients.service import ClientService
        from app.modules.loyalty.service import LoyaltyService
        from app.modules.masters.models import Master

        loyalty = LoyaltyService(self.db)

        result = await self.db.execute(
            select(Master).where(Master.id == appointment.master_id)
        )
        master = result.scalar_one_or_none()
        if not master:
            return

        # Кэшбэк за визит: 1 балл = loyalty_earn_rate рублей
        earn_rate = master.loyalty_earn_rate or 10
        price = appointment.price_final or 0
        if price > 0 and earn_rate > 0:
            cashback_points = price // earn_rate
            if cashback_points > 0:
                await loyalty.earn_points(
                    master_id=appointment.master_id,
                    client_id=appointment.client_id,
                    points=cashback_points,
                    earn_type="earn_visit",
                    appointment_id=appointment.id,
                    note=f"Кэшбэк за визит ({price}₽)",
                )

        client_service = ClientService(self.db)
        link = await client_service.get_or_create_link(
            master_id=appointment.master_id,
            client_id=appointment.client_id,
            source=appointment.source or "direct",
        )

        is_first = (link.visit_count or 0) == 0
        if is_first:
            first_bonus = master.loyalty_first_visit_bonus or 200
            if first_bonus > 0:
                await loyalty.earn_points(
                    master_id=appointment.master_id,
                    client_id=appointment.client_id,
                    points=first_bonus,
                    earn_type="earn_first_visit",
                    appointment_id=appointment.id,
                    note="Бонус за первый визит",
                )

        today = date.today()
        link.visit_count = (link.visit_count or 0) + 1
        link.total_spent = (link.total_spent or 0) + price
        link.last_visit_date = today
        if not link.first_visit_date:
            link.first_visit_date = today

        # Проверка стрика
        await loyalty.check_streak(
            master_id=appointment.master_id,
            client_id=appointment.client_id,
        )

    async def _notify_master_new_booking(
        self,
        appointment: Appointment,
        service: Service,
    ) -> None:
        """Отправить push мастеру при создании записи клиентом."""
        if not appointment.client_id:
            return
        try:
            time_str = (
                appointment.time_start.strftime("%d.%m в %H:%M")
                if appointment.time_start
                else ""
            )
            client_name = appointment.client_name or "Клиент"
            text = (
                f"📅 Новая запись!\n"
                f"Клиент: {client_name}\n"
                f"Услуга: {service.name}\n"
                f"{time_str}"
            ).strip()
            await NotificationService.send_by_master_id(
                self.db,
                appointment.master_id,
                text,
                button_text="Открыть расписание",
                button_url=f"{settings.APP_URL}?startParam=dashboard",
            )
        except Exception as e:
            logger.error(
                f"Failed to notify master {appointment.master_id} "
                f"about new booking {appointment.id}: {e}"
            )

    async def _notify_status_change(
        self,
        appointment: Appointment,
        new_status: str,
        cancel_reason: Optional[str],
    ) -> None:
        """Отправить push при изменении статуса."""
        try:
            time_str = (
                appointment.time_start.strftime("%d.%m в %H:%M")
                if appointment.time_start
                else ""
            )
            client_name = appointment.client_name or "Клиент"

            if new_status == AppointmentStatus.CANCELLED_BY_CLIENT.value:
                reason_line = f"\nПричина: {cancel_reason}" if cancel_reason else ""
                text = (
                    f"❌ Клиент отменил запись\n"
                    f"{client_name} — {time_str}{reason_line}"
                )
                await NotificationService.send_by_master_id(
                    self.db,
                    appointment.master_id,
                    text,
                    button_text="Открыть расписание",
                    button_url=f"{settings.APP_URL}?startParam=dashboard",
                )

            elif new_status == AppointmentStatus.CANCELLED_BY_MASTER.value:
                if not appointment.client_id:
                    return
                reason_line = f"\nПричина: {cancel_reason}" if cancel_reason else ""
                text = (
                    f"❌ Мастер отменил вашу запись\n"
                    f"{time_str}{reason_line}"
                )
                await NotificationService.send_by_client_id(
                    self.db,
                    appointment.client_id,
                    text,
                    button_text="Мои записи",
                    button_url=f"{settings.APP_URL}?startParam=my_bookings",
                )

            elif new_status == AppointmentStatus.CONFIRMED.value:
                if not appointment.client_id:
                    return
                text = (
                    f"✅ Ваша запись подтверждена\n{time_str}"
                ).strip()
                await NotificationService.send_by_client_id(
                    self.db,
                    appointment.client_id,
                    text,
                    button_text="Мои записи",
                    button_url=f"{settings.APP_URL}?startParam=my_bookings",
                )

            elif new_status == AppointmentStatus.COMPLETED.value:
                if not appointment.client_id:
                    return
                text = (
                    f"✅ Визит завершён\n{time_str}\n"
                    f"Спасибо, что были у нас! Оставьте отзыв 🌟"
                )
                await NotificationService.send_by_client_id(
                    self.db,
                    appointment.client_id,
                    text,
                    button_text="Оставить отзыв",
                    button_url=f"{settings.APP_URL}?startParam=review_{appointment.id}",
                )

            elif new_status == AppointmentStatus.NO_SHOW.value:
                if not appointment.client_id:
                    return
                text = (
                    f"⚠️ Вы не пришли на запись\n{time_str}\n"
                    f"Пожалуйста, отменяйте запись заранее, "
                    f"если не можете прийти."
                )
                await NotificationService.send_by_client_id(
                    self.db,
                    appointment.client_id,
                    text,
                    button_text="Записаться снова",
                    button_url=f"{settings.APP_URL}?startParam=my_bookings",
                )
        except Exception as e:
            logger.error(
                f"Failed to send status-change notification "
                f"for appointment {appointment.id} (-> {new_status}): {e}"
            )

    async def _on_no_show(self, appointment: Appointment) -> None:
        """При no-show: увеличить счётчик клиента."""
        if not appointment.client_id:
            return

        from app.modules.clients.models import ClientMasterLink

        result = await self.db.execute(
            select(ClientMasterLink).where(
                ClientMasterLink.master_id == appointment.master_id,
                ClientMasterLink.client_id == appointment.client_id,
            )
        )
        link = result.scalar_one_or_none()
        if link:
            link.no_show_count = (link.no_show_count or 0) + 1

    # ── Blocked slots ───────────────────────────────────────

    async def create_blocked_slot(
        self, master_id: int, data: dict
    ) -> BlockedSlot:
        from datetime import time as time_type
        blocked = BlockedSlot(
            master_id=master_id,
            date_from=data["date_from"],
            date_to=data["date_to"],
            time_from=time_type.fromisoformat(data["time_from"]) if data.get("time_from") else None,
            time_to=time_type.fromisoformat(data["time_to"]) if data.get("time_to") else None,
            reason=data.get("reason"),
            location_id=data.get("location_id"),
        )
        self.db.add(blocked)
        await self.db.flush()
        return blocked

    async def get_blocked_slots(self, master_id: int) -> List[BlockedSlot]:
        result = await self.db.execute(
            select(BlockedSlot)
            .where(
                BlockedSlot.master_id == master_id,
                BlockedSlot.date_to >= date.today(),
            )
            .order_by(BlockedSlot.date_from)
        )
        return list(result.scalars().all())

    async def delete_blocked_slot(self, blocked_id: int, master_id: int) -> bool:
        result = await self.db.execute(
            select(BlockedSlot).where(
                BlockedSlot.id == blocked_id,
                BlockedSlot.master_id == master_id,
            )
        )
        blocked = result.scalar_one_or_none()
        if blocked:
            await self.db.delete(blocked)
            await self.db.flush()
            return True
        return False
