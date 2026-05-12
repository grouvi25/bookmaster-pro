"""
Payments router — /api/v1/payments
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.payments.schemas import (
    CreatePaymentRequest,
    PaymentConfirmation,
    SubscriptionCreate,
    SubscriptionOut,
)
from app.modules.payments.service import PaymentService

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
