"""
Waitlist schemas.
"""

from datetime import date
from typing import Optional

from pydantic import BaseModel


class WaitlistCreate(BaseModel):
    master_id: int
    service_id: Optional[int] = None
    preferred_date: Optional[date] = None
    preferred_time_from: Optional[str] = None
    preferred_time_to: Optional[str] = None


class WaitlistOut(BaseModel):
    id: int
    master_id: int
    client_id: int
    service_id: Optional[int] = None
    preferred_date: Optional[date] = None
    preferred_time_from: Optional[str] = None
    preferred_time_to: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}
