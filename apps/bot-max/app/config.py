from pydantic_settings import BaseSettings, SettingsConfigDict


class MaxSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../../.env", case_sensitive=False, extra="ignore"
    )

    MAX_BOT_TOKEN: str = ""
    MAX_WEBHOOK_SECRET: str = ""
    APP_URL: str = "http://localhost:5173"
    BOT_MAX_PORT: int = 8082
    ENVIRONMENT: str = "development"


settings = MaxSettings()
