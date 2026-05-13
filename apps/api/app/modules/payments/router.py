"""
Payments router — /api/v1/payments
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
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


@router.post("/subscription", response_model=SubscriptionOut)
async def create_subscription(
    body: SubscriptionCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Оформить подписку мастера на тариф."""
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    service = PaymentService(db)
    sub = await service.create_master_subscription(
        master.id, body.plan, body.billing_period
    )
    return sub


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


router_webhook = APIRouter()


@router_webhook.post("/yookassa")
async def yookassa_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Webhook от ЮKassa — обновление статуса платежа."""
    body = await request.json()
    event_type = body.get("event")
    payment_data = body.get("object", {})

    service = PaymentService(db)
    await service.handle_webhook(event_type, payment_data)
    return {"status": "ok"}
