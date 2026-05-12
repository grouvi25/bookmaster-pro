"""Support / tickets schemas."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class TicketCreate(BaseModel):
    category: str  # billing | technical | abuse | feature_request | feedback
    priority: str = "medium"  # high | medium | low | feedback
    subject: str = Field(..., max_length=200)
    message: str = Field(..., max_length=5000)


class TicketReply(BaseModel):
    text: str = Field(..., max_length=5000)
    attachment_url: Optional[str] = None


class TicketMessageOut(BaseModel):
    id: int
    ticket_id: int
    sender_type: str
    sender_id: Optional[int]
    text: str
    attachment_url: Optional[str]
    created_at: datetime


class TicketOut(BaseModel):
    id: int
    ticket_code: str
    initiator_role: str
    initiator_id: int
    category: str
    priority: str
    status: str
    assigned_to: Optional[int]
    first_response_at: Optional[datetime]
    resolved_at: Optional[datetime]
    satisfaction: Optional[int]
    created_at: datetime


class TicketRateRequest(BaseModel):
    satisfaction: int = Field(..., ge=1, le=5)
