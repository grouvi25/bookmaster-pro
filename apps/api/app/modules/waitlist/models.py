"""
Waitlist — лист ожидания.
"""

from sqlalchemy import (
    Column, Integer, String, Date, DateTime,
    ForeignKey,
)

from app.core.base_model import BaseModel


class WaitlistEntry(BaseModel):
    __tablename__ = "waitlist_entries"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    preferred_date = Column(Date, nullable=True)
    preferred_time_from = Column(String(5), nullable=True)  # "09:00"
    preferred_time_to = Column(String(5), nullable=True)    # "18:00"
    status = Column(String(20), default="waiting")
    # waiting | notified | booked | expired | cancelled
    notified_at = Column(DateTime(timezone=True), nullable=True)
    slot_reserved_until = Column(DateTime(timezone=True), nullable=True)
