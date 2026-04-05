from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Lapka API"
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000

    database_url: str = "postgresql+asyncpg://lapka:lapka@db:5432/lapka"
    sync_database_url: str = "postgresql://lapka:lapka@db:5432/lapka"

    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    pharmacy_provider: str = "demo"
    pharmacy_availability_rate_limit: int = 40
    pharmacy_availability_window_sec: int = 60
    payments_provider: str = "demo"
    labs_provider: str = "demo"
    redis_url: str | None = None

    # Notifications delivery (optional MVP integration)
    # If not configured, delivery falls back to a safe audit-only behavior.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True

    sms_gateway_url: str | None = None
    sms_gateway_api_key: str | None = None
    sms_from: str | None = None

    cors_origins: str = ""
    sentry_dsn: str | None = None
    sentry_environment: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
