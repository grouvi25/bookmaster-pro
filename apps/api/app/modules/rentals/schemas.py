"""
Rental schemas.
"""

from datetime import date
from typing import Optional, List
from decimal import Decimal

from pydantic import BaseModel


LISTING_TYPES = ["chair", "room", "cabinet", "studio"]

AMENITY_OPTIONS = [
    "wifi", "tools", "parking", "mirror", "sink",
    "storage", "ac", "kitchen", "shower", "reception",
]


class RentalListingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    listing_type: str = "chair"
    address: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    price_monthly: Decimal
    price_daily: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    amenities: List[str] = []
    photo_urls: List[str] = []
    available_from: Optional[date] = None
    max_tenants: int = 1


class RentalListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    listing_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    price_monthly: Optional[Decimal] = None
    price_daily: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    amenities: Optional[List[str]] = None
    photo_urls: Optional[List[str]] = None
    status: Optional[str] = None
    available_from: Optional[date] = None
    max_tenants: Optional[int] = None


class RentalListingOut(BaseModel):
    id: int
    owner_id: int
    owner_name: Optional[str] = None
    owner_avatar: Optional[str] = None
    title: str
    description: Optional[str] = None
    listing_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    price_monthly: Decimal
    price_daily: Optional[Decimal] = None
    deposit: Optional[Decimal] = None
    amenities: List[str] = []
    photo_urls: List[str] = []
    status: str
    available_from: Optional[date] = None
    max_tenants: int = 1
    current_tenants: int = 0
    created_at: str

    model_config = {"from_attributes": True}


class RentalRequestCreate(BaseModel):
    message: Optional[str] = None


class RentalRequestOut(BaseModel):
    id: int
    listing_id: int
    listing_title: Optional[str] = None
    tenant_id: int
    tenant_name: Optional[str] = None
    tenant_avatar: Optional[str] = None
    message: Optional[str] = None
    status: str
    moved_in_at: Optional[date] = None
    created_at: str

    model_config = {"from_attributes": True}
