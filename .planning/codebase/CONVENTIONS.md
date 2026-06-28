# CONVENTIONS.md — FinAlly Code Conventions
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

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

```python
# Router definition (one per file)
router = APIRouter(tags=["domain"])

# State access via request.app.state
@router.get("/endpoint")
async def handler(request: Request):
    db_path = request.app.state.db_path
    price_cache = request.app.state.price_cache
```

- Pydantic models for request bodies: `class TradeRequest(BaseModel): ...`
- `HTTPException` for all error responses with appropriate status codes
- `request: Request` last positional arg (after Pydantic body) for state access

## Database Patterns

```python
# Always use context manager
with get_db_connection(db_path) as conn:
    user = get_user(conn)
    positions = get_positions(conn)

# Queries are pure functions: conn + args → result
def get_user(conn: sqlite3.Connection, user_id: str = "default") -> dict | None:
    row = conn.execute("SELECT ...", (user_id,)).fetchone()
    return dict(row) if row else None
```

- All DB functions take `conn` as first arg (dependency injection)
- `user_id: str = "default"` parameter on all query functions (future multi-user support)
- `_uuid()` helper for primary keys, `_now()` helper for ISO timestamps
- UNIQUE constraint violations caught by string match on `"UNIQUE"` in exception message

## Abstract Interface Pattern

```python
class MarketDataSource(ABC):
    @abstractmethod
    async def start(self, tickers: list[str]) -> None: ...
    @abstractmethod
    async def stop(self) -> None: ...
    @abstractmethod
    async def add_ticker(self, ticker: str) -> None: ...
    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None: ...
    @abstractmethod
    def get_tickers(self) -> list[str]: ...
```

Factory function selects implementation based on env vars. All consumers depend on the interface, not the implementation.

## Async Patterns

- FastAPI route handlers are `async def` throughout
- DB operations are **synchronous** (sqlite3 is sync) — called directly inside async handlers without `run_in_executor`
- Market data sources use `asyncio.create_task()` for background loops
- `await asyncio.sleep(interval)` in all polling loops (non-blocking)
- `asyncio.CancelledError` caught explicitly in SSE generator and background tasks

## Error Handling

```python
# API layer: raise HTTPException
raise HTTPException(status_code=400, detail="Ticker cannot be empty")

# LLM layer: return fallback dict on any exception
except Exception as e:
    logger.error(f"LLM call failed: {e}")
    return {"message": "I'm having trouble...", "trades": [], "watchlist_changes": []}

# Background tasks: log + continue
except Exception:
    logger.exception("Portfolio snapshot error")
```

- API handlers: `HTTPException` for client errors (4xx), log + 500 for server errors
- LLM module: never raises — always returns a valid dict (graceful degradation)
- Background tasks: `logger.exception()` on errors, loop continues

## Logging

```python
import logging
logger = logging.getLogger(__name__)

logger.info("SSE client connected: %s", client)
logger.error(f"LLM call failed: {e}")
logger.exception("Portfolio snapshot error")  # includes traceback
```

- `__name__`-based logger per module
- `logger.exception()` for unexpected errors in background tasks (includes traceback)
- f-string format for error messages, `%s` format for info/debug

## Data Models

- **Immutable dataclass** for value objects: `@dataclass(frozen=True, slots=True)` for `PriceUpdate`
- **Pydantic BaseModel** for API I/O: `LLMResponse`, `TradeRequest`, `AddTickerRequest`
- **dict** for DB results: `dict(row)` from sqlite3 `Row` objects (not custom classes)

## Validation Patterns

```python
# Ticker normalization: always uppercase + strip
ticker = body.ticker.upper().strip()

# Side normalization: always lowercase
side = body.side.lower()

# Quantity validation: must be positive float
if quantity <= 0:
    raise HTTPException(status_code=400, detail="Quantity must be positive")
```

LLM response validation: dedicated `_validate_trades()` / `_validate_watchlist_changes()` functions that normalize and filter; never raise — return empty list on invalid input.
