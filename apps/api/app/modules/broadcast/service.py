"""
Broadcast service — создание, сегментация, отправка рассылок.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.broadcast.models import Broadcast
from app.modules.clients.models import ClientMasterLink, ClientTag
from app.modules.notifications.service import NotificationService

logger = logging.getLogger(__name__)


class BroadcastService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        master_id: int,
        title: str,
        text: str,
        segment_filter: Optional[dict] = None,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
        scheduled_at: Optional[datetime] = None,
    ) -> Broadcast:
        broadcast = Broadcast(
            master_id=master_id,
            title=title,
            text=text,
            segment_filter=segment_filter or {},
            button_text=button_text,
            button_url=button_url,
            scheduled_at=scheduled_at,
            status="scheduled" if scheduled_at else "draft",
        )
        self.db.add(broadcast)
        await self.db.flush()
        return broadcast

    async def get_list(self, master_id: int) -> List[Broadcast]:
        result = await self.db.execute(
            select(Broadcast)
            .where(Broadcast.master_id == master_id)
            .order_by(Broadcast.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, broadcast_id: int) -> Optional[Broadcast]:
        return await self.db.get(Broadcast, broadcast_id)

    async def resolve_segment(self, master_id: int, segment_filter: dict) -> List[int]:
        """Разрешить фильтр сегмента в список client_id."""
        q = (
            select(ClientMasterLink.client_id)
            .where(ClientMasterLink.master_id == master_id)
        )

        tags = segment_filter.get("tags")
        if tags:
            q = q.join(
                ClientTag,
                (ClientTag.client_id == ClientMasterLink.client_id)
                & (ClientTag.master_id == master_id),
            ).where(ClientTag.tag.in_(tags))

        last_visit_before = segment_filter.get("last_visit_before")
        if last_visit_before:
            from datetime import date as date_type
            cutoff = date_type.fromisoformat(last_visit_before)
            q = q.where(ClientMasterLink.last_visit_date < cutoff)

        result = await self.db.execute(q)
        return [r[0] for r in result.all()]

    async def send(self, broadcast: Broadcast) -> dict:
        """Отправить рассылку сейчас."""
        client_ids = await self.resolve_segment(
            broadcast.master_id, broadcast.segment_filter or {}
        )

        broadcast.status = "sending"
        broadcast.total_recipients = len(client_ids)
        await self.db.flush()

        delivered = 0
        failed = 0
        for client_id in client_ids:
            ok = await NotificationService.send_by_client_id(
                self.db,
                client_id,
                broadcast.text,
                button_text=broadcast.button_text,
                button_url=broadcast.button_url,
            )
            if ok:
                delivered += 1
            else:
                failed += 1

        broadcast.status = "sent"
        broadcast.sent_at = datetime.now(timezone.utc)
        broadcast.delivered_count = delivered
        broadcast.failed_count = failed
        await self.db.flush()

        return {
            "total": len(client_ids),
            "delivered": delivered,
            "failed": failed,
        }
