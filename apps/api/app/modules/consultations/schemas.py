"""Consultations schemas — Pydantic модели запросов/ответов."""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ConsultationSlotCreate(BaseModel):
    service_id: int
    slot_start: datetime
    slot_end: datetime


class ConsultationSlotOut(BaseModel):
    id: int
    master_id: int
    service_id: int
    slot_start: datetime
    slot_end: datetime
    is_available: bool
    created_at: datetime


class ConsultationSlotBulkCreate(BaseModel):
    service_id: int
    slots: List[ConsultationSlotCreate]


class ConsultationCreate(BaseModel):
    service_id: int
    slot_id: int
    client_note: Optional[str] = Field(None, max_length=1000)


class ConsultationUpdate(BaseModel):
    status: Optional[str] = None
    master_note: Optional[str] = Field(None, max_length=2000)
    meeting_url: Optional[str] = Field(None, max_length=500)


class ConsultationOut(BaseModel):
    id: int
    master_id: int
    client_id: Optional[int]
    service_id: Optional[int]
    slot_id: Optional[int]
    slot_start: datetime
    slot_end: datetime
    status: str
    meeting_url: Optional[str]
    client_note: Optional[str]
    master_note: Optional[str]
    price: Optional[int]
    converted_appointment_id: Optional[int]
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]
    created_at: datetime


class ConsultationConvert(BaseModel):
    """Конвертировать консультацию в запись на услугу."""
    appointment_id: int


class ConsultationStats(BaseModel):
    total: int
    completed: int
    cancelled: int
    conversion_rate: float
