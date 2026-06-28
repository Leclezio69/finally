# ARCHITECTURE.md — FinAlly System Architecture
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## Pattern

**Layered monolith in a single Docker container.** FastAPI serves both the REST/SSE API and static frontend files on port 8000. All components share in-process state via `app.state`.

## Component Overview

```
┌─────────────────────────────────────────────────────────┐
│  Docker Container (port 8000)                           │
│                                                         │
│  FastAPI (uvicorn ASGI)                                 │
│  ├── /api/*          REST API routers                   │
│  ├── /api/stream/prices  SSE streaming                  │
│  └── /*              StaticFiles (Next.js export)       │
│                                                         │
│  app.state (shared in-process state)                    │
│  ├── price_cache     PriceCache (thread-safe dict)      │
│  ├── market_source   MarketDataSource (simulator/real)  │
│  └── db_path         SQLite file path                   │
│                                                         │
│  Background asyncio tasks                               │
│  ├── market data loop  (SimulatorDataSource._run)       │
│  └── portfolio snapshot loop  (every 10s)              │
│                                                         │
│  SQLite database  (/app/db/finally.db, volume-mounted)  │
└─────────────────────────────────────────────────────────┘
```

## Layers

### 1. Market Data Layer (`backend/app/market/`)

Abstract interface → two concrete implementations → shared cache

```
MarketDataSource (ABC, interface.py)
├── SimulatorDataSource  → GBMSimulator → PriceCache
└── MassiveDataSource    → Massive API polls → PriceCache

PriceCache (cache.py)
└── Thread-safe dict[ticker → PriceUpdate]
    ├── version counter (for SSE change detection)
    └── Lock for thread safety
```

- **Factory pattern**: `create_market_data_source(cache)` in `factory.py` selects implementation
- **Push architecture**: market source writes to cache; SSE reads from cache (decoupled)
- **Lifecycle**: `start(tickers)` → background asyncio task → `stop()` via lifespan

### 2. Database Layer (`backend/app/db/`)

Raw SQLite with functional query API — no ORM.

```
init.py      → init_db(), get_db_connection() context manager
schema.py    → SQL CREATE TABLE strings (6 tables)
queries.py   → pure functions: get_user(), add_to_watchlist(), execute_trade(), etc.
```

- **Connection pattern**: `with get_db_connection(db_path) as conn:` (WAL mode)
- **No migration system**: lazy init on startup creates tables if absent
- **All queries are sync**: DB writes happen inside API handlers synchronously

### 3. LLM Layer (`backend/app/llm/`)

Single module wrapping LiteLLM → OpenRouter → Cerebras.

```
chat.py
├── chat_with_llm(message, portfolio_context, history) → dict
├── LLMResponse (Pydantic BaseModel) — structured output schema
├── _build_portfolio_context_text() — formats context for prompt
├── _parse_response() — JSON parse with fallback
├── _validate_trades() — normalizes + validates trade entries
└── _validate_watchlist_changes() — normalizes + validates watchlist entries
```

- **Stateless**: no internal state; caller provides portfolio context and history
- **Auto-execution**: chat endpoint reads LLM response, auto-executes trades + watchlist changes

### 4. API Layer (`backend/app/api/`)

FastAPI routers — one file per domain.

| File | Prefix | Endpoints |
|------|--------|-----------|
| `health.py` | `/api` | `GET /health` |
| `stream.py` | `/api` | `GET /stream/prices` (SSE) |
| `watchlist.py` | `/api` | `GET/POST /watchlist`, `DELETE /watchlist/{ticker}` |
| `portfolio.py` | `/api` | `GET /portfolio`, `POST /portfolio/trade`, `GET /portfolio/history` |
| `trades.py` | `/api` | `GET /trades` |
| `chat.py` | `/api` | `POST /chat` |

**Critical constraint**: All routers registered via `app.include_router()` BEFORE `StaticFiles("/")` mount in `create_app()`. StaticFiles intercepts all unmatched paths — reversing order would break the API.

### 5. Entry Point (`backend/app/main.py`)

- `create_app()` factory: registers all routers, mounts static files
- `lifespan()` async context manager: DB init, market source start/stop, background tasks
- `app = create_app()` at module level (for uvicorn import)

## Data Flow

### Price Update Flow
```
SimulatorDataSource._run() [asyncio task, 500ms]
  → GBMSimulator.step() → new prices
  → PriceCache.update(ticker, price) [thread-safe write]
  → PriceCache.version++

SSE handler _generate_events() [per connected client]
  → polls PriceCache.version every 500ms
  → on version change: get_all() → emit "price_update" events
  → browser EventSource receives named events
```

### Trade Execution Flow
```
POST /api/portfolio/trade
  → validate ticker/quantity/side
  → price_cache.get_price(ticker) [current market price]
  → get_db_connection() [sync SQLite transaction]
  → update_cash_balance()
  → upsert_position()
  → record_trade()
  → record_portfolio_snapshot() [immediate snapshot post-trade]
  → return {success, trade, new_cash_balance}
```

### Chat Flow
```
POST /api/chat
  → load portfolio context (positions + prices + watchlist)
  → load last 20 chat messages from DB
  → chat_with_llm(message, context, history)
    → LiteLLM acompletion → OpenRouter → Cerebras
    → parse + validate structured JSON response
  → auto-execute trades (calls same logic as POST /portfolio/trade)
  → auto-apply watchlist changes
  → store message + actions in chat_messages table
  → return {message, trades, watchlist_changes, executed_trades, errors}
```

## Application Startup Sequence

```
uvicorn → app = create_app()
  1. init_db(DB_PATH)        — create tables, seed default user + watchlist
  2. PriceCache()            — empty in-memory dict
  3. create_market_data_source(cache)  — factory selects simulator or Massive
  4. get_watchlist(conn)     — load tickers from DB
  5. market_source.start(tickers)  — begins background data generation
  6. app.state.* = ...       — store shared refs
  7. asyncio.create_task(_portfolio_snapshot_loop)  — starts 10s snapshot loop
  → app ready to serve requests
```
