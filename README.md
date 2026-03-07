# LuminaLib

LuminaLib is a full-stack book management application with authentication, book uploads, borrowing, reviews, recommendations, and AI-assisted book summaries.

## Stack

- Backend: FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: Next.js 16, React 19
- AI/LLM: Ollama by default, with configurable provider settings
- Infrastructure: Docker Compose

## Project Structure

- `backend/`: FastAPI API, database models, services, Alembic config
- `frontend/`: Next.js client application
- `docker-compose.yml`: local multi-service development stack
- `ARCHITECTURE.md`: higher-level system notes

## Core Features

- JWT-based signup, login, refresh, logout, and profile endpoints
- Book upload and paginated listing
- Borrow and return workflow using the `book_borrows` table
- Book reviews and reader insight summaries
- Personalized recommendations and user preference profiling
- Redis-backed recommendation caching with background refresh on borrow/review activity
- AI-generated book summaries via configured LLM provider

## Quick Start With Docker

From the project root:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`
- pgAdmin: `http://localhost:5050`
- Redis: `localhost:6379`
- RedisInsight: `http://localhost:5540`

Default Docker services in `docker-compose.yml`:

- `db` (PostgreSQL 16)
- `redis`
- `redisinsight`
- `pgadmin`
- `backend`
- `ollama`
- `frontend`

## Local Development

### Backend

Requirements:

- Python 3.11+
- PostgreSQL

Setup:

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000` and exposes the API under `/api`, with versioned routes under `/api/v1`.

Important:

- Set `JWT_SECRET_KEY` in `backend/.env` before running the API.
- Update database credentials in `backend/.env` if you are not using the Docker defaults.
- After `alembic upgrade head`, run `ALTER TABLE loans RENAME TO book_borrows;` until a dedicated Alembic migration is added.

### Frontend

Requirements:

- Node.js 20+
- npm

Setup:

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at `http://localhost:3000`.

## Environment Notes

The backend reads environment variables from `backend/.env`.

Key settings:

- Database: `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`
- Auth: `JWT_SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`
- CORS: `CORS_ALLOW_ORIGINS`
- Storage: `STORAGE_PROVIDER`, `BOOK_STORAGE_DIR`, optional S3 settings
- LLM: `LLM_ENABLED`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, provider-specific API keys
- Redis cache: `REDIS_ENABLED`, `REDIS_URL`, `RECOMMENDATION_CACHE_TTL_SECONDS`, `RECOMMENDATION_CACHE_WARM_LIMIT`

See `backend/.env.example` for the full list.

## API Overview

Primary route groups:

- `/api/v1/auth`: signup, login, token refresh, logout, current user
- `/api/v1/books`: create, list, borrow, return, reviews, recommendations, preferences, insight

Interactive API docs are available at `http://localhost:8000/docs`.

## Useful Commands

```bash
# backend tests
cd backend && pytest

# frontend tests
cd frontend && npm test

# frontend lint
cd frontend && npm run lint
```
