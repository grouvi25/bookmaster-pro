import re
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

            _digits = re.sub(r"\D", "", (getattr(master, "phone", None) or ""))
            _customer = (
                {"phone": _digits} if len(_digits) >= 11
                else {"email": app_settings.RECEIPT_FALLBACK_EMAIL}
            )

            def _build_payload(save_method: bool) -> dict:
                payload = {
                    "amount": {"value": str(sub.price), "currency": "RUB"},
                    "confirmation": {
                        "type": "redirect",
                        "return_url": f"{app_settings.APP_URL}/billing?status=success",
                    },
                    "capture": True,
                    "description": f"Подписка {sub.plan} — {sub.billing_period}",
                    "metadata": {"subscription_id": sub.id, "master_id": master.id},
                    "receipt": {
                        "customer": _customer,
                        "items": [{
                            "description": f"Подписка {sub.plan} ({sub.billing_period})"[:128],
                            "quantity": "1.00",
                            "amount": {"value": str(sub.price), "currency": "RUB"},
                            "vat_code": 1,
                            "payment_subject": "service",
                            "payment_mode": "full_payment",
                        }],
                    },
                }
                # Рекуррентный платёж (сохранение карты для автопродления).
                # Если магазин ЮKassa не имеет права на рекуррентные платежи —
                # ниже сработает фоллбэк на обычный разовый платёж.
                if save_method:
                    payload["save_payment_method"] = True
                return payload

            def _is_recurring_forbidden(err: Exception) -> bool:
                msg = str(err).lower()
                return "recurring" in msg or "save_payment_method" in msg

            try:
                # 1) Пытаемся создать рекуррентный платёж (с автопродлением).
                yk_payment = YKPayment.create(_build_payload(save_method=True))
            except Exception as rec_err:
                if _is_recurring_forbidden(rec_err):
                    # 2) Магазин пока не умеет рекуррентные платежи —
                    #    откатываемся на обычный разовый платёж.
                    #    Когда ЮKassa включит рекуррентные, попытка №1
                    #    начнёт проходить сама, без изменений кода.
                    logger.warning(
                        "YooKassa recurring not available, falling back to "
                        f"one-time payment for subscription {sub.id}: {rec_err}"
                    )
                    yk_payment = YKPayment.create(_build_payload(save_method=False))
                else:
                    raise

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


@router.post("/subscription/cancel-auto-renew")
async def cancel_auto_renew(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отключить автопродление подписки.
    Подписка останется активной до конца оплаченного периода,
    но автоматическое списание больше не будет происходить.
    """
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = PaymentService(db)
    sub = await service.get_active_subscription(master.id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    sub.auto_renew = False
    await db.commit()

    logger.info(
        f"Auto-renew disabled for subscription {sub.id} "
        f"(master={master.id}, plan={sub.plan})"
    )

    return {
        "status": "ok",
        "message": "Автопродление отключено. Подписка активна до конца оплаченного периода.",
        "auto_renew": False,
        "next_billing": str(sub.next_billing),
    }


@router.post("/subscription/resume-auto-renew")
async def resume_auto_renew(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Включить автопродление подписки обратно."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = PaymentService(db)
    sub = await service.get_active_subscription(master.id)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    sub.auto_renew = True
    await db.commit()

    logger.info(
        f"Auto-renew resumed for subscription {sub.id} "
        f"(master={master.id}, plan={sub.plan})"
    )

    return {
        "status": "ok",
        "message": "Автопродление включено.",
        "auto_renew": True,
        "next_billing": str(sub.next_billing),
    }


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


@router.post("/agent-agreement/accept")
async def accept_agent_agreement(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Принять агентский договор-оферту.
    Фиксирует timestamp принятия — обязательно для агентской схемы (тариф A).
    """
    from datetime import datetime, timezone

    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    if master.agent_agreement_at:
        return {
            "status": "already_accepted",
            "accepted_at": master.agent_agreement_at.isoformat(),
        }

    master.agent_agreement_at = datetime.now(timezone.utc)
    await db.commit()

    logger.info(f"Agent agreement accepted by master {master.id}")
    return {
        "status": "ok",
        "accepted_at": master.agent_agreement_at.isoformat(),
    }


@router.get("/payouts")
async def get_my_payouts(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить историю выплат мастера."""
    from app.modules.payments.models import MasterPayout

    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    result = await db.execute(
        select(MasterPayout)
        .where(MasterPayout.master_id == master.id)
        .order_by(MasterPayout.id.desc())
        .limit(50)
    )
    payouts = result.scalars().all()

    return [
        {
            "id": p.id,
            "payment_id": p.payment_id,
            "amount": str(p.amount),
            "status": p.status,
            "scheduled_for": str(p.scheduled_for),
            "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            "error": p.error,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in payouts
    ]


# Backward-compatible re-export: webhook логика перенесена в app.modules.webhooks.router
from app.modules.webhooks.router import router as router_webhook  # noqa: F401, E402
