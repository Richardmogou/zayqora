# Day 4 — Cart, Checkout & Orders

**Date**: 2025-05-01
**Author**: Nchifor Richard

## Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `Order` + `OrderLine` models with UUID PKs, minor-unit amounts, status enum | ✅ |
| 2 | Alembic migrations `0003_day4_orders`, `0004_day4b_orders_hardening`, and `0005_day4_order_integrity` — order tables, payment status, and restaurant-scoped idempotency | ✅ |
| 3 | `POST /public/orders?slug=` — creates order from storefront, delivery fee €4 flat | ✅ |
| 4 | `GET /public/orders/{id}?slug=` — storefront can fetch its own order (confirmation/tracking) | ✅ |
| 5 | `GET /orders` — workspace list, filterable by status & service_mode, tenant-scoped | ✅ |
| 6 | `GET /orders/{id}` — workspace detail with lines | ✅ |
| 7 | `PATCH /orders/{id}/status` — owner/manager/cashier only, validates status enum | ✅ |
| 8 | Cross-tenant isolation: orders from other restaurants return 404 | ✅ |
| 9 | Role guards: waiter cannot update status, kitchen can view | ✅ |
| 10 | Modifier snapshot stored as JSONB on order_lines | ✅ |
| 11 | Zustand cart store (`lib/cart-store.ts`) — persisted to localStorage, scoped per slug | ✅ |
| 12 | `DishCustomizer` writes to cart store on "Add to cart" | ✅ |
| 13 | Cart page (`/r/[slug]/cart`) reads from store — qty controls, remove, delivery mode | ✅ |
| 14 | Checkout page (`/r/[slug]/checkout`) reads store, calls `POST /public/orders`, clears cart on success | ✅ |
| 15 | Order confirmation (`/r/[slug]/order-confirmation/[id]`) — Server Component, real API data, progress stepper | ✅ |
| 16 | Order tracking (`/r/[slug]/order-tracking/[id]`) — Server Component, real status, animated progress bar | ✅ |
| 17 | Workspace orders list (`/orders`) — Server Component, real API data, replaces hardcoded demo | ✅ |
| 18 | Workspace order detail (`/orders/[id]`) — Server Component, real data + `OrderStatusActions` client component | ✅ |
| 19 | 26 day-4 backend tests pass (`python -m pytest tests/test_orders.py -q`); full suite not rerun | ✅ |

## Architecture decisions

- **`POST /public/orders`** is unauthenticated — any visitor can place an order. The restaurant is resolved from the `slug` query param, validated as active.
- **`GET /public/orders/{id}`** is also unauthenticated — the order ID (UUID) acts as a bearer token for the confirmation/tracking pages. No PII is exposed beyond what the customer submitted.
- **Delivery fee** is a flat €4.00 (400 minor units) computed server-side. The client cannot override it.
- **Payment is not processed yet.** Card and PayPal are stored as the customer's requested method; `payment_status` remains `pending` until a provider integration is selected and implemented.
- **Idempotency keys are scoped to a restaurant** and protected by a database uniqueness constraint.
- **Cart store** uses Zustand `persist` middleware with `localStorage`. Switching restaurant slug clears the cart automatically.
- **Workspace orders** are Server Components — no client-side fetch, no loading states, instant render on navigation.
- **`OrderStatusActions`** is a Client Component extracted from the detail page to keep the page itself a Server Component while enabling optimistic status updates via `router.refresh()`.

## Files created / modified

### Backend
- `app/models/orders.py` — `Order`, `OrderLine` models
- `app/models/__init__.py` — exports Order, OrderLine
- `migrations/versions/0003_day4_orders.py` — Alembic migration
- `migrations/versions/0004_day4b_orders_hardening.py` — idempotency and payment-status columns
- `migrations/versions/0005_day4_order_integrity.py` — restaurant-scoped idempotency constraint
- `app/schemas/orders.py` — `OrderIn`, `OrderLineIn`, `OrderOut`, `OrderListOut`, `OrderStatusIn`
- `app/api/v1/orders.py` — workspace router + `public_router`
- `app/api/v1/router.py` — registers both routers
- `tests/test_orders.py` — 16 tests

### Frontend
- `lib/cart-store.ts` — Zustand cart store with persistence
- `app/r/[slug]/menu/[item]/dish-customizer.tsx` — writes to cart store
- `app/r/[slug]/menu/[item]/page.tsx` — passes `slug` to DishCustomizer
- `app/r/[slug]/cart/page.tsx` — reads from cart store
- `app/r/[slug]/checkout/page.tsx` — calls API, clears cart
- `app/r/[slug]/order-confirmation/[id]/page.tsx` — Server Component
- `app/r/[slug]/order-tracking/[id]/page.tsx` — Server Component
- `app/(workspace)/orders/page.tsx` — Server Component, real API
- `app/(workspace)/orders/[id]/page.tsx` — Server Component, real API
- `app/(workspace)/orders/[id]/order-status-actions.tsx` — Client Component
