"""
Booking service — создание, отмена, завершение записей.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.booking.models import (
    Appointment,
    AppointmentStatus,
    BlockedSlot,
)
from app.modules.booking.slot_service import SlotService, ACTIVE_STATUSES
from app.modules.services.models import Service
from app.modules.clients.models import Client


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
        """Создать запись, проверив доступность слота."""
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
        appointment.status = new_status

        if new_status in (
            AppointmentStatus.CANCELLED_BY_CLIENT.value,
            AppointmentStatus.CANCELLED_BY_MASTER.value,
        ):
            appointment.cancelled_at = datetime.now(timezone.utc)
            appointment.cancel_reason = cancel_reason

        if new_status == AppointmentStatus.COMPLETED.value:
            appointment.completed_at = datetime.now(timezone.utc)

        if master_comment is not None:
            appointment.master_comment = master_comment
        if price_final is not None:
            appointment.price_final = price_final

        await self.db.flush()
        return appointment

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
