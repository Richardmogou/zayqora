import time
from collections import defaultdict

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


limiter = LoginRateLimiter()
