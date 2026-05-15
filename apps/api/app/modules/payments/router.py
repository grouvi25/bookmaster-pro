"""
Payments router — /api/v1/payments
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.masters.models import Master
from app.modules.clients.models import Client
from app.modules.payments.schemas import (
    CreatePaymentRequest,
    PaymentConfirmation,
    PaymentOut,
    SubscriptionCreate,
    SubscriptionOut,
    ClientSubscriptionCreate,
    ClientSubscriptionOut,
)
from app.modules.payments.service import PaymentService
from app.modules.payments.models import Payment

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/create", response_model=PaymentConfirmation)
async def create_payment(
    body: CreatePaymentRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать платёж за запись (ЮKassa)."""
    service = PaymentService(db)
    try:
        result = await service.create_payment(
            appointment_id=body.appointment_id,
            payment_type=body.payment_type,
            return_url=body.return_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PaymentConfirmation(**result)


@router.post("/subscription")
async def create_subscription(
    body: SubscriptionCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Оформить подписку мастера на тариф.
    Если ЮKassa настроена — возвращает confirmation_url для оплаты.
    Если нет — активирует подписку сразу (dev mode).
    """
    from app.core.config import settings as app_settings

    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = PaymentService(db)
    try:
        sub = await service.create_master_subscription(
            master.id, body.plan, body.billing_period
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()

    result = {
        "id": sub.id,
        "master_id": sub.master_id,
        "plan": sub.plan,
        "price": str(sub.price),
        "billing_period": sub.billing_period,
        "status": sub.status,
        "started_at": str(sub.started_at),
        "next_billing": str(sub.next_billing),
    }

    if app_settings.YOOKASSA_SHOP_ID and app_settings.YOOKASSA_SECRET_KEY:
        try:
            from yookassa import Configuration, Payment as YKPayment
            Configuration.account_id = app_settings.YOOKASSA_SHOP_ID
            Configuration.secret_key = app_settings.YOOKASSA_SECRET_KEY

            yk_payment = YKPayment.create({
                "amount": {"value": str(sub.price), "currency": "RUB"},
                "confirmation": {
                    "type": "redirect",
                    "return_url": f"{app_settings.APP_URL}/billing?status=success",
                },
                "capture": True,
                "description": f"Подписка {sub.plan} — {sub.billing_period}",
                "metadata": {"subscription_id": sub.id, "master_id": master.id},
                "save_payment_method": True,
            })

            sub.yookassa_recurring_id = yk_payment.id
            await db.commit()

            result["confirmation_url"] = yk_payment.confirmation.confirmation_url
            result["status"] = sub.status
        except Exception as e:
            logger.error(f"YooKassa subscription payment error: {e}")
            # НЕ активируем подписку при сбое создания платежа —
            # клиент должен повторить попытку.
            raise HTTPException(
                status_code=502,
                detail="Failed to create YooKassa payment. Please try again.",
            )

    return result


@router.post("/client-subscription", response_model=ClientSubscriptionOut)
async def create_client_subscription(
    body: ClientSubscriptionCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Купить абонемент клиента (пакет визитов)."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = PaymentService(db)
    sub = await service.create_client_subscription(
        master_id=body.master_id,
        client_id=client.id,
        service_id=body.service_id,
        total_visits=body.total_visits,
        price=body.price,
    )
    return sub


@router.get("/client-subscriptions", response_model=List[ClientSubscriptionOut])
async def get_client_subscriptions(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список абонементов клиента."""
    result = await db.execute(
        select(Client).where(Client.identity_id == int(user["sub"]))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Not a client")

    service = PaymentService(db)
    return await service.get_client_subscriptions(client.id)


@router.get("/subscription", response_model=SubscriptionOut)
async def get_current_subscription(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить текущую подписку мастера."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = PaymentService(db)
    sub = await service.get_active_subscription(master.id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")
    return sub


@router.post("/refund/{payment_id}", response_model=PaymentOut)
async def refund_payment(
    payment_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Запросить возврат платежа."""
    payment = await db.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master or payment.master_id != master.id:
        if user.get("role") != "superadmin":
            raise HTTPException(status_code=403, detail="Forbidden")

    if payment.status != "succeeded":
        raise HTTPException(status_code=400, detail="Можно вернуть только успешный платёж")

    service = PaymentService(db)
    await service.request_refund(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


@router.get("/subscription-packages")
async def get_subscription_packages(
    master_id: int | None = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список шаблонов абонементов мастера (хранятся в JSON).
    Если master_id — вернуть пакеты конкретного мастера (для клиента).
    Без master_id — пакеты текущего мастера.
    """
    if master_id:
        master = await db.get(Master, master_id)
    else:
        master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    packages = master.link_page_links or []
    pkg_list = []
    for item in packages:
        if isinstance(item, dict) and item.get("_type") == "subscription_package":
            pkg_list.append(item)
    return pkg_list


@router.post("/subscription-packages")
async def create_subscription_package(
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать шаблон абонемента."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    import time
    pkg = {
        "_type": "subscription_package",
        "id": int(time.time() * 1000),
        "service_id": body.get("service_id"),
        "total_visits": body.get("total_visits", 5),
        "price": body.get("price", 0),
        "discount_percent": 0,
        "is_active": True,
    }

    links = list(master.link_page_links or [])
    links.append(pkg)
    master.link_page_links = links
    await db.commit()
    return pkg


@router.delete("/subscription-packages/{package_id}")
async def delete_subscription_package(
    package_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удалить шаблон абонемента."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    links = [
        item for item in (master.link_page_links or [])
        if not (isinstance(item, dict) and item.get("_type") == "subscription_package" and item.get("id") == package_id)
    ]
    master.link_page_links = links
    await db.commit()
    return {"status": "ok"}


router_webhook = APIRouter()


@router_webhook.post("/yookassa")
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
