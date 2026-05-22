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
    """
    from app.modules.payments.security import verify_yookassa_ip
    from app.modules.payments.service import PaymentService

    verify_yookassa_ip(request)

    try:
        body = await request.json()
    except Exception as e:
        logger.warning(f"YooKassa webhook: invalid JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = body.get("event")
    payment_data = body.get("object", {}) or {}
    if not isinstance(payment_data, dict) or not event_type:
        raise HTTPException(status_code=400, detail="Malformed notification")

    service = PaymentService(db)
    await service.handle_webhook(event_type, payment_data)
    await db.commit()
    return {"status": "ok"}
