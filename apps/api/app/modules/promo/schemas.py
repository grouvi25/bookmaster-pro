"""
Promo schemas.
"""

from datetime import date
from typing import Optional, List
from decimal import Decimal

from pydantic import BaseModel


class PromoCreate(BaseModel):
    promo_type: str  # 'code' | 'period' | 'service_discount' | 'first_visit' | 'birthday' | 'group'
    code: Optional[str] = None
    discount_type: str  # 'percent' | 'fixed'
    discount_value: Decimal
    min_amount: Decimal = Decimal("0")
    max_uses: Optional[int] = None
    service_ids: Optional[List[int]] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None


class PromoOut(BaseModel):
    id: int
    master_id: int
    promo_type: str
    code: Optional[str] = None
    discount_type: str
    discount_value: Decimal
    min_amount: Decimal
    max_uses: Optional[int] = None
    used_count: int = 0
    service_ids: Optional[List[int]] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class PromoValidateRequest(BaseModel):
    code: str
    master_id: int
    service_id: Optional[int] = None
    amount: Decimal


class PromoValidateResponse(BaseModel):
    valid: bool
    discount_amount: Decimal = Decimal("0")
    promotion_id: Optional[int] = None
    message: Optional[str] = None
