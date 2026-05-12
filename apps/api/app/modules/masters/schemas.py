"""
Masters schemas.
"""

from typing import Optional

from pydantic import BaseModel


class MasterProfileOut(BaseModel):
    id: int
    display_name: str
    slug: str
    specialization: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accept_online_payment: bool = False
    buffer_minutes: int = 0
    link_page_enabled: bool = True
    link_page_theme: str = "default"
    link_page_links: list = []
    current_plan: str = "start"
    is_verified: bool = False
    rating_avg: float = 0.0
    rating_count: int = 0
    total_clients: int = 0
    total_appointments: int = 0

    model_config = {"from_attributes": True}


class MasterProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    specialization: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accept_online_payment: Optional[bool] = None
    buffer_minutes: Optional[int] = None
    noshow_deposit_amount: Optional[int] = None
    noshow_prepay_percent: Optional[int] = None
    link_page_enabled: Optional[bool] = None
    link_page_theme: Optional[str] = None
    link_page_links: Optional[list] = None


class ScheduleTemplateIn(BaseModel):
    day_of_week: int  # 0=Mon, 6=Sun
    start_time: str  # "09:00"
    end_time: str    # "18:00"
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    location_id: Optional[int] = None


class ScheduleTemplateOut(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    location_id: Optional[int] = None
    is_active: bool = True

    model_config = {"from_attributes": True}
