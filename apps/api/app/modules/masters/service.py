"""
Masters service — профиль, расписание.
"""

from datetime import time
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.masters.models import Master
from app.modules.booking.models import ScheduleTemplate


class MasterService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_identity(self, identity_id: int) -> Optional[Master]:
        result = await self.db.execute(
            select(Master).where(Master.identity_id == identity_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, master_id: int) -> Optional[Master]:
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Optional[Master]:
        result = await self.db.execute(
            select(Master).where(Master.slug == slug)
        )
        return result.scalar_one_or_none()

    async def update_profile(
        self, master: Master, data: dict
    ) -> Master:
        for key, value in data.items():
            if value is not None and hasattr(master, key):
                setattr(master, key, value)
        await self.db.flush()
        return master

    # ── Расписание ─────────────────────────────────────────

    async def get_schedule(self, master_id: int) -> List[ScheduleTemplate]:
        result = await self.db.execute(
            select(ScheduleTemplate)
            .where(
                ScheduleTemplate.master_id == master_id,
                ScheduleTemplate.is_active.is_(True),
            )
            .order_by(ScheduleTemplate.day_of_week)
        )
        return list(result.scalars().all())

    async def set_schedule(
        self, master_id: int, templates: List[dict]
    ) -> List[ScheduleTemplate]:
        """Полная перезапись расписания."""
        # Деактивируем старые
        old = await self.get_schedule(master_id)
        for t in old:
            t.is_active = False

        # Создаём новые
        new_templates = []
        for t in templates:
            template = ScheduleTemplate(
                master_id=master_id,
                day_of_week=t["day_of_week"],
                start_time=time.fromisoformat(t["start_time"]),
                end_time=time.fromisoformat(t["end_time"]),
                break_start=time.fromisoformat(t["break_start"]) if t.get("break_start") else None,
                break_end=time.fromisoformat(t["break_end"]) if t.get("break_end") else None,
                location_id=t.get("location_id"),
                is_active=True,
            )
            self.db.add(template)
            new_templates.append(template)

        await self.db.flush()
        return new_templates
