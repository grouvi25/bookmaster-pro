"""
Rentals router — /api/v1/rentals
Аренда рабочих мест между мастерами.
"""

from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.rentals.schemas import (
    RentalListingCreate, RentalListingUpdate,
    RentalRequestCreate,
)
from app.modules.rentals.service import RentalService

router = APIRouter()


async def _get_master(user: dict, db: AsyncSession):
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    return master


# ── Listings ──

@router.post("/", status_code=201)
async def create_listing(
    body: RentalListingCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать объявление об аренде."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    listing = await svc.create_listing(master.id, body.model_dump())
    return listing


@router.get("/")
async def list_active_listings(
    city: Optional[str] = None,
    listing_type: Optional[str] = None,
    max_price: Optional[float] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Каталог активных объявлений (публичный)."""
    svc = RentalService(db)
    return await svc.list_active(
        city=city, listing_type=listing_type,
        max_price=max_price, limit=limit, offset=offset,
    )


@router.get("/my")
async def my_listings(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мои объявления."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    return await svc.my_listings(master.id)


@router.get("/{listing_id}")
async def get_listing(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Детали объявления."""
    svc = RentalService(db)
    listing = await svc.get_listing(listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    from app.modules.rentals.service import _listing_to_dict
    return _listing_to_dict(listing)


@router.patch("/{listing_id}")
async def update_listing(
    listing_id: int,
    body: RentalListingUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновить объявление."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    result = await svc.update_listing(listing_id, master.id, body.model_dump(exclude_unset=True))
    if not result:
        raise HTTPException(status_code=404, detail="Listing not found or not owner")
    from app.modules.rentals.service import _listing_to_dict
    return _listing_to_dict(result)


@router.delete("/{listing_id}", status_code=204)
async def delete_listing(
    listing_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить объявление."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    if not await svc.delete_listing(listing_id, master.id):
        raise HTTPException(status_code=404, detail="Listing not found or not owner")


# ── Requests ──

@router.post("/{listing_id}/request", status_code=201)
async def create_request(
    listing_id: int,
    body: RentalRequestCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Подать заявку на аренду."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    req = await svc.create_request(listing_id, master.id, body.message)
    if not req:
        raise HTTPException(status_code=400, detail="Cannot create request")
    return {"id": req.id, "status": req.status}


@router.get("/requests/incoming")
async def incoming_requests(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Входящие заявки на мои объявления."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    return await svc.incoming_requests(master.id)


@router.get("/requests/my")
async def my_requests(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мои заявки на аренду."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    return await svc.my_requests(master.id)


@router.patch("/requests/{request_id}")
async def respond_to_request(
    request_id: int,
    approve: bool = Query(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Одобрить или отклонить заявку (владелец)."""
    master = await _get_master(user, db)
    svc = RentalService(db)
    result = await svc.respond_to_request(request_id, master.id, approve)
    if not result:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"id": result.id, "status": result.status}
