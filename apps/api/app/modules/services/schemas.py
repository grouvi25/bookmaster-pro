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
    sort_order: int = 0

    model_config = {"from_attributes": True}
