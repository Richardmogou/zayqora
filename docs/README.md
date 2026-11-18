# ZAYQORA (MVP)

Multi-tenant digital restaurant platform: branded storefront, online ordering, table reservations, kitchen operations and restaurant management console.

## Project structure

```text
backend/    FastAPI API, SQLAlchemy 2.0 models, Alembic migrations, pytest suite
frontend/   Next.js 14 (TypeScript, Tailwind CSS) application
docs/       Architecture notes, daily progress reports, screenshots
```

## Local setup

```bash
cp .env.example .env
docker compose up -d db

# Backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed
uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs

# Frontend
cd ../frontend
npm install
npm run dev                                 # http://localhost:3000
```

Health check: `GET http://localhost:8000/api/v1/health` should return `{"status":"ok","database":"up"}`.

## Tests

```bash
cd backend
pytest -v
```

## Daily progress

| Day | Topic |
|---|---|
| [Day 1](progress/day-1.md) | Foundation: frontend workspace, authentication sessions, multi-tenant isolation, database and migrations |
| [Day 2](progress/day-2.md) | Tenant & onboarding: owner registration, restaurant profile, storefront publishing and staff roles |
| [Day 3](progress/day-3.md) | Public website & menu: storefront, categories, dishes, validated image uploads and modifiers |
| [Day 4](progress/day-4.md) | Cart, checkout & orders: persisted cart store, server-side pricing, idempotency and order tracking |
| [Day 5](progress/day-5.md) | Reservations & operations: availability engine, capacity locking, KDS board and staff notifications |
| [Day 6](progress/day-6.md) | Admin & platform controls: live dashboard metrics, sales reports, customer CRM and VIRELEO super admin |

## Architecture & Reference

- [Day 1 Architecture Decisions](architecture/day-1-decisions.md)
