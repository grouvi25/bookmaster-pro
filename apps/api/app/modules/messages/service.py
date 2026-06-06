"""
MessagesService — CRUD для тредов и сообщений.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.messages.models import MessageThread, Message
from app.modules.masters.models import Master
from app.modules.clients.models import Client

logger = logging.getLogger(__name__)


class MessagesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Threads ──────────────────────────────────────────────────────

    async def get_or_create_thread(
        self,
        master_id: int,
        client_id: int,
        appointment_id: Optional[int] = None,
    ) -> MessageThread:
        """Получить существующий тред или создать новый."""
        result = await self.db.execute(
            select(MessageThread).where(
                MessageThread.master_id == master_id,
                MessageThread.client_id == client_id,
            )
        )
        thread = result.scalar_one_or_none()
        if thread:
            return thread

        thread = MessageThread(
            master_id=master_id,
            client_id=client_id,
            appointment_id=appointment_id,
        )
        self.db.add(thread)
        await self.db.flush()
        return thread

    async def list_threads_for_master(
        self, master_id: int, offset: int = 0, limit: int = 50
    ) -> tuple[list[MessageThread], int]:
        """Список тредов мастера, отсортированных по последнему сообщению."""
        count_q = select(func.count()).select_from(MessageThread).where(
            MessageThread.master_id == master_id
        )
        total = (await self.db.execute(count_q)).scalar() or 0

        q = (
            select(MessageThread)
            .where(MessageThread.master_id == master_id)
            .order_by(MessageThread.last_message_at.desc().nullslast())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def list_threads_for_client(
        self, client_id: int, offset: int = 0, limit: int = 50
    ) -> tuple[list[MessageThread], int]:
        """Список тредов клиента."""
        count_q = select(func.count()).select_from(MessageThread).where(
            MessageThread.client_id == client_id
        )
        total = (await self.db.execute(count_q)).scalar() or 0

        q = (
            select(MessageThread)
            .where(MessageThread.client_id == client_id)
            .order_by(MessageThread.last_message_at.desc().nullslast())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(q)
        return list(result.scalars().all()), total

    async def get_thread(self, thread_id: int) -> Optional[MessageThread]:
        result = await self.db.execute(
            select(MessageThread).where(MessageThread.id == thread_id)
        )
        return result.scalar_one_or_none()

    # ── Messages ─────────────────────────────────────────────────────

    async def send_message(
        self,
        thread_id: int,
        sender_role: str,
        sender_id: int,
        text: Optional[str] = None,
        attachment_url: Optional[str] = None,
    ) -> Message:
        """Отправить сообщение в тред."""
        now = datetime.now(timezone.utc)

        msg = Message(
            thread_id=thread_id,
            sender_role=sender_role,
            sender_id=sender_id,
            text=text,
            attachment_url=attachment_url,
        )
        self.db.add(msg)

        # Обновляем тред
        thread = await self.get_thread(thread_id)
        if thread:
            thread.last_message_at = now
            thread.last_message_text = (text or "📎 Вложение")[:200]
            if sender_role == "master":
                thread.client_unread = (thread.client_unread or 0) + 1
            else:
                thread.master_unread = (thread.master_unread or 0) + 1

        await self.db.flush()
        return msg

    async def list_messages(
        self,
        thread_id: int,
        before_id: Optional[int] = None,
        limit: int = 50,
    ) -> tuple[list[Message], int]:
        """Сообщения в треде (от новых к старым, пагинация курсором)."""
        count_q = select(func.count()).select_from(Message).where(
            Message.thread_id == thread_id
        )
        total = (await self.db.execute(count_q)).scalar() or 0

        q = (
            select(Message)
            .where(Message.thread_id == thread_id)
        )
        if before_id:
            q = q.where(Message.id < before_id)

        q = q.order_by(Message.created_at.desc()).limit(limit)
        result = await self.db.execute(q)
        messages = list(result.scalars().all())
        messages.reverse()  # возвращаем в хронологическом порядке
        return messages, total

    async def mark_as_read(
        self, thread_id: int, reader_role: str
    ) -> int:
        """Отметить все сообщения как прочитанные для роли."""
        result = await self.db.execute(
            update(Message)
            .where(
                Message.thread_id == thread_id,
                Message.sender_role != reader_role,
                Message.is_read == False,
            )
            .values(is_read=True)
        )

        # Сбросить счётчик непрочитанных
        thread = await self.get_thread(thread_id)
        if thread:
            if reader_role == "master":
                thread.master_unread = 0
            else:
                thread.client_unread = 0

        await self.db.flush()
        return result.rowcount

    async def get_total_unread_master(self, master_id: int) -> int:
        """Общее количество непрочитанных сообщений для мастера."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(MessageThread.master_unread), 0)).where(
                MessageThread.master_id == master_id
            )
        )
        return result.scalar() or 0

    async def get_total_unread_client(self, client_id: int) -> int:
        """Общее количество непрочитанных сообщений для клиента."""
        result = await self.db.execute(
            select(func.coalesce(func.sum(MessageThread.client_unread), 0)).where(
                MessageThread.client_id == client_id
            )
        )
        return result.scalar() or 0

    # ── Helpers ───────────────────────────────────────────────────────

    async def enrich_thread(
        self, thread: MessageThread, viewer_role: str
    ) -> dict:
        """Добавить partner_name/avatar к треду."""
        data = {
            "id": thread.id,
            "master_id": thread.master_id,
            "client_id": thread.client_id,
            "appointment_id": thread.appointment_id,
            "last_message_at": thread.last_message_at,
            "last_message_text": thread.last_message_text,
            "master_unread": thread.master_unread,
            "client_unread": thread.client_unread,
            "created_at": thread.created_at,
        }

        if viewer_role == "master":
            client = await self.db.get(Client, thread.client_id)
            if client:
                data["partner_name"] = client.display_name
                data["partner_avatar"] = client.avatar_url
        else:
            master = await self.db.get(Master, thread.master_id)
            if master:
                data["partner_name"] = master.display_name
                data["partner_avatar"] = master.avatar_url

        return data
