"""
Reviews service — CRUD + rating recalculation.
"""

from typing import Optional, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reviews.models import ClientReview
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.masters.models import Master


class ReviewService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(
        self,
        client_id: int,
        appointment_id: int,
        rating: int,
        text: Optional[str] = None,
    ) -> ClientReview:
        # Проверяем что запись существует и завершена
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appointment = result.scalar_one_or_none()
        if not appointment:
            raise ValueError("Appointment not found")
        if appointment.status != AppointmentStatus.COMPLETED.value:
            raise ValueError("Can only review completed appointments")
        if appointment.client_id != client_id:
            raise ValueError("Not your appointment")

        # Проверяем дубликат
        result = await self.db.execute(
            select(ClientReview).where(ClientReview.appointment_id == appointment_id)
        )
        if result.scalar_one_or_none():
            raise ValueError("Review already exists for this appointment")

        review = ClientReview(
            appointment_id=appointment_id,
            master_id=appointment.master_id,
            client_id=client_id,
            rating=rating,
            text=text,
        )
        self.db.add(review)
        await self.db.flush()

        # Пересчитать рейтинг мастера
        await self._recalculate_rating(appointment.master_id)
        return review

    async def reply_to_review(
        self, review_id: int, master_id: int, reply_text: str
    ) -> ClientReview:
        result = await self.db.execute(
            select(ClientReview).where(ClientReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            raise ValueError("Review not found")
        if review.master_id != master_id:
            raise ValueError("Not your review")
        review.master_reply = reply_text
        await self.db.flush()
        return review

    async def get_master_reviews(
        self, master_id: int, limit: int = 50, offset: int = 0
    ) -> List[ClientReview]:
        result = await self.db.execute(
            select(ClientReview)
            .where(
                ClientReview.master_id == master_id,
                ClientReview.is_hidden.is_(False),
            )
            .order_by(ClientReview.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def _recalculate_rating(self, master_id: int) -> None:
        result = await self.db.execute(
            select(
                func.avg(ClientReview.rating),
                func.count(ClientReview.id),
            ).where(
                ClientReview.master_id == master_id,
                ClientReview.is_hidden.is_(False),
            )
        )
        row = result.one()
        avg_rating = float(row[0]) if row[0] else 0.0
        count = row[1] or 0

        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        if master:
            master.rating_avg = round(avg_rating, 2)
            master.rating_count = count
        await self.db.flush()
