"""
SlotService — генерация доступных слотов с учётом расписания,
записей, блокировок и буфера.
"""

from datetime import date, time, datetime, timedelta
from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

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

        # 3. Получаем шаблон расписания на этот день недели
        day_of_week = target_date.weekday()
        result = await self.db.execute(
            select(ScheduleTemplate).where(
                ScheduleTemplate.master_id == master_id,
                ScheduleTemplate.day_of_week == day_of_week,
                ScheduleTemplate.is_active.is_(True),
            )
        )
        templates = list(result.scalars().all())
        if not templates:
            return []

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
    ) -> List[dict]:
        """Генерация слотов из одного шаблона расписания."""
        slots = []
        step = 30  # шаг сетки в минутах
        slot_duration = duration + buffer

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
                # Добавляем буфер к существующей записи
                appt_end_with_buffer = appt_end + timedelta(minutes=buffer)
                if current_time < appt_end_with_buffer and slot_end > appt_start:
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

            # Не показываем прошедшие слоты
            if target_date == date.today() and current_time <= datetime.now():
                is_available = False

            slots.append({
                "start": current_time.strftime("%H:%M"),
                "end": slot_end.strftime("%H:%M"),
                "available": is_available,
            })

            current_time += timedelta(minutes=step)

        return slots
