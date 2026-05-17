"""
Reviews service — CRUD + rating recalculation + moderation.
"""

import logging
from typing import Optional, List

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.reviews.models import ClientReview
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.masters.models import Master

logger = logging.getLogger(__name__)


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

        # Начислить баллы за отзыв
        await self._earn_review_bonus(appointment.master_id, client_id)

        # Уведомить мастера о новом отзыве
        await self._notify_master_new_review(
            master_id=appointment.master_id,
            rating=rating,
            text=text,
        )

        return review

    async def _earn_review_bonus(self, master_id: int, client_id: int) -> None:
        from app.modules.loyalty.service import LoyaltyService

        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        if not master:
            return

        bonus = master.loyalty_review_bonus or 50
        if bonus > 0:
            loyalty = LoyaltyService(self.db)
            await loyalty.earn_points(
                master_id=master_id,
                client_id=client_id,
                points=bonus,
                earn_type="earn_review",
                note="Бонус за отзыв",
            )

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

    async def report_review(
        self,
        review_id: int,
        master_id: int,
        reason: str,
    ) -> int:
        """Мастер жалуется на отзыв → создаётся тикет в поддержку."""
        result = await self.db.execute(
            select(ClientReview).where(
                and_(
                    ClientReview.id == review_id,
                    ClientReview.master_id == master_id,
                )
            )
        )
        review = result.scalar_one_or_none()
        if not review:
            raise ValueError("Отзыв не найден")

        from app.modules.support.service import SupportService
        support = SupportService(self.db)
        ticket = await support.create_ticket(
            initiator_role="master",
            initiator_id=master_id,
            category="review_complaint",
            priority="medium",
            subject=f"Жалоба на отзыв #{review_id}",
            message=(
                f"Отзыв #{review_id}\n"
                f"Оценка: {review.rating}/5\n"
                f"Текст: {review.text}\n\n"
                f"Причина жалобы: {reason}"
            ),
        )
        return ticket.id

    async def hide_review(
        self,
        review_id: int,
        reason: str,
    ) -> ClientReview:
        """Модератор скрывает отзыв."""
        result = await self.db.execute(
            select(ClientReview).where(ClientReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            raise ValueError("Review not found")

        review.is_hidden = True
        review.hide_reason = reason
        await self.db.flush()

        await self._recalculate_rating(review.master_id)
        logger.info(f"Review #{review_id} hidden: {reason}")
        return review

    async def unhide_review(
        self,
        review_id: int,
    ) -> ClientReview:
        """Модератор восстанавливает отзыв."""
        result = await self.db.execute(
            select(ClientReview).where(ClientReview.id == review_id)
        )
        review = result.scalar_one_or_none()
        if not review:
            raise ValueError("Review not found")

        review.is_hidden = False
        review.hide_reason = None
        await self.db.flush()

        await self._recalculate_rating(review.master_id)
        logger.info(f"Review #{review_id} unhidden")
        return review

    async def _notify_master_new_review(
        self,
        master_id: int,
        rating: int,
        text: Optional[str] = None,
    ) -> None:
        """Уведомить мастера о новом отзыве от клиента."""
        try:
            result = await self.db.execute(
                select(Master).where(Master.id == master_id)
            )
            master = result.scalar_one_or_none()
            if not master or not master.notify_review:
                return

            from app.modules.notifications.service import NotificationService
            from app.core.config import settings

            stars = "⭐" * rating
            review_text = f"\n«{text}»" if text else ""
            msg = f"🌟 Новый отзыв!\n{stars}{review_text}"
            await NotificationService.send_by_master_id(
                self.db,
                master_id,
                msg,
                button_text="Посмотреть отзывы",
                button_url=f"{settings.APP_URL}?startParam=reviews",
            )
        except Exception as e:
            logger.error(f"Failed to notify master {master_id} about new review: {e}")

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
