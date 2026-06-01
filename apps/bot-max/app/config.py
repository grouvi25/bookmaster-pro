from pydantic_settings import BaseSettings, SettingsConfigDict


class MaxSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env", case_sensitive=False, extra="ignore"
    )

    MAX_BOT_TOKEN: str = ""
    MAX_WEBHOOK_SECRET: str = ""
    MAX_API_BASE: str = "https://botapi.max.ru"
    MAX_BOT_USERNAME: str = ""
    APP_URL: str = "http://localhost:5173"
    API_URL: str = "http://localhost:8000"
    BOT_MAX_PORT: int = 8082
    ENVIRONMENT: str = "development"


settings = MaxSettings()
