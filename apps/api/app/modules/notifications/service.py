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
MAX_API = "https://botapi.max.ru"


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
    async def send_by_client_id(
        db,
        client_id: int,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление клиенту по client_id (через его identity)."""
        from app.modules.clients.models import Client
        from app.modules.auth.models import Identity
        from sqlalchemy import select

        result = await db.execute(
            select(Client).where(Client.id == client_id)
        )
        client = result.scalar_one_or_none()
        if not client:
            return False

        result = await db.execute(
            select(Identity).where(Identity.id == client.identity_id)
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

    @staticmethod
    async def send_by_master_id(
        db,
        master_id: int,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление мастеру по master_id."""
        from app.modules.masters.models import Master
        from app.modules.auth.models import Identity
        from sqlalchemy import select

        master = await db.get(Master, master_id)
        if not master:
            return False

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

    @staticmethod
    async def send_to_master(
        master,
        text: str,
        button_text: Optional[str] = None,
        button_url: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление мастеру (нужна его identity)."""
        from app.core.database import async_session_factory
        from app.modules.auth.models import Identity
        from sqlalchemy import select

        async with async_session_factory() as db:
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

    @staticmethod
    async def send_to_admin(platform_id: str, text: str) -> bool:
        """Отправить сообщение суперадмину в Telegram по его platform_id.

        Используется для алёртов об ошибках (monitoring/alerts.py).
        """
        try:
            return await NotificationService._tg_send(chat_id=str(platform_id), text=text)
        except Exception as e:
            logger.warning(f"send_to_admin failed for {platform_id}: {e}")
            return False

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
        # MAX Bot API: POST /messages?user_id=<id>,
        # auth — токен БЕЗ «Bearer», кнопки — attachment inline_keyboard.
        payload: dict = {"text": text[:4000]}
        if button_text:
            url = button_url or settings.APP_URL
            payload["attachments"] = [{
                "type": "inline_keyboard",
                "payload": {"buttons": [[{
                    "type": "link",
                    "text": button_text,
                    "url": url,
                }]]},
            }]
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{MAX_API}/messages",
                params={"user_id": int(user_id)},
                headers={
                    "Authorization": settings.MAX_BOT_TOKEN,
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if resp.status_code in (200, 201):
                return True
            logger.warning(f"MAX API {resp.status_code}: {resp.text[:200]}")
            return False
