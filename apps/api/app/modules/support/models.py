"""
Support — тикеты поддержки.
"""

from sqlalchemy import (
    Column, Integer, String, Text, SmallInteger, DateTime,
)

from app.core.base_model import BaseModel


class SupportTicket(BaseModel):
    __tablename__ = "support_tickets"

    ticket_code = Column(String(20), unique=True, nullable=False)
    initiator_role = Column(String(20), nullable=False)
    initiator_id = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False)
    priority = Column(String(10), nullable=False)
    # 'high' | 'medium' | 'low' | 'feedback'
    status = Column(String(20), default="open")
    assigned_to = Column(Integer, nullable=True)
    first_response_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    satisfaction = Column(SmallInteger, nullable=True)


class TicketMessage(BaseModel):
    __tablename__ = "ticket_messages"

    ticket_id = Column(Integer, nullable=False)
    sender_type = Column(String(20), nullable=False)
    sender_id = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    attachment_url = Column(String(500), nullable=True)
