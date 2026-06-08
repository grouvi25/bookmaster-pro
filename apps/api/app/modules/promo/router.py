"""
Promo router — /api/v1/promo
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.promo.schemas import (
    PromoCreate, PromoUpdate, PromoOut,
    PromoValidateRequest, PromoValidateResponse,
)
from app.modules.promo.service import PromoService

router = APIRouter()


@router.post("/", response_model=PromoOut, status_code=201)
async def create_promo(
    body: PromoCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать промоакцию (мастер)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = PromoService(db)
    return await service.create(master.id, body.model_dump())


@router.get("/", response_model=List[PromoOut])
async def list_promos(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список промоакций мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = PromoService(db)
    return await service.list_by_master(master.id)


@router.patch("/{promo_id}", response_model=PromoOut)
async def update_promo(
    promo_id: int,
    body: PromoUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить промоакцию."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = PromoService(db)
    data = body.model_dump(exclude_unset=True)
    promo = await service.update(promo_id, master.id, data)
    if not promo:
        raise HTTPException(status_code=404, detail="Promo not found")
    return promo


@router.delete("/{promo_id}", status_code=204)
async def deactivate_promo(
    promo_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить промоакцию."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = PromoService(db)
    if not await service.delete(promo_id, master.id):
        raise HTTPException(status_code=404, detail="Promo not found")


@router.post("/validate", response_model=PromoValidateResponse)
async def validate_promo(
    body: PromoValidateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Проверить промокод (публичный)."""
    service = PromoService(db)
    result = await service.validate_code(
        code=body.code,
        master_id=body.master_id,
        service_id=body.service_id,
        amount=body.amount,
    )
    return PromoValidateResponse(**result)
