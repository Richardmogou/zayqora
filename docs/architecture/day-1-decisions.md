# Day 1 Architecture Decisions — ZAYQORA

**Author**: Nchifor Richard

## 1. Modular Monolith Backend (`backend/app`)
- Following Section 12.3 of the specification, ZAYQORA starts as a modular FastAPI monolith exposing `/api/v1`.
- Domain boundaries are separated into `models/`, `schemas/`, `permissions/`, `core/`, and `api/v1/`.

## 2. Server-Derived Multi-Tenant Context (`get_tenant`)
- Following Section 17.2, tenant identity is never trusted from client payloads alone.
- `get_tenant` resolves active `RestaurantMember` rows for the authenticated user and validates optional `X-Restaurant-Id` headers against active memberships.
- Unauthorized cross-tenant `X-Restaurant-Id` lookups return `404 Not Found` to prevent tenant enumeration.
- Suspended restaurants (`status == "suspended"`) are automatically blocked (`403`).

## 3. Session Authentication & CSRF Protection
- Passwords are hashed with **Argon2id** (`argon2-cffi`), with constant-time dummy verification (`burn_verification_time`) when an email is unknown.
- Raw 256-bit session tokens are sent in an `HttpOnly`, `SameSite=Lax` cookie (`zayqora_session`), while only their `SHA-256` digest (`token_hash`) is stored in `user_sessions`.
- State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) enforce origin checking against `settings.allowed_origins`.

## 4. Exact Monetary Arithmetic (`app/core/money.py`)
- Prices and totals are converted between `Decimal` and integer minor units (`to_minor` / `from_minor`) using `ROUND_HALF_UP` to prevent floating-point drift.

## 5. Design System & Route Groups (`frontend/`)
- Implements the Section 10.2 palette:
  - **Primary (Deep Navy)**: `#0F1E36` (`hsl(217 56% 14%)`)
  - **Accent (Teal)**: `#0D9488` (`hsl(175 84% 32%)`)
  - **Highlight (Warm Gold)**: `#D9A441` (`hsl(39 67% 55%)`)
- Route groups follow Section 11.2:
  - Public platform: `/`, `/login`
  - Restaurant storefront: `/r/[slug]`
  - Restaurant workspace: `/app/dashboard`
  - Kitchen KDS: `/kitchen/board`
  - VIRELEO Super Admin: `/platform/overview`
