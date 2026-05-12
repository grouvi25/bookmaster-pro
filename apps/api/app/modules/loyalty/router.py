"""
Loyalty router — /api/v1/loyalty
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.clients.models import Client
from app.modules.loyalty.schemas import (
    LoyaltyBalanceOut,
    LoyaltyTransactionOut,
    LoyaltySpendRequest,
)
from app.modules.loyalty.service import LoyaltyService

router = APIRouter()


@router.get("/balance/{master_id}", response_model=LoyaltyBalanceOut)
async def get_balance(
    master_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Баланс баллов клиента у мастера."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = LoyaltyService(db)
    account = await service.get_or_create_account(master_id, client.id)
    return LoyaltyBalanceOut(
        master_id=master_id,
        client_id=client.id,
        balance=account.balance,
        tier=account.tier,
        total_earned=account.total_earned,
    )


@router.get("/history/{master_id}", response_model=List[LoyaltyTransactionOut])
async def get_history(
    master_id: int,
    limit: int = Query(50, le=100),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """История операций с баллами."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = LoyaltyService(db)
    return await service.get_transactions(master_id, client.id, limit)


@router.post("/spend")
async def spend_points(
    body: LoyaltySpendRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Списать баллы на оплату записи."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    from app.modules.booking.models import Appointment
    result = await db.execute(
        select(Appointment).where(Appointment.id == body.appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    service = LoyaltyService(db)
    try:
        await service.spend_points(
            master_id=appointment.master_id,
            client_id=client.id,
            points=body.points,
            appointment_id=body.appointment_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ok", "points_spent": body.points}
