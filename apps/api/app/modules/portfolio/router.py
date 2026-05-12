"""
Portfolio router — /api/v1/portfolio
CRUD фото работ мастера, публичная галерея.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_master
from app.core.feature_flags import require_feature
from app.modules.portfolio.service import PortfolioService
from app.modules.portfolio.schemas import (
    WorkPhotoCreate,
    WorkPhotoUpdate,
    WorkPhotoOut,
)
from app.modules.masters.models import Master

router = APIRouter()


@router.post("/", response_model=WorkPhotoOut)
async def add_photo(
    req: WorkPhotoCreate,
    master: Master = Depends(require_feature("portfolio_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Добавить фото работы."""
    svc = PortfolioService(db)
    photo = await svc.add_photo(
        master_id=master.id,
        s3_key=req.s3_key,
        caption=req.caption,
        client_id=req.client_id,
        appointment_id=req.appointment_id,
        is_portfolio=req.is_portfolio,
    )
    await db.commit()
    return photo


@router.get("/my", response_model=List[WorkPhotoOut])
async def get_my_photos(
    master: Master = Depends(get_current_master),
    db: AsyncSession = Depends(get_db),
):
    """Все фото мастера (включая непубличные)."""
    svc = PortfolioService(db)
    return await svc.get_all_photos(master.id)


@router.get("/master/{master_id}", response_model=List[WorkPhotoOut])
async def get_master_portfolio(
    master_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Публичное портфолио мастера."""
    svc = PortfolioService(db)
    return await svc.get_portfolio(master_id)


@router.patch("/{photo_id}", response_model=WorkPhotoOut)
async def update_photo(
    photo_id: int,
    req: WorkPhotoUpdate,
    master: Master = Depends(get_current_master),
    db: AsyncSession = Depends(get_db),
):
    """Обновить фото (caption, is_portfolio, sort_order)."""
    svc = PortfolioService(db)
    photo = await svc.update_photo(
        photo_id=photo_id,
        master_id=master.id,
        caption=req.caption,
        is_portfolio=req.is_portfolio,
        sort_order=req.sort_order,
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    await db.commit()
    return photo


@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: int,
    master: Master = Depends(get_current_master),
    db: AsyncSession = Depends(get_db),
):
    """Удалить фото."""
    svc = PortfolioService(db)
    deleted = await svc.delete_photo(photo_id, master.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Photo not found")
    await db.commit()
    return {"deleted": True}
