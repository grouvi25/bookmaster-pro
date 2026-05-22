"""
Тесты AI модуля — feature gate, quota, шаблоны контента.
"""

import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import make_token


class TestAIFeatureGate:
    """AI недоступен без feature flag."""

    @pytest.mark.asyncio
    async def test_ai_ask_blocked_without_flag(
        self, client, db, master, master_identity
    ):
        """Без ai_advisor flag — 403."""
        from app.modules.core.models import FeatureFlags

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
            json={"message": "Привет"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_ai_ask_allowed_with_flag(
        self, client, db, master, master_identity, feature_flags
    ):
        """С ai_advisor flag — запрос проходит (мокаем провайдер)."""
        with patch(
            "app.modules.ai.service.get_ai_provider"
        ) as mock_provider:
            mock_ai = AsyncMock()
            mock_ai.chat = AsyncMock(return_value="Привет! Чем могу помочь?")
            mock_provider.return_value = mock_ai

            token = make_token(master_identity.id, "master")
            resp = await client.post(
                "/api/v1/ai/ask",
                json={"message": "Привет"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "response" in data
            assert data["response"] == "Привет! Чем могу помочь?"
            assert "session_id" in data


class TestAIContentTemplates:
    """Тесты шаблонов контента."""

    @pytest.mark.asyncio
    async def test_get_templates(
        self, client, master, master_identity, feature_flags
    ):
        """Список шаблонов доступен."""
        token = make_token(master_identity.id, "master")
        resp = await client.get(
            "/api/v1/ai/templates",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 4
        keys = [t["key"] for t in data]
        assert "promo_post" in keys
        assert "review_reply" in keys

    @pytest.mark.asyncio
    async def test_content_generation_with_mock(
        self, client, db, master, master_identity, feature_flags
    ):
        """Генерация контента с мок-провайдером."""
        with patch(
            "app.modules.ai.service.get_ai_provider"
        ) as mock_provider:
            mock_ai = AsyncMock()
            mock_ai.chat = AsyncMock(
                return_value="🎉 Акция! Скидка 20% на маникюр #маникюр #акция"
            )
            mock_provider.return_value = mock_ai

            token = make_token(master_identity.id, "master")
            resp = await client.post(
                "/api/v1/ai/content",
                json={
                    "template_key": "promo_post",
                    "params": {
                        "promo_description": "Скидка 20% на маникюр",
                        "platform": "Instagram",
                    },
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "content" in data
            assert data["template_key"] == "promo_post"

    @pytest.mark.asyncio
    async def test_invalid_template_returns_400(
        self, client, db, master, master_identity, feature_flags
    ):
        """Несуществующий шаблон → 400."""
        with patch(
            "app.modules.ai.service.get_ai_provider"
        ) as mock_provider:
            mock_ai = AsyncMock()
            mock_provider.return_value = mock_ai

            token = make_token(master_identity.id, "master")
            resp = await client.post(
                "/api/v1/ai/content",
                json={
                    "template_key": "nonexistent_template",
                    "params": {},
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 400


class TestAITokens:
    """Тесты квоты токенов."""

    @pytest.mark.asyncio
    async def test_get_tokens_info(
        self, client, master, master_identity, feature_flags
    ):
        """Информация о токенах доступна."""
        token = make_token(master_identity.id, "master")
        resp = await client.get(
            "/api/v1/ai/tokens",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "ai_enabled" in data
        assert "tokens_monthly_limit" in data
        assert "tokens_used_this_month" in data
        assert data["ai_enabled"] is True


class TestAIVoiceDiary:
    """Тесты голосового дневника."""

    @pytest.mark.asyncio
    async def test_voice_diary_with_mock(
        self, client, db, master, master_identity, feature_flags
    ):
        """Голосовой дневник обрабатывает транскрипт."""
        with patch(
            "app.modules.ai.service.get_ai_provider"
        ) as mock_provider:
            mock_ai = AsyncMock()
            mock_ai.chat = AsyncMock(return_value='{"physical_params": {"nail_type": "тонкие"}, "preferences": {}, "note_text": "Ногти тонкие, нужна укрепляющая база", "suggested_days_until_next": 21, "allergies": []}')
            mock_provider.return_value = mock_ai

            token = make_token(master_identity.id, "master")
            resp = await client.post(
                "/api/v1/ai/voice-diary",
                json={
                    "transcript": "У клиентки тонкие ногти, нужна укрепляющая база. Следующий визит через 3 недели.",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "transcript" in data
            assert "extracted" in data
