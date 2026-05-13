"""
Broadcast router — /api/v1/broadcast
Рассылки мастера по сегментам клиентов.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.broadcast.schemas import BroadcastCreate, BroadcastOut, SegmentPreview
from app.modules.broadcast.service import BroadcastService
from app.modules.masters.service import MasterService

router = APIRouter()


async def _get_master(user: dict, db: AsyncSession):
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    return master


@router.post("/", response_model=BroadcastOut, status_code=201)
async def create_broadcast(
    body: BroadcastCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать рассылку."""
    master = await _get_master(user, db)
    svc = BroadcastService(db)
    broadcast = await svc.create(
        master_id=master.id,
        title=body.title,
        text=body.text,
        segment_filter=body.segment_filter,
        button_text=body.button_text,
        button_url=body.button_url,
        scheduled_at=body.scheduled_at,
    )
    await db.commit()
    return broadcast


@router.get("/", response_model=List[BroadcastOut])
async def list_broadcasts(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список рассылок мастера."""
    master = await _get_master(user, db)
    svc = BroadcastService(db)
    return await svc.get_list(master.id)


@router.post("/preview-segment", response_model=SegmentPreview)
async def preview_segment(
    body: BroadcastCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Предпросмотр сегмента: сколько клиентов получат рассылку."""
    master = await _get_master(user, db)
    svc = BroadcastService(db)
    client_ids = await svc.resolve_segment(master.id, body.segment_filter or {})
    return SegmentPreview(count=len(client_ids), client_ids=client_ids[:100])


@router.post("/{broadcast_id}/send")
async def send_broadcast(
    broadcast_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отправить рассылку сейчас."""
    master = await _get_master(user, db)
    svc = BroadcastService(db)
    broadcast = await svc.get_by_id(broadcast_id)
    if not broadcast or broadcast.master_id != master.id:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    if broadcast.status == "sent":
        raise HTTPException(status_code=400, detail="Already sent")

    result = await svc.send(broadcast)
    await db.commit()
    return result
