"""
Loyalty service — баллы, начисление, списание, рефералы.
"""

from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.loyalty.models import LoyaltyAccount, LoyaltyTransaction, Referral
from app.modules.masters.models import Master


class LoyaltyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_account(
        self, master_id: int, client_id: int
    ) -> LoyaltyAccount:
        result = await self.db.execute(
            select(LoyaltyAccount).where(
                LoyaltyAccount.master_id == master_id,
                LoyaltyAccount.client_id == client_id,
            )
        )
        account = result.scalar_one_or_none()
        if not account:
            account = LoyaltyAccount(
                master_id=master_id,
                client_id=client_id,
                balance=0,
                tier="new",
                total_earned=0,
            )
            self.db.add(account)
            await self.db.flush()
        return account

    async def earn_points(
        self,
        master_id: int,
        client_id: int,
        points: int,
        earn_type: str,
        appointment_id: Optional[int] = None,
        note: Optional[str] = None,
    ) -> LoyaltyTransaction:
        account = await self.get_or_create_account(master_id, client_id)
        account.balance += points
        account.total_earned += points

        # Обновляем tier
        if account.total_earned >= 5000:
            account.tier = "vip"
        elif account.total_earned >= 1000:
            account.tier = "regular"

        tx = LoyaltyTransaction(
            master_id=master_id,
            client_id=client_id,
            type=earn_type,
            points=points,
            appointment_id=appointment_id,
            note=note,
        )
        self.db.add(tx)
        await self.db.flush()
        return tx

    async def spend_points(
        self,
        master_id: int,
        client_id: int,
        points: int,
        appointment_id: int,
    ) -> LoyaltyTransaction:
        account = await self.get_or_create_account(master_id, client_id)

        if account.balance < points:
            raise ValueError("Insufficient loyalty points")

        # Проверяем лимит списания
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        max_percent = master.loyalty_max_spend_percent if master else 30

        account.balance -= points

        tx = LoyaltyTransaction(
            master_id=master_id,
            client_id=client_id,
            type="spend",
            points=-points,
            appointment_id=appointment_id,
        )
        self.db.add(tx)
        await self.db.flush()
        return tx

    async def get_transactions(
        self, master_id: int, client_id: int, limit: int = 50
    ) -> List[LoyaltyTransaction]:
        result = await self.db.execute(
            select(LoyaltyTransaction)
            .where(
                LoyaltyTransaction.master_id == master_id,
                LoyaltyTransaction.client_id == client_id,
            )
            .order_by(LoyaltyTransaction.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create_referral(
        self, master_id: int, referrer_client_id: int, referred_client_id: int
    ) -> Referral:
        # Проверяем дубликат
        result = await self.db.execute(
            select(Referral).where(
                Referral.master_id == master_id,
                Referral.referred_client == referred_client_id,
            )
        )
        if result.scalar_one_or_none():
            raise ValueError("Referral already exists")

        referral = Referral(
            master_id=master_id,
            referrer_client=referrer_client_id,
            referred_client=referred_client_id,
        )
        self.db.add(referral)
        await self.db.flush()
        return referral
