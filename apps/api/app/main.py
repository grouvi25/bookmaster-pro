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


@app.on_event("shutdown")
async def shutdown():
    await close_redis()


# ── Health check ──────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


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


# ── APScheduler ──────────────────────────────────────────────
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.modules.booking.scheduler import (
    remind_24h, remind_2h, cleanup_pending,
    admin_daily, birthday_promo, reactivation,
    post_visit_review, billing_reminder, ai_reindex,
    loyalty_expire, loyalty_expiry_warn,
    waitlist_notify,
)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    # Фаза 1: напоминания и очистка
    scheduler.add_job(remind_24h, "interval", hours=1, id="remind_24h")
    scheduler.add_job(remind_2h, "interval", minutes=30, id="remind_2h")
    scheduler.add_job(cleanup_pending, "interval", minutes=1, id="cleanup_pending")

    # Фаза 3: расширенные задачи
    scheduler.add_job(admin_daily, "cron", hour=9, minute=0, id="admin_daily")
    scheduler.add_job(birthday_promo, "cron", hour=8, minute=0, id="birthday_promo")
    scheduler.add_job(reactivation, "cron", hour=11, minute=0, id="reactivation")
    scheduler.add_job(post_visit_review, "interval", hours=1, id="post_visit_review")
    scheduler.add_job(billing_reminder, "cron", hour=10, minute=0, id="billing_reminder")
    scheduler.add_job(ai_reindex, "cron", hour=3, minute=0, id="ai_reindex")

    # Лояльность: сгорание баллов и предупреждение
    scheduler.add_job(loyalty_expire, "cron", hour=2, minute=0, id="loyalty_expire")
    scheduler.add_job(loyalty_expiry_warn, "cron", hour=10, minute=30, id="loyalty_expiry_warn")

    # Фаза 5: waitlist
    scheduler.add_job(waitlist_notify, "interval", minutes=5, id="waitlist_notify")

    scheduler.start()
    logger.info("APScheduler started with 12 jobs")
