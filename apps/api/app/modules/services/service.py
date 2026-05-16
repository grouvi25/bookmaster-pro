"""
Services CRUD.
"""

from typing import Optional, List

from sqlalchemy import select, func
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
        from app.modules.core.models import FeatureFlags

        flags_result = await self.db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == master_id)
        )
        flags = flags_result.scalar_one_or_none()
        if flags and flags.max_services:
            count_result = await self.db.execute(
                select(func.count(Service.id)).where(
                    Service.master_id == master_id,
                    Service.is_active.is_(True),
                )
            )
            current_count = count_result.scalar() or 0
            if current_count >= flags.max_services:
                raise ValueError(
                    f"Лимит услуг по тарифу исчерпан "
                    f"({current_count}/{flags.max_services})"
                )

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

    async def reorder(self, master_id: int, order: List[int]) -> None:
        """Обновить sort_order услуг по списку ID."""
        for idx, service_id in enumerate(order):
            result = await self.db.execute(
                select(Service).where(Service.id == service_id, Service.master_id == master_id)
            )
            svc = result.scalar_one_or_none()
            if svc:
                svc.sort_order = idx
        await self.db.flush()
