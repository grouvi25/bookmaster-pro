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
    "vip": 2001,
    "regular": 501,
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

        # Проверяем лимит списания (% от суммы заказа)
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        if master and master.loyalty_max_spend_percent and appointment_id:
            from app.modules.booking.models import Appointment
            appt_result = await self.db.execute(
                select(Appointment).where(Appointment.id == appointment_id)
            )
            appt = appt_result.scalar_one_or_none()
            if appt and appt.price_final:
                max_points = int(appt.price_final * master.loyalty_max_spend_percent / 100)
                if points > max_points:
                    raise ValueError(
                        f"Максимум {max_points} баллов ({master.loyalty_max_spend_percent}% от суммы заказа)"
                    )

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
        Бонус начисляется на каждый N-й визит (3, 6, 9, ...),
        предотвращая повторное начисление.
        """
        from app.modules.booking.models import Appointment, AppointmentStatus

        # Считаем текущую серию подряд завершённых визитов
        result = await self.db.execute(
            select(Appointment)
            .where(
                Appointment.master_id == master_id,
                Appointment.client_id == client_id,
            )
            .order_by(Appointment.date.desc(), Appointment.time_start.desc())
            .limit(50)
        )
        recent = result.scalars().all()

        streak_count = 0
        for appt in recent:
            if appt.status == AppointmentStatus.COMPLETED.value:
                streak_count += 1
            else:
                break

        if streak_count < STREAK_THRESHOLD:
            return None

        # Бонус на каждый N-й визит (3, 6, 9, ...)
        if streak_count % STREAK_THRESHOLD != 0:
            return None

        # Проверяем, не начислен ли уже бонус за этот стрик
        streak_txs_result = await self.db.execute(
            select(LoyaltyTransaction)
            .where(
                LoyaltyTransaction.master_id == master_id,
                LoyaltyTransaction.client_id == client_id,
                LoyaltyTransaction.type == "earn_streak",
            )
            .order_by(LoyaltyTransaction.created_at.desc())
            .limit(1)
        )
        last_streak_tx = streak_txs_result.scalar_one_or_none()

        if last_streak_tx and last_streak_tx.note:
            # Извлекаем номер стрика из предыдущего бонуса
            try:
                prev_streak = int(
                    last_streak_tx.note.split("за ")[1].split(" визит")[0]
                )
                if prev_streak >= streak_count:
                    return None
            except (IndexError, ValueError):
                pass

        tx = await self.earn_points(
            master_id=master_id,
            client_id=client_id,
            points=STREAK_BONUS,
            earn_type="earn_streak",
            note=f"Бонус за {streak_count} визитов подряд без отмен",
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

    async def process_referral(
        self, referrer_code: str, referred_client_id: int
    ) -> dict:
        """
        Обработать реферальную ссылку: найти реферера, создать Referral, начислить бонусы.
        referrer_code = "{master_slug}_{referrer_client_id}" (формат deep link ref_)
        """
        parts = referrer_code.rsplit("_", 1)
        if len(parts) != 2:
            raise ValueError("Invalid referral code format")

        master_slug, referrer_id_str = parts
        try:
            referrer_client_id = int(referrer_id_str)
        except ValueError:
            raise ValueError("Invalid referral code format")

        result = await self.db.execute(
            select(Master).where(Master.slug == master_slug)
        )
        master = result.scalar_one_or_none()
        if not master:
            raise ValueError("Master not found")

        if referrer_client_id == referred_client_id:
            raise ValueError("Cannot refer yourself")

        referral = await self.create_referral(master.id, referrer_client_id, referred_client_id)

        referral_bonus = master.loyalty_referral_bonus or 500
        await self.earn_points(
            master_id=master.id,
            client_id=referrer_client_id,
            points=referral_bonus,
            earn_type="earn_referral",
            note="Бонус за приглашение друга",
        )
        referral.bonus_applied = referral_bonus

        await self.db.flush()
        return {"status": "ok", "bonus_applied": referral_bonus, "master_id": master.id}
