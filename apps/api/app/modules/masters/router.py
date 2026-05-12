"""
Masters router — /api/v1/masters
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
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
