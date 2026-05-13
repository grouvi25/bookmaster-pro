"""
Telegram Bot — минималистичный слой уведомлений.
Единственные задачи:
1. /start [deep_link] → кнопка открытия Mini-App
2. Входящие голосовые → API /ai/voice (если включён ai_client_bot)
3. Webhook от API → отправка push-уведомлений
4. Все остальные сообщения → redirect в Mini-App
Не содержит никакой бизнес-логики.
"""

import asyncio
import logging
import httpx
from typing import Optional

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message, CallbackQuery,
    InlineKeyboardMarkup, InlineKeyboardButton,
    WebAppInfo, BufferedInputFile,
)
from aiogram.filters import CommandStart, Command
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.webhook.aiohttp_server import (
    SimpleRequestHandler, setup_application
)
from aiohttp import web

from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

bot = Bot(token=settings.TG_BOT_TOKEN)
dp = Dispatcher(storage=MemoryStorage())


# ─── Хелпер: кнопка открытия Mini-App ────────────────────────────────
def mini_app_keyboard(
    label: str = "\U0001f4f1 Открыть приложение",
    start_param: str = "",
) -> InlineKeyboardMarkup:
    url = settings.APP_URL
    if start_param:
        url = f"{settings.APP_URL}?startParam={start_param}"
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text=label,
            web_app=WebAppInfo(url=url),
        )
    ]])


# ─── /start ──────────────────────────────────────────────────────────
@dp.message(CommandStart())
async def cmd_start(message: Message):
    """
    Обрабатываем /start с deep_link параметром.
    Форматы параметров:
      m_{slug}              → страница мастера (клиент записывается)
      dashboard             → дашборд мастера
      review_{appt_id}      → форма отзыва
      waitlist_confirm_{id} → подтверждение из waitlist
      payment_result_{id}   → статус оплаты
      billing               → страница биллинга мастера
      ticket_{id}           → конкретный тикет
      rate_support_{id}     → оценка поддержки
    """
    args = message.text.split() if message.text else []
    param = args[1] if len(args) > 1 else ""

    if param.startswith("m_"):
        text = "\U0001f484 Открываю страницу мастера..."
        label = "\U0001f4c5 Записаться"
    elif param == "dashboard":
        text = "\U0001f4ca Открываю дашборд"
        label = "\U0001f4f1 Открыть"
    elif param.startswith("review_"):
        text = "\u2b50 Оцените ваш визит!"
        label = "\u270d\ufe0f Оставить отзыв"
    elif param.startswith("waitlist_confirm_"):
        text = "\U0001f389 Появилось свободное окошко!\nПодтвердите запись."
        label = "\u2705 Подтвердить"
    elif param.startswith("payment_result_"):
        text = "\U0001f4b3 Проверяю статус оплаты..."
        label = "\U0001f4f1 Открыть"
    elif param == "billing" or param == "billing_renew":
        text = "\U0001f4b0 Управление подпиской"
        label = "\U0001f4f1 Открыть"
    elif param.startswith("ticket_"):
        text = "\U0001f4e9 Открываю ваш тикет"
        label = "\U0001f4e9 Тикет поддержки"
    elif param.startswith("rate_support_"):
        text = "\U0001f31f Оцените качество поддержки"
        label = "\u2b50 Оценить"
    else:
        text = (
            "\U0001f44b Добро пожаловать в <b>BookMaster Pro</b>!\n\n"
            "\U0001f4c5 Удобная онлайн-запись к мастерам\n"
            "\U0001f514 Напоминания и баллы лояльности\n"
            "\U0001f916 AI-ассистент для мастеров"
        )
        label = "\U0001f4f1 Открыть приложение"

    await message.answer(
        text,
        parse_mode="HTML",
        reply_markup=mini_app_keyboard(label, param),
    )


# ─── /sa — суперадминка ───────────────────────────────────────────────
@dp.message(Command("sa"))
async def cmd_superadmin(message: Message):
    """
    /sa → открывает Mini-App на странице суперадмина.
    Если user_id не в SUPERADMIN_IDS — команда игнорируется.
    """
    if not message.from_user or message.from_user.id not in settings.superadmin_list:
        return  # молча игнорируем
    await message.answer(
        "\U0001f6e0 Панель суперадмина",
        reply_markup=mini_app_keyboard("\U0001f6e0 Суперадминка", "superadmin"),
    )


