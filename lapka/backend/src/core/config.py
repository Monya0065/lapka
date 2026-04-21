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
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_recycle: int = 1800

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
    celery_broker_url: str | None = None
    celery_result_backend: str | None = None

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
    log_level: str = "INFO"
    per_user_rate_limit: int = 200
    per_user_rate_window_sec: int = 60

    # AI provider routing
    llm_provider: str = "noop"
    llm_fallback_provider: str = "noop"
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    # Free / low-cost LLM paths: groq.com (API key) or local Ollama (base URL)
    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    ollama_base_url: str = ""
    ollama_model: str = "llama3.2"
    # YandexGPT (Yandex Cloud Foundation Models) — типичный вариант для РФ
    yandex_cloud_api_key: str | None = None
    yandex_cloud_folder_id: str | None = None
    yandex_cloud_iam_token: str | None = None
    yandexgpt_model: str = "yandexgpt-lite/latest"

    # Yandex Vision (OCR, image analysis)
    yandex_vision_enabled: bool = False
    yandex_vision_folder_id: str | None = None

    # Yandex SpeechKit (STT/TTS)
    yandex_speechkit_enabled: bool = False
    yandex_speechkit_folder_id: str | None = None

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

    # VPN MVP payment/webhook settings
    vpn_yookassa_webhook_secret: str | None = None
    vpn_cloudpayments_webhook_secret: str | None = None
    vpn_tbank_webhook_secret: str | None = None
    vpn_default_device_limit: int = 5

    # WireGuard client bundle (optional; required in production for /vpn/profile/.../wireguard.conf)
    vpn_wg_server_public_key: str | None = None
    vpn_wg_endpoint: str | None = None
    vpn_wg_allowed_ips: str = "0.0.0.0/0, ::/0"
    vpn_wg_dns: str = "1.1.1.1"

    # Optional node agent: Bearer auth + POST notify when client keys are issued
    vpn_node_agent_bearer_token: str | None = None
    vpn_node_agent_notify_url: str | None = None
    # Comma-separated CIDRs; if set, only these networks may call /vpn/internal/* (after Bearer check).
    vpn_node_agent_allowed_cidrs: str | None = None
    # If the TCP peer is in these CIDRs (e.g. your ingress), use the leftmost X-Forwarded-For for allowlist checks.
    vpn_node_agent_trusted_proxy_cidrs: str | None = None

    # Enterprise identity foundation (Phase 2)
    sso_enabled: bool = False
    sso_provider: str | None = None
    sso_saml_metadata_url: str | None = None
    sso_saml_entity_id: str | None = None
    sso_saml_acs_url: str | None = None
    sso_oidc_issuer: str | None = None
    sso_oidc_client_id: str | None = None
    sso_oidc_client_secret: str | None = None
    scim_enabled: bool = False
    scim_bearer_token: str | None = None

    legal_enforcement_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
