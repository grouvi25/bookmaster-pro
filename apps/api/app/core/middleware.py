"""
CORS, rate-limiting, logging middleware.
"""

import logging
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

        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 2)

        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration}ms)"
        )
        return response
