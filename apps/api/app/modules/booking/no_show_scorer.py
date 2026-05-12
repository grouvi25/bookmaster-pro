"""
NoShowScorer — оценивает вероятность no-show клиента (0.0 до 1.0).

Факторы и веса:
+40% — no-show у этого конкретного мастера
+25% — no-show у других мастеров платформы
+7%  — отмена за < 2 часа (за каждый раз, max +21%)
+15% — новый клиент без истории
-10% — оставил отзыв (признак вовлечённости)
-8%  — оплачивал онлайн (платил → приходил)

Пороги для автоматических действий (настраиваются в FeatureFlags):
> 30% — показываем опцию предоплаты
> 50% — рекомендуем предоплату
> 70% — требуем предоплату автоматически
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text

from app.modules.booking.models import Appointment, AppointmentStatus


class NoShowScorer:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_risk_score(
        self,
        client_id: int,
        master_id: int,
    ) -> float:
        """
        Основной метод. Возвращает score от 0.0 до 1.0.
        0.0 = надёжный клиент, 1.0 = максимальный риск.
        """
        score = 0.0
        history = await self._get_client_history(client_id, master_id)

        # Новый клиент (нет ни одной записи нигде)
        if history["total_visits_platform"] == 0:
            score += 0.15

        # No-show именно у этого мастера
        score += history["no_shows_this_master"] * 0.40

        # No-show у других мастеров
        score += history["no_shows_other_masters"] * 0.25

        # Отмены за < 2 часа (max 3 учитываем)
        last_minute = min(history["last_minute_cancels"], 3)
        score += last_minute * 0.07

        # Снижаем риск за положительные факторы
        score -= history["reviews_left"] * 0.10
        score -= history["online_payments"] * 0.08

        # Если уже приходил к этому мастеру без инцидентов
        if history["visits_this_master"] > 0 and history["no_shows_this_master"] == 0:
            score -= 0.10

        return max(0.0, min(1.0, score))

    async def get_risk_level(
        self, client_id: int, master_id: int
    ) -> str:
        """Человекочитаемый уровень риска."""
        score = await self.get_risk_score(client_id, master_id)
        if score < 0.3:
            return "low"
        elif score < 0.5:
            return "medium"
        elif score < 0.7:
            return "high"
        else:
            return "critical"

    async def should_require_prepayment(
        self,
        client_id: int,
        master_id: int,
        threshold: float = 0.7,
    ) -> bool:
        """Нужно ли автоматически требовать предоплату?"""
        score = await self.get_risk_score(client_id, master_id)
        return score >= threshold

    async def _get_client_history(
        self, client_id: int, master_id: int
    ) -> dict:
        """Собираем статистику клиента для скоринга."""
        # No-show именно у этого мастера
        r1 = await self.db.execute(text("""
            SELECT COUNT(*) FROM client_no_show_log
            WHERE client_id = :client_id
              AND master_id = :master_id
              AND type = 'no_show'
        """), {"client_id": client_id, "master_id": master_id})
        no_shows_this = r1.scalar() or 0

        # No-show у других мастеров
        r2 = await self.db.execute(text("""
            SELECT COUNT(*) FROM client_no_show_log
            WHERE client_id = :client_id
              AND master_id != :master_id
              AND type = 'no_show'
        """), {"client_id": client_id, "master_id": master_id})
        no_shows_others = r2.scalar() or 0

        # Отмены в последний момент
        r3 = await self.db.execute(text("""
            SELECT COUNT(*) FROM client_no_show_log
            WHERE client_id = :client_id
              AND type = 'last_minute_cancel'
        """), {"client_id": client_id})
        last_minute = r3.scalar() or 0

        # Всего визитов на всей платформе
        r4 = await self.db.execute(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.client_id == client_id,
                    Appointment.status == AppointmentStatus.COMPLETED.value,
                )
            )
        )
        total_visits = r4.scalar() or 0

        # Визиты у этого мастера
        r5 = await self.db.execute(
            select(func.count(Appointment.id)).where(
                and_(
                    Appointment.client_id == client_id,
                    Appointment.master_id == master_id,
                    Appointment.status == AppointmentStatus.COMPLETED.value,
                )
            )
        )
        visits_this = r5.scalar() or 0

        # Отзывы (признак вовлечённости)
        r6 = await self.db.execute(text("""
            SELECT COUNT(*) FROM client_reviews
            WHERE client_id = :client_id
        """), {"client_id": client_id})
        reviews = r6.scalar() or 0

        # Онлайн-оплаты
        r7 = await self.db.execute(text("""
            SELECT COUNT(*) FROM payments
            WHERE client_id = :client_id AND status = 'succeeded'
        """), {"client_id": client_id})
        payments = r7.scalar() or 0

        return {
            "no_shows_this_master": no_shows_this,
            "no_shows_other_masters": no_shows_others,
            "last_minute_cancels": last_minute,
            "total_visits_platform": total_visits,
            "visits_this_master": visits_this,
            "reviews_left": reviews,
            "online_payments": payments,
        }
