"""
Client — профиль клиента и CRM-связанные таблицы.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Date, Float, Boolean,
    ForeignKey, JSON,
)
from sqlalchemy.orm import relationship

from app.core.base_model import BaseModel


class Client(BaseModel):
    __tablename__ = "clients"

    identity_id = Column(
        Integer, ForeignKey("identities.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    display_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    birthday = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)

    identity = relationship("Identity", backref="client", uselist=False)
    profile = relationship("ClientProfile", back_populates="client", uselist=False, cascade="all, delete-orphan")


class ClientProfile(BaseModel):
    """Расширенный профиль клиента (ДР, город, физ. параметры, предпочтения)."""
    __tablename__ = "client_profiles"

    client_id = Column(
        Integer, ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    city = Column(String(100), nullable=True)
    physical_params = Column(JSON, default=dict)
    preferences = Column(JSON, default=dict)
    allergies = Column(JSON, default=list)
    source = Column(String(50), nullable=True)
    communication_pref = Column(String(20), default="any")  # 'morning' | 'evening' | 'any'

    client = relationship("Client", back_populates="profile")


class ClientMasterLink(BaseModel):
    """Связь клиент-мастер с метаданными CRM."""
    __tablename__ = "client_master_links"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    tags = Column(JSON, default=list)
    master_notes = Column(Text, nullable=True)
    first_visit_date = Column(Date, nullable=True)
    last_visit_date = Column(Date, nullable=True)
    visit_count = Column(Integer, default=0)
    total_spent = Column(Integer, default=0)
    no_show_count = Column(Integer, default=0)
    is_blocked = Column(Boolean, default=False)
    source = Column(String(50), nullable=True)


class ClientTag(BaseModel):
    """Теги клиентов (per-мастер)."""
    __tablename__ = "client_tags"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    tag = Column(String(100), nullable=False)
    color = Column(String(20), default="grey")


class ClientNote(BaseModel):
    """Заметки мастера о клиенте."""
    __tablename__ = "client_notes"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    is_pinned = Column(Boolean, default=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)


class ClientMasterScore(BaseModel):
    """Приватная оценка клиента мастером (для CRM)."""
    __tablename__ = "client_master_scores"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, default=5.0)
    comment = Column(Text, nullable=True)
