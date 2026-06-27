# Market Data Interface

Unified Python interface for market data in FinAlly. Both the simulator and the Massive
API client implement the same abstract interface. All downstream code — SSE streaming,
trade execution, portfolio valuation — is completely source-agnostic.

## Design Goals

- **Single interface**: all callers interact with `MarketDataSource` and `PriceCache` only
- **Runtime selection**: factory function picks implementation from environment at startup
- **Async-native**: background tasks use asyncio; the Massive REST client (synchronous) is
  offloaded to a thread pool via `asyncio.to_thread`
- **Thread-safe cache**: `PriceCache` is shared between the background writer and multiple
  concurrent SSE readers

---

## Core Data Model

```python
# backend/app/market/models.py

from dataclasses import dataclass

@dataclass
class PriceUpdate:
    """A single price snapshot for one ticker."""
    ticker: str
    price: float
    previous_price: float
    timestamp: float        # Unix seconds (float)
    change: float           # price - previous_price (absolute)
    direction: str          # "up", "down", or "flat"
```

`PriceUpdate` is the only data structure that leaves the market data layer. Everything
downstream — SSE events, watchlist responses, portfolio valuation — is derived from it.

---

## Price Cache

Shared in-memory store: the background data source writes here; the SSE endpoint and
REST handlers read from here.

```python
# backend/app/market/cache.py

import time
from threading import Lock
from .models import PriceUpdate


class PriceCache:
    """Thread-safe in-memory cache of the latest price per ticker."""

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()

    def update(
        self,
        ticker: str,
        price: float,
        timestamp: float | None = None,
    ) -> PriceUpdate:
        """Record a new price. Returns the resulting PriceUpdate."""
        with self._lock:
            ts = timestamp if timestamp is not None else time.time()
            previous = self._prices.get(ticker)
            previous_price = previous.price if previous else price

            if price > previous_price:
                direction = "up"
            elif price < previous_price:
                direction = "down"
            else:
                direction = "flat"

            update = PriceUpdate(
                ticker=ticker,
                price=price,
                previous_price=previous_price,
                timestamp=ts,
                change=price - previous_price,
                direction=direction,
            )
            self._prices[ticker] = update
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        """Return the latest snapshot for one ticker, or None."""
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        """Return a copy of all current snapshots."""
        with self._lock:
            return dict(self._prices)

    def remove(self, ticker: str) -> None:
        """Evict a ticker from the cache (called on watchlist removal)."""
        with self._lock:
            self._prices.pop(ticker, None)
```

---

## Abstract Interface

```python
# backend/app/market/interface.py

from abc import ABC, abstractmethod


class MarketDataSource(ABC):
    """
    Abstract base class for market data providers.

    Implementations write price updates into a PriceCache on their own
    schedule. Callers never pull prices from the source directly — they
    read from the shared PriceCache instead.
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """
        Begin producing price updates for the given tickers.
        Starts an internal asyncio background task.
        """

    @abstractmethod
    async def stop(self) -> None:
        """Stop producing updates and clean up resources."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """
        Add a ticker to the active set.
        The data source should begin including it in subsequent updates.
        """

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """
        Remove a ticker from the active set and evict it from the cache.
        """

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return the current list of active tickers."""
```

---

## Factory Function

Selects the correct implementation at startup based on the environment:

```python
# backend/app/market/factory.py

import os
from .cache import PriceCache
from .interface import MarketDataSource


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """
    Return the appropriate MarketDataSource based on environment variables.

    - MASSIVE_API_KEY set and non-empty  ->  MassiveDataSource (real market data)
    - MASSIVE_API_KEY absent or empty    ->  SimulatorDataSource (GBM simulation)
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        from .massive_client import MassiveDataSource
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        from .simulator import SimulatorDataSource
        return SimulatorDataSource(price_cache=price_cache)
```

---

## Massive Implementation

```python
# backend/app/market/massive_client.py

import asyncio
from massive import RESTClient
from .cache import PriceCache
from .interface import MarketDataSource


class MassiveDataSource(MarketDataSource):
    """
    Polls the Massive REST API on a fixed interval and writes prices
    to the shared PriceCache.

    Free tier (5 req/min): use poll_interval=15.0
    Paid tier: use poll_interval=2.0 or 5.0
    """

    def __init__(
        self,
        api_key: str,
        price_cache: PriceCache,
        poll_interval: float = 15.0,
    ) -> None:
        self._client = RESTClient(api_key=api_key)
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = list(tickers)
        self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self._tickers:
            self._tickers.append(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _poll_loop(self) -> None:
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception as e:
                # Log and continue — never crash the background task
                print(f"[Massive] Poll error: {e}")
            await asyncio.sleep(self._interval)

    async def _poll_once(self) -> None:
        if not self._tickers:
            return
        # Offload synchronous Massive client to thread pool
        snapshots = await asyncio.to_thread(
            self._client.get_snapshot_all,
            market_type="stocks",
            tickers=list(self._tickers),
        )
        for snap in snapshots:
            if snap.last_trade is not None:
                self._cache.update(
                    ticker=snap.ticker,
                    price=snap.last_trade.price,
                    timestamp=snap.last_trade.timestamp / 1e9,  # ns -> seconds
                )
```

