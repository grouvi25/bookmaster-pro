"""
Prometheus-совместимые метрики для BookMaster Pro.
Собирает: HTTP request count/duration, active connections,
DB query count, business метрики.

Использует prometheus_client — легковесная библиотека,
не требующая Prometheus сервера для сбора (можно скрейпить напрямую).
"""

import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    generate_latest,
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    REGISTRY,
)

# ── Метрики ──────────────────────────────────────────────────────────

# HTTP
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being processed",
    ["method"],
)

# Business
BOOKINGS_CREATED_TOTAL = Counter(
    "bookings_created_total",
    "Total bookings created",
    ["status"],
)

BOOKINGS_CANCELLED_TOTAL = Counter(
    "bookings_cancelled_total",
    "Total bookings cancelled",
    ["reason"],
)

PAYMENTS_TOTAL = Counter(
    "payments_total",
    "Total payment attempts",
    ["status", "type"],
)

PAYMENTS_AMOUNT = Counter(
    "payments_amount_rub_total",
    "Total payment amount in RUB",
    ["plan"],
)

AI_REQUESTS_TOTAL = Counter(
    "ai_requests_total",
    "Total AI requests",
    ["provider", "type"],
)

AI_TOKEN_USAGE = Counter(
    "ai_tokens_used_total",
    "Total AI tokens consumed",
    ["provider"],
)

NOTIFICATIONS_SENT_TOTAL = Counter(
    "notifications_sent_total",
    "Total notifications sent",
    ["platform", "status"],
)

ACTIVE_SUBSCRIPTIONS = Gauge(
    "active_subscriptions",
    "Number of active subscriptions",
    ["plan"],
)

REGISTERED_MASTERS = Gauge(
    "registered_masters_total",
    "Total registered masters",
)

REGISTERED_CLIENTS = Gauge(
    "registered_clients_total",
    "Total registered clients",
)

APP_INFO = Info(
    "bookmaster",
    "BookMaster Pro application info",
)
APP_INFO.info({
    "version": "1.0.0",
    "environment": "production",
})




# Monitoring / Backup metrics
LAST_BACKUP_TIMESTAMP = Gauge(
    "bookmaster_last_backup_timestamp",
    "Unix timestamp of last successful backup",
)

DB_SIZE_BYTES = Gauge(
    "bookmaster_db_size_bytes",
    "PostgreSQL database size in bytes",
)

ERROR_EVENTS_TOTAL = Counter(
    "bookmaster_error_events_total",
    "Total tracked error events",
    ["severity"],
)

# ── Хелперы для бизнес-метрик ─────────────────────────────────────────

def track_booking_created(status: str = "pending"):
    BOOKINGS_CREATED_TOTAL.labels(status=status).inc()


def track_booking_cancelled(reason: str = "client"):
    BOOKINGS_CANCELLED_TOTAL.labels(reason=reason).inc()


def track_payment(status: str, payment_type: str = "subscription", amount: float = 0, plan: str = ""):
    PAYMENTS_TOTAL.labels(status=status, type=payment_type).inc()
    if status == "succeeded" and amount > 0:
        PAYMENTS_AMOUNT.labels(plan=plan).inc(amount)


def track_ai_request(provider: str = "openai", req_type: str = "chat"):
    AI_REQUESTS_TOTAL.labels(provider=provider, type=req_type).inc()


def track_ai_tokens(provider: str = "openai", tokens: int = 0):
    AI_TOKEN_USAGE.labels(provider=provider).inc(tokens)


def track_notification(platform: str = "telegram", success: bool = True):
    NOTIFICATIONS_SENT_TOTAL.labels(
        platform=platform,
        status="sent" if success else "failed",
    ).inc()


# ── Normalize endpoint для метрик (убираем параметры) ──────────────────

def _normalize_endpoint(path: str) -> str:
    """Нормализация пути: /api/v1/masters/123 → /api/v1/masters/{id}"""
    parts = path.split("/")
    normalized = []
    for part in parts:
        if part.isdigit():
            normalized.append("{id}")
        elif len(part) > 20 and "-" in part:
            normalized.append("{slug}")
        else:
            normalized.append(part)
    return "/".join(normalized)


# ── Middleware для автоматического сбора HTTP метрик ───────────────────

def setup_metrics_middleware(app: FastAPI) -> None:
    """Добавляет middleware для сбора HTTP метрик."""

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next: Callable) -> Response:
        method = request.method
        endpoint = _normalize_endpoint(request.url.path)

        # Skip metrics endpoint itself
        if request.url.path == "/metrics":
            return await call_next(request)

        HTTP_REQUESTS_IN_PROGRESS.labels(method=method).inc()
        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time
            status_code = str(response.status_code)

            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=endpoint, status_code=status_code
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                method=method, endpoint=endpoint
            ).observe(duration)

            return response
        except Exception as exc:
            duration = time.time() - start_time
            HTTP_REQUESTS_TOTAL.labels(
                method=method, endpoint=endpoint, status_code="500"
            ).inc()
            HTTP_REQUEST_DURATION.labels(
                method=method, endpoint=endpoint
            ).observe(duration)
            raise
        finally:
            HTTP_REQUESTS_IN_PROGRESS.labels(method=method).dec()


# ── Endpoint /metrics ─────────────────────────────────────────────────

def setup_metrics_endpoint(app: FastAPI) -> None:
    """Регистрирует endpoint /metrics для Prometheus scraping."""

    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(
            content=generate_latest(REGISTRY),
            media_type=CONTENT_TYPE_LATEST,
        )
