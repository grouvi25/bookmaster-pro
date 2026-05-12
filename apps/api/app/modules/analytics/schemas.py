"""Analytics schemas."""

from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class DashboardResponse(BaseModel):
    today_appointments: int
    today_completed: int
    today_cancelled: int
    today_revenue: float
    week_appointments: int
    week_revenue: float
    month_appointments: int
    month_revenue: float
    total_clients: int
    total_appointments: int
    rating_avg: float
    rating_count: int
    top_services: List[dict]
    appointments_by_status: dict


class RevenueResponse(BaseModel):
    period: str
    total_revenue: float
    online_revenue: float
    appointments_count: int
    avg_check: float
    revenue_by_day: List[dict]


class FunnelResponse(BaseModel):
    period_days: int
    total_bookings: int
    completed: int
    cancelled: int
    no_show: int
    completion_rate: float
    cancellation_rate: float
    no_show_rate: float


class TopServiceItem(BaseModel):
    service_id: int
    name: str
    count: int
    revenue: float
