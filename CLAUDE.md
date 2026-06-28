# FinAlly Project - the Finance Ally

All project documentation is in the `planning` directory.

The key document is PLAN.md included in full below; the market data component has been completed and is summarized in the file `planning/MARKET_DATA_SUMMARY.md` with more details in the `planning/archive` folder. Consult these docs only when required. The remainder of the platform is still to be developed.

@planning/PLAN.md

<!-- GSD:project-start source:PROJECT.md -->
## Project

**FinAlly — AI Trading Workstation**

FinAlly is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot. Launched via a single Docker command, it runs entirely in a single container on port 8000 with no login required.

**Core Value:** A user opens the app and immediately sees live streaming prices, can trade with one click, and can ask the AI to manage their portfolio — all without setup, login, or configuration.

### Constraints

- **Tech Stack**: Next.js 15 TypeScript + Tailwind CSS + lightweight-charts + recharts (all `'use client'` components required for static export)
- **Output**: `output: 'export'` in `next.config.js` — no server-side rendering, pure static
- **Container**: Single Docker container, port 8000, volume `finally-data:/app/db`
- **No CORS**: Frontend served by same FastAPI origin — all `/api/*` calls are same-origin
- **E2E tests**: Must pass against container at `http://localhost:8001` with `LLM_MOCK=true`
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages & Runtime
| Layer | Language | Version |
|-------|----------|---------|
| Backend | Python | 3.12 |
| E2E Tests | TypeScript | (via @playwright/test ^1.61.1) |
| Infrastructure | Bash, PowerShell | (start/stop scripts) |
## Backend Framework & Core Dependencies
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Python Style
- **Ruff** enforces style: line-length 100, `py312` target, rules E/F/I/N/W, E501 ignored
- **Type hints** throughout: `list[str]`, `dict | None`, `float | None` (Python 3.10+ union syntax)
- **`from __future__ import annotations`** at top of most modules (deferred evaluation)
- **Docstrings** on all public classes and methods (triple-quote, single-line or multi-paragraph)
## Module Organization
- **One concern per module**: `cache.py` = cache, `models.py` = data models, `queries.py` = DB queries
- **Public re-exports via `__init__.py`**: `from app.db import get_db_connection, init_db` (not direct submodule imports)
- **No circular imports**: market → (none), db → (none), llm → db, api → db + market + llm, main → all
## FastAPI Patterns
- Pydantic models for request bodies: `class TradeRequest(BaseModel): ...`
- `HTTPException` for all error responses with appropriate status codes
- `request: Request` last positional arg (after Pydantic body) for state access
## Database Patterns
- All DB functions take `conn` as first arg (dependency injection)
- `user_id: str = "default"` parameter on all query functions (future multi-user support)
- `_uuid()` helper for primary keys, `_now()` helper for ISO timestamps
- UNIQUE constraint violations caught by string match on `"UNIQUE"` in exception message
## Abstract Interface Pattern
## Async Patterns
- FastAPI route handlers are `async def` throughout
- DB operations are **synchronous** (sqlite3 is sync) — called directly inside async handlers without `run_in_executor`
- Market data sources use `asyncio.create_task()` for background loops
- `await asyncio.sleep(interval)` in all polling loops (non-blocking)
- `asyncio.CancelledError` caught explicitly in SSE generator and background tasks
## Error Handling
- API handlers: `HTTPException` for client errors (4xx), log + 500 for server errors
- LLM module: never raises — always returns a valid dict (graceful degradation)
- Background tasks: `logger.exception()` on errors, loop continues
## Logging
- `__name__`-based logger per module
- `logger.exception()` for unexpected errors in background tasks (includes traceback)
- f-string format for error messages, `%s` format for info/debug
## Data Models
- **Immutable dataclass** for value objects: `@dataclass(frozen=True, slots=True)` for `PriceUpdate`
- **Pydantic BaseModel** for API I/O: `LLMResponse`, `TradeRequest`, `AddTickerRequest`
- **dict** for DB results: `dict(row)` from sqlite3 `Row` objects (not custom classes)
## Validation Patterns
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern
## Component Overview
```
```
## Layers
### 1. Market Data Layer (`backend/app/market/`)
```
```
- **Factory pattern**: `create_market_data_source(cache)` in `factory.py` selects implementation
- **Push architecture**: market source writes to cache; SSE reads from cache (decoupled)
- **Lifecycle**: `start(tickers)` → background asyncio task → `stop()` via lifespan
### 2. Database Layer (`backend/app/db/`)
```
```
- **Connection pattern**: `with get_db_connection(db_path) as conn:` (WAL mode)
- **No migration system**: lazy init on startup creates tables if absent
- **All queries are sync**: DB writes happen inside API handlers synchronously
### 3. LLM Layer (`backend/app/llm/`)
```
```
- **Stateless**: no internal state; caller provides portfolio context and history
- **Auto-execution**: chat endpoint reads LLM response, auto-executes trades + watchlist changes
### 4. API Layer (`backend/app/api/`)
| File | Prefix | Endpoints |
|------|--------|-----------|
| `health.py` | `/api` | `GET /health` |
| `stream.py` | `/api` | `GET /stream/prices` (SSE) |
| `watchlist.py` | `/api` | `GET/POST /watchlist`, `DELETE /watchlist/{ticker}` |
| `portfolio.py` | `/api` | `GET /portfolio`, `POST /portfolio/trade`, `GET /portfolio/history` |
| `trades.py` | `/api` | `GET /trades` |
| `chat.py` | `/api` | `POST /chat` |
### 5. Entry Point (`backend/app/main.py`)
- `create_app()` factory: registers all routers, mounts static files
- `lifespan()` async context manager: DB init, market source start/stop, background tasks
- `app = create_app()` at module level (for uvicorn import)
## Data Flow
### Price Update Flow
```
```
### Trade Execution Flow
```
```
### Chat Flow
```
```
## Application Startup Sequence
```
```
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
