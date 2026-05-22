"""
Rate limiting — sliding window counter на Redis.

Использование:
  from app.core.rate_limit import rate_limit

  @router.post("/ai/ask")
  async def ask(
      ...,
      _rl=Depends(rate_limit("ai", max_requests=10, window_seconds=60)),
  ):
      ...

Или в middleware для глобального лимита по IP.
"""

import logging
import time
from typing import Optional

from fastapi import Depends, HTTPException, Request, status

from app.core.redis import get_redis

logger = logging.getLogger(__name__)


async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """
    Sliding window rate limiter на Redis.
    Возвращает True если запрос разрешён, False если лимит превышен.
    """
    try:
        redis = await get_redis()
        now = time.time()
        window_start = now - window_seconds

        pipe = redis.pipeline()
        # Удаляем устаревшие записи
        pipe.zremrangebyscore(key, 0, window_start)
        # Считаем текущие запросы в окне
        pipe.zcard(key)
        # Добавляем текущий запрос
        pipe.zadd(key, {str(now): now})
        # TTL чтобы ключ не жил вечно
        pipe.expire(key, window_seconds + 10)

        results = await pipe.execute()
        current_count = results[1]

        if current_count >= max_requests:
            # Откатываем добавленный элемент
            await redis.zrem(key, str(now))
            return False

        return True
    except Exception as e:
        # Если Redis недоступен — пропускаем (fail open)
        logger.warning(f"Rate limit check failed (allowing request): {e}")
        return True


def _get_client_ip(request: Request) -> str:
    """Получить IP клиента с учётом прокси."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    if request.client:
        return request.client.host
    return "unknown"


def rate_limit(
    scope: str,
    max_requests: int = 30,
    window_seconds: int = 60,
    by: str = "ip",
):
    """
    FastAPI Depends factory для per-endpoint rate limiting.

    Args:
        scope: Название scope (напр. "ai", "booking", "auth")
        max_requests: Максимум запросов в окне
        window_seconds: Размер окна в секундах
        by: "ip" — по IP, "user" — по identity_id из токена
    """

    async def _check(request: Request):
        if by == "user":
            # Пробуем взять identity_id из auth state
            user = getattr(request.state, "user", None)
            identifier = str(user.get("identity_id", "")) if user else ""
            if not identifier:
                identifier = _get_client_ip(request)
        else:
            identifier = _get_client_ip(request)

        key = f"rl:{scope}:{identifier}"
        allowed = await check_rate_limit(key, max_requests, window_seconds)

        if not allowed:
            logger.warning(
                f"Rate limit exceeded: scope={scope}, id={identifier}, "
                f"limit={max_requests}/{window_seconds}s"
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Limit: {max_requests} per {window_seconds}s",
            )

    return Depends(_check)


async def global_rate_limit_middleware(request: Request) -> Optional[bool]:
    """
    Глобальный rate limit — 200 req/min на IP.
    Вызывается из middleware. Возвращает False если лимит превышен.
    """
    ip = _get_client_ip(request)
    key = f"rl:global:{ip}"
    return await check_rate_limit(key, max_requests=200, window_seconds=60)
