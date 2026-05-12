"""
Clients CRM router — /api/v1/clients
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.clients.schemas import ClientCRMOut, ClientCRMUpdate
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
