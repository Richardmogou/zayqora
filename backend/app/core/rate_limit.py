import time
from collections import defaultdict

from fastapi import HTTPException, Request

from app.core.config import settings


class LoginRateLimiter:
    def __init__(self) -> None:
        self._failures: dict[str, list[float]] = defaultdict(list)

    def _prune(self, key: str, now: float) -> list[float]:
        cutoff = now - settings.login_window_seconds
        kept = [t for t in self._failures[key] if t > cutoff]
        if kept:
            self._failures[key] = kept
        else:
            self._failures.pop(key, None)
        return kept

    def blocked(self, key: str) -> bool:
        return len(self._prune(key, time.monotonic())) >= settings.login_max_attempts

    def record_failure(self, key: str) -> None:
        now = time.monotonic()
        self._prune(key, now)
        self._failures[key].append(now)

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)

    def clear(self) -> None:
        self._failures.clear()


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.monotonic()
        cutoff = now - window_seconds
        kept = [t for t in self._hits[key] if t > cutoff]
        if len(kept) >= max_requests:
            self._hits[key] = kept
            return False
        kept.append(now)
        self._hits[key] = kept
        return True

    def clear(self) -> None:
        self._hits.clear()


limiter = LoginRateLimiter()
public_limiter = SlidingWindowRateLimiter()


def enforce_rate_limit(
    request: Request,
    bucket: str,
    *,
    max_requests: int | None = None,
    window_seconds: int | None = None,
) -> None:
    ip = request.client.host if request.client else "unknown"
    limit = settings.public_rate_limit_max_requests if max_requests is None else max_requests
    window = settings.public_rate_limit_window_seconds if window_seconds is None else window_seconds
    if not public_limiter.allow(f"{bucket}|{ip}", limit, window):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(window)},
        )
