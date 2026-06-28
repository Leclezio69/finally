# INTEGRATIONS.md — FinAlly External Integrations
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## LLM: OpenRouter + Cerebras

**Purpose:** AI trading assistant chat
**Module:** `backend/app/llm/chat.py`

- **Gateway**: OpenRouter (`openrouter/openai/gpt-oss-120b`)
- **Inference provider**: Cerebras (specified via `extra_body: {"provider": {"order": ["cerebras"]}}`)
- **Client**: LiteLLM `acompletion` (async)
- **Auth**: `OPENROUTER_API_KEY` environment variable
- **Structured output**: Pydantic model `LLMResponse` with `response_format` parameter
- **Mock mode**: `LLM_MOCK=true` bypasses all API calls, returns `MOCK_RESPONSE` fixture
- **Error handling**: Falls back to graceful error message string on any exception; never crashes the endpoint

```python
MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
response = await acompletion(model=MODEL, messages=..., response_format=LLMResponse, ...)
```

## Market Data: Massive API (Optional)

**Purpose:** Real-time stock prices (optional, replaces GBM simulator)
**Module:** `backend/app/market/massive_client.py`

- **Package**: `massive` >=1.0.0 (Polygon.io wrapper)
- **Auth**: `MASSIVE_API_KEY` environment variable
- **Selection**: Factory `create_market_data_source()` in `backend/app/market/factory.py` chooses Massive vs Simulator based on env var presence
- **Mode**: REST polling (not WebSocket) — interval varies by API tier
- **Same interface**: Implements `MarketDataSource` ABC, transparent to all downstream consumers

## Market Data: GBM Simulator (Default)

**Purpose:** Simulated market data when no API key is configured
**Module:** `backend/app/market/simulator.py`

- **Algorithm**: Geometric Brownian Motion with correlated moves (numpy Cholesky decomposition)
- **Update interval**: 500ms
- **Seed prices**: `backend/app/market/seed_prices.py` — realistic starting prices per ticker
- **Dynamic tickers**: Unknown tickers get auto-generated GBM params + random seed price $50–$300
- **Events**: Occasional random 2–5% moves (event_probability=0.001 per tick)
- **No external dependency** — runs entirely in-process as an asyncio background task

## Browser SSE (Server-Sent Events)

**Purpose:** Real-time price streaming to frontend
**Module:** `backend/app/api/stream.py`

- **Endpoint**: `GET /api/stream/prices`
- **Protocol**: HTTP SSE — `StreamingResponse` with `text/event-stream` media type
- **Event name**: `price_update` (named event, not generic `message`)
- **Payload**: `{"ticker", "price", "previous_price", "timestamp", "change", "change_percent", "direction"}`
- **Reconnect**: `retry: 1000\n\n` header tells browser to reconnect after 1s
- **Change detection**: version counter on `PriceCache` — only emits when prices actually update
- **Client**: Browser native `EventSource` API (no library needed)

## SQLite Database

**Purpose:** Persistent storage for all application state
**Module:** `backend/app/db/`

- **File**: `/app/db/finally.db` (volume-mounted)
- **Init**: `init_db(DB_PATH)` called on startup — creates tables + seeds default data if absent
- **Connection**: `get_db_connection(DB_PATH)` context manager (WAL mode, row factory)
- **No migrations** — schema is always recreated from scratch on missing tables

## Frontend (Static Files)

**Purpose:** Serve Next.js static export
**Module:** `backend/app/main.py`

- FastAPI `StaticFiles` mount at `/` (registered last, after all API routes)
- `STATIC_DIR` env var points to Next.js `out/` build directory
- Mount is conditional: only added if `Path(STATIC_DIR).exists()`
- All API calls use same origin (`/api/*`) — no CORS configuration needed

> **Current state on `finally-gsd` branch**: `frontend` is an empty file, not a directory. The static build does not exist. The Docker Stage 1 (Node build) would fail. Backend-only operation works fine.