---

## Simulator Implementation

```python
# backend/app/market/simulator.py  (partial — see MARKET_SIMULATOR.md for GBMSimulator)

import asyncio
from .cache import PriceCache
from .interface import MarketDataSource
from .gbm import GBMSimulator   # See MARKET_SIMULATOR.md


class SimulatorDataSource(MarketDataSource):
    """
    Drives a GBMSimulator in an asyncio loop, writing prices to
    the PriceCache every 500ms.
    """

    def __init__(
        self,
        price_cache: PriceCache,
        update_interval: float = 0.5,
    ) -> None:
        self._cache = price_cache
        self._interval = update_interval
        self._tickers: list[str] = []
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._tickers = list(tickers)
        self._sim = GBMSimulator(tickers=self._tickers)
        # Seed the cache with initial prices so SSE has data from tick 0
        for ticker, price in self._sim.current_prices().items():
            self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self._tickers:
            self._tickers.append(ticker)
            if self._sim:
                self._sim.add_ticker(ticker)
                # Seed cache immediately so watchlist shows a price right away
                price = self._sim.get_price(ticker)
                if price is not None:
                    self._cache.update(ticker=ticker, price=price)

    async def remove_ticker(self, ticker: str) -> None:
        self._tickers = [t for t in self._tickers if t != ticker]
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _run_loop(self) -> None:
        while True:
            try:
                prices = self._sim.step()
                for ticker, price in prices.items():
                    self._cache.update(ticker=ticker, price=price)
            except asyncio.CancelledError:
                raise
            except Exception as e:
                print(f"[Simulator] Step error: {e}")
            await asyncio.sleep(self._interval)
```

---

## Integration with SSE

The SSE endpoint reads from `PriceCache` and pushes JSON to connected clients:

```python
# backend/app/routes/stream.py

import asyncio
import json
from fastapi import Request
from fastapi.responses import StreamingResponse
from ..market.cache import PriceCache


async def price_stream_generator(request: Request, price_cache: PriceCache):
    """Yield SSE events until client disconnects."""
    while True:
        if await request.is_disconnected():
            break

        prices = price_cache.get_all()
        if prices:
            payload = {
                ticker: {
                    "ticker": p.ticker,
                    "price": p.price,
                    "previous_price": p.previous_price,
                    "change": p.change,
                    "direction": p.direction,
                    "timestamp": p.timestamp,
                }
                for ticker, p in prices.items()
            }
            yield f"data: {json.dumps(payload)}\n\n"

        await asyncio.sleep(0.5)


def prices_sse(request: Request, price_cache: PriceCache) -> StreamingResponse:
    return StreamingResponse(
        price_stream_generator(request, price_cache),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
        },
    )
```

---

## Integration with Trade Execution

When filling a market order, the backend reads the current price from `PriceCache`:

```python
def get_current_price(ticker: str, price_cache: PriceCache) -> float:
    update = price_cache.get(ticker)
    if update is None:
        raise ValueError(f"No price data available for {ticker}")
    return update.price
```

---

## Application Lifecycle

```python
# backend/app/main.py  (simplified)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market.cache import PriceCache
from .market.factory import create_market_data_source
from .db import get_watchlist_tickers   # reads initial watchlist from SQLite

price_cache = PriceCache()
market_source = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global market_source

    # 1. Create price cache and data source
    market_source = create_market_data_source(price_cache)

    # 2. Load initial watchlist from DB and start streaming
    initial_tickers = get_watchlist_tickers(user_id="default")
    await market_source.start(initial_tickers)

    yield  # App runs

    # 3. Shutdown
    await market_source.stop()


app = FastAPI(lifespan=lifespan)
```

Watchlist routes call `market_source.add_ticker()` / `market_source.remove_ticker()`
directly after updating the SQLite `watchlist` table.

---

## File Structure

```
backend/
  app/
    market/
      __init__.py          # Exports PriceCache, MarketDataSource, create_market_data_source
      models.py            # PriceUpdate dataclass
      cache.py             # PriceCache (thread-safe)
      interface.py         # MarketDataSource ABC
      factory.py           # create_market_data_source()
      massive_client.py    # MassiveDataSource
      simulator.py         # SimulatorDataSource
      gbm.py               # GBMSimulator engine (see MARKET_SIMULATOR.md)
      seed_data.py         # SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS
```

All market data logic is isolated within `backend/app/market/`. Nothing outside this
package directly accesses the Massive client or the GBM math.
