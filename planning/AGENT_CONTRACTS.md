# FinAlly — Agent Contracts

This file defines the precise interfaces between modules so agents can work in parallel
without stepping on each other. Each agent owns a clearly-defined portion of the codebase.

## File Ownership

| Agent | Owns |
|-------|------|
| Database Engineer | `backend/app/db/` + `backend/tests/db/` |
| Backend API Engineer | `backend/app/main.py`, `backend/app/api/`, `backend/tests/api/`, `backend/pyproject.toml` |
| LLM Engineer | `backend/app/llm/`, `backend/tests/llm/` |
| Frontend Engineer | `frontend/` (entire directory) |
| DevOps Engineer | `Dockerfile`, `docker-compose.yml`, `scripts/`, `.env.example`, `.gitignore` |
| Integration Tester | `test/` (Playwright E2E tests) |

**IMPORTANT: Only the Backend API Engineer modifies `backend/pyproject.toml` and `backend/uv.lock`.**
Other backend agents must NOT modify pyproject.toml. Instead, the Backend API Engineer
includes ALL required Python packages: fastapi, uvicorn, numpy, massive, rich, litellm, aiofiles.

---

## Database Layer Contract

**Module:** `backend/app/db/`

**Exports from `backend/app/db/__init__.py`:**
```python
from app.db.init import init_db, get_db_connection
from app.db.queries import (
    get_user, update_cash_balance,
    get_watchlist, add_to_watchlist, remove_from_watchlist,
    get_positions, get_position, upsert_position, delete_position,
    record_trade, get_trades,
    record_portfolio_snapshot, get_portfolio_history,
    add_chat_message, get_chat_history,
)
```

**Key functions:**

```python
# init.py
def init_db(db_path: str) -> None:
    """Create tables and seed default data if not already present."""

def get_db_connection(db_path: str) -> ContextManager[sqlite3.Connection]:
    """Context manager returning sqlite3.Connection with Row factory."""

# queries.py
def get_user(conn, user_id="default") -> dict | None
def update_cash_balance(conn, delta: float, user_id="default") -> float
    # delta is positive for credit (sell), negative for debit (buy)
    # Returns new balance

def get_watchlist(conn, user_id="default") -> list[dict]
    # Returns: [{"id": str, "ticker": str, "added_at": str}]

def add_to_watchlist(conn, ticker: str, user_id="default") -> dict
    # Returns: {"id": str, "ticker": str, "added_at": str}
    # Raises: ValueError if ticker already in watchlist

def remove_from_watchlist(conn, ticker: str, user_id="default") -> bool
    # Returns True if removed, False if not found

def get_positions(conn, user_id="default") -> list[dict]
    # Returns: [{"ticker": str, "quantity": float, "avg_cost": float, "updated_at": str}]

def get_position(conn, ticker: str, user_id="default") -> dict | None

def upsert_position(conn, ticker: str, quantity: float, avg_cost: float, user_id="default") -> None
    # If quantity <= 0, deletes the position (calls delete_position)

def delete_position(conn, ticker: str, user_id="default") -> None

def record_trade(conn, ticker: str, side: str, quantity: float, price: float, user_id="default") -> dict
    # Returns: {"id": str, "ticker": str, "side": str, "quantity": float, "price": float, "executed_at": str}

def get_trades(conn, limit: int = 50, user_id="default") -> list[dict]
    # Returns most recent first

def record_portfolio_snapshot(conn, total_value: float, user_id="default") -> None

def get_portfolio_history(conn, user_id="default") -> list[dict]
    # Returns: [{"total_value": float, "recorded_at": str}]

def add_chat_message(conn, role: str, content: str, actions: dict | None = None, user_id="default") -> dict
    # Returns: {"id": str, "role": str, "content": str, "actions": dict|None, "created_at": str}

def get_chat_history(conn, limit: int = 20, user_id="default") -> list[dict]
    # Returns oldest-first (for LLM context), most recent `limit` messages
```

**DB path:** Read from env var `DB_PATH`, default `/app/db/finally.db` for Docker, fallback `./db/finally.db`.

---

## LLM Layer Contract

**Module:** `backend/app/llm/`

**Exports from `backend/app/llm/__init__.py`:**
```python
from app.llm.chat import chat_with_llm
```

**Key function:**

```python
# chat.py
async def chat_with_llm(
    message: str,
    portfolio_context: dict,   # {cash_balance, total_value, positions: [...], watchlist: [...]}
    history: list[dict],       # [{"role": "user"|"assistant", "content": str}]
) -> dict:
    # Returns: {"message": str, "trades": [...], "watchlist_changes": [...]}
    # trades: [{"ticker": str, "side": "buy"|"sell", "quantity": float}]
    # watchlist_changes: [{"ticker": str, "action": "add"|"remove"}]
```

**Model:** `openrouter/openai/gpt-oss-120b` via LiteLLM + OpenRouter
**API key env var:** `OPENROUTER_API_KEY`
**Mock mode:** When `LLM_MOCK=true`, return deterministic mock without calling API

---

## Backend API Contract

**Module:** `backend/app/`

**App state (accessible via `request.app.state`):**
```python
app.state.price_cache    # PriceCache instance
app.state.market_source  # MarketDataSource instance
app.state.db_path        # str
```

**main.py startup:**
1. `init_db(db_path)`
2. Create `PriceCache()`
3. Create `create_market_data_source(cache)`
4. Get initial watchlist tickers from DB
5. `await source.start(tickers)`
6. Start portfolio snapshot background task (every 10 seconds)

**API routes prefix:** All routes under `/api/`

**Portfolio context format** (used by chat endpoint to call LLM):
```python
{
    "cash_balance": float,
    "total_value": float,
    "positions": [
        {
            "ticker": str,
            "quantity": float,
            "avg_cost": float,
            "current_price": float,
            "unrealized_pnl": float,
            "pnl_percent": float,
        }
    ],
    "watchlist": [
        {"ticker": str, "price": float, "change_percent": float}
    ]
}
```

---

## Frontend Contract

**Framework:** Next.js 15, TypeScript, Tailwind, App Router, static export (`output: 'export'`)
**Build output:** `frontend/out/` → copied to `/app/static/` in Docker

**All API calls go to same origin** — no CORS needed.

**SSE Event format** (from `/api/stream/prices`):
```
event: price_update
data: {"ticker": "AAPL", "price": 195.23, "previous_price": 195.10, "timestamp": "...", "change": 0.13, "change_percent": 0.07, "direction": "up"}
```

---

## Docker / Scripts Contract

**Container name:** `finally`
**Volume name:** `finally-data` → mounts to `/app/db/`
**Port:** `8000`
**Env file:** `.env` at project root
**Health check:** `GET /api/health`

**Backend entrypoint:** `uvicorn app.main:app --host 0.0.0.0 --port 8000`
(run from `/app/backend/` directory via `uv run`)

**Static files:** FastAPI serves `/app/static/` at root path `/`
The Next.js build produces `frontend/out/` which is copied to `/app/static/` in Docker.
