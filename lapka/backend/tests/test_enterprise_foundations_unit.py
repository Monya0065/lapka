from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from src.security.deps import require_current_legal_ack


@pytest.mark.asyncio
async def test_require_current_legal_ack_skips_when_disabled():
    async def fake_scalar(*_args, **_kwargs):
        return None

    db = SimpleNamespace(scalar=fake_scalar)
    user = SimpleNamespace(id="user-1")

    with patch("src.security.deps.get_settings", return_value=SimpleNamespace(legal_enforcement_enabled=False)):
        assert await require_current_legal_ack(current_user=user, db=db) is None


@pytest.mark.asyncio
async def test_require_current_legal_ack_raises_when_missing_required_doc():
    async def fake_scalar(*_args, **_kwargs):
        return None

    db = SimpleNamespace(scalar=fake_scalar)
    user = SimpleNamespace(id="user-2")
    settings = SimpleNamespace(
        legal_enforcement_enabled=True,
        legal_privacy_policy_version="2024-01-01",
        legal_terms_version="2024-01-01",
        legal_consent_version="2024-01-01",
    )

    with patch("src.security.deps.get_settings", return_value=settings):
        with pytest.raises(HTTPException) as exc:
            await require_current_legal_ack(current_user=user, db=db)
    assert exc.value.status_code == 428
    assert exc.value.detail["code"] == "LEGAL_ACK_REQUIRED"
