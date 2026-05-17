"""
Payments service — ЮKassa integration, splits.
"""

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.payments.models import Payment, MasterSubscription, ClientSubscription
from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.masters.models import Master
from app.modules.core.models import FeatureFlags

logger = logging.getLogger(__name__)

PLAN_PRICES = {
    "start": Decimal("590"),
    "basic": Decimal("990"),
    "pro": Decimal("1990"),
    "pro_ai": Decimal("2990"),
    "business": Decimal("4990"),
}


class PaymentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_payment(
        self,
        appointment_id: int,
        payment_type: str = "full",
        return_url: Optional[str] = None,
    ) -> dict:
        """Создать платёж через ЮKassa."""
        # Получаем запись
        result = await self.db.execute(
            select(Appointment).where(Appointment.id == appointment_id)
        )
        appointment = result.scalar_one_or_none()
        if not appointment:
            raise ValueError("Appointment not found")

        if appointment.status not in (
            AppointmentStatus.PENDING.value,
            AppointmentStatus.CONFIRMED.value,
        ):
            raise ValueError("Appointment cannot be paid in current status")

        # Рассчитываем сумму
        total = Decimal(str(appointment.price_final or 0))
        if payment_type == "prepay_30":
            amount = total * Decimal("0.3")
        elif payment_type == "prepay_50":
            amount = total * Decimal("0.5")
        elif payment_type == "deposit":
            # Получаем настройку депозита мастера
            result = await self.db.execute(
                select(Master).where(Master.id == appointment.master_id)
            )
            master = result.scalar_one_or_none()
            amount = Decimal(str(master.noshow_deposit_amount)) if master else total
        else:
            amount = total

        # Рассчитываем splits (комиссия платформы)
        result = await self.db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == appointment.master_id)
        )
        flags = result.scalar_one_or_none()
        commission_rate = Decimal(str(flags.commission_rate_bp if flags else 700)) / Decimal("10000")
        amount_service = amount * commission_rate
        amount_master = amount - amount_service

        # Создаём запись о платеже
        payment = Payment(
            appointment_id=appointment_id,
            master_id=appointment.master_id,
            client_id=appointment.client_id,
            amount_total=total,
            amount_paid=amount,
            amount_master=amount_master,
            amount_service=amount_service,
            payment_type=payment_type,
            status="pending",
        )
        self.db.add(payment)
        await self.db.flush()

        # Создаём платёж в ЮKassa
        confirmation_url = await self._create_yookassa_payment(
            payment, amount, return_url
        )

        return {
            "confirmation_url": confirmation_url,
            "payment_id": payment.id,
        }

    async def handle_webhook(self, event_type: str, payment_data: dict) -> None:
        """Обработать webhook от ЮKassa.

        Статусу из тела запроса не доверяем — перезапрашиваем платёж
        по API и сличаем статус с ожидаемым для event_type. Для refund.succeeded
        это невозможно (refund — отдельный объект), доверяем статусу.
        """
        from app.modules.payments.security import fetch_yookassa_payment

        yookassa_id = payment_data.get("id")
        if not yookassa_id:
            return

        result = await self.db.execute(
            select(Payment).where(Payment.yookassa_payment_id == yookassa_id)
        )
        payment = result.scalar_one_or_none()
        if not payment:
            logger.warning(f"Payment not found for yookassa_id: {yookassa_id}")
            return

        if event_type in ("payment.succeeded", "payment.canceled"):
            fetched = await fetch_yookassa_payment(yookassa_id)
            if fetched is None:
                logger.warning(
                    f"YooKassa webhook {event_type} for {yookassa_id}: "
                    f"verification fetch returned None; ignoring"
                )
                return
            fetched_status = fetched.get("status") if isinstance(fetched, dict) else None
            expected = "succeeded" if event_type == "payment.succeeded" else "canceled"
            if fetched_status != expected:
                logger.warning(
                    f"YooKassa webhook {event_type} for {yookassa_id}: "
                    f"verification mismatch (got status={fetched_status!r}, "
                    f"expected {expected!r}); ignoring"
                )
                return

        if event_type == "payment.succeeded":
            payment.status = "succeeded"
            # Обновляем статус записи
            result = await self.db.execute(
                select(Appointment).where(Appointment.id == payment.appointment_id)
            )
            appointment = result.scalar_one_or_none()
            if appointment:
                appointment.status = AppointmentStatus.PAID.value

            # Уведомить клиента и мастера об успешной оплате
            await self._notify_payment_succeeded(payment)

        elif event_type == "payment.canceled":
            payment.status = "failed"

        elif event_type == "refund.succeeded":
            payment.status = "refunded"

        await self.db.flush()

    async def create_master_subscription(
        self, master_id: int, plan: str, billing_period: str = "monthly"
    ) -> MasterSubscription:
        """Создать/обновить подписку мастера."""
        price = PLAN_PRICES.get(plan, Decimal("0"))
        if billing_period == "yearly":
            price = price * 12 * Decimal("0.8")
        period_days = 365 if billing_period == "yearly" else 30

        yookassa_configured = bool(
            settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY
        )
        if not yookassa_configured and not settings.ALLOW_DEV_PAYMENTS:
            raise ValueError(
                "YooKassa is not configured. Set YOOKASSA_SHOP_ID/SECRET_KEY "
                "or enable ALLOW_DEV_PAYMENTS=true for local development."
            )

        subscription = MasterSubscription(
            master_id=master_id,
            plan=plan,
            price=price,
            billing_period=billing_period,
            status="pending" if yookassa_configured else "active",
            started_at=date.today(),
            next_billing=date.today() + timedelta(days=period_days),
        )
        if not yookassa_configured:
            logger.warning(
                "ALLOW_DEV_PAYMENTS=true \u2014 activating master %s subscription "
                "(%s) without payment",
                master_id, plan,
            )
        self.db.add(subscription)

        # Обновляем тариф мастера
        result = await self.db.execute(
            select(Master).where(Master.id == master_id)
        )
        master = result.scalar_one_or_none()
        if master:
            master.current_plan = plan

        # Обновляем feature flags
        await self._update_feature_flags(master_id, plan)
        await self.db.flush()
        return subscription

    async def create_client_subscription(
        self,
        master_id: int,
        client_id: int,
        service_id: int,
        total_visits: int,
        price: Decimal,
    ) -> ClientSubscription:
        """Создать абонемент клиента."""
        sub = ClientSubscription(
            master_id=master_id,
            client_id=client_id,
            service_id=service_id,
            total_visits=total_visits,
            used_visits=0,
            price_paid=price,
            status="active",
            expires_at=date.today() + timedelta(days=90),
        )
        self.db.add(sub)
        await self.db.flush()
        return sub

    async def _create_yookassa_payment(
        self, payment: Payment, amount: Decimal, return_url: Optional[str]
    ) -> str:
        """Создать платёж в ЮKassa API."""
        if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
            # Локальный dev-режим: имитируем успешный платёж без вызова ЮKassa.
            # Опасно в проде — требуем явный ALLOW_DEV_PAYMENTS=true.
            if not settings.ALLOW_DEV_PAYMENTS:
                raise ValueError(
                    "YooKassa is not configured. Set YOOKASSA_SHOP_ID/SECRET_KEY "
                    "or enable ALLOW_DEV_PAYMENTS=true for local development."
                )
            logger.warning(
                "ALLOW_DEV_PAYMENTS=true — marking payment %s as succeeded "
                "without contacting YooKassa",
                payment.id,
            )
            payment.yookassa_payment_id = f"dev_{payment.id}"
            payment.status = "succeeded"
            return return_url or settings.APP_URL

        try:
            from yookassa import Configuration, Payment as YKPayment
            Configuration.account_id = settings.YOOKASSA_SHOP_ID
            Configuration.secret_key = settings.YOOKASSA_SECRET_KEY

            yk_params = {
                "amount": {
                    "value": str(amount),
                    "currency": "RUB",
                },
                "confirmation": {
                    "type": "redirect",
                    "return_url": return_url or settings.APP_URL,
                },
                "capture": True,
                "description": f"Запись #{payment.appointment_id}",
                "metadata": {
                    "payment_id": payment.id,
                    "appointment_id": payment.appointment_id,
                },
            }

            # Splits: для тарифа A (комиссионный) отправляем transfers
            result = await self.db.execute(
                select(Master).where(Master.id == payment.master_id)
            )
            master = result.scalar_one_or_none()
            if master and master.tariff_type == "A" and master.yookassa_account_id:
                yk_params["transfers"] = [
                    {
                        "account_id": master.yookassa_account_id,
                        "amount": {
                            "value": str(payment.amount_master),
                            "currency": "RUB",
                        },
                    }
                ]

            yk_payment = YKPayment.create(yk_params)

            payment.yookassa_payment_id = yk_payment.id
            return yk_payment.confirmation.confirmation_url
        except Exception as e:
            logger.error(f"YooKassa payment error: {e}")
            raise ValueError(f"Payment creation failed: {e}")

    async def _update_feature_flags(self, master_id: int, plan: str) -> None:
        """Обновить feature flags по тарифу."""
        result = await self.db.execute(
            select(FeatureFlags).where(FeatureFlags.master_id == master_id)
        )
        flags = result.scalar_one_or_none()
        if not flags:
            flags = FeatureFlags(master_id=master_id)
            self.db.add(flags)

        # Тарифная матрица (согласно ТЗ раздел 14)
        if plan == "start":
            flags.max_bookings_per_month = 30
            flags.max_services = 3
            flags.commission_rate_bp = 700  # 7%
            flags.booking_enabled = True
            flags.crm_basic = False
            flags.crm_advanced = False
            flags.promo_enabled = False
            flags.loyalty_enabled = False
            flags.client_subscriptions = False
            flags.waitlist_enabled = False
            flags.analytics_enabled = False
            flags.ai_advisor = False
            flags.ai_client_bot = False
            flags.ai_voice = False
            flags.ai_tokens_monthly = 0
            flags.portfolio_enabled = False
            flags.marketplace_enabled = False
            flags.marketplace_featured = False
            flags.widget_enabled = False
            flags.consultations_enabled = False
            flags.multi_location = False
            flags.max_locations = 1
            flags.reviews_enabled = False
            flags.broadcast_enabled = False
        elif plan == "basic":
            flags.max_bookings_per_month = 150
            flags.max_services = 10
            flags.commission_rate_bp = 700  # 7%
            flags.booking_enabled = True
            flags.crm_basic = True
            flags.crm_advanced = False
            flags.promo_enabled = True
            flags.loyalty_enabled = False
            flags.client_subscriptions = False
            flags.waitlist_enabled = True
            flags.analytics_enabled = False
            flags.ai_advisor = False
            flags.ai_client_bot = False
            flags.ai_voice = False
            flags.ai_tokens_monthly = 0
            flags.portfolio_enabled = False
            flags.marketplace_enabled = True
            flags.marketplace_featured = False
            flags.widget_enabled = True
            flags.consultations_enabled = False
            flags.multi_location = False
            flags.max_locations = 1
            flags.reviews_enabled = True
            flags.broadcast_enabled = False
        elif plan == "pro":
            flags.max_bookings_per_month = 999999  # ∞
            flags.max_services = 999999
            flags.commission_rate_bp = 600  # 6%
            flags.booking_enabled = True
            flags.crm_basic = True
            flags.crm_advanced = True
            flags.promo_enabled = True
            flags.loyalty_enabled = True
            flags.client_subscriptions = True
            flags.waitlist_enabled = True
            flags.analytics_enabled = True
            flags.ai_advisor = True
            flags.ai_client_bot = False
            flags.ai_voice = False
            flags.ai_tokens_monthly = 200000
            flags.portfolio_enabled = True
            flags.marketplace_enabled = True
            flags.marketplace_featured = False
            flags.widget_enabled = True
            flags.consultations_enabled = True
            flags.multi_location = True
            flags.max_locations = 2
            flags.reviews_enabled = True
            flags.broadcast_enabled = True
        elif plan == "pro_ai":
            flags.max_bookings_per_month = 999999  # ∞
            flags.max_services = 999999
            flags.commission_rate_bp = 550  # 5.5%
            flags.booking_enabled = True
            flags.crm_basic = True
            flags.crm_advanced = True
            flags.promo_enabled = True
            flags.loyalty_enabled = True
            flags.client_subscriptions = True
            flags.waitlist_enabled = True
            flags.analytics_enabled = True
            flags.ai_advisor = True
            flags.ai_client_bot = True
            flags.ai_voice = True
            flags.ai_tokens_monthly = 1000000
            flags.portfolio_enabled = True
            flags.marketplace_enabled = True
            flags.marketplace_featured = False
            flags.widget_enabled = True
            flags.consultations_enabled = True
            flags.multi_location = True
            flags.max_locations = 3
            flags.reviews_enabled = True
            flags.broadcast_enabled = True
        elif plan == "business":
            flags.max_bookings_per_month = 999999  # ∞
            flags.max_services = 999999
            flags.commission_rate_bp = 500  # 5%
            flags.booking_enabled = True
            flags.crm_basic = True
            flags.crm_advanced = True
            flags.promo_enabled = True
            flags.loyalty_enabled = True
            flags.client_subscriptions = True
            flags.waitlist_enabled = True
            flags.analytics_enabled = True
            flags.ai_advisor = True
            flags.ai_client_bot = True
            flags.ai_voice = True
            flags.ai_tokens_monthly = 3000000
            flags.portfolio_enabled = True
            flags.marketplace_enabled = True
            flags.marketplace_featured = True
            flags.widget_enabled = True
            flags.consultations_enabled = True
            flags.multi_location = True
            flags.max_locations = 999999  # ∞
            flags.reviews_enabled = True
            flags.broadcast_enabled = True

        await self.db.flush()

    async def _notify_payment_succeeded(self, payment: Payment) -> None:
        """Уведомить клиента и мастера об успешной оплате."""
        try:
            from app.modules.notifications.service import NotificationService

            amount_str = f"{payment.amount_paid}₽"

            # Уведомляем клиента
            if payment.client_id:
                client_text = (
                    f"✅ Оплата прошла успешно!\n"
                    f"Сумма: {amount_str}"
                )
                await NotificationService.send_by_client_id(
                    self.db,
                    payment.client_id,
                    client_text,
                    button_text="Мои записи",
                    button_url=f"{settings.APP_URL}?startParam=my_bookings",
                )

            # Уведомляем мастера
            if payment.master_id:
                master_text = (
                    f"💰 Получена оплата!\n"
                    f"Сумма: {amount_str}"
                )
                await NotificationService.send_by_master_id(
                    self.db,
                    payment.master_id,
                    master_text,
                    button_text="Открыть расписание",
                    button_url=f"{settings.APP_URL}?startParam=dashboard",
                )
        except Exception as e:
            logger.error(
                f"Failed to send payment notification for payment {payment.id}: {e}"
            )

    async def get_active_subscription(self, master_id: int) -> Optional[MasterSubscription]:
        """Получить активную подписку мастера."""
        result = await self.db.execute(
            select(MasterSubscription)
            .where(
                MasterSubscription.master_id == master_id,
                MasterSubscription.status == "active",
            )
            .order_by(MasterSubscription.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def request_refund(self, payment: Payment) -> None:
        """Запросить возврат платежа через ЮKassa."""
        if not settings.YOOKASSA_SHOP_ID or not settings.YOOKASSA_SECRET_KEY:
            payment.status = "refunded"
            await self.db.flush()
            return

        try:
            from yookassa import Configuration, Refund
            Configuration.account_id = settings.YOOKASSA_SHOP_ID
            Configuration.secret_key = settings.YOOKASSA_SECRET_KEY

            Refund.create({
                "payment_id": payment.yookassa_payment_id,
                "amount": {
                    "value": str(payment.amount_paid),
                    "currency": "RUB",
                },
            })
            payment.status = "refunded"
        except Exception as e:
            logger.error(f"YooKassa refund error: {e}")
            raise ValueError(f"Refund failed: {e}")

        await self.db.flush()

    async def get_client_subscriptions(self, client_id: int) -> list:
        """Получить все абонементы клиента."""
        result = await self.db.execute(
            select(ClientSubscription)
            .where(ClientSubscription.client_id == client_id)
            .order_by(ClientSubscription.id.desc())
        )
        return list(result.scalars().all())
