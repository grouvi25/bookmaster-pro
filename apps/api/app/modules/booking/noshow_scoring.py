"""
Anti-no-show AI scoring — формула из ТЗ 10.1.

5 уровней:
1 - Auto (напоминания) — всегда
2 - Deposit — мастер включает вручную
3 - Prepay — мастер включает вручную
4 - AI Score — авто-предоплата для риска > threshold
5 - Blacklist — запрет записи при 2+ no-show
"""

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.clients.models import ClientMasterLink
from app.modules.reviews.models import ClientReview


async def calculate_noshow_risk(
    db: AsyncSession,
    client_id: int,
    master_id: int,
) -> float:
    """
    AI-скоринг риска no-show по формуле из ТЗ:
    base 15% (новый клиент)
    + no_show_this_master × 40%
    + no_show_others × 25%
    + last_minute_cancels × 7%
    − reviews_left × 10%
    − paid_online × 8%
    Результат clamp(0, 1).
    """
    # no_show у этого мастера
    result = await db.execute(
        select(ClientMasterLink).where(
            ClientMasterLink.client_id == client_id,
            ClientMasterLink.master_id == master_id,
        )
    )
    link = result.scalar_one_or_none()
    no_show_this = link.no_show_count if link else 0

    # no_show у других мастеров
    result = await db.execute(
        select(func.coalesce(func.sum(ClientMasterLink.no_show_count), 0)).where(
            ClientMasterLink.client_id == client_id,
            ClientMasterLink.master_id != master_id,
        )
    )
    no_show_others = int(result.scalar() or 0)

    # last_minute_cancels (отмена менее чем за 2 часа)
    result = await db.execute(
        select(func.count()).where(
            Appointment.client_id == client_id,
            Appointment.status.in_([
                AppointmentStatus.CANCELLED_BY_CLIENT.value,
            ]),
        )
    )
    last_minute_cancels = int(result.scalar() or 0)

    # reviews_left
    result = await db.execute(
        select(func.count()).where(
            ClientReview.client_id == client_id,
        )
    )
    reviews_left = int(result.scalar() or 0)

    # paid_online (completed appointments — proxy for online payments)
    result = await db.execute(
        select(func.count()).where(
            Appointment.client_id == client_id,
            Appointment.status == AppointmentStatus.COMPLETED.value,
        )
    )
    paid_online = int(result.scalar() or 0)

    score = (
        0.15
        + no_show_this * 0.40
        + no_show_others * 0.25
        + last_minute_cancels * 0.07
        - reviews_left * 0.10
        - paid_online * 0.08
    )

    return max(0.0, min(1.0, score))


async def check_booking_allowed(
    db: AsyncSession,
    client_id: int,
    master_id: int,
) -> dict:
    """
    Проверить может ли клиент записаться.
    Возвращает: {"allowed": bool, "risk_score": float,
                 "require_prepay": bool, "blacklisted": bool}
    """
    from app.modules.masters.models import Master
    from app.modules.clients.models import ClientMasterLink

    result = await db.execute(
        select(Master).where(Master.id == master_id)
    )
    master = result.scalar_one_or_none()
    if not master:
        return {"allowed": True, "risk_score": 0, "require_prepay": False, "blacklisted": False}

    result = await db.execute(
        select(ClientMasterLink).where(
            ClientMasterLink.client_id == client_id,
            ClientMasterLink.master_id == master_id,
        )
    )
    link = result.scalar_one_or_none()

    # Level 5: Blacklist
    blacklist_count = master.noshow_blacklist_count or 2
    if link and (link.no_show_count or 0) >= blacklist_count:
        return {"allowed": False, "risk_score": 1.0, "require_prepay": False, "blacklisted": True}

    # Level 4: AI Score
    risk_score = await calculate_noshow_risk(db, client_id, master_id)
    threshold = (master.noshow_ai_threshold or 70) / 100.0
    require_prepay = risk_score > threshold

    return {
        "allowed": True,
        "risk_score": round(risk_score, 2),
        "require_prepay": require_prepay,
        "blacklisted": False,
    }
