# Deployment Guide & Operational Runbook — ZAYQORA

**Author**: Nchifor Richard  
**Company / Product Blueprint**: VIRELEO

---

## 1. Deployment Topology (Section 21.1)

| Component | Technology | Role |
|---|---|---|
| **Frontend** | Next.js 14 (`frontend/Dockerfile` or Vercel) | Server-rendered restaurant storefronts (`/r/[slug]`), customer flows, restaurant workspace and VIRELEO super admin (`/platform`). |
| **Backend API** | FastAPI + Uvicorn (`backend/Dockerfile`) | Modular monolith exposing `/api/v1/*`, OpenAPI specification (`/docs`), CSRF origin checks, security headers and `X-Request-Id` tracing. |
| **Database** | PostgreSQL 16 (`docker-compose.yml`) | Transactional storage for identity, tenants, menus, orders, reservations, notifications and audit logs (`zayqora` schema). |
| **Media storage** | Non-executable volume (`backend/storage/uploads/`) | Validated PNG, JPEG and WebP dish photographs served with `X-Content-Type-Options: nosniff`. |

---

## 2. Environment Variables (Section 21.2)

### Backend (`backend/.env`)

| Variable | Description | Production requirement |
|---|---|---|
| `ENV` | `development` \| `staging` \| `production` | Set to `production` to enforce `Secure` session cookies, `Strict-Transport-Security`, and block demo seeding. |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql+psycopg://...`) | Use private networking and TLS (`sslmode=require`). |
| `ALLOWED_ORIGINS` | Allowed frontend origins for CORS & CSRF checks | Set to the exact HTTPS frontend origin(s). |
| `SESSION_COOKIE_NAME` | Session cookie identifier (`zayqora_session`) | Sent `HttpOnly`, `SameSite=Lax`, `Secure=True` in production. |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `API_ORIGIN` | Internal origin used by Next.js server rewrites and Server Components (e.g. `http://backend:8000` in Docker). |
| `NEXT_PUBLIC_API_URL` | Public API origin used by client checkout fetches. |
| `NEXT_PUBLIC_SITE_URL` | Canonical public URL used by `/sitemap.xml` and metadata. |

---

## 3. Containerized Deployment

```bash
# Build and start PostgreSQL, FastAPI backend, and Next.js frontend
docker compose up -d --build

# Apply database migrations
docker compose exec backend alembic upgrade head

# Verify health endpoint
curl -i http://localhost:8000/api/v1/health
```

---

## 4. Backup & Disaster Recovery Runbook (Section 21.4)

### 4.1 Create a logical backup (`pg_dump`)

```bash
docker compose exec -T db pg_dump -U zayqora -d zayqora -n zayqora -Fc > zayqora_$(date +%Y%m%d_%H%M%S).dump
```

### 4.2 Restore and verify in an isolated database (`pg_restore`)

```bash
docker compose exec -T db createdb -U zayqora zayqora_restore_verify
docker compose exec -T db pg_restore -U zayqora -d zayqora_restore_verify --no-owner < zayqora_backup.dump
```

---

## 5. Incident Response Runbooks (Section 21.5)

1. **Compromised user or staff credentials**:
   - Remove or deactivate the staff member in `/settings` (`DELETE /api/v1/members/{id}`) or revoke all active rows in `user_sessions` (`UPDATE zayqora.user_sessions SET revoked_at = NOW() WHERE user_id = '...'`).
2. **Abusive or non-compliant restaurant tenant**:
   - Sign in to `/platform` as a VIRELEO platform administrator (`is_platform_admin=True`) and click **Suspend** with a documented reason (`PATCH /api/v1/platform/tenants/{id}/status`). Public storefront access (`404`) and workspace access (`403`) are cut off immediately and recorded in `audit_logs`.
3. **Database migration verification**:
   - Confirm single-head integrity before any release with `alembic heads` (must output `0009_day6_platform_plan (head)`) and preview offline SQL with `alembic upgrade head --sql`.
