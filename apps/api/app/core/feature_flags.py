"""
Feature flag checker — проверяет доступ мастера к модулю по тарифу.
Использование: Depends(require_feature("ai_advisor"))
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


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
