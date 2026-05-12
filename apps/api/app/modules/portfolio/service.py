"""
Portfolio service — CRUD фото работ мастера.
"""

from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.modules.portfolio.models import WorkPhoto


class PortfolioService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_photo(
        self,
        master_id: int,
        s3_key: str,
        caption: Optional[str] = None,
        client_id: Optional[int] = None,
        appointment_id: Optional[int] = None,
        is_portfolio: bool = True,
    ) -> WorkPhoto:
        # Get max sort_order
        r = await self.db.execute(
            select(WorkPhoto.sort_order)
            .where(WorkPhoto.master_id == master_id)
            .order_by(WorkPhoto.sort_order.desc())
            .limit(1)
        )
        max_order = r.scalar() or 0

        photo = WorkPhoto(
            master_id=master_id,
            s3_key=s3_key,
            caption=caption,
            client_id=client_id,
            appointment_id=appointment_id,
            is_portfolio=is_portfolio,
            sort_order=max_order + 1,
        )
        self.db.add(photo)
        await self.db.flush()
        return photo

    async def get_portfolio(
        self, master_id: int, limit: int = 50
    ) -> List[WorkPhoto]:
        """Публичное портфолио (is_portfolio=True)."""
        result = await self.db.execute(
            select(WorkPhoto)
            .where(
                WorkPhoto.master_id == master_id,
                WorkPhoto.is_portfolio.is_(True),
            )
            .order_by(WorkPhoto.sort_order)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_all_photos(
        self, master_id: int, limit: int = 100
    ) -> List[WorkPhoto]:
        """Все фото мастера (для мастерской панели)."""
        result = await self.db.execute(
            select(WorkPhoto)
            .where(WorkPhoto.master_id == master_id)
            .order_by(WorkPhoto.sort_order)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def update_photo(
        self,
        photo_id: int,
        master_id: int,
        caption: Optional[str] = None,
        is_portfolio: Optional[bool] = None,
        sort_order: Optional[int] = None,
    ) -> Optional[WorkPhoto]:
        result = await self.db.execute(
            select(WorkPhoto).where(
                WorkPhoto.id == photo_id,
                WorkPhoto.master_id == master_id,
            )
        )
        photo = result.scalar_one_or_none()
        if not photo:
            return None

        if caption is not None:
            photo.caption = caption
        if is_portfolio is not None:
            photo.is_portfolio = is_portfolio
        if sort_order is not None:
            photo.sort_order = sort_order

        await self.db.flush()
        return photo

    async def delete_photo(self, photo_id: int, master_id: int) -> bool:
        result = await self.db.execute(
            select(WorkPhoto).where(
                WorkPhoto.id == photo_id,
                WorkPhoto.master_id == master_id,
            )
        )
        photo = result.scalar_one_or_none()
        if not photo:
            return False
        await self.db.delete(photo)
        await self.db.flush()
        return True
