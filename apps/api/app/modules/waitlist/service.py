"""
Waitlist service.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.waitlist.models import WaitlistEntry


class WaitlistService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add_to_waitlist(
        self,
        master_id: int,
        client_id: int,
        service_id: Optional[int] = None,
        preferred_date=None,
        preferred_time_from: Optional[str] = None,
        preferred_time_to: Optional[str] = None,
    ) -> WaitlistEntry:
        entry = WaitlistEntry(
            master_id=master_id,
            client_id=client_id,
            service_id=service_id,
            preferred_date=preferred_date,
            preferred_time_from=preferred_time_from,
            preferred_time_to=preferred_time_to,
            status="waiting",
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def get_waitlist(
        self, master_id: int, status: Optional[str] = "waiting"
    ) -> List[WaitlistEntry]:
        query = select(WaitlistEntry).where(
            WaitlistEntry.master_id == master_id,
        )
        if status:
            query = query.where(WaitlistEntry.status == status)
        query = query.order_by(WaitlistEntry.created_at)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def notify_entry(self, entry_id: int) -> WaitlistEntry:
        result = await self.db.execute(
            select(WaitlistEntry).where(WaitlistEntry.id == entry_id)
        )
        entry = result.scalar_one_or_none()
        if not entry:
            raise ValueError("Entry not found")

        entry.status = "notified"
        entry.notified_at = datetime.now(timezone.utc)
        entry.slot_reserved_until = datetime.now(timezone.utc) + timedelta(
            minutes=settings.WAITLIST_CONFIRM_MINUTES
        )
        await self.db.flush()
        return entry

    async def cancel_entry(self, entry_id: int, client_id: int) -> bool:
        result = await self.db.execute(
            select(WaitlistEntry).where(
                WaitlistEntry.id == entry_id,
                WaitlistEntry.client_id == client_id,
            )
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.status = "cancelled"
            await self.db.flush()
            return True
        return False
