"""
Consultations — онлайн-консультации мастера.
Слоты, бронирования, ссылки на видеозвонки.
"""

import enum

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.base_model import BaseModel


class ConsultationStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class ConsultationSlot(BaseModel):
    """Слот для онлайн-консультации, привязанный к услуге-консультации."""
    __tablename__ = "consultation_slots"

    master_id = Column(
        Integer,
        ForeignKey("masters.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_id = Column(
        Integer,
        ForeignKey("services.id", ondelete="CASCADE"),
        nullable=False,
    )
    slot_start = Column(DateTime(timezone=True), nullable=False)
    slot_end = Column(DateTime(timezone=True), nullable=False)
    is_available = Column(Boolean, default=True)

    master = relationship("Master")
    service = relationship("Service")


class Consultation(BaseModel):
    """Забронированная онлайн-консультация."""
    __tablename__ = "consultations"

    master_id = Column(
        Integer,
        ForeignKey("masters.id", ondelete="CASCADE"),
        nullable=False,
    )
    client_id = Column(
        Integer,
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    service_id = Column(
        Integer,
        ForeignKey("services.id", ondelete="SET NULL"),
        nullable=True,
    )
    slot_id = Column(
        Integer,
        ForeignKey("consultation_slots.id", ondelete="SET NULL"),
        nullable=True,
    )

    slot_start = Column(DateTime(timezone=True), nullable=False)
    slot_end = Column(DateTime(timezone=True), nullable=False)

    status = Column(
        String(30),
        default=ConsultationStatus.PENDING.value,
        nullable=False,
    )

    meeting_url = Column(String(500), nullable=True)
    client_note = Column(Text, nullable=True)
    master_note = Column(Text, nullable=True)

    price = Column(Integer, nullable=True)
    converted_appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )

    completed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(300), nullable=True)

    master = relationship("Master")
    client = relationship("Client")
    service = relationship("Service")
    slot = relationship("ConsultationSlot")
