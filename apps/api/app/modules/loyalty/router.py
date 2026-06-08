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
    from app.modules.booking.models import Appointment, AppointmentStatus
    result2 = await db.execute(
        select(Appointment)
        .where(
            Appointment.master_id == master_id,
            Appointment.client_id == client.id,
        )
        .order_by(Appointment.date.desc(), Appointment.time_start.desc())
        .limit(50)
    )
    recent_appts = result2.scalars().all()
    streak_count = 0
    for appt in recent_appts:
        if appt.status == AppointmentStatus.COMPLETED.value:
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
    """Настройки лояльности для мастера (per-master, читаются из Master)."""
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
        referral_bonus=master.loyalty_referral_bonus or 500,
        earn_rate=master.loyalty_earn_rate or 10,
        first_visit_bonus=master.loyalty_first_visit_bonus or 200,
        review_bonus=master.loyalty_review_bonus or 50,
        birthday_bonus=master.loyalty_birthday_bonus or 300,
        max_spend_percent=master.loyalty_max_spend_percent or 30,
    )


@router.put("/settings", response_model=LoyaltySettingsOut)
async def update_loyalty_settings(
    body: LoyaltySettingsUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки лояльности (per-master)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    # Маппинг schema field → Master column
    if body.referral_bonus is not None:
        master.loyalty_referral_bonus = max(0, body.referral_bonus)
    if body.earn_rate is not None:
        master.loyalty_earn_rate = max(1, body.earn_rate)
    if body.first_visit_bonus is not None:
        master.loyalty_first_visit_bonus = max(0, body.first_visit_bonus)
    if body.review_bonus is not None:
        master.loyalty_review_bonus = max(0, body.review_bonus)
    if body.birthday_bonus is not None:
        master.loyalty_birthday_bonus = max(0, body.birthday_bonus)
    if body.max_spend_percent is not None:
        # Ограничиваем от 0 до 100%
        master.loyalty_max_spend_percent = max(0, min(100, body.max_spend_percent))

    await db.commit()
    await db.refresh(master)

    return LoyaltySettingsOut(
        tiers={
            "new": {"threshold": 0, "cashback_percent": TIER_CASHBACK_PERCENT["new"]},
            "regular": {"threshold": TIER_THRESHOLDS["regular"], "cashback_percent": TIER_CASHBACK_PERCENT["regular"]},
            "vip": {"threshold": TIER_THRESHOLDS["vip"], "cashback_percent": TIER_CASHBACK_PERCENT["vip"]},
        },
        points_expiry_months=12,
        streak_threshold=3,
        streak_bonus=100,
        referral_bonus=master.loyalty_referral_bonus or 500,
        earn_rate=master.loyalty_earn_rate or 10,
        first_visit_bonus=master.loyalty_first_visit_bonus or 200,
        review_bonus=master.loyalty_review_bonus or 50,
        birthday_bonus=master.loyalty_birthday_bonus or 300,
        max_spend_percent=master.loyalty_max_spend_percent or 30,
    )


@router.get("/referrals/stats")
async def get_referral_stats(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Статистика рефералов для мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    
    service = LoyaltyService(db)
    return await service.get_referral_stats(master.id)


@router.get("/referral-link/{master_id}")
async def get_referral_link(
    master_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить реферальную ссылку клиента для конкретного мастера."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")
    
    service = LoyaltyService(db)
    try:
        return await service.get_referral_link(master_id, client.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

