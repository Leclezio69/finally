# Massive API Reference (formerly Polygon.io)

Reference documentation for the Massive (formerly Polygon.io) REST API as used in FinAlly.

## Overview

Polygon.io rebranded as Massive.com in October 2025. All existing API keys, accounts, and
integrations continue to work unchanged. The new API base is `api.massive.com`; the legacy
`api.polygon.io` endpoint remains supported during the transition period.

- **Base URL**: `https://api.massive.com`
- **Legacy URL**: `https://api.polygon.io` (still works)
- **Python package**: `massive` (`uv add massive` / `pip install -U massive`)
- **Min Python**: 3.9+
- **Auth header**: `Authorization: Bearer <API_KEY>`
- **Env var**: `MASSIVE_API_KEY` — the `RESTClient` reads this automatically

## Rate Limits

| Plan | Limit | Recommended Poll Interval |
|------|-------|--------------------------|
| Starter / Developer | 5 requests/minute | Every 15 seconds |
| Advanced / Business | Effectively unlimited | Every 2–5 seconds |

For FinAlly, all watched tickers are fetched in **one API call** per poll cycle using the
snapshot endpoint, which means even the free tier (5 req/min) is manageable.

## Data Freshness

| Plan | Data Latency |
|------|-------------|
| Starter / Developer | 15-minute delay |
| Advanced / Business | Real-time |

For production trading, use Advanced or Business. For demo/educational use (FinAlly's
primary use case), Starter is sufficient — or use the built-in simulator.

## Installation

```bash
uv add massive
# or
pip install -U massive
```

## Client Initialization

```python
from massive import RESTClient

# Reads MASSIVE_API_KEY from environment automatically (recommended)
client = RESTClient()

# Or pass key explicitly
client = RESTClient(api_key="your_key_here")

# With debug logging
client = RESTClient(trace=True, verbose=True)
```

---

## Endpoints Used in FinAlly

### 1. Full Market Snapshot — Primary Polling Endpoint

Fetches current price data for multiple tickers in a single API call. This is the
primary endpoint used by the Massive poller in FinAlly.

**REST**: `GET /v2/snapshot/locale/us/markets/stocks/tickers`

**Query parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `tickers` | string | Comma-separated list of ticker symbols (e.g., `AAPL,GOOGL,MSFT`). Omit to get all tickers. |
| `include_otc` | boolean | Include OTC securities. Default: `false`. |

**Python client**:
```python
from massive import RESTClient

client = RESTClient()

# Fetch snapshots for specific tickers — one API call
snapshots = client.get_snapshot_all(
    market_type="stocks",
    tickers=["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"],
)

for snap in snapshots:
    print(f"{snap.ticker}: ${snap.last_trade.price}")
    print(f"  Day change: {snap.todays_change_perc:.2f}%")
    print(f"  Prev close: ${snap.prev_day.close}")
    print(f"  Volume:     {snap.day.volume:,}")
    print(f"  Updated:    {snap.updated}")  # Unix nanoseconds
```

**Response structure** (per ticker in `tickers` array):
```json
{
  "ticker": "AAPL",
  "day": {
    "open": 190.50,
    "high": 192.30,
    "low": 189.10,
    "close": 191.75,
    "volume": 54321000,
    "vwap": 190.88
  },
  "min": {
    "open": 191.60,
    "high": 191.80,
    "low": 191.40,
    "close": 191.75,
    "volume": 120000,
    "accumulated_volume": 54321000
  },
  "last_trade": {
    "price": 191.75,
    "size": 200,
    "exchange": 4,
    "timestamp": 1675190399000000000
  },
  "last_quote": {
    "bid_price": 191.74,
    "bid_size": 5,
    "ask_price": 191.76,
    "ask_size": 3,
    "timestamp": 1675190399500000000
  },
  "prev_day": {
    "open": 189.00,
    "high": 191.00,
    "low": 188.50,
    "close": 190.00,
    "volume": 48000000,
    "vwap": 189.75
  },
  "todays_change": 1.75,
  "todays_change_perc": 0.921,
  "updated": 1675190399000000000
}
```

