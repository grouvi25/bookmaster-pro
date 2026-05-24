"""
Webhooks router — /webhook/*
Обработка входящих вебхуков от внешних сервисов.
ЮKassa, будущие интеграции (MAX, Telegram payments и т.д.)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/yookassa")
async def yookassa_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Webhook от ЮKassa — обновление статуса платежа.

    Безопасность (ЮKassa не подписывает webhook'и HMAC):
    1. IP отправителя должен быть в списке доверенных подсетей ЮKassa.
    2. Статус из тела запроса не доверяем — перезапрашиваем платёж по API
       для подтверждения (см. PaymentService.handle_webhook).

    ВАЖНО: Всегда возвращаем 200 OK. ЮKassa ретраит при любом не-2xx
    ответе, что создаёт бесконечный цикл повторов.
    """
    from app.modules.payments.security import verify_yookassa_ip
    from app.modules.payments.service import PaymentService

    try:
        verify_yookassa_ip(request)
    except Exception as e:
        logger.warning(f"YooKassa webhook IP rejected: {e}")
        return {"status": "ok"}  # Всегда 200 — не ретраить

    try:
        body = await request.json()
    except Exception as e:
        logger.warning(f"YooKassa webhook: invalid JSON: {e}")
        return {"status": "ok"}  # Всегда 200

    event_type = body.get("event")
    payment_data = body.get("object", {}) or {}
    if not isinstance(payment_data, dict) or not event_type:
        logger.warning("YooKassa webhook: malformed notification body")
        return {"status": "ok"}  # Всегда 200

    try:
        service = PaymentService(db)
        await service.handle_webhook(event_type, payment_data)
        await db.commit()
    except Exception as e:
        logger.error(f"YooKassa webhook processing error: {e}")

    return {"status": "ok"}
