"""
AI providers — абстракция LLM и embedding провайдеров.
Поддержка: OpenAI, YandexGPT (fallback).
"""

import logging
from typing import List, AsyncIterator
from abc import ABC, abstractmethod

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    last_usage_tokens: int = 0  # Real token count from last API call (0 = unknown)

    @abstractmethod
    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        ...

    @abstractmethod
    async def chat_stream(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncIterator[str]:
        ...


class EmbedProvider(ABC):
    @abstractmethod
    async def embed(self, text: str) -> List[float]:
        ...

    @abstractmethod
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        ...


class OpenAIProvider(AIProvider):
    def __init__(self):
        import openai

        kwargs: dict = {"api_key": settings.OPENAI_API_KEY}

        # Поддержка Railway прокси (ТЗ Архитектура):
        # Если AI_PROXY_URL задан — все запросы идут через прокси-сервер,
        # обходя блокировку OpenAI API из российских IP.
        if settings.AI_PROXY_URL:
            kwargs["base_url"] = settings.AI_PROXY_URL
            if settings.AI_PROXY_SECRET:
                kwargs["default_headers"] = {
                    "X-Proxy-Secret": settings.AI_PROXY_SECRET,
                }

        self.client = openai.AsyncOpenAI(**kwargs)
        self.model = settings.OPENAI_MODEL_DEFAULT or "gpt-4o-mini"
        self.last_usage_tokens: int = 0  # Total tokens from last request

    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        # Сохраняем реальное использование токенов из API
        if response.usage:
            self.last_usage_tokens = response.usage.total_tokens
        else:
            self.last_usage_tokens = 0
        return response.choices[0].message.content or ""

    async def chat_stream(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            stream_options={"include_usage": True},
        )
        self.last_usage_tokens = 0
        async for chunk in stream:
            if chunk.usage:
                self.last_usage_tokens = chunk.usage.total_tokens
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.ogg") -> str:
        ...


class OpenAISTTProvider(STTProvider):
    def __init__(self):
        import openai

        kwargs: dict = {"api_key": settings.OPENAI_API_KEY}
        if settings.AI_PROXY_URL:
            kwargs["base_url"] = settings.AI_PROXY_URL
            if settings.AI_PROXY_SECRET:
                kwargs["default_headers"] = {"X-Proxy-Secret": settings.AI_PROXY_SECRET}

        self.client = openai.AsyncOpenAI(**kwargs)

    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.ogg") -> str:
        import io
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        response = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="ru",
        )
        return response.text


class DummySTTProvider(STTProvider):
    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.ogg") -> str:
        return "[STT] Распознавание речи доступно после настройки OPENAI_API_KEY."


class OpenAIEmbedProvider(EmbedProvider):
    def __init__(self):
        import openai

        kwargs: dict = {"api_key": settings.OPENAI_API_KEY}
        if settings.AI_PROXY_URL:
            kwargs["base_url"] = settings.AI_PROXY_URL
            if settings.AI_PROXY_SECRET:
                kwargs["default_headers"] = {"X-Proxy-Secret": settings.AI_PROXY_SECRET}

        self.client = openai.AsyncOpenAI(**kwargs)

    async def embed(self, text: str) -> List[float]:
        response = await self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        response = await self.client.embeddings.create(
            model="text-embedding-3-small",
            input=texts,
        )
        return [item.embedding for item in response.data]


