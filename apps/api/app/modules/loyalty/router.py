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
    ReferralCreate,
    LoyaltySettingsOut,
    LoyaltySettingsUpdate,
)
from app.modules.loyalty.service import LoyaltyService, TIER_CASHBACK_PERCENT, TIER_THRESHOLDS
from app.modules.masters.service import MasterService

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

    # Streak: count consecutive completed appointments
    from app.modules.booking.models import Appointment
    result2 = await db.execute(
        select(Appointment)
        .where(
            Appointment.master_id == master_id,
            Appointment.client_id == client.id,
        )
        .order_by(Appointment.date.desc())
        .limit(20)
    )
    recent_appts = result2.scalars().all()
    streak_count = 0
    for appt in recent_appts:
        if appt.status == "completed":
            streak_count += 1
        else:
            break

    return {
        "master_id": master_id,
        "client_id": client.id,
        "balance": account.balance,
        "tier": account.tier,
        "total_earned": account.total_earned,
        "streak_count": streak_count,
        "streak_threshold": 3,
        "streak_bonus": 100,
    }


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


@router.post("/referral")
async def process_referral(
    body: ReferralCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обработать реферальную ссылку и начислить бонус."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = LoyaltyService(db)
    try:
        referral_result = await service.process_referral(body.referrer_code, client.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return referral_result


@router.get("/settings", response_model=LoyaltySettingsOut)
async def get_loyalty_settings(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Настройки лояльности для мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    return LoyaltySettingsOut(
        tiers={
            "new": {"threshold": 0, "cashback_percent": TIER_CASHBACK_PERCENT["new"]},
            "regular": {"threshold": TIER_THRESHOLDS["regular"], "cashback_percent": TIER_CASHBACK_PERCENT["regular"]},
            "vip": {"threshold": TIER_THRESHOLDS["vip"], "cashback_percent": TIER_CASHBACK_PERCENT["vip"]},
        },
        points_expiry_months=12,
        streak_threshold=3,
        streak_bonus=100,
        referral_bonus=200,
    )


@router.put("/settings")
async def update_loyalty_settings(
    body: LoyaltySettingsUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки лояльности (заглушка, настройки пока глобальные)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    return {"status": "ok"}
