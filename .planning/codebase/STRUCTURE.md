# STRUCTURE.md — FinAlly Directory Layout
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## Top-Level Layout

```
finally/
├── backend/              # FastAPI uv project (Python 3.12)
├── db/                   # Runtime SQLite volume mount target (contains .gitkeep only)
├── frontend              # EMPTY FILE on finally-gsd branch (was Next.js dir on main)
├── planning/             # Legacy planning docs (pre-GSD, agent reference)
├── scripts/              # Docker start/stop scripts
├── test/                 # Playwright E2E tests (host-side)
├── .planning/            # GSD planning directory (new, being initialized)
├── .env                  # Environment variables (gitignored)
├── .env.example          # Template (committed)
├── CLAUDE.md             # Project instructions for Claude Code
├── Dockerfile            # Multi-stage build
├── docker-compose.yml    # Optional dev convenience
└── README.md             # User-facing documentation
```

## Backend Structure (`backend/`)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py           # FastAPI app factory, lifespan, portfolio snapshot loop
│   ├── api/
│   │   ├── __init__.py
│   │   ├── chat.py       # POST /api/chat
│   │   ├── health.py     # GET /api/health
│   │   ├── portfolio.py  # GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history
│   │   ├── stream.py     # GET /api/stream/prices (SSE)
│   │   ├── trades.py     # GET /api/trades
│   │   └── watchlist.py  # GET/POST /api/watchlist, DELETE /api/watchlist/{ticker}
│   ├── db/
│   │   ├── __init__.py   # Public exports: get_db_connection, init_db, all query functions
│   │   ├── init.py       # init_db(), get_db_connection(), seed_default_data()
│   │   ├── queries.py    # All CRUD query functions
│   │   └── schema.py     # SQL CREATE TABLE strings
│   ├── llm/
│   │   ├── __init__.py
│   │   └── chat.py       # chat_with_llm(), LLMResponse Pydantic model, mock mode
│   └── market/
│       ├── __init__.py   # Public exports: PriceCache, create_market_data_source
│       ├── cache.py      # PriceCache (thread-safe in-memory price store)
│       ├── factory.py    # create_market_data_source() factory function
│       ├── interface.py  # MarketDataSource ABC
│       ├── massive_client.py  # MassiveDataSource implementation
│       ├── models.py     # PriceUpdate dataclass
│       ├── seed_prices.py    # SEED_PRICES, TICKER_PARAMS, CORRELATION_GROUPS
│       ├── simulator.py  # SimulatorDataSource + GBMSimulator
│       └── stream.py     # (legacy SSE helper, superceded by app/api/stream.py)
├── tests/
│   ├── conftest.py       # Minimal pytest fixtures
│   ├── api/
│   │   └── test_api.py   # API route unit tests (mocked DB + market)
│   ├── db/
│   │   └── test_db.py    # DB query function tests (in-memory SQLite)
│   ├── llm/
│   │   └── test_chat.py  # LLM chat tests (mocked LiteLLM)
│   └── market/
│       ├── test_cache.py           # PriceCache tests
│       ├── test_factory.py         # Factory selection tests
│       ├── test_massive.py         # MassiveDataSource tests
│       ├── test_models.py          # PriceUpdate model tests
│       ├── test_simulator.py       # GBMSimulator math tests
│       └── test_simulator_source.py # SimulatorDataSource lifecycle tests
├── pyproject.toml        # uv project definition, pytest config, ruff config
├── uv.lock               # Locked dependencies
└── README.md
```

## E2E Tests (`test/`)

```
test/
├── specs/
│   └── smoke.spec.ts     # 19 Playwright tests: API + UI + SSE scenarios
├── playwright.config.ts  # Config: baseURL, test dir, browser settings
├── package.json          # { "@playwright/test": "^1.61.1" }
├── package-lock.json
└── node_modules/         # Playwright install
```

## Scripts (`scripts/`)

```
scripts/
├── start.sh              # Build Docker image (if needed) + run container
├── stop.sh               # Stop + remove container (keeps volume)
└── start.ps1             # Windows PowerShell equivalent
```

## Planning (`planning/`)

```
planning/
├── PLAN.md               # Original project specification (full detail)
├── MARKET_DATA_SUMMARY.md    # Summary of completed market data component
└── archive/              # Detailed notes from agent team builds
```

## Key File Locations

| What you want | Where to find it |
|---------------|-----------------|
| FastAPI app entry | `backend/app/main.py` |
| All API routes | `backend/app/api/` (one file per domain) |
| Database schema | `backend/app/db/schema.py` |
| Database queries | `backend/app/db/queries.py` |
| LLM integration | `backend/app/llm/chat.py` |
| Market data interface | `backend/app/market/interface.py` |
| Price simulator | `backend/app/market/simulator.py` |
| Shared price cache | `backend/app/market/cache.py` |
| SSE streaming | `backend/app/api/stream.py` |
| E2E test scenarios | `test/specs/smoke.spec.ts` |
| Docker build | `Dockerfile` |
| Environment config | `.env` (local) / `.env.example` (template) |
| Project spec | `planning/PLAN.md` |

## Naming Conventions

- Python files: `snake_case.py`
- Python classes: `PascalCase` (e.g., `PriceCache`, `SimulatorDataSource`, `LLMResponse`)
- Python functions: `snake_case` (e.g., `get_db_connection`, `create_market_data_source`)
- FastAPI routers: one `router = APIRouter(tags=[...])` per file, imported in `main.py`
- Test files: `test_<module>.py` matching the module under test
- TypeScript tests: `<name>.spec.ts`
