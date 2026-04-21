"""Time-limited HMAC links for document file download (no Bearer in browser tab)."""

from __future__ import annotations

import hashlib
import hmac
import time
from typing import Final

from src.core.config import get_settings

_VERSION: Final[str] = "v1"


def _secret_bytes() -> bytes:
    return (get_settings().jwt_secret or "change_me").encode("utf-8")


def sign_document_file_link(*, doc_id: str, expires_at_unix: int) -> str:
    msg = f"{_VERSION}:{doc_id}:{expires_at_unix}".encode("utf-8")
    return hmac.new(_secret_bytes(), msg, hashlib.sha256).hexdigest()


def verify_document_file_link(*, doc_id: str, expires_at_unix: int, signature: str) -> bool:
    if expires_at_unix < int(time.time()):
        return False
    expected = sign_document_file_link(doc_id=doc_id, expires_at_unix=expires_at_unix)
    return hmac.compare_digest(expected, signature or "")
