"""
Masters service — профиль, расписание.
"""

from datetime import time
from typing import Optional, List

from sqlalchemy import select, func
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

    # ── Локации (мультикабинет) ────────────────────────────

    async def get_locations(self, master_id: int) -> list:
        from app.modules.masters.models import MasterLocation
        result = await self.db.execute(
            select(MasterLocation)
            .where(MasterLocation.master_id == master_id)
            .order_by(MasterLocation.is_default.desc(), MasterLocation.id)
        )
        return list(result.scalars().all())

    async def create_location(self, master_id: int, data: dict):
        from app.modules.masters.models import MasterLocation
        from app.modules.core.models import FeatureFlags

        flags_result = await self.db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == master_id)
        )
        flags = flags_result.scalar_one_or_none()
        if flags and flags.max_locations:
            count_result = await self.db.execute(
                select(func.count(MasterLocation.id)).where(
                    MasterLocation.master_id == master_id,
                    MasterLocation.is_active.is_(True),
                )
            )
            current_count = count_result.scalar() or 0
            if current_count >= flags.max_locations:
                raise ValueError(
                    f"Лимит локаций по тарифу исчерпан ({current_count}/{flags.max_locations})"
                )

        loc = MasterLocation(
            master_id=master_id,
            name=data.get("name", ""),
            address=data.get("address"),
            latitude=data.get("latitude"),
            longitude=data.get("longitude"),
            is_default=data.get("is_default", False),
            is_active=data.get("is_active", True),
        )
        self.db.add(loc)
        await self.db.flush()
        return loc

    async def update_location(
        self, master_id: int, location_id: int, data: dict
    ):
        from app.modules.masters.models import MasterLocation
        result = await self.db.execute(
            select(MasterLocation).where(
                MasterLocation.id == location_id,
                MasterLocation.master_id == master_id,
            )
        )
        loc = result.scalar_one_or_none()
        if not loc:
            return None
        for key in ("name", "address", "latitude", "longitude", "is_default", "is_active"):
            if key in data:
                setattr(loc, key, data[key])
        await self.db.flush()
        return loc

    async def delete_location(self, master_id: int, location_id: int) -> bool:
        from app.modules.masters.models import MasterLocation
        result = await self.db.execute(
            select(MasterLocation).where(
                MasterLocation.id == location_id,
                MasterLocation.master_id == master_id,
            )
        )
        loc = result.scalar_one_or_none()
        if not loc:
            return False
        await self.db.delete(loc)
        await self.db.flush()
        return True
