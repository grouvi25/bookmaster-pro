"""
Service — услуги мастера.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.core.base_model import BaseModel


class Service(BaseModel):
    __tablename__ = "services"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    duration_min = Column(Integer, nullable=False)  # длительность в минутах
    price = Column(Float, nullable=False)
    price_max = Column(Float, nullable=True)  # для диапазона «от ... до ...»
    category = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_online = Column(Boolean, default=False)  # онлайн-консультация

    master = relationship("Master", back_populates="services")
