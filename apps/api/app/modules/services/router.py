"""
Services router — /api/v1/services
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.services.schemas import ServiceCreate, ServiceUpdate, ServiceOut, ServiceReorderRequest
from app.modules.services.service import ServiceService

router = APIRouter()


@router.get("/my", response_model=List[ServiceOut])
async def list_my_services(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список услуг текущего мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = ServiceService(db)
    return await service.list_by_master(master.id)


@router.get("/master/{master_id}", response_model=List[ServiceOut])
async def list_services(
    master_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Список активных услуг мастера (публичный)."""
    service = ServiceService(db)
    return await service.list_by_master(master_id)


@router.post("/", response_model=ServiceOut, status_code=201)
async def create_service(
    body: ServiceCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать услугу (только мастер)."""
    from sqlalchemy import select, func
    from app.modules.core.models import FeatureFlags
    from app.modules.services.models import Service as ServiceModel

    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Only masters can create services")

    flags_result = await db.execute(
        select(FeatureFlags).where(FeatureFlags.master_id == master.id)
    )
    flags = flags_result.scalar_one_or_none()
    if flags and flags.max_services:
        count_result = await db.execute(
            select(func.count(ServiceModel.id)).where(
                ServiceModel.master_id == master.id,
                ServiceModel.is_active.is_(True),
            )
        )
        current_count = count_result.scalar() or 0
        if current_count >= flags.max_services:
            raise HTTPException(
                status_code=403,
                detail=f"Лимит услуг по тарифу исчерпан ({current_count}/{flags.max_services})",
            )

    service = ServiceService(db)
    return await service.create(master.id, body.model_dump())


@router.patch("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: int,
    body: ServiceUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить услугу (только владелец)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    svc_service = ServiceService(db)
    svc = await svc_service.get_by_id(service_id)
    if not svc or svc.master_id != master.id:
        raise HTTPException(status_code=404, detail="Service not found")
    return await svc_service.update(svc, body.model_dump(exclude_unset=True))


@router.delete("/{service_id}", status_code=204)
async def delete_service(
    service_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Деактивировать услугу (soft delete)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    svc_service = ServiceService(db)
    svc = await svc_service.get_by_id(service_id)
    if not svc or svc.master_id != master.id:
        raise HTTPException(status_code=404, detail="Service not found")
    await svc_service.delete(svc)


@router.post("/reorder")
async def reorder_services(
    body: ServiceReorderRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Сортировка услуг drag-and-drop."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    svc_service = ServiceService(db)
    await svc_service.reorder(master.id, body.order)
    return {"status": "ok"}