**Key fields for FinAlly**:
- `last_trade.price` — current price for display and trade execution
- `prev_day.close` — previous close, used to calculate day change
- `todays_change_perc` — pre-calculated day change percentage
- `last_trade.timestamp` — nanoseconds since epoch (divide by 1e9 for seconds)

---

### 2. Unified Snapshot — Alternative Multi-Ticker Endpoint

A newer v3 endpoint that supports filtering up to 250 tickers via `ticker.any_of`.
Returns richer data including market status. Useful if you need the `session` object
(with daily open/close/change) rather than the `day`/`prevDay` split from v2.

**REST**: `GET /v3/snapshot`

**Query parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `ticker.any_of` | string | Up to 250 comma-separated tickers |
| `type` | string | Asset class filter (e.g., `CS` for common stock) |
| `limit` | integer | Results per page. Default: 10, Max: 250 |
| `sort` | string | Field to sort by |
| `order` | string | `asc` or `desc` |

**Direct HTTP example**:
```python
import requests

response = requests.get(
    "https://api.massive.com/v3/snapshot",
    params={"ticker.any_of": "AAPL,TSLA,GOOGL", "limit": 50},
    headers={"Authorization": f"Bearer {api_key}"},
)

data = response.json()
for result in data.get("results", []):
    if "error" not in result:
        ticker = result["ticker"]
        price = result["last_trade"]["price"]
        change_pct = result["session"].get("change_percent", 0)
        print(f"{ticker}: ${price:.2f} ({change_pct:+.2f}%)")
```

**Result object fields**:
- `ticker` — symbol
- `name` — company name
- `market_status` — `"open"`, `"closed"`, `"early_trading"`, `"late_trading"`
- `last_trade.price` — most recent trade price
- `last_trade.timestamp` — nanoseconds since epoch
- `last_quote.bid` / `last_quote.ask` — current bid/ask
- `session.open`, `session.close`, `session.high`, `session.low` — today's OHLC
- `session.volume` — today's volume
- `session.change`, `session.change_percent` — day change
- `error` — present if this ticker had an error (e.g., invalid symbol)

**Note**: The v2 snapshot endpoint (`get_snapshot_all`) is simpler to use with the Python
client. The v3 endpoint is preferred when using raw HTTP or when you need the
`market_status` field to handle pre/post-market hours gracefully.

---

### 3. Previous Day Bar

Gets the previous trading day's OHLCV aggregates for a single ticker. Useful for
seeding initial prices or displaying yesterday's close.

**REST**: `GET /v2/aggs/ticker/{ticker}/prev`

**Python client**:
```python
client = RESTClient()
results = client.get_previous_close_agg(ticker="AAPL")

for agg in results:
    print(f"Previous close: ${agg.close:.2f}")
    print(f"OHLC: O={agg.open} H={agg.high} L={agg.low} C={agg.close}")
    print(f"Volume: {agg.volume:,}")
    print(f"Date (ms): {agg.timestamp}")
```

**Response** (`results` array, one entry):
```json
{
  "T": "AAPL",
  "o": 189.00,
  "h": 191.00,
  "l": 188.50,
  "c": 190.00,
  "v": 48000000,
  "vw": 189.75,
  "t": 1672531200000
}
```

---

### 4. Aggregate Bars (Historical OHLCV)

Historical candlestick bars over a date range. Not required for the core polling
loop, but useful for populating historical charts or seeding more accurate prices.

**REST**: `GET /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}`

