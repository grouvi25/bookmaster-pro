"""
Support router — /api/v1/support
Тикеты поддержки: создание, ответы, назначение модератора,
закрытие, SLA-статистика.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user
from app.modules.support.service import SupportService
from app.modules.support.schemas import (
    TicketCreate,
    TicketReply,
    TicketCloseRequest,
    TicketOut,
    TicketMessageOut,
    TicketRateRequest,
)

router = APIRouter()


# ── User endpoints ──────────────────────────────────────────

@router.post("/tickets", response_model=TicketOut)
async def create_ticket(
    req: TicketCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать тикет поддержки."""
    from sqlalchemy import select

    identity_id = user.get("identity_id", 0)
    role = user.get("role", "client")

    entity_id = identity_id
    if role == "master":
        from app.modules.masters.models import Master
        result = await db.execute(
            select(Master).where(Master.identity_id == identity_id)
        )
        entity = result.scalar_one_or_none()
        if entity:
            entity_id = entity.id
        initiator_role = "master"
    else:
        from app.modules.clients.models import Client
        result = await db.execute(
            select(Client).where(Client.identity_id == identity_id)
        )
        entity = result.scalar_one_or_none()
        if entity:
            entity_id = entity.id
        initiator_role = "client"

    svc = SupportService(db)
    ticket = await svc.create_ticket(
        initiator_role=initiator_role,
        initiator_id=entity_id,
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

    role = user.get("role", "client")
    sender_type = "moderator" if role in ("superadmin", "moderator") else "user"

    try:
        msg = await svc.reply_to_ticket(
            ticket_id=ticket_id,
            sender_type=sender_type,
            sender_id=user.get("identity_id"),
            text=req.text,
            attachment_url=req.attachment_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return msg


@router.post("/tickets/{ticket_id}/rate", response_model=TicketOut)
async def rate_ticket(
    ticket_id: int,
    req: TicketRateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Оценить качество поддержки (1-5)."""
    svc = SupportService(db)
    try:
        ticket = await svc.rate_ticket(
            ticket_id,
            req.satisfaction,
            initiator_id=user.get("identity_id"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return ticket


# ── Модерация (moderator / superadmin) ──────────────────────

@router.get("/tickets/queue", response_model=List[TicketOut])
async def get_moderation_queue(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Очередь тикетов для модератора/суперадмина."""
    role = user.get("role", "")
    if role not in ("moderator", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderators only")
    svc = SupportService(db)
    tickets, _ = await svc.get_tickets(
        status_filter=status,
        priority_filter=priority,
        limit=limit,
        offset=offset,
    )
    return tickets


@router.post("/tickets/{ticket_id}/assign", response_model=TicketOut)
async def assign_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Модератор берёт тикет в работу."""
    role = user.get("role", "")
    if role not in ("moderator", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderators only")

    svc = SupportService(db)
    try:
        ticket = await svc.assign_ticket(
            ticket_id=ticket_id,
            moderator_id=user.get("identity_id", 0),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return ticket


@router.post("/tickets/{ticket_id}/close", response_model=TicketOut)
async def close_ticket(
    ticket_id: int,
    req: TicketCloseRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Закрыть тикет (только модератор/суперадмин)."""
    role = user.get("role", "")
    if role not in ("moderator", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderators only")

    svc = SupportService(db)
    try:
        ticket = await svc.close_ticket(ticket_id, req.resolution_note)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return ticket


@router.post("/tickets/{ticket_id}/resolve", response_model=TicketOut)
async def resolve_ticket(
    ticket_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Быстрое закрытие тикета без заметки (backward compat)."""
    role = user.get("role", "")
    if role not in ("moderator", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderators only")

    svc = SupportService(db)
    ticket = await svc.resolve_ticket(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return ticket


@router.get("/sla-stats")
async def get_sla_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SLA метрики поддержки (суперадмин)."""
    role = user.get("role", "")
    if role not in ("moderator", "superadmin"):
        raise HTTPException(status_code=403, detail="Moderators only")

    svc = SupportService(db)
    return await svc.get_sla_stats()
