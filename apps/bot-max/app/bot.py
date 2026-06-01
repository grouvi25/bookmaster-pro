"""
MAX Bot — обработчик webhook от MAX (max.ru).
MAX Bot API: https://dev.max.ru/docs-api

Архитектура та же, что у TG-бота: никакой бизнес-логики,
только redirect в Mini-App + push уведомления.

Ключевые особенности MAX Bot API (отличия от Telegram):
- Базовый URL без версии: https://botapi.max.ru (НЕ /v1).
- Авторизация заголовком `Authorization: <token>` (без "Bearer").
- Отправка сообщения: POST /messages?user_id=<id>, тело — текст + attachments.
- Кнопка-ссылка: attachment типа "inline_keyboard" с payload.buttons.
- Входящее событие (Update): update_type + message.{sender,recipient,body}.
- Подпись webhook: общий секрет в заголовке `X-Max-Bot-Api-Secret`
  (это НЕ HMAC — просто сравнение значения, заданного при подписке).
"""

import logging
import hmac
import json
from typing import Optional

from fastapi import FastAPI, Request, HTTPException
import httpx

from app.config import settings

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(docs_url=None, redoc_url=None)

# База без /v1 — у MAX нет версии в пути.
MAX_API = settings.MAX_API_BASE.rstrip("/")


def _auth_headers() -> dict:
    return {
        "Authorization": settings.MAX_BOT_TOKEN,
        "Content-Type": "application/json",
    }


# ─── Хелпер: AI клиентский бот ───────────────────────────────────────
async def _get_master_id_for_user(user_id: int) -> Optional[int]:
    """Получить master_id, с которым пользователь MAX взаимодействовал последним."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.API_URL}/api/v1/clients/last-master",
                params={"platform_id": str(user_id)},
            )
            if resp.status_code == 200:
                return resp.json().get("master_id")
    except Exception as e:
        logger.error(f"Get last master error (MAX): {e}")
    return None


async def _forward_to_ai_client_bot(user_id: int, text: str, master_id: int) -> Optional[str]:
    """Переслать сообщение пользователя MAX в AI клиентский бот."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.API_URL}/api/v1/ai/client-message",
                json={"master_id": master_id, "message": text},
            )
            if resp.status_code == 200:
                return resp.json().get("response")
    except Exception as e:
        logger.error(f"AI client-message error (MAX): {e}")
    return None


# ─── Верификация секрета MAX ─────────────────────────────────────────
def verify_max_secret(request: Request) -> bool:
    """
    Проверяем секрет вебхука от MAX.
    MAX присылает заданный при подписке секрет в заголовке
    `X-Max-Bot-Api-Secret` (см. POST /subscriptions). Это НЕ подпись/HMAC —
    нужно просто сравнить значение.

    - Если секрет не задан и ENVIRONMENT=production — отклоняем (небезопасно).
    - Если секрет не задан в dev — пропускаем для удобства тестирования.
    """
    if not settings.MAX_WEBHOOK_SECRET:
        if settings.ENVIRONMENT == "production":
            logger.error(
                "MAX_WEBHOOK_SECRET not configured in production — rejecting webhook"
            )
            return False
        return True

    received = request.headers.get("X-Max-Bot-Api-Secret", "")
    if not received:
        return False
    return hmac.compare_digest(received, settings.MAX_WEBHOOK_SECRET)


# ─── Отправка сообщений ───────────────────────────────────────────────
async def send_max_message(
    user_id: int,
    text: str,
    button_text: Optional[str] = None,
    button_url: Optional[str] = None,
    as_app: bool = False,
    app_payload: Optional[str] = None,
) -> bool:
    """Отправить сообщение пользователю MAX (POST /messages?user_id=...)."""
    payload: dict = {"text": text[:4000]}

    if button_text:
        # Кнопка open_app запускает полноценное мини-приложение с контекстом
        # window.WebApp (initData, пользователь). Кнопка link открывает
        # обычный webview без контекста — оставлена как fallback.
        if as_app and settings.MAX_BOT_USERNAME:
            button: dict = {
                "type": "open_app",
                "text": button_text,
                "web_app": settings.MAX_BOT_USERNAME,
            }
            if app_payload:
                button["payload"] = app_payload
        else:
            button = {
                "type": "link",
                "text": button_text,
                "url": button_url or settings.APP_URL,
            }
        payload["attachments"] = [
            {
                "type": "inline_keyboard",
                "payload": {"buttons": [[button]]},
            }
        ]

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{MAX_API}/messages",
                params={"user_id": user_id},
                headers=_auth_headers(),
                json=payload,
            )
            if resp.status_code not in (200, 201):
                logger.error(
                    f"MAX send failed: {resp.status_code} {resp.text[:300]}"
                )
                return False
            return True
        except Exception as e:
            logger.error(f"MAX send error: {e}")
            return False


# ─── Webhook endpoint ─────────────────────────────────────────────────
@app.post("/webhook/max")
async def max_webhook(request: Request):
    """
    Обрабатываем события (Update) от MAX.
    Типы событий (update_type):
    - message_created → новое сообщение от пользователя
    - bot_started     → пользователь запустил бота
    - message_callback → нажатие кнопки (не используется — кнопки ведут на ссылку)
    """
    if not verify_max_secret(request):
        raise HTTPException(status_code=403, detail="Invalid secret")

    body = await request.body()
    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = event.get("update_type")
    logger.info(f"MAX webhook event: {event_type}")

    if event_type == "message_created":
        message = event.get("message", {}) or {}
        sender = message.get("sender") or {}
        user_id = sender.get("user_id")
        body_obj = message.get("body") or {}
        text = (body_obj.get("text") or "").strip()

        if not user_id:
            return {"status": "ok"}

        if text.startswith("/start"):
            parts = text.split()
            param = parts[1] if len(parts) > 1 else ""
            await _handle_start(user_id, param)
        else:
            # Пересылаем текст в AI клиентский бот (паритет с TG ботом)
            master_id = await _get_master_id_for_user(user_id)
            if master_id and text:
                ai_response = await _forward_to_ai_client_bot(user_id, text, master_id)
                if ai_response:
                    await send_max_message(user_id=user_id, text=ai_response)
                    return {"status": "ok"}

            await send_max_message(
                user_id=user_id,
                text="Используйте приложение для записи и управления \U0001f447",
                button_text="\U0001f4f1 Открыть приложение",
                button_url=settings.APP_URL,
                as_app=True,
            )

    elif event_type == "bot_started":
        # У bot_started поля на верхнем уровне: user, chat_id, payload.
        user = event.get("user") or {}
        user_id = user.get("user_id")
        param = event.get("payload") or ""
        if user_id:
            await _handle_start(user_id, param)

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
        as_app=True,
        app_payload=param or None,
    )


# ─── Health check ─────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "platform": "max"}
