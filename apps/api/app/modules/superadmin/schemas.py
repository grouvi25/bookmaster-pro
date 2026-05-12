"""Superadmin schemas."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SuperadminDashboard(BaseModel):
    mrr: float  # Monthly Recurring Revenue
    arr: float  # Annual Recurring Revenue
    total_masters: int
    active_masters: int  # мастера с хотя бы 1 записью за 30 дней
    new_masters_30d: int
    total_clients: int
    total_appointments: int
    total_revenue: float
    avg_revenue_per_master: float
    churn_rate_30d: float  # % мастеров не было активно за 30 дней
    conversion_rate: float  # registrations -> active
    plan_distribution: Dict[str, int]
    appointments_by_day: List[dict]


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
    status: str  # healthy | degraded | down
    checks: Dict[str, dict]


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
