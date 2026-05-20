"""
Тесты мониторинга — /metrics, /health/detailed, бизнес-метрики.
"""

import pytest
from app.core.metrics import (
    track_booking_created,
    track_booking_cancelled,
    track_payment,
    track_ai_request,
    track_notification,
    _normalize_endpoint,
)


class TestMetricsEndpoint:
    """Тесты endpoint /metrics."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint_returns_prometheus_format(self, client):
        resp = await client.get("/metrics")
        assert resp.status_code == 200
        content = resp.text
        # Prometheus формат содержит TYPE и HELP
        assert "http_requests_total" in content
        assert "http_request_duration_seconds" in content
        assert "bookmaster_info" in content

    @pytest.mark.asyncio
    async def test_metrics_after_request(self, client):
        """После HTTP-запроса метрика http_requests_total инкрементится."""
        # Делаем запрос
        await client.get("/health")
        # Проверяем метрики
        resp = await client.get("/metrics")
        assert "http_requests_total" in resp.text
        assert '200' in resp.text


class TestHealthDetailed:
    """Тесты расширенного health check."""

    @pytest.mark.asyncio
    async def test_detailed_health_structure(self, client):
        resp = await client.get("/health/detailed")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "version" in data
        assert "checks" in data
        assert "db" in data["checks"]
        # В тестовом окружении DB должна быть ok (SQLite)


class TestBusinessMetrics:
    """Тесты бизнес-метрик."""

    def test_track_booking_created(self):
        """track_booking_created не крашится."""
        track_booking_created("pending")
        track_booking_created("confirmed")

    def test_track_booking_cancelled(self):
        track_booking_cancelled("client")
        track_booking_cancelled("master")

    def test_track_payment(self):
        track_payment("succeeded", "subscription", 990.0, "pro")
        track_payment("failed", "subscription")

    def test_track_ai_request(self):
        track_ai_request("openai", "chat")
        track_ai_request("yandexgpt", "content")

    def test_track_notification(self):
        track_notification("telegram", True)
        track_notification("max", False)

    def test_normalize_endpoint(self):
        assert _normalize_endpoint("/api/v1/masters/123") == "/api/v1/masters/{id}"
        assert _normalize_endpoint("/api/v1/booking/create") == "/api/v1/booking/create"
        assert _normalize_endpoint("/health") == "/health"
