"""
T-Bank Payouts API — выплаты мастерам по агентской схеме.

Используется для перечисления доли мастера после оплаты клиентом.
Выплаты через СБП (по номеру телефона) или на банковскую карту.

Документация: https://developer.tbank.ru/docs/api/
"""

import logging
from decimal import Decimal
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# T-Bank Business API — БИК для СБП-платежей
TBANK_SBP_BIC = "044525974"


class TBankPayoutError(Exception):
    """Ошибка при выполнении выплаты через T-Bank."""

    def __init__(self, message: str, response_data: Optional[dict] = None):
        super().__init__(message)
        self.response_data = response_data


async def payout_via_sbp(
    phone: str,
    amount: Decimal,
    payment_id: int,
    description: str = "",
) -> dict:
    """
    Выплата мастеру через СБП по номеру телефона.

    Args:
        phone: Номер телефона мастера (формат: 79XXXXXXXXX)
        amount: Сумма выплаты в рублях
        payment_id: ID платежа (для назначения)
        description: Дополнительное описание

    Returns:
        Ответ T-Bank API (содержит paymentId, status и т.д.)

    Raises:
        TBankPayoutError: При ошибке выполнения выплаты
    """
    # Нормализуем телефон — только цифры, начиная с 7
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if not digits.startswith("7") or len(digits) != 11:
        raise TBankPayoutError(f"Invalid phone format: {phone}")

    purpose = f"Выплата по агентскому договору. Платёж #{payment_id}."
    if description:
        purpose += f" {description}"
    purpose = purpose[:140]  # ограничение назначения платежа

    payload = {
        "payment": {
            "sum": {
                "amount": str(int(amount * 100)),  # в копейках
                "currency": "RUB",
            },
            "paymentRequisite": {
                "accountNumber": digits,
                "bic": TBANK_SBP_BIC,
            },
            "operationCode": "6",  # платежи контрагентам
            "purpose": purpose,
        }
    }

    return await _execute_payout(payload, payment_id)


async def payout_via_card(
    card_number: str,
    amount: Decimal,
    payment_id: int,
    description: str = "",
) -> dict:
    """
    Выплата мастеру на банковскую карту.

    Args:
        card_number: Номер карты мастера (16-19 цифр)
        amount: Сумма выплаты в рублях
        payment_id: ID платежа
        description: Дополнительное описание

    Returns:
        Ответ T-Bank API

    Raises:
        TBankPayoutError: При ошибке выполнения выплаты
    """
    digits = "".join(c for c in card_number if c.isdigit())
    if len(digits) < 16 or len(digits) > 19:
        raise TBankPayoutError(f"Invalid card number length: {len(digits)}")

    purpose = f"Выплата по агентскому договору. Платёж #{payment_id}."
    if description:
        purpose += f" {description}"
    purpose = purpose[:140]

    payload = {
        "payment": {
            "sum": {
                "amount": str(int(amount * 100)),
                "currency": "RUB",
            },
            "paymentRequisite": {
                "cardNumber": digits,
            },
            "operationCode": "6",
            "purpose": purpose,
        }
    }

    return await _execute_payout(payload, payment_id)


async def _execute_payout(payload: dict, payment_id: int) -> dict:
    """Выполнить запрос к T-Bank Payouts API."""
    if not settings.T_BANK_API_KEY:
        raise TBankPayoutError(
            "T_BANK_API_KEY not configured — cannot process payouts"
        )

    api_url = settings.T_BANK_API_URL
    headers = {
        "Authorization": f"Bearer {settings.T_BANK_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(api_url, json=payload, headers=headers)

            if resp.status_code >= 400:
                error_body = resp.text
                logger.error(
                    f"T-Bank payout error (payment #{payment_id}): "
                    f"HTTP {resp.status_code} — {error_body}"
                )
                raise TBankPayoutError(
                    f"T-Bank API returned {resp.status_code}: {error_body}",
                    response_data=resp.json() if resp.headers.get("content-type", "").startswith("application/json") else None,
                )

            data = resp.json()
            logger.info(
                f"T-Bank payout success (payment #{payment_id}): "
                f"tbank_id={data.get('paymentId', 'N/A')}"
            )
            return data

        except httpx.HTTPError as e:
            logger.error(f"T-Bank payout network error (payment #{payment_id}): {e}")
            raise TBankPayoutError(f"Network error: {e}") from e
