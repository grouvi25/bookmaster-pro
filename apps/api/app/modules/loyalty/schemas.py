"""
Loyalty schemas.
"""

from typing import Optional

from pydantic import BaseModel


class LoyaltyBalanceOut(BaseModel):
    master_id: int
    client_id: int
    balance: int
    tier: str
    total_earned: int


class LoyaltyTransactionOut(BaseModel):
    id: int
    type: str
    points: int
    appointment_id: Optional[int] = None
    note: Optional[str] = None

    model_config = {"from_attributes": True}


class LoyaltySpendRequest(BaseModel):
    points: int
    appointment_id: int


class ReferralCreate(BaseModel):
    referrer_code: str
