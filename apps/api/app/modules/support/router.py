"""
Support router — /api/v1/support
Тикеты поддержки: создание, ответы, SLA.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.support.service import SupportService
from app.modules.support.schemas import (
    TicketCreate,
    TicketReply,
    TicketOut,
    TicketMessageOut,
    TicketRateRequest,
)

router = APIRouter()


@router.post("/tickets", response_model=TicketOut)
async def create_ticket(
    req: TicketCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать тикет поддержки."""
    svc = SupportService(db)
    ticket = await svc.create_ticket(
        initiator_role=user.get("role", "client"),
        initiator_id=user.get("identity_id", 0),
        category=req.category,
        priority=req.priority,
        subject=req.subject,
        message=req.message,
    )
    await db.commit()
    return ticket


@router.get("/tickets/my", response_model=List[TicketOut])
async def get_my_tickets(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мои тикеты."""
    svc = SupportService(db)
    return await svc.get_my_tickets(
        initiator_role=user.get("role", "client"),
        initiator_id=user.get("identity_id", 0),
        status_filter=status,
    )


@router.get("/tickets/{ticket_id}/messages", response_model=List[TicketMessageOut])
async def get_ticket_messages(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Сообщения в тикете."""
    svc = SupportService(db)
    return await svc.get_ticket_messages(ticket_id)


@router.post("/tickets/{ticket_id}/reply", response_model=TicketMessageOut)
async def reply_to_ticket(
    ticket_id: int,
    req: TicketReply,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ответить в тикет."""
    svc = SupportService(db)
    try:
        msg = await svc.reply_to_ticket(
            ticket_id=ticket_id,
            sender_type=user.get("role", "client"),
            sender_id=user.get("identity_id"),
            text=req.text,
            attachment_url=req.attachment_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return msg


@router.post("/tickets/{ticket_id}/resolve", response_model=TicketOut)
async def resolve_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Закрыть тикет (модератор/суперадмин)."""
    svc = SupportService(db)
    ticket = await svc.resolve_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return ticket


@router.post("/tickets/{ticket_id}/rate", response_model=TicketOut)
async def rate_ticket(
    ticket_id: int,
    req: TicketRateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Оценить качество поддержки (1-5)."""
    svc = SupportService(db)
    ticket = await svc.rate_ticket(ticket_id, req.satisfaction)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return ticket
