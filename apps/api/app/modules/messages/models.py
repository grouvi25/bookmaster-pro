"""
Messages — внутренняя переписка мастер ↔ клиент.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.base_model import BaseModel


class MessageThread(BaseModel):
    """Тред переписки — 1 тред = 1 пара мастер+клиент."""
    __tablename__ = "message_threads"

    master_id = Column(
        Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False
    )
    client_id = Column(
        Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    appointment_id = Column(
        Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )

    last_message_at = Column(DateTime(timezone=True), nullable=True)
    last_message_text = Column(String(200), nullable=True)
    master_unread = Column(Integer, default=0, nullable=False)
    client_unread = Column(Integer, default=0, nullable=False)

    master = relationship("Master", backref="message_threads")
    client = relationship("Client", backref="message_threads")
    messages = relationship(
        "Message", back_populates="thread",
        cascade="all, delete-orphan", order_by="Message.created_at",
    )

    __table_args__ = (
        UniqueConstraint("master_id", "client_id", name="uq_thread_master_client"),
    )


class Message(BaseModel):
    """Одно сообщение в треде."""
    __tablename__ = "messages"

    thread_id = Column(
        Integer, ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False
    )
    sender_role = Column(String(10), nullable=False)  # 'master' | 'client'
    sender_id = Column(Integer, nullable=False)  # master.id or client.id
    text = Column(Text, nullable=True)
    attachment_url = Column(String(500), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)

    thread = relationship("MessageThread", back_populates="messages")
