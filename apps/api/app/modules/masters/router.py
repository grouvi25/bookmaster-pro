"""
Masters router — /api/v1/masters
"""

import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.modules.masters.schemas import (
    MasterProfileOut,
    MasterProfileUpdate,
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
    updated = await service.update_profile(master, body.model_dump(exclude_unset=True))
    return updated


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
