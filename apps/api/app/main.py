"""
BookMaster Pro API — FastAPI entry point.
Только регистрация роутеров и middleware.
"""

import logging

from fastapi import FastAPI

from app.core.config import settings
from app.core.middleware import setup_middleware
from app.core.redis import close_redis

# Sentry (optional)
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BookMaster Pro API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

setup_middleware(app)

# Prometheus metrics
from app.core.metrics import setup_metrics_middleware, setup_metrics_endpoint
setup_metrics_middleware(app)
setup_metrics_endpoint(app)


@app.on_event("shutdown")
async def shutdown():
    await close_redis()


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/health/detailed")
async def health_detailed():
    """Расширенная проверка здоровья — DB, Redis, ключевые сервисы."""
    import time as _time
    checks = {}

    # DB
    try:
        from app.core.database import async_session_factory
        start = _time.time()
        async with async_session_factory() as session:
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
        checks["db"] = {"status": "ok", "latency_ms": round((_time.time() - start) * 1000, 1)}
    except Exception as e:
        checks["db"] = {"status": "error", "detail": str(e)[:100]}

    # Redis
    try:
        from app.core.redis import get_redis
        start = _time.time()
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = {"status": "ok", "latency_ms": round((_time.time() - start) * 1000, 1)}
    except Exception as e:
        checks["redis"] = {"status": "error", "detail": str(e)[:100]}

    all_ok = all(c["status"] == "ok" for c in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "1.0.0",
        "checks": checks,
    }


# ── Роутеры модулей ───────────────────────────────────────────
from app.modules.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

from app.modules.masters.router import router as masters_router
app.include_router(masters_router, prefix="/api/v1/masters", tags=["masters"])

from app.modules.services.router import router as services_router
app.include_router(services_router, prefix="/api/v1/services", tags=["services"])

from app.modules.booking.router import router as booking_router
app.include_router(booking_router, prefix="/api/v1/booking", tags=["booking"])

from app.modules.payments.router import router as payments_router, router_webhook
app.include_router(payments_router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(router_webhook, prefix="/webhook", tags=["webhooks"])

from app.modules.promo.router import router as promo_router
app.include_router(promo_router, prefix="/api/v1/promo", tags=["promo"])

from app.modules.loyalty.router import router as loyalty_router
app.include_router(loyalty_router, prefix="/api/v1/loyalty", tags=["loyalty"])

from app.modules.reviews.router import router as reviews_router
app.include_router(reviews_router, prefix="/api/v1/reviews", tags=["reviews"])

from app.modules.waitlist.router import router as waitlist_router
app.include_router(waitlist_router, prefix="/api/v1/waitlist", tags=["waitlist"])

from app.modules.clients.router import router as clients_router
app.include_router(clients_router, prefix="/api/v1/clients", tags=["clients"])

from app.modules.ai.router import router as ai_router
app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

from app.modules.analytics.router import router as analytics_router
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])

from app.modules.portfolio.router import router as portfolio_router
app.include_router(portfolio_router, prefix="/api/v1/portfolio", tags=["portfolio"])

from app.modules.support.router import router as support_router
app.include_router(support_router, prefix="/api/v1/support", tags=["support"])

from app.modules.marketplace.router import router as marketplace_router
app.include_router(marketplace_router, prefix="/api/v1/marketplace", tags=["marketplace"])

from app.modules.superadmin.router import router as superadmin_router
app.include_router(superadmin_router, prefix="/api/v1/superadmin", tags=["superadmin"])

from app.modules.consultations.router import router as consultations_router
app.include_router(consultations_router, prefix="/api/v1/consultations", tags=["consultations"])

from app.modules.broadcast.router import router as broadcast_router
app.include_router(broadcast_router, prefix="/api/v1/broadcast", tags=["broadcast"])

from app.modules.nps.router import router as nps_router
app.include_router(nps_router, prefix="/api/v1/nps", tags=["nps"])

from app.modules.widget.router import router as widget_router
app.include_router(widget_router, prefix="/api/v1/widget", tags=["widget"])

from app.modules.core.router import router as feature_flags_router
app.include_router(feature_flags_router, prefix="/api/v1/feature-flags", tags=["feature-flags"])

from app.modules.uploads.router import router as uploads_router
app.include_router(uploads_router, prefix="/api/v1/uploads", tags=["uploads"])


# ── APScheduler вынесен в отдельный воркер apps/scheduler/runner.py ──
# Все фоновые задачи теперь запускаются через контейнер bm_scheduler
# с Redis jobstore для персистентности.
