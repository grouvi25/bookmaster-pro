"""
Конфигурация приложения через Pydantic Settings.
Все переменные читаются из .env файла.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # === Платформы ===
    TG_BOT_TOKEN: str = ""
    TG_WEBHOOK_URL: str = ""
    TG_WEBHOOK_SECRET: str = ""
    MAX_BOT_TOKEN: str = ""
    MAX_WEBHOOK_URL: str = ""

    # === Суперадмин ===
    SUPERADMIN_IDS: str = ""

    @property
    def superadmin_list(self) -> List[str]:
        return [s.strip() for s in self.SUPERADMIN_IDS.split(",") if s.strip()]

    # === База данных ===
    DATABASE_URL: str = "postgresql+asyncpg://bookmaster:devpassword@localhost:5432/bookmaster"
    DATABASE_URL_SYNC: str = "postgresql://bookmaster:devpassword@localhost:5432/bookmaster"
    REDIS_URL: str = "redis://localhost:6379/0"

    # === AI ===
    AI_DEFAULT_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL_DEFAULT: str = "gpt-4o-mini"
    OPENAI_MODEL_FAST: str = "gpt-4o-mini"
    OPENAI_MODEL_SMART: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-ada-002"
    OPENAI_WHISPER_MODEL: str = "whisper-1"
    YANDEX_GPT_API_KEY: str = ""
    YANDEX_GPT_FOLDER_ID: str = ""
    YANDEX_FOLDER_ID: str = ""
    YANDEX_GPT_MODEL: str = "yandexgpt-pro"
    CLAUDE_API_KEY: str = ""
    YANDEX_STT_API_KEY: str = ""
    YANDEX_TTS_API_KEY: str = ""

    # === Платежи ===
    YOOKASSA_SHOP_ID: str = ""
    YOOKASSA_SECRET_KEY: str = ""
    YOOKASSA_WEBHOOK_URL: str = ""
    YOOKASSA_AGENT_ID: str = ""

    # === Хранилище S3 ===
    S3_ENDPOINT_URL: str = "https://storage.yandexcloud.net"
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "bookmaster-files"
    S3_PUBLIC_URL: str = "https://storage.yandexcloud.net/bookmaster-files"

    # === Приложение ===
    APP_URL: str = "https://app.bookmaster.pro"
    MARKETPLACE_URL: str = "https://bookmaster.pro"
    API_URL: str = "https://api.bookmaster.pro"
    SECRET_KEY: str = "change-me-to-64-random-characters"
    ALGORITHM: str = "HS256"

    # === Бронирование ===
    TIMEZONE: str = "Europe/Moscow"
    MAX_ADVANCE_BOOKING_DAYS: int = 30
    SLOT_RESERVE_MINUTES: int = 5
    WAITLIST_CONFIRM_MINUTES: int = 30
    REMINDER_HOURS_BEFORE: int = 2

    # === Мониторинг ===
    SENTRY_DSN: str = ""
    ENVIRONMENT: str = "development"
    DEBUG: bool = True


settings = Settings()
