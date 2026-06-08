"""
Rental service — CRUD + request management.
"""

import logging
from typing import Optional, List

from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.rentals.models import RentalListing, RentalRequest
from app.modules.masters.models import Master

logger = logging.getLogger(__name__)


class RentalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Listings CRUD ──

    async def create_listing(self, owner_id: int, data: dict) -> RentalListing:
        listing = RentalListing(owner_id=owner_id, **data)
        self.db.add(listing)
        await self.db.commit()
        await self.db.refresh(listing)
        return listing

    async def get_listing(self, listing_id: int) -> Optional[RentalListing]:
        result = await self.db.execute(
            select(RentalListing).where(RentalListing.id == listing_id)
        )
        return result.scalar_one_or_none()

    async def list_active(
        self,
        city: Optional[str] = None,
        listing_type: Optional[str] = None,
        max_price: Optional[float] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[dict]:
        q = (
            select(RentalListing, Master.display_name, Master.avatar_url)
            .join(Master, Master.id == RentalListing.owner_id)
            .where(RentalListing.status == "active")
        )
        if city:
            q = q.where(RentalListing.city.ilike(f"%{city}%"))
        if listing_type:
            q = q.where(RentalListing.listing_type == listing_type)
        if max_price:
            q = q.where(RentalListing.price_monthly <= max_price)
        q = q.order_by(RentalListing.created_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(q)
        rows = result.all()
        return [
            {
                **_listing_to_dict(row[0]),
                "owner_name": row[1],
                "owner_avatar": row[2],
            }
            for row in rows
        ]

    async def my_listings(self, owner_id: int) -> List[dict]:
        q = (
            select(RentalListing)
            .where(RentalListing.owner_id == owner_id)
            .order_by(RentalListing.created_at.desc())
        )
        result = await self.db.execute(q)
        listings = result.scalars().all()
        return [_listing_to_dict(l) for l in listings]

    async def update_listing(
        self, listing_id: int, owner_id: int, data: dict
    ) -> Optional[RentalListing]:
        listing = await self.get_listing(listing_id)
        if not listing or listing.owner_id != owner_id:
            return None
        for k, v in data.items():
            if v is not None:
                setattr(listing, k, v)
        await self.db.commit()
        await self.db.refresh(listing)
        return listing

    async def delete_listing(self, listing_id: int, owner_id: int) -> bool:
        listing = await self.get_listing(listing_id)
        if not listing or listing.owner_id != owner_id:
            return False
        await self.db.delete(listing)
        await self.db.commit()
        return True

    # ── Rental Requests ──

    async def create_request(
        self, listing_id: int, tenant_id: int, message: Optional[str] = None
    ) -> Optional[RentalRequest]:
        # Check listing exists and is active
        listing = await self.get_listing(listing_id)
        if not listing or listing.status != "active":
            return None
        # Check not already requested
        existing = await self.db.execute(
            select(RentalRequest).where(
                RentalRequest.listing_id == listing_id,
                RentalRequest.tenant_id == tenant_id,
                RentalRequest.status.in_(["pending", "approved"]),
            )
        )
        if existing.scalar_one_or_none():
            return None  # Already has active request
        req = RentalRequest(
            listing_id=listing_id,
            tenant_id=tenant_id,
            message=message,
        )
        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def incoming_requests(self, owner_id: int) -> List[dict]:
        """Requests for my listings (I'm the owner)."""
        q = (
            select(RentalRequest, RentalListing.title, Master.display_name, Master.avatar_url)
            .join(RentalListing, RentalListing.id == RentalRequest.listing_id)
            .join(Master, Master.id == RentalRequest.tenant_id)
            .where(
                RentalListing.owner_id == owner_id,
                RentalRequest.status == "pending",
            )
            .order_by(RentalRequest.created_at.desc())
        )
        result = await self.db.execute(q)
        rows = result.all()
        return [
            {
                **_request_to_dict(row[0]),
                "listing_title": row[1],
                "tenant_name": row[2],
                "tenant_avatar": row[3],
            }
            for row in rows
        ]

    async def my_requests(self, tenant_id: int) -> List[dict]:
        """My applications (I'm the tenant)."""
        q = (
            select(RentalRequest, RentalListing.title)
            .join(RentalListing, RentalListing.id == RentalRequest.listing_id)
            .where(RentalRequest.tenant_id == tenant_id)
            .order_by(RentalRequest.created_at.desc())
        )
        result = await self.db.execute(q)
        rows = result.all()
        return [
            {
                **_request_to_dict(row[0]),
                "listing_title": row[1],
            }
            for row in rows
        ]

    async def respond_to_request(
        self, request_id: int, owner_id: int, approve: bool
    ) -> Optional[RentalRequest]:
        q = (
            select(RentalRequest)
            .join(RentalListing, RentalListing.id == RentalRequest.listing_id)
            .where(
                RentalRequest.id == request_id,
                RentalListing.owner_id == owner_id,
                RentalRequest.status == "pending",
            )
        )
        result = await self.db.execute(q)
        req = result.scalar_one_or_none()
        if not req:
            return None

        if approve:
            req.status = "approved"
            # Update tenant count
            listing = await self.get_listing(req.listing_id)
            if listing:
                listing.current_tenants = (listing.current_tenants or 0) + 1
                if listing.current_tenants >= listing.max_tenants:
                    listing.status = "rented"
        else:
            req.status = "rejected"

        await self.db.commit()
        await self.db.refresh(req)
        return req


def _listing_to_dict(l: RentalListing) -> dict:
    return {
        "id": l.id,
        "owner_id": l.owner_id,
        "title": l.title,
        "description": l.description,
        "listing_type": l.listing_type,
        "address": l.address,
        "city": l.city,
        "price_monthly": float(l.price_monthly) if l.price_monthly else 0,
        "price_daily": float(l.price_daily) if l.price_daily else None,
        "deposit": float(l.deposit) if l.deposit else None,
        "amenities": l.amenities or [],
        "photo_urls": l.photo_urls or [],
        "status": l.status,
        "available_from": str(l.available_from) if l.available_from else None,
        "max_tenants": l.max_tenants or 1,
        "current_tenants": l.current_tenants or 0,
        "created_at": l.created_at.isoformat() if l.created_at else "",
    }


def _request_to_dict(r: RentalRequest) -> dict:
    return {
        "id": r.id,
        "listing_id": r.listing_id,
        "tenant_id": r.tenant_id,
        "message": r.message,
        "status": r.status,
        "moved_in_at": str(r.moved_in_at) if r.moved_in_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else "",
    }