**Python client**:
```python
aggs = []
for agg in client.list_aggs(
    ticker="AAPL",
    multiplier=1,
    timespan="day",       # "minute", "hour", "day", "week", "month", "quarter", "year"
    from_="2024-01-01",
    to="2024-01-31",
    limit=50000,           # max page size; auto-paginated
):
    aggs.append(agg)

for a in aggs:
    print(f"Date: {a.timestamp}, O={a.open} H={a.high} L={a.low} C={a.close} V={a.volume}")
```

**Timespan options**: `"second"`, `"minute"`, `"hour"`, `"day"`, `"week"`, `"month"`,
`"quarter"`, `"year"`

---

### 5. Last Trade and Last Quote

Individual endpoints for the single most recent trade or NBBO quote.

```python
# Most recent trade
trade = client.get_last_trade(ticker="AAPL")
print(f"Price: ${trade.price:.2f}, Size: {trade.size}")

# Most recent NBBO quote
quote = client.get_last_quote(ticker="AAPL")
print(f"Bid: ${quote.bid_price:.2f} x {quote.bid_size}")
print(f"Ask: ${quote.ask_price:.2f} x {quote.ask_size}")
```

---

## How FinAlly Uses the API

The Massive poller runs as an asyncio background task:

1. Collects the current watchlist tickers
2. Calls `get_snapshot_all()` with those tickers — **one API call per cycle**
3. Extracts `last_trade.price` and `prev_day.close` from each snapshot
4. Writes to the shared in-memory `PriceCache`
5. Sleeps for the poll interval, then repeats

```python
import asyncio
import time
from massive import RESTClient

async def poll_massive(
    api_key: str,
    get_tickers,        # callable returning list[str]
    price_cache,        # PriceCache instance
    interval: float = 15.0,
):
    """Background task: poll Massive API and update the price cache."""
    client = RESTClient(api_key=api_key)

    while True:
        tickers = get_tickers()
        if tickers:
            try:
                # Synchronous client call — run in thread pool to avoid blocking event loop
                snapshots = await asyncio.to_thread(
                    client.get_snapshot_all,
                    market_type="stocks",
                    tickers=tickers,
                )
                for snap in snapshots:
                    if snap.last_trade is not None:
                        price_cache.update(
                            ticker=snap.ticker,
                            price=snap.last_trade.price,
                            timestamp=snap.last_trade.timestamp / 1e9,  # ns -> seconds
                        )
            except Exception as e:
                # Log and continue — don't crash the background task
                print(f"[Massive] Poll error: {e}")

        await asyncio.sleep(interval)
```

---

## Error Handling

The `massive` client raises `requests.HTTPError` (via `urllib3`) for HTTP-level errors:

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Invalid API key | Check `MASSIVE_API_KEY` |
| 403 | Plan doesn't include endpoint | Upgrade plan |
| 429 | Rate limit exceeded | Increase poll interval |
| 5xx | Server error | Client retries 3x automatically |

```python
import requests

try:
    snapshots = client.get_snapshot_all(market_type="stocks", tickers=["AAPL"])
except requests.HTTPError as e:
    if e.response.status_code == 429:
        print("Rate limited — increase poll interval")
    elif e.response.status_code == 401:
        print("Invalid API key")
    else:
        raise
```

---

## Important Notes

- **Timestamp format**: API returns nanoseconds since epoch for trades/quotes; divide by
  `1e9` for Unix seconds or `1e3` for milliseconds
- **Snapshot resets**: Snapshot data clears at 3:30 AM EST daily and repopulates from
  ~4:00 AM EST as exchanges open
- **After-hours prices**: `last_trade.price` may reflect after-hours activity when
  market is closed; `prev_day.close` is the cleaner reference for day-change calculations
- **Single call for all tickers**: Always use `get_snapshot_all()` with multiple tickers
  rather than individual calls per ticker — this is essential for free-tier rate limits
- **OTC securities**: Excluded by default; pass `include_otc=True` if needed
- **Market status**: Use the v3 `/v3/snapshot` endpoint or `GET /v1/marketstatus/now`
  to check whether the market is currently open
