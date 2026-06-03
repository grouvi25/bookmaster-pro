"""
Payments — транзакции, подписки мастеров, абонементы клиентов.
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Date, ForeignKey, Boolean,
)

from app.core.base_model import BaseModel


class Payment(BaseModel):
    __tablename__ = "payments"

    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)

    amount_total = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), nullable=False)
    amount_master = Column(Numeric(10, 2), nullable=True)
    amount_service = Column(Numeric(10, 2), nullable=True)

    payment_type = Column(String(20), nullable=True)
    # 'prepay_30' | 'prepay_50' | 'full' | 'deposit'

    status = Column(String(20), default="pending")
    # pending | succeeded | refunded | partial_refund | failed

    yookassa_payment_id = Column(String(100), nullable=True)
    yookassa_split_id = Column(String(100), nullable=True)


class MasterSubscription(BaseModel):
    """Абонемент мастера — тариф B."""
    __tablename__ = "master_subscriptions"

    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    plan = Column(String(20), nullable=False)
    # 'start' | 'basic' | 'pro' | 'pro_ai' | 'business'
    price = Column(Numeric(8, 2), nullable=False)
    billing_period = Column(String(20), default="monthly")
    status = Column(String(20), default="active")
    started_at = Column(Date, nullable=False)
    next_billing = Column(Date, nullable=False)
    yookassa_recurring_id = Column(String(100), nullable=True)
    auto_renew = Column(Boolean, default=True, server_default="true", nullable=False)


class ClientSubscription(BaseModel):
    """Абонемент клиента — пакет визитов."""
    __tablename__ = "client_subscriptions"

    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)

    total_visits = Column(Integer, nullable=False)
    used_visits = Column(Integer, default=0)
    price_paid = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="active")
    # active | exhausted | expired | refunded
    expires_at = Column(Date, nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)
