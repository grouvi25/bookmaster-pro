"""
Marketplace router — /api/v1/marketplace
Поиск мастеров, публичные профили, листинги.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_master
from app.modules.marketplace.service import MarketplaceService
from app.modules.marketplace.schemas import (
    MarketplaceSearchResponse,
    MasterPublicProfile,
    ListingUpdateRequest,
)
from app.modules.masters.models import Master

router = APIRouter()


@router.get("/search", response_model=MarketplaceSearchResponse)
async def search_masters(
    city: Optional[str] = None,
    specialization: Optional[str] = None,
    q: Optional[str] = None,
    min_rating: Optional[float] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Поиск мастеров с фильтрами (публичный)."""
    svc = MarketplaceService(db)
    masters, total = await svc.search_masters(
        city=city,
        specialization=specialization,
        query=q,
        min_rating=min_rating,
        page=page,
        per_page=per_page,
    )
    return MarketplaceSearchResponse(
        masters=masters,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/master/{slug}", response_model=MasterPublicProfile)
async def get_master_profile(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Публичная страница мастера (для SEO и TapLink)."""
    svc = MarketplaceService(db)
    profile = await svc.get_public_profile(slug)
    if not profile:
        raise HTTPException(status_code=404, detail="Master not found")

    # Track view
    await svc.track_view(profile["id"])
    await db.commit()

    return profile


@router.post("/master/{slug}/book-click")
async def track_book_click(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Трекинг клика на кнопку 'Записаться'."""
    from app.modules.masters.models import Master
    from sqlalchemy import select

    result = await db.execute(select(Master.id).where(Master.slug == slug))
    master_id = result.scalar_one_or_none()
    if not master_id:
        raise HTTPException(status_code=404, detail="Master not found")

    svc = MarketplaceService(db)
    await svc.track_book_click(master_id)
    await db.commit()
    return {"tracked": True}


@router.patch("/listing")
async def update_my_listing(
    req: ListingUpdateRequest,
    master: Master = Depends(get_current_master),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки листинга мастера."""
    svc = MarketplaceService(db)
    listing = await svc.update_listing(
        master_id=master.id,
        is_visible=req.is_visible,
        placement_tier=req.placement_tier,
    )
    await db.commit()
    return {
        "master_id": listing.master_id,
        "is_visible": listing.is_visible,
        "placement_tier": listing.placement_tier,
        "views_total": listing.views_total,
        "clicks_book_total": listing.clicks_book_total,
    }