# ─── Хелпер: отправка сообщения в API /ai/client-message ──────────────
async def _forward_to_ai_client_bot(
    message: Message, text: str, master_id: Optional[int] = None
) -> Optional[str]:
    """Пересылка сообщения клиента в API для AI-ответа."""
    if not master_id:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.API_URL}/api/v1/ai/client-message",
                json={"master_id": master_id, "message": text},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("response")
    except Exception as e:
        logger.error(f"AI client-message error: {e}")
    return None


async def _get_master_id_for_client(user_id: int) -> Optional[int]:
    """Получить master_id, с которым клиент взаимодействовал последним."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{settings.API_URL}/api/v1/clients/last-master",
                params={"platform_id": str(user_id)},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("master_id")
    except Exception as e:
        logger.error(f"Get last master error: {e}")
    return None


# ─── Голосовые сообщения клиентов ────────────────────────────────────
@dp.message(F.voice)
async def handle_voice(message: Message):
    """
    Клиент отправил голосовое.
    Скачиваем, транскрибируем через API /ai/transcribe, затем пересылаем в /ai/client-message.
    """
    if not message.from_user:
        return

    master_id = await _get_master_id_for_client(message.from_user.id)
    if not master_id:
        await message.answer(
            "\U0001f3a4 Голосовое получено! Откройте приложение для удобного общения.",
            reply_markup=mini_app_keyboard(),
        )
        return

    await message.answer("\U0001f3a4 Обрабатываю голосовое сообщение...")

    try:
        voice_file = await bot.get_file(message.voice.file_id)
        voice_data = await bot.download_file(voice_file.file_path)
        if voice_data is None:
            raise ValueError("Failed to download voice")

        voice_bytes = voice_data.read()
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.API_URL}/api/v1/ai/transcribe",
                files={"audio": ("voice.ogg", voice_bytes, "audio/ogg")},
            )
            if resp.status_code == 200:
                transcript = resp.json().get("transcript", "")
                if transcript:
                    ai_response = await _forward_to_ai_client_bot(
                        message, transcript, master_id
                    )
                    if ai_response:
                        await message.answer(ai_response)
                        return

        await message.answer(
            "\U0001f3a4 Голосовое получено! Откройте приложение для подробностей.",
            reply_markup=mini_app_keyboard(),
        )
    except Exception as e:
        logger.error(f"Voice handling error: {e}")
        await message.answer(
            "\U0001f3a4 Не удалось обработать голосовое. Попробуйте текстом.",
            reply_markup=mini_app_keyboard(),
        )


# ─── Текстовые сообщения клиентов → AI бот ──────────────────────────
@dp.message(F.text)
async def handle_text(message: Message):
    """Текстовое сообщение клиента → AI клиентский бот или redirect."""
    if not message.from_user or not message.text:
        return

    master_id = await _get_master_id_for_client(message.from_user.id)
    if master_id:
        ai_response = await _forward_to_ai_client_bot(
            message, message.text, master_id
        )
        if ai_response:
            await message.answer(ai_response)
            return

    await message.answer(
        "Используйте приложение для записи и управления \U0001f447",
        reply_markup=mini_app_keyboard(),
    )


# ─── Все остальные сообщения ─────────────────────────────────────────
@dp.message()
async def handle_any(message: Message):
    """Любое неизвестное сообщение → Mini-App."""
    await message.answer(
        "Используйте приложение для записи и управления \U0001f447",
        reply_markup=mini_app_keyboard(),
    )


# ─── Запуск в режиме polling (разработка) ────────────────────────────
async def run_polling():
    logger.info("Starting bot in polling mode...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)


# ─── Запуск в режиме webhook (продакшн) ──────────────────────────────
async def run_webhook():
    """
    Webhook через aiohttp. Telegram шлёт POST на /webhook/tg.
    HTTPS обязателен — настраивается через nginx.
    """
    logger.info(f"Starting bot in webhook mode: {settings.TG_WEBHOOK_URL}")
    await bot.set_webhook(
        url=settings.TG_WEBHOOK_URL,
        secret_token=settings.TG_WEBHOOK_SECRET,
        drop_pending_updates=True,
    )

    app = web.Application()
    handler = SimpleRequestHandler(
        dispatcher=dp,
        bot=bot,
        secret_token=settings.TG_WEBHOOK_SECRET,
    )
    handler.register(app, path="/webhook/tg")
    setup_application(app, dp, bot=bot)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host="0.0.0.0", port=settings.BOT_PORT)
    await site.start()
    logger.info(f"Webhook server started on port {settings.BOT_PORT}")

    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()


# ─── Точка входа ─────────────────────────────────────────────────────
async def main():
    if settings.ENVIRONMENT == "production":
        await run_webhook()
    else:
        await run_polling()


if __name__ == "__main__":
    asyncio.run(main())
