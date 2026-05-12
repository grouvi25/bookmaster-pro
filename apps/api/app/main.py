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

# from app.modules.payments.router import router as payments_router
# app.include_router(payments_router, prefix="/api/v1/payments", tags=["payments"])

# from app.modules.promo.router import router as promo_router
# app.include_router(promo_router, prefix="/api/v1/promo", tags=["promo"])

# from app.modules.loyalty.router import router as loyalty_router
# app.include_router(loyalty_router, prefix="/api/v1/loyalty", tags=["loyalty"])

# from app.modules.reviews.router import router as reviews_router
# app.include_router(reviews_router, prefix="/api/v1/reviews", tags=["reviews"])

# from app.modules.ai.router import router as ai_router
# app.include_router(ai_router, prefix="/api/v1/ai", tags=["ai"])

# from app.modules.waitlist.router import router as waitlist_router
# app.include_router(waitlist_router, prefix="/api/v1/waitlist", tags=["waitlist"])

# from app.modules.analytics.router import router as analytics_router
# app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])

# from app.modules.support.router import router as support_router
# app.include_router(support_router, prefix="/api/v1/support", tags=["support"])

# from app.modules.marketplace.router import router as marketplace_router
# app.include_router(marketplace_router, prefix="/api/v1/marketplace", tags=["marketplace"])

# from app.modules.superadmin.router import router as superadmin_router
# app.include_router(superadmin_router, prefix="/api/v1/superadmin", tags=["superadmin"])

# from app.modules.webhooks.router import router as webhooks_router
# app.include_router(webhooks_router, prefix="/webhook", tags=["webhooks"])


# ── APScheduler ──────────────────────────────────────────────
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.modules.booking.scheduler import remind_24h, remind_2h, cleanup_pending

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    scheduler.add_job(remind_24h, "interval", hours=1, id="remind_24h")
    scheduler.add_job(remind_2h, "interval", minutes=30, id="remind_2h")
    scheduler.add_job(cleanup_pending, "interval", minutes=10, id="cleanup_pending")
    scheduler.start()
    logger.info("APScheduler started with 3 jobs")
