"""
Waitlist router — /api/v1/waitlist
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.clients.models import Client
from app.modules.masters.service import MasterService
from app.modules.waitlist.schemas import WaitlistCreate, WaitlistOut
from app.modules.waitlist.service import WaitlistService

router = APIRouter()


@router.post("/", response_model=WaitlistOut, status_code=201)
async def add_to_waitlist(
    body: WaitlistCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Записаться в лист ожидания (клиент)."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = WaitlistService(db)
    entry = await service.add_to_waitlist(
        master_id=body.master_id,
        client_id=client.id,
        service_id=body.service_id,
        preferred_date=body.preferred_date,
        preferred_time_from=body.preferred_time_from,
        preferred_time_to=body.preferred_time_to,
    )
    return entry


@router.get("/master", response_model=List[WaitlistOut])
async def get_master_waitlist(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Лист ожидания мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = WaitlistService(db)
    return await service.get_waitlist(master.id)


@router.post("/{entry_id}/notify")
async def notify_waitlist_entry(
    entry_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Уведомить клиента из листа ожидания (мастер)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = WaitlistService(db)
    try:
        await service.notify_entry(entry_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"status": "notified"}


@router.delete("/{entry_id}", status_code=204)
async def cancel_waitlist_entry(
    entry_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отменить запись в листе ожидания (клиент)."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")
    service = WaitlistService(db)
    if not await service.cancel_entry(entry_id, client.id):
        raise HTTPException(status_code=404, detail="Entry not found")
