"""
Client — профиль клиента.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Date,
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
    notes = Column(Text, nullable=True)  # Заметки клиента о себе
    avatar_url = Column(String(500), nullable=True)

    identity = relationship("Identity", backref="client", uselist=False)


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
    source = Column(String(50), nullable=True)  # 'direct' | 'marketplace' | 'referral'
