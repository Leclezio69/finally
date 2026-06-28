# TESTING.md — FinAlly Test Structure
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## Test Layers

| Layer | Framework | Location | Count (approx) |
|-------|-----------|----------|----------------|
| Backend unit tests | pytest + pytest-asyncio | `backend/tests/` | ~167 tests |
| E2E tests | Playwright (TypeScript) | `test/specs/` | 19 tests |

> No frontend unit tests (frontend is absent on `finally-gsd` branch).

## Backend Unit Tests (`backend/tests/`)

### Framework

- **pytest** >=8.3.0
- **pytest-asyncio** >=0.24.0 with `asyncio_mode = "auto"` (all async tests auto-detected)
- **pytest-cov** for coverage
- `asyncio_default_fixture_loop_scope = "function"` (fresh event loop per test)

### Test Modules

**`tests/market/test_simulator.py`** (131 lines) — GBMSimulator math
- Verifies price changes stay within realistic bounds
- Tests correlated moves, event probability, Cholesky decomposition
- Tests dynamic ticker addition (unknown tickers get auto-generated params)

**`tests/market/test_cache.py`** — PriceCache thread safety + API
- `update()` sets price, computes direction, increments version
- `get()` / `get_price()` / `get_all()` / `remove()`
- Version counter increments on every update

**`tests/market/test_models.py`** — PriceUpdate dataclass
- `change`, `change_percent`, `direction` computed properties
- `to_dict()` serialization

**`tests/market/test_factory.py`** — Factory selection logic
- `MASSIVE_API_KEY` set → `MassiveDataSource`
- No key → `SimulatorDataSource`

**`tests/market/test_simulator_source.py`** — SimulatorDataSource lifecycle
- `start(tickers)` / `stop()` / `add_ticker()` / `remove_ticker()`
- Verifies cache is populated after start

**`tests/market/test_massive.py`** — MassiveDataSource
- API response parsing
- Both implementations conform to `MarketDataSource` interface

**`tests/db/test_db.py`** (382 lines) — All DB query functions
- Uses in-memory SQLite (`:memory:`) — no file I/O in tests
- Tests all CRUD: users, watchlist, positions, trades, portfolio snapshots, chat messages
- Edge cases: insufficient shares sell, duplicate watchlist entry, zero-quantity position deletion

**`tests/llm/test_chat.py`** (458 lines) — LLM integration
- Mocks `litellm.acompletion` with `unittest.mock.AsyncMock`
- Tests structured output parsing, fallback on malformed JSON
- Tests `_validate_trades()` / `_validate_watchlist_changes()` validation
- Tests mock mode (`LLM_MOCK=true`)
- Tests error handling (API failure → graceful degradation)

**`tests/api/test_api.py`** — API route tests
- `make_test_app()` factory creates minimal FastAPI app with mocked state (no DB startup, no market source)
- Uses `TestClient` (sync) and `AsyncClient` from httpx
- Tests: health, watchlist CRUD, portfolio get/trade, trades list, chat endpoint
- All DB calls patched with `unittest.mock.patch`

### Running Tests

```bash
cd backend
uv run pytest                          # all tests
uv run pytest tests/market/            # market tests only
uv run pytest --cov=app --cov-report=term-missing  # with coverage
```

### Mocking Strategy

```python
# API tests: inject mock state directly
def make_test_app(price_cache=None, market_source=None, db_path=":memory:"):
    test_app = FastAPI()
    test_app.state.price_cache = price_cache or MagicMock()
    test_app.state.market_source = market_source or AsyncMock()
    test_app.state.db_path = db_path
    return test_app

# LLM tests: patch at import site
with patch("app.llm.chat.acompletion", new_callable=AsyncMock) as mock_llm:
    mock_llm.return_value = mock_response
    result = await chat_with_llm(...)
```

- `unittest.mock.MagicMock` for sync dependencies
- `unittest.mock.AsyncMock` for async dependencies (market source, LiteLLM)
- `patch()` as context manager, not decorator (more control over scope)

## E2E Tests (`test/specs/smoke.spec.ts`)

### Framework

- **Playwright** `@playwright/test ^1.61.1` (TypeScript)
- Run against live Docker container at `http://localhost:8001`
- Config: `test/playwright.config.ts`

### Test Scenarios (19 tests)

**Health check (1)**
- `GET /api/health` → 200, `{status: "ok", timestamp}`

**Watchlist API (5)**
- Default 10 tickers present (AAPL, GOOGL, NVDA)
- Add ticker (lowercase `pypl` → normalized to `PYPL`)
- Duplicate add → 409
- Remove ticker → 200, gone from list
- Remove non-existent → 404

**Portfolio API (5)**
- Initial $10k cash, no positions
- Buy 1 AAPL → cash decreases, position appears (with 1s wait for price stream)
- Buy with insufficient funds → 400
- Sell without position → 400
- Portfolio history → array

**Trades API (2)**
- `GET /api/trades` → array
- `GET /api/trades?limit=2` → respects limit

**SSE stream (1)**
- Uses `page.evaluate()` to connect `EventSource('/api/stream/prices')`
- Waits up to 8s for first `price_update` named event
- Verifies `ticker` (string) and `price` (number > 0)

**Chat API (1)**
- `POST /api/chat` with mock mode → 200, `{message, trades: [], watchlist_changes: []}`

**Frontend UI (4)**
- Page loads + "FinAlly" in title or heading
- Watchlist tickers visible after 2s
- Cash balance text (`$[digits]`) visible
- Connection status indicator visible ("live"/"connected"/"connecting")

### Running E2E Tests

```bash
# Start the app first
./scripts/start.sh

# Run tests (from test/)
cd test
npx playwright test              # headless
npx playwright test --headed     # headed
```

**Requirements**: Docker container running with `LLM_MOCK=true` and port 8001 mapped.

## Test Coverage Notes

- Market module: well-covered (GBM math, cache, factory, both sources)
- DB module: well-covered (all query paths, edge cases)
- LLM module: well-covered (parse, validate, mock mode, error fallback)
- API routes: covered by unit tests (mocked) + E2E (live)
- SSE streaming: covered by E2E test only (requires live connection)
- Frontend: E2E only (no unit tests; component absent on this branch)
