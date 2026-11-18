# Day 2 — Tenant & Onboarding

Restaurant owners can register a new account, which automatically creates their tenant workspace (restaurant + default branch + owner membership). The restaurant profile can be updated by the owner or manager. Cross-tenant isolation is enforced and tested.

## Acceptance criteria covered

| Criterion | Status |
|---|---|
| `POST /api/v1/auth/register` creates user, restaurant, branch and owner membership in one transaction | ✅ |
| Registration auto-logs in the owner with an `HttpOnly` session cookie | ✅ |
| Duplicate email returns `409`; short password and invalid email return `422` | ✅ |
| Restaurant slug is auto-generated from the restaurant name and deduplicated | ✅ |
| `PATCH /api/v1/restaurants/me` allows owner/manager to update name, country, currency and timezone | ✅ |
| Waiter and unauthenticated requests to `PATCH` are rejected (`403` / `401`) | ✅ |
| Cross-tenant `PATCH` attempt returns `404` and leaves the target restaurant unchanged | ✅ |
| All mutations write an entry to `audit_logs` | ✅ |
| `/register` page added to `frontend/` (same layout as `/login`, EN/FR i18n) | ✅ |
| `/orders` list page added to `frontend/` (filters: status, service mode, payment) | ✅ |
| `/orders/[id]` detail page added to `frontend/` (items, history, customer info, actions) | ✅ |
| Automated tests: 14 register tests + 10 restaurant profile tests | ✅ |

---

## New API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Create owner account + tenant workspace |
| `PATCH` | `/api/v1/restaurants/me` | Update restaurant profile (owner / manager) |

---

## Frontend pages added

| Route | Description |
|---|---|
| `/register` | Owner registration form — full name, email, password, restaurant name |
| `/settings` | Restaurant profile editor, storefront publish/unpublish toggle, and staff role management |
| `/orders` | Order list with search and filters |
| `/orders/[id]` | Order detail — items, history, customer info, amount summary, status actions |

---

## Known limitations

- `/register` does not yet include country, currency or timezone fields; defaults to `US / USD / UTC` and can be updated in `/settings`.
- Dashboard KPIs still display demo data until the Day 6 reporting endpoints are connected.
