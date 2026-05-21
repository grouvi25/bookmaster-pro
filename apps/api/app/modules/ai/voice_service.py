"""
TTS (Text-to-Speech) — синтез речи.
Провайдеры: Yandex SpeechKit (основной), OpenAI TTS (fallback).
По ТЗ: опциональная фича в рамках голосового модуля.
"""

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """Синтез речи из текста."""

    async def synthesize(
        self,
        text: str,
        voice: str = "marina",
        speed: float = 1.0,
    ) -> Optional[bytes]:
        """
        Синтезирует речь из текста.
        Возвращает байты MP3/OGG или None при ошибке.
        """
        if not text or not text.strip():
            return None

        # Обрезка длинных текстов
        if len(text) > 5000:
            text = text[:5000] + "..."

        # Yandex SpeechKit TTS — основной
        if settings.YANDEX_TTS_API_KEY:
            try:
                return await self._speechkit_synthesize(text, voice, speed)
            except Exception as e:
                logger.warning(f"SpeechKit TTS failed: {e}")

        # Fallback — OpenAI TTS
        if settings.OPENAI_API_KEY:
            try:
                return await self._openai_tts(text)
            except Exception as e:
                logger.error(f"OpenAI TTS failed: {e}")

        logger.error("All TTS providers unavailable")
        return None

    async def _speechkit_synthesize(
        self, text: str, voice: str, speed: float
    ) -> bytes:
        """Синтез через Yandex SpeechKit."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize",
                headers={
                    "Authorization": f"Api-Key {settings.YANDEX_TTS_API_KEY}",
                },
                data={
                    "text": text,
                    "lang": "ru-RU",
                    "voice": voice,
                    "speed": str(speed),
                    "format": "mp3",
                    "sampleRateHertz": "48000",
                },
            )
            response.raise_for_status()
            return response.content

    async def _openai_tts(self, text: str) -> bytes:
        """Синтез через OpenAI TTS."""
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=text,
            response_format="mp3",
        )
        return response.content
