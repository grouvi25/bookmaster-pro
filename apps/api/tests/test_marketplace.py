"""
Тесты маркетплейса — поиск, featured, публичный профиль.
"""

import pytest
from tests.conftest import make_token


class TestMarketplaceSearch:
    """Тесты поиска мастеров."""

    @pytest.mark.asyncio
    async def test_search_returns_verified_masters(
        self, client, master
    ):
        """Поиск возвращает верифицированных мастеров."""
        resp = await client.get("/api/v1/marketplace/search")
        assert resp.status_code == 200
        data = resp.json()
        assert "masters" in data
        assert "total" in data
        # Наш тестовый мастер is_verified=True
        assert data["total"] >= 1
        found = [m for m in data["masters"] if m["slug"] == "test-master"]
        assert len(found) == 1
        assert found[0]["display_name"] == "Тест Мастер"

    @pytest.mark.asyncio
    async def test_search_filters_by_city(self, client, master):
        """Фильтр по городу."""
        resp = await client.get(
            "/api/v1/marketplace/search",
            params={"city": "Москва"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

        resp2 = await client.get(
            "/api/v1/marketplace/search",
            params={"city": "Несуществующий_город"},
        )
        data2 = resp2.json()
        assert data2["total"] == 0

    @pytest.mark.asyncio
    async def test_search_filters_by_specialization(self, client, master):
        """Фильтр по специализации."""
        resp = await client.get(
            "/api/v1/marketplace/search",
            params={"specialization": "Маникюр"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1


class TestFeatured:
    """Тесты featured мастеров."""

    @pytest.mark.asyncio
    async def test_featured_returns_verified_with_rating(self, client, master):
        """Featured возвращает верифицированных мастеров с рейтингом."""
        resp = await client.get(
            "/api/v1/marketplace/featured",
            params={"limit": 6},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        # Наш мастер is_verified=True, rating_count=10
        assert len(data["items"]) >= 1

    @pytest.mark.asyncio
    async def test_featured_limit(self, client, master):
        """Limit корректно ограничивает результат."""
        resp = await client.get(
            "/api/v1/marketplace/featured",
            params={"limit": 1},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 1


class TestPublicProfile:
    """Тесты публичного профиля мастера."""

    @pytest.mark.asyncio
    async def test_get_public_profile_by_slug(self, client, master, service):
        """Получение публичного профиля по slug."""
        resp = await client.get(f"/api/v1/masters/{master.slug}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Тест Мастер"
        assert data["slug"] == "test-master"
        assert data["specialization"] == "Маникюр"

    @pytest.mark.asyncio
    async def test_nonexistent_slug_returns_404(self, client):
        """Несуществующий slug → 404."""
        resp = await client.get("/api/v1/masters/nonexistent-slug-xyz")
        assert resp.status_code == 404
