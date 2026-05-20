"""
Тесты модуля аутентификации — JWT, роли, доступы.
"""

import pytest
from app.core.auth import create_access_token, decode_token, is_superadmin
from tests.conftest import make_token


class TestJWT:
    """Тесты создания и валидации JWT."""

    def test_create_and_decode_token(self):
        payload = {"sub": "1", "identity_id": 1, "role": "master"}
        token = create_access_token(payload)
        decoded = decode_token(token)
        assert decoded["sub"] == "1"
        assert decoded["identity_id"] == 1
        assert decoded["role"] == "master"
        assert "exp" in decoded

    def test_invalid_token_raises(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            decode_token("invalid.token.here")
        assert exc_info.value.status_code == 401

    def test_expired_token_raises(self):
        from datetime import timedelta
        from fastapi import HTTPException

        token = create_access_token(
            {"sub": "1", "identity_id": 1, "role": "master"},
            expires_delta=timedelta(seconds=-10),
        )
        with pytest.raises(HTTPException):
            decode_token(token)


class TestSuperadmin:
    """Тесты проверки суперадмина."""

    def test_is_superadmin_returns_true_for_listed_id(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.auth.settings.SUPERADMIN_IDS", "123,456"
        )
        assert is_superadmin("123") is True
        assert is_superadmin("456") is True

    def test_is_superadmin_returns_false_for_unknown(self, monkeypatch):
        monkeypatch.setattr(
            "app.core.auth.settings.SUPERADMIN_IDS", "123,456"
        )
        assert is_superadmin("789") is False
        assert is_superadmin("") is False


class TestAuthEndpoints:
    """Тесты API эндпоинтов аутентификации."""

    @pytest.mark.asyncio
    async def test_health_endpoint(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_protected_endpoint_without_token(self, client):
        resp = await client.get("/api/v1/masters/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_protected_endpoint_with_valid_token(
        self, client, master, master_identity
    ):
        token = make_token(master_identity.id, "master")
        resp = await client.get(
            "/api/v1/masters/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["display_name"] == "Тест Мастер"
        assert data["slug"] == "test-master"
