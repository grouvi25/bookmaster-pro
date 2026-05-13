"""
Clients CRM router — /api/v1/clients
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.clients.schemas import ClientCRMOut, ClientCRMUpdate, ClientDetailOut, ClientNoteCreate, ClientNoteOut
from app.modules.clients.service import ClientService

router = APIRouter()


@router.get("/", response_model=List[ClientCRMOut])
async def get_my_clients(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список клиентов мастера с CRM-данными."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = ClientService(db)
    clients = await service.get_master_clients(master.id)
    return [ClientCRMOut(**c) for c in clients]


@router.get("/{client_id}/detail", response_model=ClientDetailOut)
async def get_client_detail(
    client_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Детальная карточка клиента с историей визитов, тегами, заметками, ДР."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    service = ClientService(db)
    detail = await service.get_client_detail(master.id, client_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Client not found")
    return detail


@router.patch("/{client_id}", response_model=ClientCRMOut)
async def update_client_crm(
    client_id: int,
    body: ClientCRMUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить CRM-данные клиента (теги, заметки)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = ClientService(db)
    link = await service.update_client_crm(
        master.id, client_id, body.model_dump(exclude_unset=True)
    )
    if not link:
        raise HTTPException(status_code=404, detail="Client not found")

    from sqlalchemy import select
    from app.modules.clients.models import Client
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()

    return ClientCRMOut(
        client_id=client.id,
        display_name=client.display_name if client else "",
        phone=client.phone if client else None,
        tags=link.tags or [],
        master_notes=link.master_notes,
        first_visit_date=link.first_visit_date,
        last_visit_date=link.last_visit_date,
        visit_count=link.visit_count,
        total_spent=link.total_spent,
        no_show_count=link.no_show_count,
        source=link.source,
    )


@router.post("/{client_id}/notes", response_model=ClientNoteOut)
async def create_client_note(
    client_id: int,
    body: ClientNoteCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавить заметку к клиенту."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    from app.modules.clients.models import ClientNote
    note = ClientNote(
        master_id=master.id,
        client_id=client_id,
        text=body.text,
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return note


@router.get("/last-master")
async def get_last_master(
    platform_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Получить ID мастера, с которым клиент взаимодействовал последним (для бота)."""
    from app.modules.auth.models import Identity
    from app.modules.clients.models import Client, ClientMasterLink

    result = await db.execute(
        select(Identity).where(Identity.platform_id == platform_id)
    )
    identity = result.scalar_one_or_none()
    if not identity:
        return {"master_id": None}

    result = await db.execute(
        select(Client).where(Client.identity_id == identity.id)
    )
    client = result.scalar_one_or_none()
    if not client:
        return {"master_id": None}

    result = await db.execute(
        select(ClientMasterLink)
        .where(ClientMasterLink.client_id == client.id)
        .order_by(ClientMasterLink.last_visit_date.desc().nullslast())
        .limit(1)
    )
    link = result.scalar_one_or_none()
    return {"master_id": link.master_id if link else None}
