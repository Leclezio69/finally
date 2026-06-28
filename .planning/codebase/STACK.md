# STACK.md — FinAlly Technology Stack
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## Languages & Runtime

| Layer | Language | Version |
|-------|----------|---------|
| Backend | Python | 3.12 |
| E2E Tests | TypeScript | (via @playwright/test ^1.61.1) |
| Infrastructure | Bash, PowerShell | (start/stop scripts) |

> **Note:** The `frontend` entry in the repo root is currently an empty file on the `finally-gsd` branch. The Next.js frontend exists in git history (branch `main`) but is absent from this branch's working tree.

## Backend Framework & Core Dependencies

Managed as a `uv` project (`backend/pyproject.toml`, `backend/uv.lock`).

| Package | Version Constraint | Role |
|---------|-------------------|------|
| `fastapi` | >=0.115.0 | HTTP API framework + SSE |
| `uvicorn[standard]` | >=0.32.0 | ASGI server |
| `numpy` | >=2.0.0 | GBM simulation (correlated random walks) |
| `litellm` | >=1.0.0 | LLM client (OpenRouter / Cerebras) |
| `massive` | >=1.0.0 | Polygon.io-based real market data client |
| `aiofiles` | >=23.0.0 | Async file I/O |
| `rich` | >=13.0.0 | Logging/terminal formatting |

## Dev Dependencies

| Package | Role |
|---------|------|
| `pytest` >=8.3.0 | Test runner |
| `pytest-asyncio` >=0.24.0 | Async test support (`asyncio_mode = "auto"`) |
| `pytest-cov` >=5.0.0 | Coverage reporting |
| `ruff` >=0.7.0 | Linter + formatter (line-length 100, py312 target) |

## Database

- **SQLite** — single file at `/app/db/finally.db` (volume-mounted at runtime)
- No ORM — raw `sqlite3` via `get_db_connection()` context manager (`backend/app/db/__init__.py`)
- Lazy initialization on startup: tables created + seed data inserted if DB missing

## LLM Integration

- **Provider**: OpenRouter → Cerebras inference
- **Model**: `openrouter/openai/gpt-oss-120b` with `provider.order: ["cerebras"]`
- **Client**: LiteLLM `acompletion` with `response_format=LLMResponse` (Pydantic model)
- **Mock mode**: `LLM_MOCK=true` env var returns deterministic fixture response (no API call)

## Containerization

- **Docker** — multi-stage Dockerfile:
  - Stage 1: `node:20-slim` builds Next.js static export (when frontend exists)
  - Stage 2: `python:3.12-slim` + `uv sync --frozen` + frontend static files
- **docker-compose.yml** — optional dev convenience; canonical launch is `docker run`
- Port: `8000` (single port, single container)
- Volume: `finally-data:/app/db`

## E2E Testing

- **Playwright** `@playwright/test ^1.61.1` (TypeScript)
- Runs on host against live container at `http://localhost:8001`
- Config: `test/playwright.config.ts`

## Environment Variables

| Variable | Default | Effect |
|----------|---------|--------|
| `OPENROUTER_API_KEY` | — | Required for LLM chat |
| `MASSIVE_API_KEY` | (empty) | If set → real market data; else → GBM simulator |
| `LLM_MOCK` | `false` | `true` → deterministic mock LLM responses |
| `DB_PATH` | `/app/db/finally.db` | SQLite file location |
| `STATIC_DIR` | `/app/static` | Next.js static export directory |

## Toolchain

- `uv` — Python package manager (lockfile: `backend/uv.lock`)
- `npm` — Node.js packages for E2E tests only (`test/package.json`)
- Docker — container build and runtime
- `ruff` — linting + formatting (`backend/`)
