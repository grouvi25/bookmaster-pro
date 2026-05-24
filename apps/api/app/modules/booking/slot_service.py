"""
SlotService — генерация доступных слотов с учётом расписания,
записей, блокировок и буфера.
"""

from datetime import date, datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

from app.modules.booking.models import (
    ScheduleTemplate,
    BlockedSlot,
    Appointment,
    AppointmentStatus,
)
from app.modules.masters.models import Master
from app.modules.services.models import Service


ACTIVE_STATUSES = [
    AppointmentStatus.PENDING.value,
    AppointmentStatus.CONFIRMED.value,
    AppointmentStatus.PAID.value,
    AppointmentStatus.IN_PROGRESS.value,
]


class SlotService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_available_slots(
        self,
        master_id: int,
        target_date: date,
        service_id: int,
        location_id: Optional[int] = None,
        client_tz: Optional[str] = None,
    ) -> List[dict]:
        """
        Генерирует список доступных слотов для заданной даты.
        Учитывает расписание, буфер, существующие записи, блокировки.
        """
        # 1. Получаем мастера
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        if not master:
            return []

        # 2. Получаем услугу
        result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        service = result.scalar_one_or_none()
        if not service:
            return []

        duration = service.duration_min
        buffer = master.buffer_minutes

        # 3. Получаем шаблон расписания на этот день недели ИЛИ specific_date
        day_of_week = target_date.weekday()
        result = await self.db.execute(
            select(ScheduleTemplate).where(
                ScheduleTemplate.master_id == master_id,
                ScheduleTemplate.is_active.is_(True),
                # Ищем: конкретная дата ИЛИ день недели
                (ScheduleTemplate.specific_date == target_date)
                | (
                    ScheduleTemplate.specific_date.is_(None)
                    & (ScheduleTemplate.day_of_week == day_of_week)
                ),
            )
        )
        templates = list(result.scalars().all())
        if not templates:
            return []

        # specific_date имеет приоритет над day_of_week
        specific = [t for t in templates if t.specific_date is not None]
        if specific:
            templates = specific

        # Фильтруем по локации если указана
        if location_id:
            templates = [t for t in templates if t.location_id == location_id or t.location_id is None]

        # 4. Получаем существующие записи на этот день
        result = await self.db.execute(
            select(Appointment).where(
                Appointment.master_id == master_id,
                Appointment.date == target_date,
                Appointment.status.in_(ACTIVE_STATUSES),
            )
        )
        existing_appointments = list(result.scalars().all())

        # 5. Получаем блокировки
        result = await self.db.execute(
            select(BlockedSlot).where(
                BlockedSlot.master_id == master_id,
                BlockedSlot.date_from <= target_date,
                BlockedSlot.date_to >= target_date,
            )
        )
        blocked = list(result.scalars().all())

        # 6. Генерируем слоты
        slots = []
        for template in templates:
            template_slots = self._generate_slots_from_template(
                template=template,
                target_date=target_date,
                duration=duration,
                buffer=buffer,
                existing=existing_appointments,
                blocked=blocked,
                client_tz=client_tz,
            )
            slots.extend(template_slots)

        return slots

    def _generate_slots_from_template(
        self,
        template: ScheduleTemplate,
        target_date: date,
        duration: int,
        buffer: int,
        existing: List[Appointment],
        blocked: List[BlockedSlot],
        client_tz: Optional[str] = None,
    ) -> List[dict]:
        """Генерация слотов из одного шаблона расписания."""
        slots = []
        step = template.slot_step_min or 30

        current_time = datetime.combine(target_date, template.start_time)
        end_time = datetime.combine(target_date, template.end_time)

        while current_time + timedelta(minutes=duration) <= end_time:
            slot_end = current_time + timedelta(minutes=duration)

            # Проверяем перерыв
            if template.break_start and template.break_end:
                break_start = datetime.combine(target_date, template.break_start)
                break_end = datetime.combine(target_date, template.break_end)
                if current_time < break_end and slot_end > break_start:
                    current_time = break_end
                    continue

            # Проверяем пересечение с существующими записями
            is_available = True
            for appt in existing:
                appt_start = appt.time_start
                appt_end = appt.time_end
                # Конвертируем UTC → локальное время мастера, потом снимаем tzinfo
                # (current_time — naive local, appt.time_start — aware UTC)
                tz_local = ZoneInfo(client_tz) if client_tz else ZoneInfo(settings.TIMEZONE)
                if appt_start and appt_start.tzinfo is not None:
                    appt_start = appt_start.astimezone(tz_local).replace(tzinfo=None)
                elif appt_start and hasattr(appt_start, 'replace'):
                    appt_start = appt_start.replace(tzinfo=None)
                if appt_end and appt_end.tzinfo is not None:
                    appt_end = appt_end.astimezone(tz_local).replace(tzinfo=None)
                elif appt_end and hasattr(appt_end, 'replace'):
                    appt_end = appt_end.replace(tzinfo=None)
                if not appt_start or not appt_end:
                    continue
                # Буфер: защищаем окно после И перед записью
                appt_start_with_buffer = appt_start - timedelta(minutes=buffer)
                appt_end_with_buffer = appt_end + timedelta(minutes=buffer)
                if current_time < appt_end_with_buffer and slot_end > appt_start_with_buffer:
                    is_available = False
                    break

            # Проверяем блокировки
            if is_available:
                for block in blocked:
                    if block.time_from and block.time_to:
                        block_start = datetime.combine(target_date, block.time_from)
                        block_end = datetime.combine(target_date, block.time_to)
                        if current_time < block_end and slot_end > block_start:
                            is_available = False
                            break
                    else:
                        # Весь день заблокирован
                        is_available = False
                        break

            # Не показываем прошедшие слоты (в таймзоне клиента)
            try:
                tz = ZoneInfo(client_tz) if client_tz else ZoneInfo(settings.TIMEZONE)
            except (KeyError, ValueError):
                tz = ZoneInfo(settings.TIMEZONE)
            now_local = datetime.now(tz).replace(tzinfo=None)
            today_local = now_local.date()
            if target_date == today_local and current_time <= now_local:
                is_available = False

            slots.append({
                "start": current_time.strftime("%H:%M"),
                "end": slot_end.strftime("%H:%M"),
                "available": is_available,
            })

            current_time += timedelta(minutes=step)

        return slots
