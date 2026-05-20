"""Superadmin schemas (для документации; роуты возвращают dict для гибкости)."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SuperadminDashboard(BaseModel):
    """ТЗ 12.3 — ключевые метрики дашборда."""
    # Финансы
    mrr: float
    arr: float
    month_revenue: float
    total_revenue: float
    transaction_revenue_month: float
    avg_revenue_per_master: float
    ltv_avg: float

    # Мастера / клиенты
    total_masters: int
    active_masters: int
    new_masters_30d: int
    new_masters_week: int
    total_clients: int
    plan_distribution: Dict[str, int]

    # Записи
    total_appointments: int
    today_bookings: int
    appointments_by_day: List[dict]

    # Воронка / удержание
    churn_rate_30d: float
    conversion_rate: float

    # Поддержка
    open_tickets: int
    sla_breached_tickets: int

    # NPS
    nps_score: Optional[float] = None
    nps_quarter: str
    nps_responses: int


class MasterAdminListItem(BaseModel):
    id: int
    display_name: str
    slug: str
    specialization: Optional[str]
    city: Optional[str]
    current_plan: str
    is_verified: bool
    is_active: bool
    rating_avg: float
    total_clients: int
    total_appointments: int
    created_at: datetime


class MasterAdminUpdate(BaseModel):
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    current_plan: Optional[str] = None


class HealthCheckResponse(BaseModel):
    """ТЗ 12.2 — реальные системные тесты."""
    status: str  # healthy | degraded | down | ok
    checks: Dict[str, dict]
    checked_at: Optional[str] = None


class SystemSettingsUpdate(BaseModel):
    key: str
    value: Any


class TariffConfig(BaseModel):
    plan: str
    commission_rate_bp: int = Field(..., ge=0, le=10000)
    max_bookings: int
    max_services: int
    ai_tokens: int
    features: Dict[str, bool]
