"""
Clients CRM service.
"""

from datetime import date
from typing import Optional, List, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.clients.models import Client, ClientMasterLink, ClientNote


class ClientService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_master_clients(
        self, master_id: int, search: Optional[str] = None
    ) -> List[dict]:
        """Список клиентов мастера с CRM-данными."""
        query = (
            select(ClientMasterLink, Client)
            .join(Client, ClientMasterLink.client_id == Client.id)
            .where(ClientMasterLink.master_id == master_id)
        )
        if search:
            from sqlalchemy import or_
            pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    Client.display_name.ilike(pattern),
                    Client.phone.ilike(pattern),
                )
            )
        query = query.order_by(ClientMasterLink.last_visit_date.desc().nullslast())
        result = await self.db.execute(query)
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

    async def get_client_detail(
        self, master_id: int, client_id: int
    ) -> Optional[Dict[str, Any]]:
        """Детальная карточка клиента: CRM-данные + история визитов + заметки + лояльность."""
        result = await self.db.execute(
            select(ClientMasterLink, Client)
            .join(Client, ClientMasterLink.client_id == Client.id)
            .where(ClientMasterLink.master_id == master_id, ClientMasterLink.client_id == client_id)
        )
        row = result.first()
        if not row:
            return None
        link, client = row

        from app.modules.booking.models import Appointment
        from app.modules.services.models import Service

        visits_result = await self.db.execute(
            select(Appointment, Service)
            .outerjoin(Service, Appointment.service_id == Service.id)
            .where(
                Appointment.master_id == master_id,
                Appointment.client_id == client_id,
            )
            .order_by(Appointment.date.desc())
            .limit(50)
        )
        visits = []
        for appt, svc in visits_result.all():
            visits.append({
                "id": appt.id,
                "date": appt.time_start or appt.date,
                "service_name": svc.name if svc else "—",
                "status": appt.status,
                "price": float(appt.price_final) if appt.price_final else None,
            })

        notes_result = await self.db.execute(
            select(ClientNote)
            .where(ClientNote.master_id == master_id, ClientNote.client_id == client_id)
            .order_by(ClientNote.created_at.desc())
            .limit(50)
        )
        notes = list(notes_result.scalars().all())

        from app.modules.loyalty.models import LoyaltyAccount
        loyalty_result = await self.db.execute(
            select(LoyaltyAccount).where(
                LoyaltyAccount.master_id == master_id, LoyaltyAccount.client_id == client_id
            )
        )
        loyalty = loyalty_result.scalar_one_or_none()

        return {
            "client_id": client.id,
            "display_name": client.display_name,
            "phone": client.phone,
            "birthday": client.birthday,
            "avatar_url": client.avatar_url,
            "tags": link.tags or [],
            "master_notes": link.master_notes,
            "first_visit_date": link.first_visit_date,
            "last_visit_date": link.last_visit_date,
            "visit_count": link.visit_count,
            "total_spent": link.total_spent,
            "no_show_count": link.no_show_count,
            "source": link.source,
            "visits": visits,
            "notes": notes,
            "loyalty_balance": loyalty.balance if loyalty else 0,
            "loyalty_tier": loyalty.tier if loyalty else "new",
        }

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

    async def create_client_for_master(
        self,
        master_id: int,
        name: str,
        phone: Optional[str] = None,
        birthday: Optional[date] = None,
        tags: Optional[List[str]] = None,
        notes: Optional[str] = None,
    ) -> Client:
        """Создать клиента вручную (мастер добавляет в свою CRM).

        Под каждого ручного клиента создаём синтетическую Identity
        (platform='manual'), т.к. Client.identity_id NOT NULL + unique.
        """
        import uuid
        from datetime import date as _date
        from app.modules.auth.models import Identity

        identity = Identity(
            platform="manual",
            platform_id=f"manual_{master_id}_{uuid.uuid4().hex[:16]}",
            role="client",
        )
        self.db.add(identity)
        await self.db.flush()

        client = Client(
            identity_id=identity.id,
            display_name=name.strip(),
            phone=phone.strip() if phone else None,
            birthday=birthday,
        )
        self.db.add(client)
        await self.db.flush()

        link = ClientMasterLink(
            master_id=master_id,
            client_id=client.id,
            tags=tags or [],
            master_notes=notes,
            source="manual",
            first_visit_date=_date.today(),
        )
        self.db.add(link)
        await self.db.flush()
        return client
