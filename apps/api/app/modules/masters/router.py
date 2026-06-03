"""
Masters router — /api/v1/masters
"""

import io
import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.modules.masters.models import Master
from app.modules.masters.schemas import (
    MasterProfileOut,
    MasterProfileUpdate,
    NotificationSettingsOut,
    NotificationSettingsUpdate,
    ScheduleTemplateIn,
    ScheduleTemplateOut,
)
from app.modules.masters.service import MasterService

router = APIRouter()


@router.get("/me", response_model=MasterProfileOut)
async def get_my_profile(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить профиль текущего мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    return master


@router.patch("/me", response_model=MasterProfileOut)
async def update_my_profile(
    body: MasterProfileUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить профиль мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master profile not found")
    data = body.model_dump(exclude_unset=True)
    # Тариф A (раздельные платежи / сплиты) включается автоматически,
    # когда мастер привязал свой суб-счёт YooKassa. Сбросил счёт —
    # вернулись на тариф B (обычная подписка, без сплитов).
    # Применяем напрямую, т.к. update_profile игнорирует None (нужно для сброса).
    if "yookassa_account_id" in data:
        acct = (data.pop("yookassa_account_id") or "").strip() or None
        master.yookassa_account_id = acct
        master.tariff_type = "A" if acct else "B"
    updated = await service.update_profile(master, data)
    return updated


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/search/nearby")
async def search_nearby_masters(
    lat: float = Query(..., description="Широта"),
    lng: float = Query(..., description="Долгота"),
    radius_km: float = Query(10, description="Радиус поиска в км"),
    specialization: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Геопоиск мастеров по координатам (Haversine)."""
    query = select(Master).where(
        and_(
            Master.latitude.isnot(None),
            Master.longitude.isnot(None),
            Master.is_active.is_(True),
        )
    )
    if specialization:
        query = query.where(Master.specialization.ilike(f"%{specialization}%"))

    result = await db.execute(query)
    masters = result.scalars().all()

    nearby = []
    for m in masters:
        dist = _haversine_km(lat, lng, m.latitude, m.longitude)
        if dist <= radius_km:
            nearby.append({
                "id": m.id,
                "display_name": m.display_name,
                "specialization": m.specialization,
                "slug": m.slug,
                "avatar_url": m.avatar_url,
                "rating_avg": m.rating_avg,
                "rating_count": m.rating_count,
                "distance_km": round(dist, 1),
                "latitude": m.latitude,
                "longitude": m.longitude,
            })

    nearby.sort(key=lambda x: x["distance_km"])
    return nearby[:limit]


@router.get("/{slug}", response_model=MasterProfileOut)
async def get_master_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Получить публичный профиль мастера по slug."""
    service = MasterService(db)
    master = await service.get_by_slug(slug)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    return master


# ── Настройки уведомлений ──────────────────────────────────

@router.get("/me/notification-settings", response_model=NotificationSettingsOut)
async def get_notification_settings(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить настройки уведомлений мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    return master


@router.patch("/me/notification-settings", response_model=NotificationSettingsOut)
async def update_notification_settings(
    body: NotificationSettingsUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки уведомлений мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    updated = await service.update_profile(master, body.model_dump(exclude_unset=True))
    return updated


# ── Расписание ─────────────────────────────────────────────

@router.get("/me/schedule", response_model=List[ScheduleTemplateOut])
async def get_my_schedule(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить расписание мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    schedule = await service.get_schedule(master.id)
    result = []
    for s in schedule:
        result.append(ScheduleTemplateOut(
            id=s.id,
            day_of_week=s.day_of_week,
            start_time=s.start_time.isoformat() if s.start_time else "",
            end_time=s.end_time.isoformat() if s.end_time else "",
            break_start=s.break_start.isoformat() if s.break_start else None,
            break_end=s.break_end.isoformat() if s.break_end else None,
            location_id=s.location_id,
            is_active=s.is_active,
        ))
    return result


@router.put("/me/schedule", response_model=List[ScheduleTemplateOut])
async def set_my_schedule(
    templates: List[ScheduleTemplateIn],
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Перезаписать расписание мастера целиком."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    new_schedule = await service.set_schedule(
        master.id,
        [t.model_dump() for t in templates],
    )
    result = []
    for s in new_schedule:
        result.append(ScheduleTemplateOut(
            id=s.id,
            day_of_week=s.day_of_week,
            start_time=s.start_time.isoformat() if s.start_time else "",
            end_time=s.end_time.isoformat() if s.end_time else "",
            break_start=s.break_start.isoformat() if s.break_start else None,
            break_end=s.break_end.isoformat() if s.break_end else None,
            location_id=s.location_id,
            is_active=s.is_active,
        ))
    return result


# ── Статистика мастера ──────────────────────────────────

@router.get("/me/stats")
async def get_my_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Статистика мастера: выручка за сегодня, кол-во записей и т.д."""
    from datetime import date
    from sqlalchemy import select, func
    from app.modules.booking.models import Appointment
    from app.modules.payments.models import Payment

    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    today = date.today()

    today_revenue_result = await db.execute(
        select(func.coalesce(func.sum(Payment.amount_paid), 0))
        .where(Payment.master_id == master.id)
        .where(func.date(Payment.created_at) == today)
    )
    today_revenue = today_revenue_result.scalar() or 0

    total_bookings_result = await db.execute(
        select(func.count(Appointment.id))
        .where(Appointment.master_id == master.id)
    )
    total_bookings = total_bookings_result.scalar() or 0

    today_bookings_result = await db.execute(
        select(func.count(Appointment.id))
        .where(Appointment.master_id == master.id)
        .where(Appointment.date == today)
    )
    today_bookings = today_bookings_result.scalar() or 0

    return {
        "today_revenue": float(today_revenue),
        "total_bookings": total_bookings,
        "today_bookings": today_bookings,
    }


# ── QR-код ─────────────────────────────────────────────

@router.get("/me/qr")
async def get_my_qr(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Генерация QR-кода со ссылкой на страницу записи мастера."""
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers import RoundedModuleDrawer

    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    booking_url = f"{settings.APP_URL}?startParam=m_{master.slug}"

    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(booking_url)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(),
    )
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=qr_{master.slug}.png"},
    )


@router.get("/{slug}/qr")
async def get_master_qr_public(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Публичный QR-код мастера по slug."""
    import qrcode

    service = MasterService(db)
    master = await service.get_by_slug(slug)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    booking_url = f"{settings.APP_URL}?startParam=m_{master.slug}"

    img = qrcode.make(booking_url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f"attachment; filename=qr_{slug}.png"},
    )


# ── Локации (мультикабинет) ────────────────────────────────

@router.get("/me/locations")
async def get_my_locations(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список локаций мастера."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    locations = await service.get_locations(master.id)
    return [
        {
            "id": loc.id,
            "name": loc.name,
            "address": loc.address,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "is_default": loc.is_default,
            "is_active": loc.is_active,
        }
        for loc in locations
    ]


@router.post("/me/locations", status_code=201)
async def create_location(
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать локацию."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    loc = await service.create_location(master.id, body)
    await db.commit()
    return {
        "id": loc.id,
        "name": loc.name,
        "address": loc.address,
        "latitude": loc.latitude,
        "longitude": loc.longitude,
        "is_default": loc.is_default,
        "is_active": loc.is_active,
    }


@router.patch("/me/locations/{location_id}")
async def update_location(
    location_id: int,
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить локацию."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    loc = await service.update_location(master.id, location_id, body)
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    await db.commit()
    return {"id": loc.id, "updated": True}


@router.delete("/me/locations/{location_id}", status_code=204)
async def delete_location(
    location_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить локацию."""
    service = MasterService(db)
    master = await service.get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    deleted = await service.delete_location(master.id, location_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found")
