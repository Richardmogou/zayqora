import hashlib
import hmac
import secrets
import time

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

_ph = PasswordHasher()
_DUMMY_HASH = _ph.hash(secrets.token_urlsafe(16))


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def burn_verification_time(password: str) -> None:
    verify_password(password, _DUMMY_HASH)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def sign_webhook_payload(secret: str, timestamp: str, raw_body: bytes) -> str:
    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
    digest = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_webhook_signature(
    secret: str,
    signature_header: str | None,
    timestamp_header: str | None,
    raw_body: bytes,
    *,
    tolerance_seconds: int = 300,
    now_ts: int | None = None,
) -> bool:
    if not secret or not signature_header or not timestamp_header:
        return False
    try:
        ts = int(timestamp_header.strip())
    except ValueError:
        return False
    current = int(time.time()) if now_ts is None else now_ts
    if abs(current - ts) > tolerance_seconds:
        return False

    provided = signature_header.strip()
    if provided.startswith("sha256="):
        provided = provided[7:]
    if len(provided) != 64:
        return False
    expected = sign_webhook_payload(secret, str(ts), raw_body)[7:]
    return hmac.compare_digest(expected, provided)
