"""Marketplace schemas."""

from pydantic import BaseModel
from typing import Optional, List


class MarketplaceSearchRequest(BaseModel):
    city: Optional[str] = None
    specialization: Optional[str] = None
    query: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = 10.0
    min_rating: Optional[float] = None
    page: int = 1
    per_page: int = 20


class MarketplaceMasterCard(BaseModel):
    id: int
    slug: str
    display_name: str
    specialization: Optional[str]
    city: Optional[str]
    avatar_url: Optional[str]
    rating_avg: float
    rating_count: int
    total_clients: int
    min_price: Optional[float]
    services_count: int
    placement_tier: str  # free | priority | featured
    is_verified: bool


class MarketplaceSearchResponse(BaseModel):
    masters: List[MarketplaceMasterCard]
    total: int
    page: int
    per_page: int


class MasterPublicProfile(BaseModel):
    id: int
    slug: str
    display_name: str
    specialization: Optional[str]
    description: Optional[str]
    avatar_url: Optional[str]
    cover_url: Optional[str]
    city: Optional[str]
    address: Optional[str]
    rating_avg: float
    rating_count: int
    total_clients: int
    link_page_links: Optional[list]
    services: List[dict]
    recent_reviews: List[dict]
    portfolio_photos: List[dict]


class ListingUpdateRequest(BaseModel):
    is_visible: Optional[bool] = None
    placement_tier: Optional[str] = None  # free | priority | featured
