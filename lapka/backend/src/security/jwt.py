import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from src.core.config import get_settings

settings = get_settings()


class TokenError(Exception):
    pass


def _as_timestamp(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    raise TokenError("Invalid token timestamp")


def create_access_token(subject: str, role: str, clinic_id: str | None = None) -> str:
    """Generate a JWT access token.

    A clinic_id claim is included when the user has selected a clinic context.
    This allows downstream dependencies to automatically scope requests.
    """

    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, object] = {
        "sub": subject,
        "role": role,
        "type": "access",
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }
    if clinic_id:
        # store string form of uuid
        payload["clinic_id"] = clinic_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": subject,
        "type": "refresh",
        "iat": now,
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError("Invalid token") from exc

    now_ts = datetime.now(timezone.utc).timestamp()
    exp_ts = _as_timestamp(payload.get("exp"))
    if exp_ts <= now_ts:
        raise TokenError("Token expired")

    iat_raw = payload.get("iat")
    if iat_raw is not None:
        iat_ts = _as_timestamp(iat_raw)
        # Allow small clock skew.
        if iat_ts > now_ts + 300:
            raise TokenError("Token issued-at is invalid")

    token_type = payload.get("type")
    if token_type not in {"access", "refresh"}:
        raise TokenError("Invalid token type")
    if not payload.get("sub"):
        raise TokenError("Token subject missing")
    if not payload.get("jti"):
        raise TokenError("Token id missing")

    return payload


def extract_user_id_from_token(token: str | None) -> str | None:
    """Lightweight extraction of user_id from a bearer token. Does NOT verify signature."""
    if not token or not token.lower().startswith("bearer "):
        return None
    raw = token[7:].strip()
    try:
        payload = jwt.get_unverified_claims(raw)
        return payload.get("sub")
    except Exception:
        return None
