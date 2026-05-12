"""
Booking router — /api/v1/booking
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.booking.schemas import (
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    DaySlots,
    TimeSlot,
    BlockedSlotCreate,
    BlockedSlotOut,
)
from app.modules.booking.service import BookingService
from app.modules.booking.slot_service import SlotService
from app.modules.masters.service import MasterService
from app.modules.clients.models import Client

router = APIRouter()


# ── Слоты ──────────────────────────────────────────────────

@router.get("/slots/{master_id}", response_model=DaySlots)
async def get_slots(
    master_id: int,
    target_date: date = Query(..., alias="date"),
    service_id: int = Query(...),
    location_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Получить доступные слоты мастера на дату."""
    slot_service = SlotService(db)
    slots = await slot_service.get_available_slots(
        master_id, target_date, service_id, location_id
    )
    return DaySlots(
        date=target_date,
        slots=[TimeSlot(**s) for s in slots],
    )


# ── Записи ─────────────────────────────────────────────────

@router.post("/", response_model=BookingOut, status_code=201)
async def create_booking(
    body: BookingCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать запись (от клиента или мастера вручную)."""
    # Определяем client_id
    client_id = None
    if user.get("role") == "client":
        from sqlalchemy import select
        result = await db.execute(
            select(Client).where(Client.identity_id == int(user["sub"]))
        )
        client = result.scalar_one_or_none()
        if client:
            client_id = client.id

    booking_service = BookingService(db)
    try:
        appointment = await booking_service.create_appointment(
            master_id=body.master_id,
            service_id=body.service_id,
            target_date=body.date,
            time_start_str=body.time_start,
            client_id=client_id,
            client_name=body.client_name,
            client_phone=body.client_phone,
            client_comment=body.client_comment,
            location_id=body.location_id,
            promotion_id=body.promotion_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return appointment


@router.get("/master", response_model=List[BookingOut])
async def get_master_bookings(
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список записей мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = BookingService(db)
    return await service.get_appointments_for_master(
        master.id, date_from, date_to, status
    )


@router.get("/client", response_model=List[BookingOut])
async def get_client_bookings(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список записей клиента."""
    from sqlalchemy import select
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    service = BookingService(db)
    return await service.get_appointments_for_client(client.id)


@router.patch("/{appointment_id}", response_model=BookingOut)
async def update_booking_status(
    appointment_id: int,
    body: BookingStatusUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить статус записи (confirm, cancel, complete, no_show)."""
    service = BookingService(db)
    appointment = await service.get_by_id(appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Проверяем права: мастер или клиент
    identity_id = int(user["sub"])
    master = await MasterService(db).get_by_identity(identity_id)

    is_master = master and appointment.master_id == master.id

    if not is_master and user.get("role") != "superadmin":
        # Клиент может только отменить
        if body.status != "cancelled_by_client":
            raise HTTPException(status_code=403, detail="Clients can only cancel bookings")

    updated = await service.update_status(
        appointment,
        body.status,
        cancel_reason=body.cancel_reason,
        master_comment=body.master_comment,
        price_final=body.price_final,
    )
    return updated


# ── Блокировки ─────────────────────────────────────────────

@router.post("/blocked", response_model=BlockedSlotOut, status_code=201)
async def create_blocked_slot(
    body: BlockedSlotCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать блокировку (выходной/отпуск)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = BookingService(db)
    blocked = await service.create_blocked_slot(master.id, body.model_dump())
    return BlockedSlotOut(
        id=blocked.id,
        date_from=blocked.date_from,
        date_to=blocked.date_to,
        time_from=blocked.time_from.isoformat() if blocked.time_from else None,
        time_to=blocked.time_to.isoformat() if blocked.time_to else None,
        reason=blocked.reason,
    )


@router.get("/blocked", response_model=List[BlockedSlotOut])
async def get_blocked_slots(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список блокировок мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = BookingService(db)
    blocked_list = await service.get_blocked_slots(master.id)
    return [
        BlockedSlotOut(
            id=b.id,
            date_from=b.date_from,
            date_to=b.date_to,
            time_from=b.time_from.isoformat() if b.time_from else None,
            time_to=b.time_to.isoformat() if b.time_to else None,
            reason=b.reason,
        )
        for b in blocked_list
    ]


@router.delete("/blocked/{blocked_id}", status_code=204)
async def delete_blocked_slot(
    blocked_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить блокировку."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = BookingService(db)
    deleted = await service.delete_blocked_slot(blocked_id, master.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Blocked slot not found")
