from urllib.parse import urlsplit
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(title="ZAYQORA API", version="0.1.0")

app.add_middleware(
    CORSMiddleware, allow_origins=settings.allowed_origins,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

_UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
_DOCS_PATHS = {"/docs", "/redoc", "/openapi.json"}


def _origin_of(value: str | None) -> str | None:
    if not value:
        return None
    parts = urlsplit(value)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None


@app.middleware("http")
async def security_and_correlation_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    if request.method in _UNSAFE:
        origin = _origin_of(request.headers.get("origin")) or _origin_of(request.headers.get("referer"))
        if origin is not None and origin not in settings.allowed_origins:
            response = JSONResponse({"detail": "Origin not allowed"}, status_code=403)
            response.headers["X-Request-Id"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
            return response

    response = await call_next(request)
    response.headers["X-Request-Id"] = request_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
    if request.url.path not in _DOCS_PATHS:
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
    return response


app.include_router(api_router)
