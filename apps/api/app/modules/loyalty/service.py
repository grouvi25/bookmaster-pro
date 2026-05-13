"""
Loyalty service — баллы, начисление, списание, рефералы.
"""

from datetime import date, timedelta
from typing import Optional, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.loyalty.models import LoyaltyAccount, LoyaltyTransaction, Referral
from app.modules.masters.models import Master

POINTS_EXPIRY_MONTHS = 12
POINTS_EXPIRY_WARN_DAYS = 30

TIER_THRESHOLDS = {
    "vip": 5000,
    "regular": 1000,
}

TIER_CASHBACK_PERCENT = {
    "new": 3,
    "regular": 5,
    "vip": 10,
}

STREAK_THRESHOLD = 3
STREAK_BONUS = 100


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

        self._update_tier(account)

        expiry = date.today() + timedelta(days=POINTS_EXPIRY_MONTHS * 30)
        tx = LoyaltyTransaction(
            master_id=master_id,
            client_id=client_id,
            type=earn_type,
            points=points,
            appointment_id=appointment_id,
            note=note,
            expires_at=expiry,
        )
        self.db.add(tx)
        await self.db.flush()
        return tx

    @staticmethod
    def _update_tier(account: LoyaltyAccount) -> None:
        if account.total_earned >= TIER_THRESHOLDS["vip"]:
            account.tier = "vip"
        elif account.total_earned >= TIER_THRESHOLDS["regular"]:
            account.tier = "regular"
        else:
            account.tier = "new"

    @staticmethod
    def get_cashback_percent(tier: str) -> int:
        return TIER_CASHBACK_PERCENT.get(tier, TIER_CASHBACK_PERCENT["new"])

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
        result.scalar_one_or_none()

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

    async def check_streak(
        self, master_id: int, client_id: int
    ) -> Optional[LoyaltyTransaction]:
        """
        Проверить стрик: если клиент завершил STREAK_THRESHOLD визитов подряд
        без отмен — начислить бонус STREAK_BONUS баллов.
        """
        from app.modules.booking.models import Appointment, AppointmentStatus

        result = await self.db.execute(
            select(Appointment)
            .where(
                Appointment.master_id == master_id,
                Appointment.client_id == client_id,
            )
            .order_by(Appointment.date.desc())
            .limit(STREAK_THRESHOLD)
        )
        recent = result.scalars().all()
        if len(recent) < STREAK_THRESHOLD:
            return None

        all_completed = all(
            a.status == AppointmentStatus.COMPLETED.value for a in recent
        )
        if not all_completed:
            return None

        tx = await self.earn_points(
            master_id=master_id,
            client_id=client_id,
            points=STREAK_BONUS,
            earn_type="earn_streak",
            note=f"Бонус за {STREAK_THRESHOLD} визитов подряд без отмен",
        )
        return tx

    async def expire_points(self) -> int:
        """Списать просроченные баллы (expires_at < today)."""
        from sqlalchemy import and_

        today = date.today()
        result = await self.db.execute(
            select(LoyaltyTransaction).where(
                and_(
                    LoyaltyTransaction.expires_at <= today,
                    LoyaltyTransaction.type != "expire",
                    LoyaltyTransaction.type != "spend",
                    LoyaltyTransaction.points > 0,
                )
            )
        )
        expired_txs = result.scalars().all()
        count = 0

        for tx in expired_txs:
            account = await self.get_or_create_account(tx.master_id, tx.client_id)
            points_to_expire = min(tx.points, account.balance)
            if points_to_expire <= 0:
                continue

            account.balance -= points_to_expire
            expire_tx = LoyaltyTransaction(
                master_id=tx.master_id,
                client_id=tx.client_id,
                type="expire",
                points=-points_to_expire,
                note=f"Сгорание баллов (начислены {tx.created_at.strftime('%d.%m.%Y') if tx.created_at else ''})",
            )
            self.db.add(expire_tx)
            tx.points = 0
            count += points_to_expire

        await self.db.flush()
        return count

    async def get_expiring_soon(self, days: int = 30) -> list:
        """Найти транзакции, баллы по которым сгорят в ближайшие N дней."""
        from sqlalchemy import and_

        today = date.today()
        warn_date = today + timedelta(days=days)
        result = await self.db.execute(
            select(LoyaltyTransaction).where(
                and_(
                    LoyaltyTransaction.expires_at <= warn_date,
                    LoyaltyTransaction.expires_at > today,
                    LoyaltyTransaction.type.notin_(["expire", "spend"]),
                    LoyaltyTransaction.points > 0,
                )
            )
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
