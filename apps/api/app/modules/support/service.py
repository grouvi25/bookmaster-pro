"""
Support service — тикеты поддержки, ответы, SLA-трекинг.
"""

import secrets
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.support.models import SupportTicket, TicketMessage


class SupportService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_ticket(
        self,
        initiator_role: str,
        initiator_id: int,
        category: str,
        priority: str,
        subject: str,
        message: str,
    ) -> SupportTicket:
        ticket_code = f"TK-{secrets.token_hex(4).upper()}"

        ticket = SupportTicket(
            ticket_code=ticket_code,
            initiator_role=initiator_role,
            initiator_id=initiator_id,
            category=category,
            priority=priority,
            status="open",
        )
        self.db.add(ticket)
        await self.db.flush()

        # First message
        msg = TicketMessage(
            ticket_id=ticket.id,
            sender_type=initiator_role,
            sender_id=initiator_id,
            text=f"[{subject}]\n\n{message}",
        )
        self.db.add(msg)
        await self.db.flush()

        return ticket

    async def reply_to_ticket(
        self,
        ticket_id: int,
        sender_type: str,
        sender_id: Optional[int],
        text: str,
        attachment_url: Optional[str] = None,
    ) -> TicketMessage:
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            raise ValueError("Ticket not found")

        msg = TicketMessage(
            ticket_id=ticket_id,
            sender_type=sender_type,
            sender_id=sender_id,
            text=text,
            attachment_url=attachment_url,
        )
        self.db.add(msg)

        # Track first response from support
        if sender_type in ("admin", "moderator", "system") and not ticket.first_response_at:
            ticket.first_response_at = datetime.now(timezone.utc)

        # Reopen if client replies to resolved ticket
        if sender_type in ("master", "client") and ticket.status == "resolved":
            ticket.status = "reopened"

        await self.db.flush()
        return msg

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

        # Priority order: high > medium > low > feedback
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

    async def resolve_ticket(self, ticket_id: int) -> Optional[SupportTicket]:
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return None
        ticket.status = "resolved"
        ticket.resolved_at = datetime.now(timezone.utc)
        await self.db.flush()
        return ticket

    async def rate_ticket(
        self, ticket_id: int, satisfaction: int
    ) -> Optional[SupportTicket]:
        ticket = await self.db.get(SupportTicket, ticket_id)
        if not ticket:
            return None
        ticket.satisfaction = satisfaction
        await self.db.flush()
        return ticket
