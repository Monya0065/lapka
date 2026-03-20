from __future__ import annotations

import re
from typing import Any

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")
_SCRIPT_TAG_RE = re.compile(r"<\s*/?\s*script[^>]*>", flags=re.IGNORECASE)
_EVENT_HANDLER_RE = re.compile(r"\son[a-z]+\s*=", flags=re.IGNORECASE)
_JS_SCHEME_RE = re.compile(r"javascript\s*:", flags=re.IGNORECASE)


def sanitize_text(value: str | None, *, max_len: int = 5000) -> str:
    if not value:
        return ""
    cleaned = _CONTROL_CHARS_RE.sub("", value)
    cleaned = _SCRIPT_TAG_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_RE.sub(" ", cleaned)
    cleaned = _JS_SCHEME_RE.sub("", cleaned)
    cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = cleaned.strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[:max_len]
    return cleaned


def sanitize_list(values: list[str] | None, *, max_items: int = 64, max_len: int = 200) -> list[str]:
    if not values:
        return []
    cleaned: list[str] = []
    for value in values[:max_items]:
        item = sanitize_text(value, max_len=max_len)
        if item:
            cleaned.append(item)
    return cleaned


def sanitize_payload(payload: Any, *, max_string_len: int = 5000, max_depth: int = 8) -> Any:
    """Recursively sanitize JSON-like payloads to reduce XSS/input poisoning risk."""
    if max_depth <= 0:
        return payload

    if isinstance(payload, str):
        return sanitize_text(payload, max_len=max_string_len)

    if isinstance(payload, list):
        return [sanitize_payload(item, max_string_len=max_string_len, max_depth=max_depth - 1) for item in payload]

    if isinstance(payload, dict):
        sanitized: dict[Any, Any] = {}
        for key, value in payload.items():
            safe_key = sanitize_text(str(key), max_len=128)
            sanitized[safe_key] = sanitize_payload(value, max_string_len=max_string_len, max_depth=max_depth - 1)
        return sanitized

    return payload
