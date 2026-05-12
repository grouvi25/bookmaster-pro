"""
Promo service — CRUD + validation.
"""

from datetime import date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.promo.models import Promotion, PromoUsage


class PromoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, master_id: int, data: dict) -> Promotion:
        promo = Promotion(master_id=master_id, **data)
        self.db.add(promo)
        await self.db.flush()
        return promo

    async def list_by_master(self, master_id: int) -> List[Promotion]:
        result = await self.db.execute(
            select(Promotion)
            .where(Promotion.master_id == master_id)
            .order_by(Promotion.created_at.desc())
        )
        return list(result.scalars().all())

    async def deactivate(self, promo_id: int, master_id: int) -> bool:
        result = await self.db.execute(
            select(Promotion).where(
                Promotion.id == promo_id,
                Promotion.master_id == master_id,
            )
        )
        promo = result.scalar_one_or_none()
        if promo:
            promo.is_active = False
            await self.db.flush()
            return True
        return False

    async def validate_code(
        self,
        code: str,
        master_id: int,
        service_id: Optional[int],
        amount: Decimal,
        client_id: Optional[int] = None,
    ) -> dict:
        """Проверить промокод и рассчитать скидку."""
        result = await self.db.execute(
            select(Promotion).where(
                Promotion.master_id == master_id,
                Promotion.code == code,
                Promotion.is_active.is_(True),
            )
        )
        promo = result.scalar_one_or_none()

        if not promo:
            return {"valid": False, "discount_amount": Decimal("0"), "message": "Промокод не найден"}

        # Проверяем срок действия
        today = date.today()
        if promo.valid_from and today < promo.valid_from:
            return {"valid": False, "discount_amount": Decimal("0"), "message": "Промокод ещё не активен"}
        if promo.valid_until and today > promo.valid_until:
            return {"valid": False, "discount_amount": Decimal("0"), "message": "Промокод истёк"}

        # Проверяем лимит использований
        if promo.max_uses and promo.used_count >= promo.max_uses:
            return {"valid": False, "discount_amount": Decimal("0"), "message": "Лимит использований исчерпан"}

        # Проверяем минимальную сумму
        if amount < promo.min_amount:
            return {
                "valid": False, "discount_amount": Decimal("0"),
                "message": f"Минимальная сумма заказа: {promo.min_amount}₽",
            }

        # Проверяем применимость к услуге
        if promo.service_ids and service_id and service_id not in promo.service_ids:
            return {"valid": False, "discount_amount": Decimal("0"), "message": "Промокод не применим к этой услуге"}

        # Проверяем не использовал ли клиент уже
        if client_id:
            result = await self.db.execute(
                select(PromoUsage).where(
                    PromoUsage.promotion_id == promo.id,
                    PromoUsage.client_id == client_id,
                )
            )
            if result.scalar_one_or_none():
                return {"valid": False, "discount_amount": Decimal("0"), "message": "Вы уже использовали этот промокод"}

        # Рассчитываем скидку
        if promo.discount_type == "percent":
            discount = amount * promo.discount_value / Decimal("100")
        else:
            discount = min(promo.discount_value, amount)

        return {
            "valid": True,
            "discount_amount": discount,
            "promotion_id": promo.id,
            "message": None,
        }

    async def apply_promo(
        self, promotion_id: int, client_id: int, appointment_id: int, discount: Decimal
    ) -> None:
        """Зафиксировать использование промо."""
        result = await self.db.execute(
            select(Promotion).where(Promotion.id == promotion_id)
        )
        promo = result.scalar_one_or_none()
        if promo:
            promo.used_count += 1

        usage = PromoUsage(
            promotion_id=promotion_id,
            client_id=client_id,
            appointment_id=appointment_id,
            discount_applied=discount,
        )
        self.db.add(usage)
        await self.db.flush()
