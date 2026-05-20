"""
Тесты модуля поддержки — тикеты, SLA, модерация.
"""

import pytest
from tests.conftest import make_token


class TestTickets:
    """Тесты создания и управления тикетами."""

    @pytest.mark.asyncio
    async def test_create_ticket(
        self, client, master, master_identity
    ):
        """Мастер создаёт тикет поддержки."""
        token = make_token(master_identity.id, "master", "111111")
        resp = await client.post(
            "/api/v1/support/tickets",
            json={
                "category": "billing",
                "priority": "normal",
                "subject": "Проблема с оплатой",
                "message": "Не могу оплатить подписку",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["category"] == "billing"
        assert data["status"] == "open"

    @pytest.mark.asyncio
    async def test_get_my_tickets(
        self, client, master, master_identity
    ):
        """Получение своих тикетов."""
        token = make_token(master_identity.id, "master", "111111")

        # Сначала создаём тикет
        await client.post(
            "/api/v1/support/tickets",
            json={
                "category": "technical",
                "priority": "high",
                "subject": "Баг",
                "message": "Ничего не работает",
            },
            headers={"Authorization": f"Bearer {token}"},
        )

        resp = await client.get(
            "/api/v1/support/tickets/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_superadmin_sees_ticket_queue(
        self, client, db, master, master_identity
    ):
        """Суперадмин видит очередь тикетов."""
        from app.modules.auth.models import Identity

        # Создаём суперадмин identity
        sa = Identity(platform="telegram", platform_id="999999", role="superadmin")
        db.add(sa)
        await db.commit()
        await db.refresh(sa)

        sa_token = make_token(sa.id, "superadmin", "999999")

        resp = await client.get(
            "/api/v1/support/tickets/queue",
            headers={"Authorization": f"Bearer {sa_token}"},
        )
        assert resp.status_code == 200


class TestSLA:
    """Тесты SLA-метрик."""

    @pytest.mark.asyncio
    async def test_sla_stats_endpoint(self, client, db):
        """SLA-статистика доступна для суперадмина."""
        from app.modules.auth.models import Identity

        sa = Identity(platform="telegram", platform_id="888888", role="superadmin")
        db.add(sa)
        await db.commit()
        await db.refresh(sa)

        sa_token = make_token(sa.id, "superadmin", "888888")
        resp = await client.get(
            "/api/v1/support/sla-stats",
            headers={"Authorization": f"Bearer {sa_token}"},
        )
        assert resp.status_code == 200
