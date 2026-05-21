"""
Feature flag checker — проверяет доступ мастера к модулю по тарифу.
Использование: Depends(require_feature("ai_advisor"))

check_master_access() — определяет активный план мастера по приоритету:
  1. Активный grant (trial/promo/manual/gift)
  2. Активная платная подписка
  3. Дефолт — 'start'
"""

from datetime import date

from fastapi import Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


async def check_master_access(master_id: int, db: AsyncSession) -> str:
    """
    Определяет активный план мастера.

    Приоритет:
    1. Активный grant (trial/promo/manual/gift) — перекрывает всё
    2. Активная платная подписка (MasterSubscription со status='active')
    3. Дефолт — тариф 'start' (минимальный)
    """
    from app.modules.core.models import AccessGrant
    from app.modules.payments.models import MasterSubscription

    # 1. Проверяем активные гранты (trial, promo, manual, gift)
    result = await db.execute(
        select(AccessGrant).where(
            and_(
                AccessGrant.master_id == master_id,
                AccessGrant.valid_until >= date.today(),
            )
        ).order_by(AccessGrant.valid_until.desc())
    )
    active_grant = result.scalars().first()

    if active_grant:
        return active_grant.plan

    # 2. Проверяем активную платную подписку
    sub_result = await db.execute(
        select(MasterSubscription).where(
            and_(
                MasterSubscription.master_id == master_id,
                MasterSubscription.status == "active",
            )
        ).order_by(MasterSubscription.id.desc())
    )
    active_sub = sub_result.scalars().first()

    if active_sub:
        return active_sub.plan

    return "start"


async def check_feature(
    db: AsyncSession,
    master_id: int,
    feature_name: str,
) -> bool:
    """
    Проверяет, включена ли фича для мастера.
    Поднимает HTTPException если модуль недоступен.
    """
    from app.modules.core.models import FeatureFlags

    result = await db.execute(
        select(FeatureFlags).where(FeatureFlags.master_id == master_id)
    )
    flags = result.scalar_one_or_none()

    if flags is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Feature flags not configured",
        )

    if not getattr(flags, feature_name, False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature '{feature_name}' is not available on your plan",
        )
    return True


def require_feature(feature_name: str):
    """
    FastAPI Depends factory — проверяет фичу и возвращает Master.
    Использование: master: Master = Depends(require_feature("ai_advisor"))
    """
    from app.core.auth import get_current_master

    async def _checker(
        master=Depends(get_current_master),
        db: AsyncSession = Depends(get_db),
    ):
        await check_feature(db, master.id, feature_name)
        return master

    return _checker
