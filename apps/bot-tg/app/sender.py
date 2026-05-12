"""
Sender — отправка уведомлений из других сервисов.
Используется FastAPI бэкендом для push-уведомлений:
  from app.modules.notifications.service import NotificationService
Это отдельный HTTP-клиент к Telegram Bot API,
не зависящий от aiogram инстанса.
"""

import httpx
import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

TG_API = f"https://api.telegram.org/bot{settings.TG_BOT_TOKEN}"


async def send_message(
    chat_id: str,
    text: str,
    button_text: Optional[str] = None,
    button_url: Optional[str] = None,
    parse_mode: str = "HTML",
) -> bool:
    """
    Отправить сообщение пользователю.
    Возвращает True при успехе.
    """
    payload: dict = {
        "chat_id": chat_id,
        "text": text[:4096],
        "parse_mode": parse_mode,
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
        try:
            resp = await client.post(
                f"{TG_API}/sendMessage",
                json=payload,
            )
            if resp.status_code == 200:
                return True
            data = resp.json()
            if resp.status_code == 403:
                logger.debug(f"Bot blocked by user {chat_id}")
            else:
                logger.error(
                    f"TG send error {resp.status_code}: "
                    f"{data.get('description', 'unknown')}"
                )
            return False
        except httpx.TimeoutException:
            logger.warning(f"TG send timeout for chat_id={chat_id}")
            return False
        except Exception as e:
            logger.error(f"TG send exception: {e}")
            return False


async def send_voice(chat_id: str, audio_bytes: bytes) -> bool:
    """Отправить голосовое сообщение (MP3 → OGG Telegram)."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{TG_API}/sendVoice",
                data={"chat_id": chat_id},
                files={"voice": ("voice.mp3", audio_bytes, "audio/mpeg")},
            )
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"TG send_voice error: {e}")
            return False
