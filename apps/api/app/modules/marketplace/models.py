"""
Marketplace — маркетплейс листинги.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Date, Float,
    ForeignKey,
)
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import TSVECTOR

from app.core.base_model import BaseModel


class MarketplaceListing(BaseModel):
    __tablename__ = "marketplace_listings"

    master_id = Column(
        Integer, ForeignKey("masters.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )
    is_visible = Column(Boolean, default=True)
    placement_tier = Column(String(20), default="free")
    # 'free' | 'priority' | 'featured'
    tier_expires_at = Column(Date, nullable=True)
    geo_point = Column(Geometry("POINT", srid=4326), nullable=True)  # PostGIS
    search_vector = Column(TSVECTOR, nullable=True)  # полнотекстовый поиск
    views_total = Column(Integer, default=0)
    clicks_book_total = Column(Integer, default=0)
