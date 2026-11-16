from urllib.parse import urlsplit

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


def _origin_of(value: str | None) -> str | None:
    if not value:
        return None
    parts = urlsplit(value)
    return f"{parts.scheme}://{parts.netloc}" if parts.scheme and parts.netloc else None


@app.middleware("http")
async def reject_foreign_origins(request: Request, call_next):
    """Protection CSRF : une requête qui modifie des données doit venir d'une origine autorisée.
    Sans en-tête Origin/Referer (curl, webhooks, tests), la requête est acceptée ; le cookie SameSite=Lax
    n'est de toute façon pas envoyé lors d'une requête POST venant d'un autre site."""
    if request.method in _UNSAFE:
        origin = _origin_of(request.headers.get("origin")) or _origin_of(request.headers.get("referer"))
        if origin is not None and origin not in settings.allowed_origins:
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
    return await call_next(request)


app.include_router(api_router)
