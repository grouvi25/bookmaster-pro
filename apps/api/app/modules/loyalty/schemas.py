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
    earn_rate: int = 10              # 1 балл = N рублей
    first_visit_bonus: int = 200
    review_bonus: int = 50
    birthday_bonus: int = 300
    max_spend_percent: int = 30      # макс % от заказа, который можно покрыть баллами


class LoyaltySettingsUpdate(BaseModel):
    referral_bonus: Optional[int] = None
    streak_bonus: Optional[int] = None
    earn_rate: Optional[int] = None
    first_visit_bonus: Optional[int] = None
    review_bonus: Optional[int] = None
    birthday_bonus: Optional[int] = None
    max_spend_percent: Optional[int] = None