class YandexGPTProvider(AIProvider):
    """Fallback — YandexGPT API."""

    def __init__(self):
        import httpx
        self.api_key = settings.YANDEX_GPT_API_KEY
        self.folder_id = settings.YANDEX_FOLDER_ID
        self.client = httpx.AsyncClient(timeout=60)

    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        ya_messages = []
        for m in messages:
            ya_messages.append({"role": m["role"], "text": m["content"]})

        response = await self.client.post(
            "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
            headers={
                "Authorization": f"Api-Key {self.api_key}",
                "x-folder-id": self.folder_id,
            },
            json={
                "modelUri": f"gpt://{self.folder_id}/yandexgpt/latest",
                "completionOptions": {
                    "stream": False,
                    "temperature": temperature,
                    "maxTokens": str(max_tokens),
                },
                "messages": ya_messages,
            },
        )
        data = response.json()
        return data.get("result", {}).get("alternatives", [{}])[0].get("message", {}).get("text", "")

    async def chat_stream(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncIterator[str]:
        # YandexGPT stream requires different endpoint
        result = await self.chat(messages, temperature, max_tokens)
        yield result


class FallbackProvider(AIProvider):
    """Runtime fallback: primary → secondary on error."""

    def __init__(self, primary: AIProvider, secondary: AIProvider):
        self._primary = primary
        self._secondary = secondary

    async def chat(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        try:
            return await self._primary.chat(messages, temperature, max_tokens)
        except Exception as e:
            logger.warning(f"Primary AI failed: {e}, falling back to secondary")
            return await self._secondary.chat(messages, temperature, max_tokens)

    async def chat_stream(
        self,
        messages: List[dict],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> AsyncIterator[str]:
        try:
            chunks: List[str] = []
            async for chunk in self._primary.chat_stream(messages, temperature, max_tokens):
                chunks.append(chunk)
                yield chunk
            if not chunks:
                raise ValueError("Empty response from primary")
        except Exception as e:
            if chunks:
                return
            logger.warning(f"Primary AI stream failed: {e}, falling back to secondary")
            async for chunk in self._secondary.chat_stream(messages, temperature, max_tokens):
                yield chunk


class DummyProvider(AIProvider):
    """Dev-mode: без реального AI."""

    async def chat(self, messages, temperature=0.7, max_tokens=1000) -> str:
        return "[AI ответ] Функция AI доступна после настройки OPENAI_API_KEY."

    async def chat_stream(self, messages, temperature=0.7, max_tokens=1000):
        yield "[AI ответ] Функция AI доступна после настройки OPENAI_API_KEY."


class DummyEmbedProvider(EmbedProvider):
    async def embed(self, text: str) -> List[float]:
        return [0.0] * 1536

    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [[0.0] * 1536 for _ in texts]


def get_ai_provider() -> AIProvider:
    """Фабрика AI провайдера с runtime fallback (ТЗ 6.1)."""
    provider = getattr(settings, "AI_DEFAULT_PROVIDER", "openai")

    openai_ok = bool(settings.OPENAI_API_KEY)
    yandex_ok = bool(
        getattr(settings, "YANDEX_GPT_API_KEY", None)
        and getattr(settings, "YANDEX_FOLDER_ID", None)
    )

    primary: AIProvider | None = None
    secondary: AIProvider | None = None

    if provider == "yandexgpt":
        if yandex_ok:
            primary = YandexGPTProvider()
        if openai_ok:
            secondary = OpenAIProvider()
    else:
        if openai_ok:
            primary = OpenAIProvider()
        if yandex_ok:
            secondary = YandexGPTProvider()

    if primary and secondary:
        return FallbackProvider(primary, secondary)
    if primary:
        return primary
    if secondary:
        return secondary

    logger.info("No AI provider configured, using DummyProvider")
    return DummyProvider()


def get_embed_provider() -> EmbedProvider:
    if settings.OPENAI_API_KEY:
        try:
            return OpenAIEmbedProvider()
        except Exception:
            pass
    return DummyEmbedProvider()


def get_stt_provider() -> STTProvider:
    if settings.OPENAI_API_KEY:
        try:
            return OpenAISTTProvider()
        except Exception as e:
            logger.warning(f"OpenAI STT init failed: {e}")
    return DummySTTProvider()


def invalidate_provider_cache() -> None:
    """Сбросить кэш AI-провайдеров.

    Сейчас get_ai_provider/get_embed_provider/get_stt_provider создают
    инстансы по запросу и не кэшируются, так что эта функция — no-op,
    оставлена как точка интеграции для суперадминки (ТЗ 8.5: сменить
    AI-провайдер без деплоя).

    Если в будущем добавится lru_cache, нужно вызвать .cache_clear() здесь.
    """
    return None
