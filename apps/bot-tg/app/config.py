from pydantic_settings import BaseSettings, SettingsConfigDict


class BotSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env",
        case_sensitive=False,
        extra="ignore",
    )

    TG_BOT_TOKEN: str
    TG_WEBHOOK_URL: str = ""
    TG_WEBHOOK_SECRET: str = "secret"
    APP_URL: str = "http://localhost:5173"
    API_URL: str = "http://localhost:8000"
    BOT_PORT: int = 8081
    ENVIRONMENT: str = "development"


settings = BotSettings()
