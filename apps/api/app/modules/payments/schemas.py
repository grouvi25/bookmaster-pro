"""
Payments schemas.
"""

from datetime import date
from typing import Optional
from decimal import Decimal

from pydantic import BaseModel


class CreatePaymentRequest(BaseModel):
    appointment_id: int
    payment_type: str = "full"  # 'prepay_30' | 'prepay_50' | 'full' | 'deposit'
    return_url: Optional[str] = None


class PaymentOut(BaseModel):
    id: int
    appointment_id: Optional[int] = None
    master_id: int
    client_id: Optional[int] = None
    amount_total: Decimal
    amount_paid: Decimal
    amount_master: Optional[Decimal] = None
    amount_service: Optional[Decimal] = None
    payment_type: Optional[str] = None
    status: str
    yookassa_payment_id: Optional[str] = None

    model_config = {"from_attributes": True}


class PaymentConfirmation(BaseModel):
    confirmation_url: str
    payment_id: int


class SubscriptionCreate(BaseModel):
    plan: str  # 'start' | 'basic' | 'pro' | 'pro_ai' | 'business'
    billing_period: str = "monthly"


class SubscriptionOut(BaseModel):
    id: int
    master_id: int
    plan: str
    price: Decimal
    billing_period: str
    status: str
    started_at: date
    next_billing: date
    auto_renew: bool = True

    model_config = {"from_attributes": True}


class ClientSubscriptionCreate(BaseModel):
    master_id: int
    service_id: int
    total_visits: int
    price: Decimal


class ClientSubscriptionOut(BaseModel):
    id: int
    master_id: int
    client_id: int
    service_id: Optional[int] = None
    total_visits: int
    used_visits: int
    price_paid: Decimal
    status: str
    expires_at: Optional[date] = None

    model_config = {"from_attributes": True}
