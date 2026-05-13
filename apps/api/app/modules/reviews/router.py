"""
Reviews router — /api/v1/reviews
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.clients.models import Client
from app.modules.masters.service import MasterService
from app.modules.reviews.schemas import ReviewCreate, ReviewReply, ReviewOut
from app.modules.reviews.service import ReviewService

router = APIRouter()


@router.post("/", response_model=ReviewOut, status_code=201)
async def create_review(
    body: ReviewCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Оставить отзыв (клиент)."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Only clients can leave reviews")

    service = ReviewService(db)
    try:
        review = await service.create_review(
            client_id=client.id,
            appointment_id=body.appointment_id,
            rating=body.rating,
            text=body.text,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return review


@router.post("/{review_id}/reply", response_model=ReviewOut)
async def reply_to_review(
    review_id: int,
    body: ReviewReply,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ответить на отзыв (мастер)."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = ReviewService(db)
    try:
        review = await service.reply_to_review(review_id, master.id, body.master_reply)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return review


@router.get("/client", response_model=List[ReviewOut])
async def get_client_reviews(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мои отзывы (клиент)."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    from app.modules.reviews.models import ClientReview
    result = await db.execute(
        select(ClientReview)
        .where(ClientReview.client_id == client.id)
        .order_by(ClientReview.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/master/{master_id}", response_model=List[ReviewOut])
async def get_master_reviews(
    master_id: int,
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """Отзывы мастера (публичный)."""
    service = ReviewService(db)
    return await service.get_master_reviews(master_id, limit, offset)
