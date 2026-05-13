"""
Broadcast schemas.
"""

from datetime import datetime
from typing import Optional, Dict, Any, List

from pydantic import BaseModel


class BroadcastCreate(BaseModel):
    title: str
    text: str
    segment_filter: Optional[Dict[str, Any]] = None
    button_text: Optional[str] = None
    button_url: Optional[str] = None
    scheduled_at: Optional[datetime] = None


class BroadcastOut(BaseModel):
    id: int
    master_id: int
    title: str
    text: str
    segment_filter: Optional[Dict[str, Any]] = None
    status: str
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    total_recipients: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    button_text: Optional[str] = None
    button_url: Optional[str] = None

    class Config:
        from_attributes = True


class SegmentPreview(BaseModel):
    count: int
    client_ids: List[int]
