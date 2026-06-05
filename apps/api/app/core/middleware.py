"""
CORS, rate-limiting, logging middleware.
"""

import logging
import uuid
import time
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def setup_middleware(app: FastAPI) -> None:
    # CORS — ограничиваем origins для безопасности (ТЗ)
    from app.core.config import settings as app_settings

    allowed_origins = [
        app_settings.APP_URL,
        app_settings.MARKETPLACE_URL,
        app_settings.API_URL,
    ]
    # В development разрешаем localhost
    if app_settings.DEBUG:
        allowed_origins.extend([
            "http://localhost:5173",
            "http://localhost:3000",
            "http://localhost:8000",
            "http://127.0.0.1:5173",
        ])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_and_rate_limit(request: Request, call_next: Callable) -> Response:
        start = time.time()

        # Глобальный rate-limit: 200 req/min на IP
        # Пропускаем health/metrics (внутренние)
        path = request.url.path
        if path not in ("/health", "/health/detailed", "/metrics"):
            try:
                from app.core.rate_limit import global_rate_limit_middleware
                allowed = await global_rate_limit_middleware(request)
                if not allowed:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests. Global limit: 200/min"},
                    )
            except Exception:
                pass  # fail open — если Redis недоступен, пропускаем

        # Request context: request_id для логирования
        from app.core.request_context import set_request_id, set_user_id
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:8]
        set_request_id(request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        duration = round((time.time() - start) * 1000, 2)

        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)"
        )
        return response


    # ── Global exception handler ──────────────────────────────
    from starlette.requests import Request as StarletteRequest
    from starlette.responses import JSONResponse as StarletteJSONResponse

    @app.exception_handler(Exception)
    async def global_exception_handler(request: StarletteRequest, exc: Exception):
        from app.core.request_context import get_request_id, get_user_id

        logger.error(
            "Unhandled exception",
            exc_info=exc,
            extra={
                "path": str(request.url.path),
                "method": request.method,
                "request_id": get_request_id(),
            }
        )

        # Записываем в БД (error tracking)
        try:
            from app.core.database import async_session_factory
            from app.modules.monitoring.tracker import ErrorTracker

            async with async_session_factory() as db:
                tracker = ErrorTracker(db)
                parts = request.url.path.strip("/").split("/")
                module = parts[2] if len(parts) > 2 else ""
                await tracker.track(
                    exc=exc,
                    module=module,
                    severity="critical" if isinstance(exc, (SystemError, MemoryError)) else "error",
                    request_id=get_request_id(),
                    user_id=get_user_id(),
                )
                await db.commit()
        except Exception as track_err:
            logger.warning(f"ErrorTracker failed: {track_err}")

        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
