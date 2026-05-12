"""
Consultations router — /api/v1/consultations
Онлайн-консультации: слоты, бронирование, управление.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, get_current_client
from app.core.feature_flags import require_feature
from app.modules.consultations.service import ConsultationService
from app.modules.consultations.schemas import (
    ConsultationSlotCreate,
    ConsultationSlotBulkCreate,
    ConsultationSlotOut,
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationOut,
    ConsultationConvert,
    ConsultationStats,
)

router = APIRouter()


# ── Slots (мастер) ─────────────────────────────────────────────

@router.post("/slots", response_model=ConsultationSlotOut, status_code=201)
async def create_slot(
    body: ConsultationSlotCreate,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Создать слот для консультации."""
    svc = ConsultationService(db)
    slot = await svc.create_slot(
        master_id=master.id,
        service_id=body.service_id,
        slot_start=body.slot_start,
        slot_end=body.slot_end,
    )
    return slot


@router.post("/slots/bulk", response_model=List[ConsultationSlotOut], status_code=201)
async def create_slots_bulk(
    body: ConsultationSlotBulkCreate,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Создать несколько слотов за раз."""
    svc = ConsultationService(db)
    slots = await svc.create_slots_bulk(
        master_id=master.id,
        service_id=body.service_id,
        slots_data=body.slots,
    )
    return slots


@router.get("/slots/{master_id}", response_model=List[ConsultationSlotOut])
async def get_available_slots(
    master_id: int,
    service_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """Доступные слоты мастера для консультаций (публичный)."""
    svc = ConsultationService(db)
    return await svc.get_available_slots(master_id, service_id)


@router.delete("/slots/{slot_id}", status_code=204)
async def delete_slot(
    slot_id: int,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Удалить слот (только мастер-владелец)."""
    svc = ConsultationService(db)
    ok = await svc.delete_slot(slot_id, master.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Slot not found")


# ── Booking (клиент) ───────────────────────────────────────────

@router.post("/book", response_model=ConsultationOut, status_code=201)
async def book_consultation(
    body: ConsultationCreate,
    client=Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    """Забронировать онлайн-консультацию."""
    svc = ConsultationService(db)
    from app.modules.consultations.models import ConsultationSlot
    slot = await db.get(ConsultationSlot, body.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    try:
        consultation = await svc.book_consultation(
            master_id=slot.master_id,
            client_id=client.id,
            service_id=body.service_id,
            slot_id=body.slot_id,
            client_note=body.client_note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return consultation


@router.get("/my", response_model=List[ConsultationOut])
async def get_my_consultations(
    status: Optional[str] = None,
    client=Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
):
    """Мои консультации (клиент)."""
    svc = ConsultationService(db)
    return await svc.get_client_consultations(client.id, status)


# ── Management (мастер) ────────────────────────────────────────

@router.get("/master", response_model=List[ConsultationOut])
async def get_master_consultations(
    status: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = 0,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Консультации мастера."""
    svc = ConsultationService(db)
    return await svc.get_master_consultations(master.id, status, limit, offset)


@router.get("/stats", response_model=ConsultationStats)
async def get_consultation_stats(
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Статистика консультаций мастера (конверсия и т.д.)."""
    svc = ConsultationService(db)
    return await svc.get_stats(master.id)


@router.get("/{consultation_id}", response_model=ConsultationOut)
async def get_consultation(
    consultation_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Детали консультации."""
    svc = ConsultationService(db)
    c = await svc.get_consultation(consultation_id)
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return c


@router.patch("/{consultation_id}", response_model=ConsultationOut)
async def update_consultation(
    consultation_id: int,
    body: ConsultationUpdate,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Обновить консультацию (статус, заметки, ссылку)."""
    svc = ConsultationService(db)
    c = await svc.update_consultation(
        consultation_id=consultation_id,
        master_id=master.id,
        status=body.status,
        master_note=body.master_note,
        meeting_url=body.meeting_url,
    )
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return c


@router.post("/{consultation_id}/cancel", response_model=ConsultationOut)
async def cancel_consultation(
    consultation_id: int,
    reason: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отменить консультацию (мастер или клиент)."""
    role = user.get("role", "")
    svc = ConsultationService(db)

    if role in ("master", "superadmin"):
        from app.modules.masters.models import Master
        from sqlalchemy import select as sa_select
        identity_id = user.get("identity_id")
        result = await db.execute(
            sa_select(Master).where(Master.identity_id == identity_id)
        )
        master = result.scalar_one_or_none()
        if not master:
            raise HTTPException(status_code=403, detail="Master not found")
        c = await svc.cancel_consultation(consultation_id, master.id, True, reason)
    else:
        from app.modules.clients.models import Client
        from sqlalchemy import select as sa_select
        identity_id = user.get("identity_id")
        result = await db.execute(
            sa_select(Client).where(Client.identity_id == identity_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=403, detail="Client not found")
        c = await svc.cancel_consultation(consultation_id, client.id, False, reason)

    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return c


@router.post("/{consultation_id}/convert", response_model=ConsultationOut)
async def convert_to_appointment(
    consultation_id: int,
    body: ConsultationConvert,
    master=Depends(require_feature("consultations_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Привязать запись (appointment) к консультации для трекинга конверсии."""
    svc = ConsultationService(db)
    c = await svc.convert_to_appointment(
        consultation_id=consultation_id,
        appointment_id=body.appointment_id,
        master_id=master.id,
    )
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return c
