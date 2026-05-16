"""
YooKassa webhook security: IP whitelist + payment re-fetch verification.

ЮKassa не подписывает webhook-запросы HMAC. Рекомендуемый способ защиты
(см. https://yookassa.ru/developers/using-api/webhooks):
1. Проверять IP отправителя — список доверенных подсетей.
2. Не доверять статусу из тела запроса, а перезапрашивать платёж по API.
"""

from __future__ import annotations

import ipaddress
import logging
from typing import Iterable, List, Optional

from fastapi import HTTPException, Request

from app.core.config import settings

logger = logging.getLogger(__name__)

# Официальный список подсетей ЮKassa
# https://yookassa.ru/developers/using-api/webhooks#ip
DEFAULT_YOOKASSA_IPS: tuple[str, ...] = (
    "185.71.76.0/27",
    "185.71.77.0/27",
    "77.75.153.0/25",
    "77.75.156.11",
    "77.75.156.35",
    "77.75.154.128/25",
    "2a02:5180::/32",
)


def _parse_networks(values: Iterable[str]) -> List[ipaddress._BaseNetwork]:
    """Преобразовать список строк в ip_network объекты."""
    networks: List[ipaddress._BaseNetwork] = []
    for raw in values:
        raw = raw.strip()
        if not raw:
            continue
        try:
            networks.append(ipaddress.ip_network(raw, strict=False))
        except ValueError as e:
            logger.warning(f"Invalid YooKassa trusted IP/network '{raw}': {e}")
    return networks


def _trusted_networks() -> List[ipaddress._BaseNetwork]:
    """Загрузить trusted-список: override из settings или дефолт ЮKassa."""
    override = (settings.YOOKASSA_WEBHOOK_TRUSTED_IPS or "").strip()
    if override:
        return _parse_networks(override.split(","))
    return _parse_networks(DEFAULT_YOOKASSA_IPS)


def _client_ip(request: Request) -> Optional[str]:
    """Получить реальный IP клиента с учётом nginx-прокси.

    Берём первое значение из X-Forwarded-For (оно ставится самим прокси),
    падаем на X-Real-IP, а затем на request.client.host.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    if request.client:
        return request.client.host
    return None


def verify_yookassa_ip(request: Request) -> None:
    """Проверить, что webhook пришёл с доверенного IP ЮKassa.

    В development (ENVIRONMENT='development') пропускаем проверку,
    чтобы можно было тестировать локально через ngrok / прямые POST'ы.

    Бросает HTTPException(403), если IP не в списке.
    """
    if settings.ENVIRONMENT == "development":
        return

    ip_str = _client_ip(request)
    if not ip_str:
        logger.warning("YooKassa webhook: cannot determine client IP")
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        logger.warning(f"YooKassa webhook: invalid IP '{ip_str}'")
        raise HTTPException(status_code=403, detail="Forbidden")

    for network in _trusted_networks():
        if ip in network:
            return

    logger.warning(f"YooKassa webhook rejected: IP {ip_str} not in trusted list")
    raise HTTPException(status_code=403, detail="Forbidden")


async def fetch_yookassa_payment(payment_id: str) -> Optional[dict]:
    """Перезапросить payment у ЮKassa, чтобы убедиться в актуальном статусе.

    Возвращает dict с полями ЮKassa Payment или None если запрос не удался.
    Не возбуждает исключений — caller сам решает что делать.
    """
    if not (settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY):
        return None

    try:
        from yookassa import Configuration, Payment as YKPayment

        Configuration.account_id = settings.YOOKASSA_SHOP_ID
        Configuration.secret_key = settings.YOOKASSA_SECRET_KEY

        fetched = YKPayment.find_one(payment_id)
        if fetched is None:
            return None
        # SDK возвращает объект, а не dict — приводим к dict через .json() если есть,
        # иначе через атрибуты.
        if hasattr(fetched, "json"):
            try:
                return fetched.json()
            except Exception:
                pass
        return {
            "id": getattr(fetched, "id", None),
            "status": getattr(fetched, "status", None),
            "paid": getattr(fetched, "paid", None),
            "amount": getattr(fetched, "amount", None),
        }
    except Exception as e:
        logger.error(f"YooKassa fetch_payment({payment_id}) failed: {e}")
        return None
