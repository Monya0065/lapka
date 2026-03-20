from __future__ import annotations

from src.core.config import get_settings
from src.integrations.payments_providers.base import PaymentsProvider
from src.integrations.payments_providers.demo_provider import DemoPaymentsProvider


_PROVIDERS: dict[str, PaymentsProvider] = {
    "demo": DemoPaymentsProvider(),
}


def get_payments_provider() -> PaymentsProvider:
    settings = get_settings()
    provider_key = (settings.payments_provider or "demo").strip().lower()
    return _PROVIDERS.get(provider_key, _PROVIDERS["demo"])
