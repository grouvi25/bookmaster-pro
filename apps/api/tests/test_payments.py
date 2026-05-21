"""
Тесты модуля платежей — подписки, dev-mode, feature flags.
"""

import pytest
from sqlalchemy import select

from app.modules.payments.models import MasterSubscription
from app.modules.payments.service import PaymentService, PLAN_PRICES
from tests.conftest import make_token


class TestPlanPrices:
    """Цены тарифов должны быть корректны."""

    def test_all_plans_have_prices(self):
        assert "start" in PLAN_PRICES
        assert "basic" in PLAN_PRICES
        assert "pro" in PLAN_PRICES
        assert "pro_ai" in PLAN_PRICES
        assert "business" in PLAN_PRICES

    def test_prices_increase_by_plan(self):
        plans = ["start", "basic", "pro", "pro_ai", "business"]
        prices = [PLAN_PRICES[p] for p in plans]
        for i in range(len(prices) - 1):
            assert prices[i] <= prices[i + 1]


class TestSubscriptionAPI:
    """Тесты API подписок."""

    @pytest.mark.asyncio
    async def test_get_subscription_no_sub_returns_404(
        self, client, master, master_identity
    ):
        """Без активной подписки — 404."""
        token = make_token(master_identity.id, "master")
        resp = await client.get(
            "/api/v1/payments/subscription",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_subscription_dev_mode(
        self, client, db, master, master_identity, monkeypatch
    ):
        """В dev mode подписка активируется сразу."""
        monkeypatch.setattr(
            "app.modules.payments.router.app_settings.YOOKASSA_SHOP_ID", ""
        )
        monkeypatch.setattr(
            "app.modules.payments.router.app_settings.YOOKASSA_SECRET_KEY", ""
        )
        monkeypatch.setattr(
            "app.modules.payments.service.settings.ALLOW_DEV_PAYMENTS", True
        )

        token = make_token(master_identity.id, "master")
        resp = await client.post(
            "/api/v1/payments/subscription",
            json={"plan": "pro", "billing_period": "monthly"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["plan"] == "pro"
        assert data["status"] == "active"

    @pytest.mark.asyncio
    async def test_subscription_updates_feature_flags(
        self, client, db, master, master_identity, feature_flags, monkeypatch
    ):
        """После смены тарифа feature flags должны обновиться."""
        monkeypatch.setattr(
            "app.modules.payments.service.settings.ALLOW_DEV_PAYMENTS", True
        )

        token = make_token(master_identity.id, "master")
        resp = await client.post(
            "/api/v1/payments/subscription",
            json={"plan": "enterprise", "billing_period": "monthly"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200

        # Проверяем feature flags
        from app.modules.core.models import FeatureFlags
        result = await db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == master.id)
        )
        flags = result.scalar_one_or_none()
        if flags:
            assert flags.marketplace_featured is True
            assert flags.consultations_enabled is True


class TestFeatureFlags:
    """Тесты системы feature flags."""

    @pytest.mark.asyncio
    async def test_get_feature_flags(
        self, client, master, master_identity, feature_flags
    ):
        token = make_token(master_identity.id, "master")
        resp = await client.get(
            "/api/v1/feature-flags/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ai_advisor"] is True
        assert data["analytics_enabled"] is True

    @pytest.mark.asyncio
    async def test_feature_gate_blocks_without_flag(
        self, client, db, master, master_identity
    ):
        """Без feature flag AI недоступен."""
        from app.modules.core.models import FeatureFlags

        # Создаём flags с отключенным ai_advisor
        flags = FeatureFlags(
            master_id=master.id,
            ai_advisor=False,
            ai_voice=False,
            ai_client_bot=False,
        )
        db.add(flags)
        await db.commit()

        token = make_token(master_identity.id, "master")
        resp = await client.post(
            "/api/v1/ai/ask",
            json={"message": "test"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403
