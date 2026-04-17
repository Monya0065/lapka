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

    # AI provider routing
    llm_provider: str = "noop"
    llm_fallback_provider: str = "noop"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    legal_privacy_policy_version: str = "2024-01-01"
    legal_terms_version: str = "2024-01-01"
    legal_consent_version: str = "2024-01-01"
    legal_dpa_version: str = "2024-01-01"
    legal_contact_email: str = "privacy@lapka.local"

    # MVP: lost-pet boost (Stripe Checkout)
    app_public_url: str = "http://localhost:3000"
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    stripe_price_lost_pet_boost_id: str | None = None
    mvp_admin_notify_email: str | None = None
    mvp_telegram_bot_token: str | None = None
    mvp_telegram_chat_id: str | None = None
    mvp_invite_code: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
