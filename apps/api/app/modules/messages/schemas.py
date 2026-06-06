"""
Messages schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class MessageCreate(BaseModel):
    text: Optional[str] = None
    attachment_url: Optional[str] = None


class MessageOut(BaseModel):
    id: int
    thread_id: int
    sender_role: str
    sender_id: int
    text: Optional[str] = None
    attachment_url: Optional[str] = None
    is_read: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class ThreadOut(BaseModel):
    id: int
    master_id: int
    client_id: int
    appointment_id: Optional[int] = None
    last_message_at: Optional[datetime] = None
    last_message_text: Optional[str] = None
    master_unread: int = 0
    client_unread: int = 0
    created_at: datetime
    # Joined fields
    partner_name: Optional[str] = None
    partner_avatar: Optional[str] = None

    model_config = {"from_attributes": True}


class ThreadListOut(BaseModel):
    items: List[ThreadOut]
    total: int


class MessageListOut(BaseModel):
    items: List[MessageOut]
    total: int
    thread: ThreadOut
