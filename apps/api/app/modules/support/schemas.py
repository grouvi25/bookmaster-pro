"""Support / tickets schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TicketCreate(BaseModel):
    category: str  # billing | technical | abuse | feature_request | feedback | review_complaint
    priority: Optional[str] = None  # auto from category if omitted
    subject: str = Field(..., max_length=300)
    message: str = Field(..., max_length=5000)


class TicketReply(BaseModel):
    text: str = Field(..., max_length=5000)
    attachment_url: Optional[str] = None


class TicketCloseRequest(BaseModel):
    resolution_note: Optional[str] = Field(None, max_length=2000)


class TicketMessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_id: Optional[int]
    text: str
    attachment_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: int
    ticket_code: str
    initiator_role: str
    initiator_id: int
    category: str
    priority: str
    status: str
    subject: Optional[str] = None
    assigned_to: Optional[int] = None
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    satisfaction: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TicketRateRequest(BaseModel):
    satisfaction: int = Field(..., ge=1, le=5)
