"""
Services schemas.
"""

from typing import Optional

from pydantic import BaseModel


class ServiceCreate(BaseModel):
    name: str
    duration_min: int
    price: float
    price_max: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_online: bool = False
    is_consultation: bool = False
    consultation_url: Optional[str] = None
    sort_order: int = 0


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_min: Optional[int] = None
    price: Optional[float] = None
    price_max: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_online: Optional[bool] = None
    is_consultation: Optional[bool] = None
    consultation_url: Optional[str] = None
    sort_order: Optional[int] = None


class ServiceOut(BaseModel):
    id: int
    master_id: int
    name: str
    duration_min: int
    price: float
    price_max: Optional[float] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: bool = True
    is_online: bool = False
    is_consultation: bool = False
    consultation_url: Optional[str] = None
    sort_order: int = 0

    model_config = {"from_attributes": True}
