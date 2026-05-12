"""
Services CRUD.
"""

from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.services.models import Service


class ServiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_master(
        self, master_id: int, active_only: bool = True
    ) -> List[Service]:
        query = select(Service).where(Service.master_id == master_id)
        if active_only:
            query = query.where(Service.is_active.is_(True))
        query = query.order_by(Service.sort_order, Service.id)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_by_id(self, service_id: int) -> Optional[Service]:
        result = await self.db.execute(
            select(Service).where(Service.id == service_id)
        )
        return result.scalar_one_or_none()

    async def create(self, master_id: int, data: dict) -> Service:
        service = Service(master_id=master_id, **data)
        self.db.add(service)
        await self.db.flush()
        return service

    async def update(self, service: Service, data: dict) -> Service:
        for key, value in data.items():
            if value is not None and hasattr(service, key):
                setattr(service, key, value)
        await self.db.flush()
        return service

    async def delete(self, service: Service) -> None:
        service.is_active = False
        await self.db.flush()
