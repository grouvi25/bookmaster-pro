"""
Loyalty schemas.
"""

from typing import Optional, Dict, Any

from pydantic import BaseModel


class LoyaltyBalanceOut(BaseModel):
    master_id: int
    client_id: int
    balance: int
    tier: str
    total_earned: int
    streak_count: int = 0
    streak_threshold: int = 3
    streak_bonus: int = 100


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


class LoyaltySettingsOut(BaseModel):
    tiers: Dict[str, Any]
    points_expiry_months: int
    streak_threshold: int
    streak_bonus: int
    referral_bonus: int


class LoyaltySettingsUpdate(BaseModel):
    referral_bonus: Optional[int] = None
    streak_bonus: Optional[int] = None
