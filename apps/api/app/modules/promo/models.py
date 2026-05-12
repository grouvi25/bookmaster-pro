"""
Promotions — промоакции, промокоды.
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Date,
    ForeignKey, ARRAY,
)

from app.core.base_model import BaseModel


class Promotion(BaseModel):
    __tablename__ = "promotions"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    promo_type = Column(String(30), nullable=False)
    # 'code' | 'period' | 'service_discount' | 'first_visit' | 'birthday' | 'group'

    code = Column(String(50), nullable=True)
    discount_type = Column(String(10), nullable=False)  # 'percent' | 'fixed'
    discount_value = Column(Numeric(8, 2), nullable=False)
    min_amount = Column(Numeric(8, 2), default=0)
    max_uses = Column(Integer, nullable=True)  # NULL = без ограничений
    used_count = Column(Integer, default=0)
    service_ids = Column(ARRAY(Integer), nullable=True)  # NULL = все услуги
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)


class PromoUsage(BaseModel):
    __tablename__ = "promo_usages"

    promotion_id = Column(Integer, ForeignKey("promotions.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    discount_applied = Column(Numeric(8, 2), nullable=True)
