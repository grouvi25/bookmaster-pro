"""
Marketplace service — поиск мастеров, листинги, публичные профили.
"""

from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_

from app.modules.masters.models import Master
from app.modules.services.models import Service
from app.modules.marketplace.models import MarketplaceListing
from app.modules.reviews.models import ClientReview
from app.modules.portfolio.models import WorkPhoto


class MarketplaceService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def search_masters(
        self,
        city: Optional[str] = None,
        specialization: Optional[str] = None,
        query: Optional[str] = None,
        min_rating: Optional[float] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[dict], int]:
        """Поиск мастеров с фильтрами."""
        q = (
            select(
                Master,
                MarketplaceListing.placement_tier,
                func.min(Service.price).label("min_price"),
                func.count(Service.id).label("services_count"),
            )
            .outerjoin(MarketplaceListing, MarketplaceListing.master_id == Master.id)
            .outerjoin(Service, and_(
                Service.master_id == Master.id,
                Service.is_active.is_(True),
            ))
            .where(Master.is_active.is_(True))
            .group_by(Master.id, MarketplaceListing.placement_tier)
        )

        # Filters
        if city:
            q = q.where(func.lower(Master.city) == func.lower(city))
        if specialization:
            q = q.where(func.lower(Master.specialization).contains(func.lower(specialization)))
        if query:
            q = q.where(or_(
                Master.display_name.ilike(f"%{query}%"),
                Master.specialization.ilike(f"%{query}%"),
                Master.description.ilike(f"%{query}%"),
            ))
        if min_rating:
            q = q.where(Master.rating_avg >= min_rating)

        # Filter only visible listings
        q = q.where(
            or_(
                MarketplaceListing.is_visible.is_(True),
                MarketplaceListing.id.is_(None),
            )
        )

        # Count
        count_q = select(func.count()).select_from(q.subquery())
        total_r = await self.db.execute(count_q)
        total = total_r.scalar() or 0

        # Order: featured > priority > free, then by rating
        q = q.order_by(
            func.array_position(
                ["featured", "priority", "free"],
                func.coalesce(MarketplaceListing.placement_tier, "free"),
            ),
            Master.rating_avg.desc(),
        )
        q = q.offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(q)
        rows = result.all()

        masters = []
        for row in rows:
            master = row[0]
            masters.append({
                "id": master.id,
                "slug": master.slug,
                "display_name": master.display_name,
                "specialization": master.specialization,
                "city": master.city,
                "avatar_url": master.avatar_url,
                "rating_avg": master.rating_avg,
                "rating_count": master.rating_count,
                "total_clients": master.total_clients,
                "min_price": float(row[2]) if row[2] else None,
                "services_count": row[3],
                "placement_tier": row[1] or "free",
                "is_verified": master.is_verified,
            })

        return masters, total

    async def get_public_profile(self, slug: str) -> Optional[dict]:
        """Публичная страница мастера (для маркетплейса и TapLink)."""
        result = await self.db.execute(
            select(Master).where(Master.slug == slug, Master.is_active.is_(True))
        )
        master = result.scalar_one_or_none()
        if not master:
            return None

        # Services
        svc_result = await self.db.execute(
            select(Service)
            .where(Service.master_id == master.id, Service.is_active.is_(True))
            .order_by(Service.sort_order)
        )
        services = [
            {
                "id": s.id,
                "name": s.name,
                "duration_min": s.duration_min,
                "price": float(s.price),
                "price_max": float(s.price_max) if s.price_max else None,
                "category": s.category,
                "is_online": s.is_online,
            }
            for s in svc_result.scalars().all()
        ]

        # Recent reviews (3)
        rev_result = await self.db.execute(
            select(ClientReview)
            .where(
                ClientReview.master_id == master.id,
                ClientReview.is_hidden.is_(False),
            )
            .order_by(ClientReview.created_at.desc())
            .limit(3)
        )
        reviews = [
            {
                "id": r.id,
                "rating": r.rating,
                "text": r.text,
                "master_reply": r.master_reply,
                "created_at": str(r.created_at),
            }
            for r in rev_result.scalars().all()
        ]

        # Portfolio photos (6)
        photo_result = await self.db.execute(
            select(WorkPhoto)
            .where(
                WorkPhoto.master_id == master.id,
                WorkPhoto.is_portfolio.is_(True),
            )
            .order_by(WorkPhoto.sort_order)
            .limit(6)
        )
        photos = [
            {
                "id": p.id,
                "s3_key": p.s3_key,
                "caption": p.caption,
            }
            for p in photo_result.scalars().all()
        ]

        return {
            "id": master.id,
            "slug": master.slug,
            "display_name": master.display_name,
            "specialization": master.specialization,
            "description": master.description,
            "avatar_url": master.avatar_url,
            "cover_url": master.cover_url,
            "city": master.city,
            "address": master.address,
            "rating_avg": master.rating_avg,
            "rating_count": master.rating_count,
            "total_clients": master.total_clients,
            "link_page_links": master.link_page_links,
            "services": services,
            "recent_reviews": reviews,
            "portfolio_photos": photos,
        }

    async def get_or_create_listing(self, master_id: int) -> MarketplaceListing:
        result = await self.db.execute(
            select(MarketplaceListing).where(
                MarketplaceListing.master_id == master_id
            )
        )
        listing = result.scalar_one_or_none()
        if not listing:
            listing = MarketplaceListing(
                master_id=master_id,
                is_visible=True,
                placement_tier="free",
            )
            self.db.add(listing)
            await self.db.flush()
        return listing

    async def update_listing(
        self,
        master_id: int,
        is_visible: Optional[bool] = None,
        placement_tier: Optional[str] = None,
    ) -> MarketplaceListing:
        listing = await self.get_or_create_listing(master_id)
        if is_visible is not None:
            listing.is_visible = is_visible
        if placement_tier is not None:
            listing.placement_tier = placement_tier
        await self.db.flush()
        return listing

    async def track_view(self, master_id: int):
        listing = await self.get_or_create_listing(master_id)
        listing.views_total = (listing.views_total or 0) + 1
        await self.db.flush()

    async def track_book_click(self, master_id: int):
        listing = await self.get_or_create_listing(master_id)
        listing.clicks_book_total = (listing.clicks_book_total or 0) + 1
        await self.db.flush()
