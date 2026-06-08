"""
Rental Listings — аренда рабочих мест между мастерами.
"""

from sqlalchemy import (
    Column, Integer, String, Numeric, Text, Date, Boolean,
    ForeignKey, JSON,
)

from app.core.base_model import BaseModel


class RentalListing(BaseModel):
    __tablename__ = "rental_listings"

    owner_id = Column(
        Integer, ForeignKey("masters.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    listing_type = Column(String(30), nullable=False, default="chair")
    # chair | room | cabinet | studio
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    price_monthly = Column(Numeric(10, 2), nullable=False)
    price_daily = Column(Numeric(10, 2), nullable=True)
    deposit = Column(Numeric(10, 2), nullable=True)
    amenities = Column(JSON, default=list)
    # ["wifi", "tools", "parking", "mirror", "sink", "storage", "ac"]
    photo_urls = Column(JSON, default=list)
    status = Column(String(20), nullable=False, default="active")
    # active | paused | rented
    available_from = Column(Date, nullable=True)
    max_tenants = Column(Integer, default=1)
    current_tenants = Column(Integer, default=0)


class RentalRequest(BaseModel):
    __tablename__ = "rental_requests"

    listing_id = Column(
        Integer, ForeignKey("rental_listings.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    tenant_id = Column(
        Integer, ForeignKey("masters.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    message = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    # pending | approved | rejected | cancelled
    moved_in_at = Column(Date, nullable=True)
    moved_out_at = Column(Date, nullable=True)
