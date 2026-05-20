"""
MAX Bot — обработчик webhook от VK MAX.
MAX Bot API: https://dev.vk.com/max/bots-api
Webhook: MAX шлёт POST запросы при событиях (новое сообщение и т.д.)
Архитектура та же: никакой бизнес-логики,
только redirect в Mini-App + push уведомления.
"""

import logging
import hmac
import hashlib
import json
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

app = FastAPI(docs_url=None, redoc_url=None)

MAX_API = "https://botapi.max.ru/v1"


# ─── Верификация подписи MAX ──────────────────────────────────────────
def verify_max_signature(body: bytes, signature: str) -> bool:
    """
    Верифицируем подпись вебхука от MAX.
    Документация: https://dev.vk.com/max/bots-api/webhooks
    """
    if not settings.MAX_WEBHOOK_SECRET:
        return True
    expected = hmac.HMAC(
        settings.MAX_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ─── Отправка сообщений ───────────────────────────────────────────────
async def send_max_message(
    user_id: int,
    text: str,
    button_text: Optional[str] = None,
    button_url: Optional[str] = None,
) -> bool:
    """Отправить сообщение пользователю MAX."""
    payload: dict = {
        "user_id": user_id,
        "text": text[:4096],
    }
    if button_text:
        url = button_url or settings.APP_URL
        payload["keyboard"] = {
            "buttons": [[{
                "type": "open_link",
                "text": button_text,
                "url": url,
                "payload": json.dumps({"url": url}),
            }]]
        }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{MAX_API}/messages/send",
                headers={
                    "Authorization": f"Bearer {settings.MAX_BOT_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            return resp.status_code in (200, 201)
        except Exception as e:
            logger.error(f"MAX send error: {e}")
            return False


# ─── Webhook endpoint ─────────────────────────────────────────────────
@app.post("/webhook/max")
async def max_webhook(request: Request):
    """
    Обрабатываем события от MAX.
    Типы событий:
    - message_created → новое сообщение от пользователя
    - message_callback → нажатие кнопки
    - bot_started → пользователь запустил бота
    """
    body = await request.body()

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_max_signature(body, signature):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("update_type")
    logger.info(f"MAX webhook event: {event_type}")

    if event_type == "message_created":
        message = event.get("message", {})
        user_id = message.get("from_id") or message.get("sender", {}).get("user_id")
        text = message.get("text", "").strip()

        if not user_id:
            return {"status": "ok"}

        if text.startswith("/start"):
            parts = text.split()
            param = parts[1] if len(parts) > 1 else ""
            await _handle_start(user_id, param)
        else:
            await send_max_message(
                user_id=user_id,
                text="Используйте приложение для записи и управления \U0001f447",
                button_text="\U0001f4f1 Открыть приложение",
                button_url=settings.APP_URL,
            )

    elif event_type == "bot_started":
        user_id = event.get("user", {}).get("user_id")
        if user_id:
            await _handle_start(user_id, "")

    return {"status": "ok"}


async def _handle_start(user_id: int, param: str):
    """Обработка /start — открываем Mini-App."""
    if param.startswith("m_"):
        text = "\U0001f484 Открываю страницу мастера..."
        label = "\U0001f4c5 Записаться"
    elif param.startswith("review_"):
        text = "\u2b50 Оцените ваш визит!"
        label = "\u270d\ufe0f Оставить отзыв"
    elif param.startswith("waitlist_confirm_"):
        text = "\U0001f389 Появилось свободное окошко! Подтвердите запись."
        label = "\u2705 Подтвердить"
    else:
        text = (
            "\U0001f44b Добро пожаловать в BookMaster Pro!\n\n"
            "\U0001f4c5 Удобная онлайн-запись к мастерам\n"
            "\U0001f514 Напоминания и баллы лояльности"
        )
        label = "\U0001f4f1 Открыть приложение"

    url = f"{settings.APP_URL}?startParam={param}" if param else settings.APP_URL
    await send_max_message(
        user_id=user_id,
        text=text,
        button_text=label,
        button_url=url,
    )


# ─── Health check ─────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "platform": "max"}
