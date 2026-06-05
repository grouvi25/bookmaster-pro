"""
Booking models — расписание, записи, блокировки.
"""

import enum
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Date,
    Time, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.base_model import BaseModel


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PAID = "paid"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED_BY_CLIENT = "cancelled_by_client"
    CANCELLED_BY_MASTER = "cancelled_by_master"
    NO_SHOW = "no_show"


class EventType(str, enum.Enum):
    SERVICE = "service"
    MEETING = "meeting"
    CONSULTATION = "consultation"
    SHOOTING = "shooting"
    EDUCATION = "education"
    OTHER = "other"


class ScheduleTemplate(BaseModel):
    """Шаблон расписания — день недели + время."""
    __tablename__ = "schedule_templates"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    location_id = Column(Integer, ForeignKey("master_locations.id"), nullable=True)
    day_of_week = Column(Integer, nullable=True)  # 0=Mon, 6=Sun; NULL если конкретная дата
    specific_date = Column(Date, nullable=True)  # конкретная дата (вместо day_of_week)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    break_start = Column(Time, nullable=True)
    break_end = Column(Time, nullable=True)
    slot_step_min = Column(Integer, default=30)  # шаг слотов в минутах
    is_active = Column(Boolean, default=True)

    master = relationship("Master", back_populates="schedule_templates")


class BlockedSlot(BaseModel):
    """Заблокированный период (выходной, отпуск)."""
    __tablename__ = "blocked_slots"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    location_id = Column(Integer, ForeignKey("master_locations.id"), nullable=True)
    date_from = Column(Date, nullable=False)
    date_to = Column(Date, nullable=False)
    time_from = Column(Time, nullable=True)  # NULL = весь день
    time_to = Column(Time, nullable=True)
    reason = Column(String(200), nullable=True)


class Appointment(BaseModel):
    """Запись клиента к мастеру."""
    __tablename__ = "appointments"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    location_id = Column(Integer, ForeignKey("master_locations.id"), nullable=True)

    date = Column(Date, nullable=False)
    time_start = Column(DateTime(timezone=True), nullable=False)
    time_end = Column(DateTime(timezone=True), nullable=False)

    status = Column(
        String(30),
        default=AppointmentStatus.PENDING.value,
        nullable=False,
    )

    client_name = Column(String(100), nullable=True)
    client_phone = Column(String(20), nullable=True)
    client_comment = Column(Text, nullable=True)
    master_comment = Column(Text, nullable=True)

    price_final = Column(Integer, nullable=True)
    discount_amount = Column(Integer, default=0)
    promotion_id = Column(Integer, ForeignKey("promotions.id"), nullable=True)
    loyalty_points_used = Column(Integer, default=0)
    subscription_id = Column(Integer, nullable=True)

    source = Column(String(30), default="mini_app")
    # 'mini_app' | 'bot' | 'marketplace' | 'widget' | 'manual'

    event_type = Column(String(30), default=EventType.SERVICE.value, nullable=False)
    # 'service' | 'meeting' | 'consultation' | 'shooting' | 'education' | 'other'

    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(String(300), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    reminder_1d_sent = Column(Boolean, default=False)
    reminder_2h_sent = Column(Boolean, default=False)

    # Отношения
    master = relationship("Master")
    client = relationship("Client")
    service = relationship("Service")
