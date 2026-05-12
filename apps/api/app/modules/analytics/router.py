"""
Analytics router — /api/v1/analytics
Дашборд, выручка, воронка мастера.
"""

from datetime import date, timedelta, timezone, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.feature_flags import require_feature
from app.modules.analytics.service import AnalyticsService
from app.modules.analytics.schemas import DashboardResponse, RevenueResponse, FunnelResponse
from app.modules.masters.models import Master

router = APIRouter()


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    master: Master = Depends(require_feature("analytics_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Сводная аналитика мастера."""
    svc = AnalyticsService(db)
    return await svc.get_dashboard(master.id)


@router.get("/revenue", response_model=RevenueResponse)
async def get_revenue(
    date_from: date = Query(default=None),
    date_to: date = Query(default=None),
    master: Master = Depends(require_feature("analytics_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Выручка по периодам."""
    if not date_to:
        date_to = datetime.now(timezone.utc).date()
    if not date_from:
        date_from = date_to - timedelta(days=30)
    svc = AnalyticsService(db)
    return await svc.get_revenue(master.id, date_from, date_to)


@router.get("/funnel", response_model=FunnelResponse)
async def get_funnel(
    days: int = Query(30, ge=7, le=365),
    master: Master = Depends(require_feature("analytics_enabled")),
    db: AsyncSession = Depends(get_db),
):
    """Воронка записей: завершённые / отмены / no-show."""
    svc = AnalyticsService(db)
    return await svc.get_funnel(master.id, days)
