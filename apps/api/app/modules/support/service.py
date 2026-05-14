"""
Support service — тикеты поддержки, ответы, назначение модератора,
закрытие, SLA-метрики, уведомления.
"""

import logging
import secrets
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.support.models import SupportTicket, TicketMessage

logger = logging.getLogger(__name__)

CATEGORY_PRIORITY = {
    "billing": "high",
    "technical": "high",
    "abuse": "high",
    "review_complaint": "medium",
    "feature_request": "low",
    "feedback": "feedback",
}


class SupportService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_ticket(
        self,
        initiator_role: str,
        initiator_id: int,
        category: str,
        subject: str,
        message: str,
        priority: Optional[str] = None,
        attachment_url: Optional[str] = None,
    ) -> SupportTicket:
        """
        Создаём тикет и отправляем уведомление модераторам.

        initiator_role: 'master' | 'client'
        initiator_id: master.id или client.id
        priority: если не указан, определяется автоматически по категории
        """
        if not priority:
            priority = CATEGORY_PRIORITY.get(category, "low")

        ticket_code = f"TK-{secrets.token_hex(4).upper()}"

        ticket = SupportTicket(
            ticket_code=ticket_code,
            initiator_role=initiator_role,
            initiator_id=initiator_id,
            category=category,
            priority=priority,
            subject=subject,
            status="open",
        )
        self.db.add(ticket)
        await self.db.flush()

        first_msg = TicketMessage(
            ticket_id=ticket.id,
            sender_type="user",
            sender_id=initiator_id,
            text=message,
            attachment_url=attachment_url,
        )
        self.db.add(first_msg)
        await self.db.flush()

        await self._notify_moderators(ticket)

        logger.info(
            f"Ticket created: {ticket_code} "
            f"category={category} priority={priority}"
        )

        return ticket

    async def reply_to_ticket(
        self,
        ticket_id: int,
        sender_type: str,
        sender_id: Optional[int],
        text: str,
        attachment_url: Optional[str] = None,
    ) -> TicketMessage:
        """
        Добавляем сообщение в тикет.
        При ответе модератора — фиксируем first_response_at,
        меняем статус на waiting_user.
        При ответе пользователя — меняем статус из waiting_user → in_progress.
        """
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            raise ValueError("Тикет не найден")

        if ticket.status == "closed":
            raise ValueError("Тикет закрыт. Создайте новый.")

        msg = TicketMessage(
            ticket_id=ticket_id,
            sender_type=sender_type,
            sender_id=sender_id,
            text=text,
            attachment_url=attachment_url,
        )
        self.db.add(msg)

        now = datetime.now(timezone.utc)

        if sender_type in ("moderator", "admin", "superadmin", "system"):
            if not ticket.first_response_at:
                ticket.first_response_at = now
            ticket.status = "waiting_user"
            await self._notify_initiator_reply(ticket, text)

        elif sender_type == "user":
            if ticket.status in ("waiting_user", "resolved"):
                ticket.status = "in_progress"
            await self._notify_moderator_user_replied(ticket)

        await self.db.flush()
        return msg

    async def assign_ticket(
        self,
        ticket_id: int,
        moderator_id: int,
    ) -> SupportTicket:
        """Модератор берёт тикет в работу."""
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            raise ValueError("Тикет не найден")

        ticket.assigned_to = moderator_id
        ticket.status = "in_progress"

        system_msg = TicketMessage(
            ticket_id=ticket_id,
            sender_type="system",
            text=f"Тикет взят в работу (модератор #{moderator_id})",
        )
        self.db.add(system_msg)
        await self.db.flush()

        return ticket

    async def close_ticket(
        self,
        ticket_id: int,
        resolution_note: Optional[str] = None,
    ) -> SupportTicket:
        """Закрываем тикет и запрашиваем оценку у инициатора."""
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            raise ValueError("Тикет не найден")

        ticket.status = "resolved"
        ticket.resolved_at = datetime.now(timezone.utc)

        if resolution_note:
            note_msg = TicketMessage(
                ticket_id=ticket_id,
                sender_type="moderator",
                text=f"✅ Тикет решён. {resolution_note}",
            )
            self.db.add(note_msg)

        await self.db.flush()

        await self._request_satisfaction_score(ticket)

        return ticket

    async def rate_ticket(
        self,
        ticket_id: int,
        satisfaction: int,
        initiator_id: Optional[int] = None,
    ) -> Optional[SupportTicket]:
        """Инициатор оценивает качество поддержки (1-5)."""
        if not 1 <= satisfaction <= 5:
            raise ValueError("Оценка должна быть от 1 до 5")

        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return None

        if initiator_id and ticket.initiator_id != initiator_id:
            raise ValueError("Нет доступа")

        ticket.satisfaction = satisfaction
        ticket.status = "closed"
        await self.db.flush()
        return ticket

    async def resolve_ticket(self, ticket_id: int) -> Optional[SupportTicket]:
        """Simple resolve without note (backward compat)."""
        return await self.close_ticket(ticket_id)

    async def get_ticket_messages(self, ticket_id: int) -> List[TicketMessage]:
        result = await self.db.execute(
            select(TicketMessage)
            .where(TicketMessage.ticket_id == ticket_id)
            .order_by(TicketMessage.created_at)
        )
        return list(result.scalars().all())

    async def get_my_tickets(
        self,
        initiator_role: str,
        initiator_id: int,
        status_filter: Optional[str] = None,
    ) -> List[SupportTicket]:
        q = select(SupportTicket).where(
            SupportTicket.initiator_role == initiator_role,
            SupportTicket.initiator_id == initiator_id,
        )
        if status_filter:
            q = q.where(SupportTicket.status == status_filter)
        q = q.order_by(SupportTicket.created_at.desc())

        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_tickets(
        self,
        status_filter: Optional[str] = None,
        priority_filter: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[SupportTicket], int]:
        """Admin/moderator: получить очередь тикетов."""
        q = select(SupportTicket)
        count_q = select(func.count(SupportTicket.id))

        if status_filter:
            q = q.where(SupportTicket.status == status_filter)
            count_q = count_q.where(SupportTicket.status == status_filter)
        if priority_filter:
            q = q.where(SupportTicket.priority == priority_filter)
            count_q = count_q.where(SupportTicket.priority == priority_filter)

        priority_order = func.array_position(
            ["high", "medium", "low", "feedback"],
            SupportTicket.priority,
        )
        q = q.order_by(priority_order, SupportTicket.created_at).offset(offset).limit(limit)

        result = await self.db.execute(q)
        tickets = list(result.scalars().all())

        total_r = await self.db.execute(count_q)
        total = total_r.scalar() or 0

        return tickets, total

    async def get_sla_stats(self) -> Dict:
        """Метрики SLA: среднее время ответа и решения."""
        result = await self.db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        SupportTicket.first_response_at - SupportTicket.created_at
                    )
                ).label("avg_first_response_sec"),
                func.avg(
                    func.extract(
                        "epoch",
                        SupportTicket.resolved_at - SupportTicket.created_at
                    )
                ).label("avg_resolution_sec"),
                func.count(SupportTicket.id).label("total"),
                func.sum(
                    case((SupportTicket.status == "open", 1), else_=0)
                ).label("open_count"),
                func.sum(
                    case((SupportTicket.status == "in_progress", 1), else_=0)
                ).label("in_progress_count"),
                func.avg(SupportTicket.satisfaction).label("avg_satisfaction"),
            )
        )
        row = result.one()

        def sec_to_hours(sec):
            return round((sec or 0) / 3600, 1)

        return {
            "avg_first_response_hours": sec_to_hours(row.avg_first_response_sec),
            "avg_resolution_hours": sec_to_hours(row.avg_resolution_sec),
            "total_tickets": row.total or 0,
            "open_count": int(row.open_count or 0),
            "in_progress_count": int(row.in_progress_count or 0),
            "avg_satisfaction": round(float(row.avg_satisfaction or 0), 1),
        }

    # ─── Уведомления ─────────────────────────────────────────────────

    async def _notify_moderators(self, ticket: SupportTicket) -> None:
        """Уведомляем суперадминов о новом тикете."""
        from app.core.config import settings
        from app.modules.auth.models import Identity
        from app.modules.notifications.service import NotificationService

        priority_emoji = {
            "high": "🔴",
            "medium": "🟡",
            "low": "🟢",
            "feedback": "💬",
        }
        emoji = priority_emoji.get(ticket.priority, "📩")

        text = (
            f"{emoji} Новый тикет #{ticket.ticket_code}\n"
            f"Категория: {ticket.category}\n"
            f"Приоритет: {ticket.priority}\n"
        )
        if ticket.subject:
            text += f"Тема: {ticket.subject}\n"

        superadmin_ids = settings.superadmin_list
        for sa_id in superadmin_ids:
            try:
                result = await self.db.execute(
                    select(Identity).where(Identity.id == int(sa_id))
                )
                identity = result.scalar_one_or_none()
                if identity:
                    await NotificationService.send_to_client(
                        platform=identity.platform,
                        platform_id=identity.platform_id,
                        text=text,
                        button_text="Открыть тикет",
                        button_url=f"{settings.APP_URL}?startapp=ticket_{ticket.id}",
                    )
            except Exception as e:
                logger.error(f"Failed to notify superadmin {sa_id}: {e}")

    async def _notify_initiator_reply(
        self, ticket: SupportTicket, reply_text: str
    ) -> None:
        """Уведомляем создателя тикета об ответе модератора."""
        from app.modules.notifications.service import NotificationService

        entity = None
        if ticket.initiator_role == "master":
            from app.modules.masters.models import Master
            entity = await self.db.get(Master, ticket.initiator_id)
        elif ticket.initiator_role == "client":
            from app.modules.clients.models import Client
            entity = await self.db.get(Client, ticket.initiator_id)

        if not entity:
            return

        from app.modules.auth.models import Identity
        from app.core.config import settings

        result = await self.db.execute(
            select(Identity).where(Identity.id == entity.identity_id)
        )
        identity = result.scalar_one_or_none()
        if not identity:
            return

        preview = reply_text[:200]
        text = (
            f"💬 Ответ по тикету #{ticket.ticket_code}\n\n"
            f"{preview}"
        )

        try:
            await NotificationService.send_to_client(
                platform=identity.platform,
                platform_id=identity.platform_id,
                text=text,
                button_text="Открыть тикет",
                button_url=f"{settings.APP_URL}?startapp=ticket_{ticket.id}",
            )
        except Exception as e:
            logger.error(f"Failed to notify initiator: {e}")

    async def _notify_moderator_user_replied(
        self, ticket: SupportTicket
    ) -> None:
        """Уведомляем модератора что пользователь ответил."""
        if not ticket.assigned_to:
            return

        from app.modules.auth.models import Identity
        from app.modules.notifications.service import NotificationService
        from app.core.config import settings

        try:
            result = await self.db.execute(
                select(Identity).where(Identity.id == ticket.assigned_to)
            )
            identity = result.scalar_one_or_none()
            if identity:
                await NotificationService.send_to_client(
                    platform=identity.platform,
                    platform_id=identity.platform_id,
                    text=f"📩 Ответ пользователя в тикете #{ticket.ticket_code}",
                    button_text="Открыть тикет",
                    button_url=f"{settings.APP_URL}?startapp=ticket_{ticket.id}",
                )
        except Exception as e:
            logger.error(f"Failed to notify moderator: {e}")

    async def _request_satisfaction_score(self, ticket: SupportTicket) -> None:
        """Запрашиваем оценку поддержки у инициатора."""
        entity = None
        if ticket.initiator_role == "master":
            from app.modules.masters.models import Master
            entity = await self.db.get(Master, ticket.initiator_id)
        elif ticket.initiator_role == "client":
            from app.modules.clients.models import Client
            entity = await self.db.get(Client, ticket.initiator_id)

        if not entity:
            return

        from app.modules.auth.models import Identity
        from app.modules.notifications.service import NotificationService
        from app.core.config import settings

        result = await self.db.execute(
            select(Identity).where(Identity.id == entity.identity_id)
        )
        identity = result.scalar_one_or_none()
        if not identity:
            return

        try:
            await NotificationService.send_to_client(
                platform=identity.platform,
                platform_id=identity.platform_id,
                text=(
                    f"✅ Тикет #{ticket.ticket_code} решён!\n\n"
                    "Оцените качество поддержки (1-5):"
                ),
                button_text="Оценить",
                button_url=f"{settings.APP_URL}?startapp=rate_ticket_{ticket.id}",
            )
        except Exception as e:
            logger.error(f"Failed to request satisfaction score: {e}")
