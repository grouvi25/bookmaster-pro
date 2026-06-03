"""
Masters schemas.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


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
    buffer_minutes: int = 30
    tariff_type: str = "B"
    yookassa_account_id: Optional[str] = None
    link_page_enabled: bool = True
    link_page_theme: str = "default"
    link_page_links: list = []
    current_plan: str = "start"
    is_verified: bool = False
    rating_avg: float = 0.0
    rating_count: int = 0
    total_clients: int = 0
    total_appointments: int = 0
    notify_new_booking: bool = True
    notify_cancel: bool = True
    notify_reminder: bool = True
    notify_review: bool = True
    notify_no_show: bool = True

    # Агентская схема (тариф A)
    payout_phone: Optional[str] = None
    payout_card: Optional[str] = None
    inn: Optional[str] = None
    agent_agreement_at: Optional[datetime] = None

    @field_validator(
        "accept_online_payment", "link_page_enabled", "is_verified",
        mode="before",
    )
    @classmethod
    def _bool_none(cls, v: object) -> bool:
        return bool(v) if v is not None else False

    @field_validator(
        "buffer_minutes", "rating_count", "total_clients", "total_appointments",
        mode="before",
    )
    @classmethod
    def _int_none(cls, v: object) -> int:
        return int(v) if v is not None else 0

    @field_validator("link_page_theme", "current_plan", mode="before")
    @classmethod
    def _str_none(cls, v: object) -> str:
        return str(v) if v is not None else "default"

    @field_validator("link_page_links", mode="before")
    @classmethod
    def _list_none(cls, v: object) -> list:
        return list(v) if v is not None else []

    @field_validator("rating_avg", mode="before")
    @classmethod
    def _float_none(cls, v: object) -> float:
        return float(v) if v is not None else 0.0

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
    yookassa_account_id: Optional[str] = None
    noshow_deposit_amount: Optional[int] = None
    noshow_prepay_percent: Optional[int] = None
    link_page_enabled: Optional[bool] = None
    link_page_theme: Optional[str] = None
    link_page_links: Optional[list] = None
    notify_new_booking: Optional[bool] = None
    notify_cancel: Optional[bool] = None
    notify_reminder: Optional[bool] = None
    notify_review: Optional[bool] = None
    notify_no_show: Optional[bool] = None

    # Агентская схема (тариф A)
    payout_phone: Optional[str] = None
    payout_card: Optional[str] = None
    inn: Optional[str] = None


class NotificationSettingsOut(BaseModel):
    notify_new_booking: bool = True
    notify_cancel: bool = True
    notify_reminder: bool = True
    notify_review: bool = True
    notify_no_show: bool = True

    model_config = {"from_attributes": True}


class NotificationSettingsUpdate(BaseModel):
    notify_new_booking: Optional[bool] = None
    notify_cancel: Optional[bool] = None
    notify_reminder: Optional[bool] = None
    notify_review: Optional[bool] = None
    notify_no_show: Optional[bool] = None


class ScheduleTemplateIn(BaseModel):
    day_of_week: int  # 0=Mon, 6=Sun
    start_time: str  # "09:00"
    end_time: str    # "18:00"
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    slot_step_min: Optional[int] = None  # шаг слотов (15/30/45/60), default 30
    location_id: Optional[int] = None


class ScheduleTemplateOut(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    slot_step_min: int = 30
    location_id: Optional[int] = None
    is_active: bool = True

    model_config = {"from_attributes": True}
