"""
Тесты модуля лояльности — баллы, стрики, рефералы, сгорание.
"""

import pytest
from datetime import date, timedelta

from app.modules.loyalty.service import (
    LoyaltyService,
    STREAK_THRESHOLD,
    STREAK_BONUS,
    POINTS_EXPIRY_MONTHS,
    TIER_THRESHOLDS,
)
from tests.conftest import make_token


class TestLoyaltyEarn:
    """Тесты начисления баллов."""

    @pytest.mark.asyncio
    async def test_earn_points_creates_account(self, db, master, test_client):
        """Первое начисление создаёт аккаунт."""
        svc = LoyaltyService(db)
        tx = await svc.earn_points(
            master_id=master.id,
            client_id=test_client.id,
            points=100,
            earn_type="earn_visit",
            note="Тестовое начисление",
        )
        await db.commit()

        assert tx.points == 100
        assert tx.type == "earn_visit"

        account = await svc.get_or_create_account(master.id, test_client.id)
        assert account.balance == 100
        assert account.total_earned == 100
        assert account.tier == "new"

    @pytest.mark.asyncio
    async def test_earn_points_updates_tier(self, db, master, test_client):
        """После порога — тир повышается."""
        svc = LoyaltyService(db)

        # Начисляем до порога regular (501)
        await svc.earn_points(master.id, test_client.id, 600, "earn_visit")
        await db.commit()

        account = await svc.get_or_create_account(master.id, test_client.id)
        assert account.tier == "regular"
        assert account.total_earned == 600

    @pytest.mark.asyncio
    async def test_earn_points_vip_tier(self, db, master, test_client):
        """После порога VIP (2001) — tier = vip."""
        svc = LoyaltyService(db)
        await svc.earn_points(master.id, test_client.id, 2500, "earn_visit")
        await db.commit()

        account = await svc.get_or_create_account(master.id, test_client.id)
        assert account.tier == "vip"


class TestLoyaltySpend:
    """Тесты списания баллов."""

    @pytest.mark.asyncio
    async def test_spend_points_success(self, db, master, test_client):
        """Списание при достаточном балансе."""
        svc = LoyaltyService(db)
        await svc.earn_points(master.id, test_client.id, 500, "earn_visit")

        tx = await svc.spend_points(
            master_id=master.id,
            client_id=test_client.id,
            points=200,
            appointment_id=1,
        )
        await db.commit()

        assert tx.points == -200
        account = await svc.get_or_create_account(master.id, test_client.id)
        assert account.balance == 300

    @pytest.mark.asyncio
    async def test_spend_points_insufficient(self, db, master, test_client):
        """Списание больше баланса — ошибка."""
        svc = LoyaltyService(db)
        await svc.earn_points(master.id, test_client.id, 50, "earn_visit")

        with pytest.raises(ValueError, match="Insufficient"):
            await svc.spend_points(
                master_id=master.id,
                client_id=test_client.id,
                points=100,
                appointment_id=1,
            )


class TestLoyaltyStreak:
    """Тесты стриков."""

    @pytest.mark.asyncio
    async def test_streak_bonus_after_threshold(self, db, master, test_client):
        """После STREAK_THRESHOLD визитов подряд — бонус."""
        from app.modules.booking.models import Appointment, AppointmentStatus
        from datetime import datetime, timezone

        # Создаём STREAK_THRESHOLD завершённых визитов подряд
        for i in range(STREAK_THRESHOLD):
            appt = Appointment(
                master_id=master.id,
                client_id=test_client.id,
                date=date.today() - timedelta(days=STREAK_THRESHOLD - i),
                time_start=datetime.now(timezone.utc),
                time_end=datetime.now(timezone.utc),
                status=AppointmentStatus.COMPLETED.value,
            )
            db.add(appt)
        await db.commit()

        svc = LoyaltyService(db)
        tx = await svc.check_streak(master.id, test_client.id)
        await db.commit()

        assert tx is not None
        assert tx.points == STREAK_BONUS
        assert tx.type == "earn_streak"

    @pytest.mark.asyncio
    async def test_no_streak_with_cancel(self, db, master, test_client):
        """Отменённый визит прерывает стрик."""
        from app.modules.booking.models import Appointment, AppointmentStatus
        from datetime import datetime, timezone

        # 2 завершённых + 1 отменённый
        for i in range(2):
            appt = Appointment(
                master_id=master.id,
                client_id=test_client.id,
                date=date.today() - timedelta(days=3 - i),
                time_start=datetime.now(timezone.utc),
                time_end=datetime.now(timezone.utc),
                status=AppointmentStatus.COMPLETED.value,
            )
            db.add(appt)

        # Более свежий отменённый визит (прерывает стрик)
        cancelled = Appointment(
            master_id=master.id,
            client_id=test_client.id,
            date=date.today(),
            time_start=datetime.now(timezone.utc),
            time_end=datetime.now(timezone.utc),
            status=AppointmentStatus.CANCELLED_BY_CLIENT.value,
        )
        db.add(cancelled)
        await db.commit()

        svc = LoyaltyService(db)
        tx = await svc.check_streak(master.id, test_client.id)
        assert tx is None


class TestLoyaltyReferral:
    """Тесты реферальной системы."""

    @pytest.mark.asyncio
    async def test_create_referral_success(self, db, master, test_client, client_identity):
        """Успешное создание реферала."""
        from app.modules.clients.models import Client

        # Второй клиент (referred)
        referred = Client(
            identity_id=client_identity.id + 100,  # Другой identity
            first_name="Новый",
            platform="telegram",
            platform_id="333333",
        )
        db.add(referred)
        await db.commit()
        await db.refresh(referred)

        svc = LoyaltyService(db)
        referral = await svc.create_referral(
            master_id=master.id,
            referrer_client_id=test_client.id,
            referred_client_id=referred.id,
        )
        await db.commit()

        assert referral.referrer_client == test_client.id
        assert referral.referred_client == referred.id

    @pytest.mark.asyncio
    async def test_duplicate_referral_raises(self, db, master, test_client, client_identity):
        """Повторная реферальная ссылка — ошибка."""
        from app.modules.clients.models import Client

        referred = Client(
            identity_id=client_identity.id + 200,
            first_name="Ещё",
            platform="telegram",
            platform_id="444444",
        )
        db.add(referred)
        await db.commit()
        await db.refresh(referred)

        svc = LoyaltyService(db)
        await svc.create_referral(master.id, test_client.id, referred.id)
        await db.commit()

        with pytest.raises(ValueError, match="already exists"):
            await svc.create_referral(master.id, test_client.id, referred.id)


class TestLoyaltyAPI:
    """Тесты API эндпоинтов лояльности."""

    @pytest.mark.asyncio
    async def test_get_balance(self, client, db, master, test_client, client_identity):
        """Получение баланса через API."""
        # Начисляем баллы
        svc = LoyaltyService(db)
        await svc.earn_points(master.id, test_client.id, 300, "earn_visit")
        await db.commit()

        token = make_token(client_identity.id, "client", "222222")
        resp = await client.get(
            f"/api/v1/loyalty/balance/{master.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["balance"] == 300

    @pytest.mark.asyncio
    async def test_get_history(self, client, db, master, test_client, client_identity):
        """Получение истории транзакций через API."""
        svc = LoyaltyService(db)
        await svc.earn_points(master.id, test_client.id, 100, "earn_visit")
        await svc.earn_points(master.id, test_client.id, 50, "earn_review")
        await db.commit()

        token = make_token(client_identity.id, "client", "222222")
        resp = await client.get(
            f"/api/v1/loyalty/history/{master.id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2
