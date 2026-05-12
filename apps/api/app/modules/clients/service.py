"""
Clients CRM service.
"""

from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.models import Client, ClientMasterLink


class ClientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_master_clients(
        self, master_id: int
    ) -> List[dict]:
        """Список клиентов мастера с CRM-данными."""
        result = await self.db.execute(
            select(ClientMasterLink, Client)
            .join(Client, ClientMasterLink.client_id == Client.id)
            .where(ClientMasterLink.master_id == master_id)
            .order_by(ClientMasterLink.last_visit_date.desc().nullslast())
        )
        rows = result.all()
        clients = []
        for link, client in rows:
            clients.append({
                "client_id": client.id,
                "display_name": client.display_name,
                "phone": client.phone,
                "tags": link.tags or [],
                "master_notes": link.master_notes,
                "first_visit_date": link.first_visit_date,
                "last_visit_date": link.last_visit_date,
                "visit_count": link.visit_count,
                "total_spent": link.total_spent,
                "no_show_count": link.no_show_count,
                "source": link.source,
            })
        return clients

    async def update_client_crm(
        self, master_id: int, client_id: int, data: dict
    ) -> Optional[ClientMasterLink]:
        result = await self.db.execute(
            select(ClientMasterLink).where(
                ClientMasterLink.master_id == master_id,
                ClientMasterLink.client_id == client_id,
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            return None

        if "tags" in data and data["tags"] is not None:
            link.tags = data["tags"]
        if "master_notes" in data and data["master_notes"] is not None:
            link.master_notes = data["master_notes"]

        await self.db.flush()
        return link

    async def get_or_create_link(
        self, master_id: int, client_id: int, source: str = "direct"
    ) -> ClientMasterLink:
        """Создать связь клиент-мастер если нет."""
        result = await self.db.execute(
            select(ClientMasterLink).where(
                ClientMasterLink.master_id == master_id,
                ClientMasterLink.client_id == client_id,
            )
        )
        link = result.scalar_one_or_none()
        if link:
            return link

        link = ClientMasterLink(
            master_id=master_id,
            client_id=client_id,
            source=source,
        )
        self.db.add(link)
        await self.db.flush()
        return link
