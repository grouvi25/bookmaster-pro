"""
Booking schemas.
"""

from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel


class TimeSlot(BaseModel):
    start: str  # "09:00"
    end: str    # "10:00"
    available: bool = True


class DaySlots(BaseModel):
    date: date
    slots: List[TimeSlot]


class BookingCreate(BaseModel):
    master_id: int
    service_id: int
    date: date
    time_start: str  # "09:00"
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_comment: Optional[str] = None
    location_id: Optional[int] = None
    promotion_id: Optional[int] = None


class BookingOut(BaseModel):
    id: int
    master_id: int
    client_id: Optional[int] = None
    service_id: Optional[int] = None
    date: date
    time_start: datetime
    time_end: datetime
    status: str
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_comment: Optional[str] = None
    master_comment: Optional[str] = None
    price_final: Optional[int] = None
    discount_amount: int = 0
    source: str = "mini_app"

    model_config = {"from_attributes": True}


class BookingStatusUpdate(BaseModel):
    status: str
    cancel_reason: Optional[str] = None
    master_comment: Optional[str] = None
    price_final: Optional[int] = None


class AvailableDatesOut(BaseModel):
    dates: List[date]


class BlockedSlotCreate(BaseModel):
    date_from: date
    date_to: date
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    reason: Optional[str] = None
    location_id: Optional[int] = None


class BlockedSlotOut(BaseModel):
    id: int
    date_from: date
    date_to: date
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    reason: Optional[str] = None

    model_config = {"from_attributes": True}
