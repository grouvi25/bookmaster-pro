"""
Loyalty — баллы, уровни, транзакции, рефералы.
"""

from sqlalchemy import (
    Column, Integer, String, Date, Text,
    ForeignKey, PrimaryKeyConstraint,
)

from app.core.base_model import BaseModel, TimestampMixin
from app.core.database import Base


class LoyaltyAccount(Base, TimestampMixin):
    __tablename__ = "loyalty_accounts"

    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    balance = Column(Integer, default=0)
    tier = Column(String(20), default="new")  # 'new' | 'regular' | 'vip'
    total_earned = Column(Integer, default=0)

    __table_args__ = (
        PrimaryKeyConstraint("master_id", "client_id"),
    )


class LoyaltyTransaction(BaseModel):
    __tablename__ = "loyalty_transactions"

    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    type = Column(String(30), nullable=False)
    # 'earn_visit' | 'earn_review' | 'earn_birthday' | 'earn_referral' | 'spend' | 'expire'
    points = Column(Integer, nullable=False)
    appointment_id = Column(Integer, nullable=True)
    expires_at = Column(Date, nullable=True)
    note = Column(Text, nullable=True)


class Referral(BaseModel):
    __tablename__ = "referrals"

    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    referrer_client = Column(Integer, ForeignKey("clients.id"), nullable=False)
    referred_client = Column(Integer, ForeignKey("clients.id"), nullable=False)
    first_visit_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    bonus_applied = Column(Integer, default=0)
