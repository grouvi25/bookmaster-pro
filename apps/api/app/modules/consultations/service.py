"""
Consultations service — бизнес-логика онлайн-консультаций.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.consultations.models import (
    Consultation,
    ConsultationSlot,
    ConsultationStatus,
)


class ConsultationService:

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Slots ──────────────────────────────────────────────────

    async def create_slot(
        self,
        master_id: int,
        service_id: int,
        slot_start: datetime,
        slot_end: datetime,
    ) -> ConsultationSlot:
        slot = ConsultationSlot(
            master_id=master_id,
            service_id=service_id,
            slot_start=slot_start,
            slot_end=slot_end,
            is_available=True,
        )
        self.db.add(slot)
        await self.db.flush()
        return slot

    async def create_slots_bulk(
        self,
        master_id: int,
        service_id: int,
        slots_data: list,
    ) -> List[ConsultationSlot]:
        created = []
        for s in slots_data:
            slot = ConsultationSlot(
                master_id=master_id,
                service_id=service_id,
                slot_start=s.slot_start,
                slot_end=s.slot_end,
                is_available=True,
            )
            self.db.add(slot)
            created.append(slot)
        await self.db.flush()
        return created

    async def get_available_slots(
        self,
        master_id: int,
        service_id: Optional[int] = None,
    ) -> List[ConsultationSlot]:
        q = select(ConsultationSlot).where(
            ConsultationSlot.master_id == master_id,
            ConsultationSlot.is_available.is_(True),
            ConsultationSlot.slot_start > datetime.now(timezone.utc),
        )
        if service_id:
            q = q.where(ConsultationSlot.service_id == service_id)
        q = q.order_by(ConsultationSlot.slot_start)

        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def delete_slot(self, slot_id: int, master_id: int) -> bool:
        slot = await self.db.get(ConsultationSlot, slot_id)
        if not slot or slot.master_id != master_id:
            return False
        await self.db.delete(slot)
        await self.db.flush()
        return True

    # ── Consultations ──────────────────────────────────────────

    async def book_consultation(
        self,
        master_id: int,
        client_id: int,
        service_id: int,
        slot_id: int,
        client_note: Optional[str] = None,
    ) -> Consultation:
        slot = await self.db.get(ConsultationSlot, slot_id)
        if not slot or not slot.is_available:
            raise ValueError("Slot is not available")
        if slot.master_id != master_id:
            raise ValueError("Slot does not belong to this master")

        meeting_url = f"https://meet.jit.si/bm-{uuid.uuid4().hex[:12]}"

        from app.modules.services.models import Service
        svc = await self.db.get(Service, service_id)
        price = int(svc.price) if svc and svc.price else None

        consultation = Consultation(
            master_id=master_id,
            client_id=client_id,
            service_id=service_id,
            slot_id=slot_id,
            slot_start=slot.slot_start,
            slot_end=slot.slot_end,
            status=ConsultationStatus.CONFIRMED.value,
            meeting_url=meeting_url,
            client_note=client_note,
            price=price,
        )
        self.db.add(consultation)

        slot.is_available = False
        await self.db.flush()

        # Уведомить мастера о новой консультации
        await self._notify_master_new_consultation(consultation, slot)

        return consultation

    async def get_consultation(self, consultation_id: int) -> Optional[Consultation]:
        return await self.db.get(Consultation, consultation_id)

    async def get_master_consultations(
        self,
        master_id: int,
        status_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Consultation]:
        q = select(Consultation).where(Consultation.master_id == master_id)
        if status_filter:
            q = q.where(Consultation.status == status_filter)
        q = q.order_by(Consultation.slot_start.desc()).offset(offset).limit(limit)

        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_client_consultations(
        self,
        client_id: int,
        status_filter: Optional[str] = None,
    ) -> List[Consultation]:
        q = select(Consultation).where(Consultation.client_id == client_id)
        if status_filter:
            q = q.where(Consultation.status == status_filter)
        q = q.order_by(Consultation.slot_start.desc())

        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def update_consultation(
        self,
        consultation_id: int,
        master_id: int,
        status: Optional[str] = None,
        master_note: Optional[str] = None,
        meeting_url: Optional[str] = None,
    ) -> Optional[Consultation]:
        consultation = await self.db.get(Consultation, consultation_id)
        if not consultation or consultation.master_id != master_id:
            return None

        if status:
            consultation.status = status
            if status == ConsultationStatus.COMPLETED.value:
                consultation.completed_at = datetime.now(timezone.utc)
            elif status == ConsultationStatus.CANCELLED.value:
                consultation.cancelled_at = datetime.now(timezone.utc)
                # Free the slot if cancelled
                if consultation.slot_id:
                    slot = await self.db.get(ConsultationSlot, consultation.slot_id)
                    if slot:
                        slot.is_available = True

        if master_note is not None:
            consultation.master_note = master_note
        if meeting_url is not None:
            consultation.meeting_url = meeting_url

        await self.db.flush()
        return consultation

    async def cancel_consultation(
        self,
        consultation_id: int,
        user_id: int,
        is_master: bool,
        reason: Optional[str] = None,
    ) -> Optional[Consultation]:
        consultation = await self.db.get(Consultation, consultation_id)
        if not consultation:
            return None

        if is_master and consultation.master_id != user_id:
            return None
        if not is_master and consultation.client_id != user_id:
            return None

        consultation.status = ConsultationStatus.CANCELLED.value
        consultation.cancelled_at = datetime.now(timezone.utc)
        consultation.cancel_reason = reason

        if consultation.slot_id:
            slot = await self.db.get(ConsultationSlot, consultation.slot_id)
            if slot:
                slot.is_available = True

        await self.db.flush()
        return consultation

    async def convert_to_appointment(
        self,
        consultation_id: int,
        appointment_id: int,
        master_id: int,
    ) -> Optional[Consultation]:
        consultation = await self.db.get(Consultation, consultation_id)
        if not consultation or consultation.master_id != master_id:
            return None
        consultation.converted_appointment_id = appointment_id
        await self.db.flush()
        return consultation

    async def _notify_master_new_consultation(
        self,
        consultation: "Consultation",
        slot: "ConsultationSlot",
    ) -> None:
        """Уведомить мастера о новой бронировке консультации."""
        try:
            from app.modules.masters.models import Master
            from app.modules.notifications.service import NotificationService
            from app.core.config import settings

            result = await self.db.execute(
                select(Master).where(Master.id == consultation.master_id)
            )
            master = result.scalar_one_or_none()
            if not master or not master.notify_new_booking:
                return

            time_str = (
                slot.slot_start.strftime("%d.%m в %H:%M")
                if slot.slot_start
                else ""
            )
            text = (
                f"📹 Новая онлайн-консультация!\n"
                f"{time_str}"
            )
            await NotificationService.send_by_master_id(
                self.db,
                consultation.master_id,
                text,
                button_text="Открыть расписание",
                button_url=f"{settings.APP_URL}?startParam=dashboard",
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(
                f"Failed to notify master {consultation.master_id} "
                f"about new consultation {consultation.id}: {e}"
            )

    # ── Stats ──────────────────────────────────────────────────

    async def get_stats(self, master_id: int) -> dict:
        total_r = await self.db.execute(
            select(func.count(Consultation.id)).where(
                Consultation.master_id == master_id
            )
        )
        total = total_r.scalar() or 0

        completed_r = await self.db.execute(
            select(func.count(Consultation.id)).where(
                and_(
                    Consultation.master_id == master_id,
                    Consultation.status == ConsultationStatus.COMPLETED.value,
                )
            )
        )
        completed = completed_r.scalar() or 0

        cancelled_r = await self.db.execute(
            select(func.count(Consultation.id)).where(
                and_(
                    Consultation.master_id == master_id,
                    Consultation.status == ConsultationStatus.CANCELLED.value,
                )
            )
        )
        cancelled = cancelled_r.scalar() or 0

        converted_r = await self.db.execute(
            select(func.count(Consultation.id)).where(
                and_(
                    Consultation.master_id == master_id,
                    Consultation.converted_appointment_id.isnot(None),
                )
            )
        )
        converted = converted_r.scalar() or 0

        conversion_rate = (converted / completed * 100) if completed > 0 else 0.0

        return {
            "total": total,
            "completed": completed,
            "cancelled": cancelled,
            "conversion_rate": round(conversion_rate, 1),
        }
