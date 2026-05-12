"""
NotificationService — единая точка отправки уведомлений.
Вызывает TG Bot API или MAX Bot API напрямую через httpx.
Не зависит от aiogram инстанса (разные процессы).
"""

import httpx
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

TG_API = f"https://api.telegram.org/bot{settings.TG_BOT_TOKEN}"
MAX_API = "https://botapi.max.ru/v1"


class NotificationService:
    @staticmethod
    async def send_to_client(
        platform: str,
        platform_id: str,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление клиенту или мастеру."""
        try:
            if platform == "telegram":
                return await NotificationService._tg_send(
                    chat_id=platform_id, text=text,
                    button_text=button_text, button_url=button_url,
                )
            elif platform == "max":
                return await NotificationService._max_send(
                    user_id=platform_id, text=text,
                    button_text=button_text, button_url=button_url,
                )
        except Exception as e:
            logger.error(f"Notification error ({platform}:{platform_id}): {e}")
            return False
        return False

    @staticmethod
    async def send_to_master(
        master,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление мастеру (нужна его identity)."""
        from app.core.database import AsyncSessionLocal
        from app.modules.auth.models import Identity
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Identity).where(Identity.id == master.identity_id)
            )
            identity = result.scalar_one_or_none()
            if not identity:
                return False
            return await NotificationService.send_to_client(
                platform=identity.platform,
                platform_id=identity.platform_id,
                text=text,
                button_text=button_text,
                button_url=button_url,
            )

    # ─── Telegram ─────────────────────────────────────────────────────
    @staticmethod
    async def _tg_send(
        chat_id: str,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        payload: dict = {
            "chat_id": chat_id,
            "text": text[:4096],
            "parse_mode": "HTML",
        }
        if button_text:
            url = button_url or settings.APP_URL
            payload["reply_markup"] = {
                "inline_keyboard": [[{
                    "text": button_text,
                    "web_app": {"url": url},
                }]]
            }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{TG_API}/sendMessage",
                json=payload,
            )
            if resp.status_code == 200:
                return True
            if resp.status_code == 403:
                logger.debug(f"Bot blocked by user {chat_id}")
            else:
                logger.warning(f"TG API {resp.status_code}: {resp.text[:200]}")
            return False

    # ─── MAX ──────────────────────────────────────────────────────────
    @staticmethod
    async def _max_send(
        user_id: str,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        if not settings.MAX_BOT_TOKEN:
            logger.debug("MAX_BOT_TOKEN not set, skipping")
            return False
        payload: dict = {
            "user_id": int(user_id),
            "text": text[:4096],
        }
        if button_text:
            url = button_url or settings.APP_URL
            payload["keyboard"] = {
                "buttons": [[{
                    "type": "open_link",
                    "text": button_text,
                    "url": url,
                }]]
            }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MAX_API}/messages/send",
                headers={
                    "Authorization": f"Bearer {settings.MAX_BOT_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code in (200, 201):
                return True
            logger.warning(f"MAX API {resp.status_code}: {resp.text[:200]}")
            return False
