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
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_MODEL_DEFAULT or "gpt-4o-mini"

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
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.ogg") -> str:
        ...


class OpenAISTTProvider(STTProvider):
    def __init__(self):
        import openai
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

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
    """Фабрика AI провайдера с fallback."""
    provider = getattr(settings, "AI_DEFAULT_PROVIDER", "openai")
    if provider == "openai" and settings.OPENAI_API_KEY:
        try:
            return OpenAIProvider()
        except Exception as e:
            logger.warning(f"OpenAI init failed: {e}, trying YandexGPT")

    if provider == "yandexgpt" or (
        settings.YANDEX_GPT_API_KEY and settings.YANDEX_FOLDER_ID
    ):
        try:
            return YandexGPTProvider()
        except Exception as e:
            logger.warning(f"YandexGPT init failed: {e}")

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
