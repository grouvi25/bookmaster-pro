"""
Booking router — /api/v1/booking
"""

from datetime import date, datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

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
    AvailableDatesOut,
    BlockedSlotCreate,
    BlockedSlotOut,
)
from app.modules.booking.service import BookingService
from app.modules.booking.slot_service import SlotService
from app.modules.masters.service import MasterService
from app.modules.clients.models import Client
from app.modules.booking.models import Appointment

router = APIRouter()


def _enrich_booking(appt: Appointment) -> dict:
    """Add service_name, duration_min, time, master_name from relationships."""
    data = {
        "id": appt.id,
        "master_id": appt.master_id,
        "client_id": appt.client_id,
        "service_id": appt.service_id,
        "date": appt.date,
        "time_start": appt.time_start,
        "time_end": appt.time_end,
        "status": appt.status,
        "client_name": appt.client_name,
        "client_phone": appt.client_phone,
        "client_comment": appt.client_comment,
        "master_comment": appt.master_comment,
        "price_final": appt.price_final,
        "discount_amount": appt.discount_amount or 0,
        "source": appt.source or "mini_app",
        "time": appt.time_start.strftime("%H:%M") if appt.time_start else None,
    }
    if appt.service:
        data["service_name"] = appt.service.name
        data["duration_min"] = appt.service.duration_min
    if appt.master:
        data["master_name"] = appt.master.display_name
    return data


# ── Слоты ──────────────────────────────────────────────────

@router.get("/available-dates", response_model=AvailableDatesOut)
async def get_available_dates(
    master_id: int = Query(...),
    service_id: int = Query(...),
    days_ahead: int = Query(30),
    location_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Получить список дат с доступными слотами на ближайшие N дней."""
    from datetime import timedelta as td
    from app.core.config import settings
    slot_service = SlotService(db)
    available = []
    tz = ZoneInfo(settings.TIMEZONE)
    today = datetime.now(tz).date()
    for offset in range(days_ahead):
        d = today + td(days=offset)
        slots = await slot_service.get_available_slots(
            master_id, d, service_id, location_id
        )
        if any(s["available"] for s in slots):
            available.append(d)
    return AvailableDatesOut(dates=available)


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
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    query = (
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.master))
        .where(Appointment.master_id == master.id)
    )
    if date_from:
        query = query.where(Appointment.date >= date_from)
    if date_to:
        query = query.where(Appointment.date <= date_to)
    if status:
        query = query.where(Appointment.status == status)
    query = query.order_by(Appointment.time_start)
    result = await db.execute(query)
    appointments = list(result.scalars().all())
    return [_enrich_booking(a) for a in appointments]


@router.get("/client", response_model=List[BookingOut])
async def get_client_bookings(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список записей клиента."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.service), selectinload(Appointment.master))
        .where(Appointment.client_id == client.id)
        .order_by(Appointment.time_start.desc())
    )
    appointments = list(result.scalars().all())
    return [_enrich_booking(a) for a in appointments]


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


@router.get("/noshow-risk")
async def check_noshow_risk(
    master_id: int = Query(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Проверить риск no-show для текущего клиента."""
    from sqlalchemy import select as sel
    result = await db.execute(
        sel(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    from app.modules.booking.noshow_scoring import check_booking_allowed
    return await check_booking_allowed(db, client.id, master_id)


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
