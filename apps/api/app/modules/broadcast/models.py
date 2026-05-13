"""
Broadcast — рассылки мастера по сегментам клиентов.
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, JSON,
    ForeignKey,
)

from app.core.base_model import BaseModel


class Broadcast(BaseModel):
    __tablename__ = "broadcasts"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    text = Column(Text, nullable=False)
    segment_filter = Column(JSON, default=dict)
    # segment_filter: {"tags": [...], "last_visit_before": "2024-01-01", "city": "..."}
    status = Column(String(20), default="draft")
    # draft | scheduled | sending | sent | cancelled
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    total_recipients = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    button_text = Column(String(100), nullable=True)
    button_url = Column(String(500), nullable=True)
