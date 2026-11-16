# ZAYQORA — The Complete Digital Restaurant Platform

**Author**: Nchifor Richard  
**Company / Product Blueprint**: VIRELEO

Multi-tenant restaurant website, online ordering, table reservations, kitchen operations (KDS) and SaaS management platform.

## Project structure

```text
backend/    FastAPI API, SQLAlchemy 2.0 models, Alembic migrations, pytest suite
frontend/   Next.js 14 (TypeScript, Tailwind CSS) application & UI design system
docs/       Architecture decisions, daily progress reports, screenshots
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
uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
npm run dev
```

Health check: `GET http://localhost:8000/api/v1/health` returns `{"status":"ok","database":"up"}`.

## Tests

```bash
cd backend
pytest -v
```

## Daily progress

| Day | Focus |
|---|---|
| [Day 1](docs/progress/day-1.md) | Foundation & design: repository, database schema baseline, auth skeleton, multi-tenant isolation & UI design system |
