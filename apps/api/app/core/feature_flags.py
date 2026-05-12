"""
Feature flag checker — проверяет доступ мастера к модулю по тарифу.
"""

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


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
