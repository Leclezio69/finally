# Market Simulator

Approach and code structure for simulating realistic stock prices when no Massive API
key is configured.

## Overview

The simulator uses **Geometric Brownian Motion (GBM)** to generate realistic stock price
paths. GBM is the standard continuous-time model underlying the Black-Scholes
option-pricing formula. Its key properties make it well-suited for simulation:

- Prices are always positive (multiplicative, not additive)
- Returns are lognormally distributed, matching empirical stock data
- Parameterized by just two values: drift (`mu`) and volatility (`sigma`)

Updates run at ~500ms intervals. The effect on screen is a continuous stream of small
price moves — some tickers trending, some volatile, all correlated in sector groups —
that gives the dashboard a "live market" feel.

---

## GBM Math

At each time step, a price evolves as:

```
S(t + dt) = S(t) * exp((mu - sigma^2 / 2) * dt + sigma * sqrt(dt) * Z)
```

Where:
- `S(t)` — current price
- `mu` — annualized drift (e.g. `0.05` = 5% expected annual return)
- `sigma` — annualized volatility (e.g. `0.25` = 25%)
- `dt` — time step as a fraction of a trading year
- `Z` — standard normal random variable drawn from N(0, 1)

The term `(mu - sigma^2/2)` is the Ito correction that ensures the expected price grows
at rate `mu` rather than `mu + sigma^2/2`.

### Time Step Calculation

With 500ms updates, ~252 trading days per year, and ~6.5 trading hours per day:

```
dt = 0.5s / (252 days/year * 6.5 hours/day * 3600 s/hour)
   = 0.5 / 5,896,800
   ≈ 8.48e-8
```

This tiny `dt` ensures each tick produces sub-cent moves that accumulate naturally over
time. With `sigma=0.25`, the annualized vol translates to roughly 0.004% per tick,
which compounds to realistic intraday ranges.

---

## Correlated Moves

Real stocks don't move independently — tech stocks rise and fall together, financials
correlate with each other, etc. Ignoring correlation would produce uncanny, artificial
price paths.

We use **Cholesky decomposition** of a correlation matrix to generate correlated draws.

### Method

Given correlation matrix `C` (symmetric, positive definite), compute lower-triangular
factor `L` such that `C = L @ L.T`.

For each time step:
1. Draw `n` independent standard normals: `z_ind ~ N(0, I_n)`
2. Transform: `z_corr = L @ z_ind`
3. `z_corr[i]` and `z_corr[j]` now have the correlation specified in `C[i,j]`

```python
import numpy as np

corr = np.array([[1.0, 0.6, 0.6],
                 [0.6, 1.0, 0.6],
                 [0.6, 0.6, 1.0]])

L = np.linalg.cholesky(corr)

z_ind = np.random.standard_normal(3)
z_corr = L @ z_ind  # correlated draws
```

### Correlation Groups

| Group | Tickers | Intra-group corr | Cross-group corr |
|-------|---------|-----------------|-----------------|
| Tech | AAPL, GOOGL, MSFT, AMZN, META, NVDA, NFLX | 0.60 | 0.30 |
| Finance | JPM, V | 0.50 | 0.30 |
| Loner | TSLA | — | 0.30 (with everything) |
| Unknown | any other ticker | — | 0.30 |

When a new ticker is added, it is treated as an independent ticker (0.30 correlation
with all existing tickers) and the Cholesky matrix is rebuilt in O(n^2) time.

---

## Random Events

Every tick, each ticker has a small probability of a "news event" — a sudden 2–5%
move in either direction. This adds drama and makes the dashboard visually interesting.

```python
EVENT_PROBABILITY = 0.001   # 0.1% per tick per ticker

if random.random() < EVENT_PROBABILITY:
    shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
    price *= (1 + shock)
```

With 10 tickers and 2 ticks/second, the expected frequency of an event somewhere in the
watchlist is roughly once every 50 seconds — frequent enough to keep the display lively
without being absurd.

---

## Seed Prices and Per-Ticker Parameters

```python
# backend/app/market/seed_data.py

# Realistic starting prices for the default watchlist (as of late 2025)
SEED_PRICES: dict[str, float] = {
    "AAPL":  190.0,
    "GOOGL": 175.0,
    "MSFT":  420.0,
    "AMZN":  185.0,
    "TSLA":  250.0,
    "NVDA":  800.0,
    "META":  500.0,
    "JPM":   195.0,
    "V":     280.0,
    "NFLX":  600.0,
}

# Per-ticker GBM parameters
# sigma = annualized volatility; mu = annualized drift
TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL":  {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT":  {"sigma": 0.20, "mu": 0.05},
    "AMZN":  {"sigma": 0.28, "mu": 0.05},
    "TSLA":  {"sigma": 0.50, "mu": 0.03},  # High vol, erratic
    "NVDA":  {"sigma": 0.40, "mu": 0.08},  # High vol, strong upward drift
    "META":  {"sigma": 0.30, "mu": 0.05},
    "JPM":   {"sigma": 0.18, "mu": 0.04},  # Lower vol (bank)
    "V":     {"sigma": 0.17, "mu": 0.04},  # Lower vol (payments)
    "NFLX":  {"sigma": 0.35, "mu": 0.05},
}

# Fallback for tickers not in the seed list
DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}

# Seed price range for unknown tickers
UNKNOWN_TICKER_PRICE_RANGE = (50.0, 300.0)
```

---

## Full Implementation

```python
# backend/app/market/gbm.py

import math
import random
import numpy as np
from .seed_data import (
    SEED_PRICES,
    TICKER_PARAMS,
    DEFAULT_PARAMS,
    UNKNOWN_TICKER_PRICE_RANGE,
)

# dt for 500ms steps in a trading year (252 days * 6.5 hours * 3600 seconds)
TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600
DT = 0.5 / TRADING_SECONDS_PER_YEAR   # ≈ 8.48e-8

# Sector membership for correlation
TECH_TICKERS = {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"}
FINANCE_TICKERS = {"JPM", "V"}
LONER_TICKERS = {"TSLA"}

# Pairwise correlations
INTRA_TECH_CORR = 0.60
INTRA_FINANCE_CORR = 0.50
CROSS_SECTOR_CORR = 0.30
DEFAULT_CORR = 0.30

EVENT_PROBABILITY = 0.001
EVENT_SHOCK_RANGE = (0.02, 0.05)


class GBMSimulator:
    """
    Generates correlated GBM price paths for multiple tickers.

    Usage:
        sim = GBMSimulator(tickers=["AAPL", "TSLA"])
        sim.add_ticker("GOOGL")
        prices = sim.step()          # -> {"AAPL": 191.23, "TSLA": 248.77, "GOOGL": 174.10}
        sim.remove_ticker("TSLA")
    """

    def __init__(
        self,
        tickers: list[str],
        dt: float = DT,
        event_probability: float = EVENT_PROBABILITY,
    ) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        for ticker in tickers:
            self.add_ticker(ticker)

    def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the simulation. No-op if already present."""
        if ticker in self._prices:
            return
        self._tickers.append(ticker)
        self._prices[ticker] = SEED_PRICES.get(
            ticker,
            random.uniform(*UNKNOWN_TICKER_PRICE_RANGE),
        )
        self._params[ticker] = TICKER_PARAMS.get(ticker, DEFAULT_PARAMS)
        self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the simulation. No-op if not present."""
        if ticker not in self._prices:
            return
        self._tickers.remove(ticker)
        del self._prices[ticker]
        del self._params[ticker]
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """
        Advance one time step for all tickers.
        Returns {ticker: new_price} for all active tickers.
        """
        n = len(self._tickers)
        if n == 0:
            return {}

        # Generate correlated random normals
        z_independent = np.random.standard_normal(n)
        if self._cholesky is not None:
            z = self._cholesky @ z_independent
        else:
            z = z_independent

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            # GBM step: multiplicative log-normal increment
            drift = (mu - 0.5 * sigma ** 2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * float(z[i])
            self._prices[ticker] *= math.exp(drift + diffusion)

            # Random event (news shock)
            if random.random() < self._event_prob:
                shock = random.uniform(*EVENT_SHOCK_RANGE) * random.choice([-1, 1])
                self._prices[ticker] *= (1 + shock)

            result[ticker] = round(self._prices[ticker], 2)

        return result

    def get_price(self, ticker: str) -> float | None:
        """Return the current (un-stepped) price for a ticker."""
        return self._prices.get(ticker)

    def current_prices(self) -> dict[str, float]:
        """Return all current prices without advancing the simulation."""
        return {t: round(p, 2) for t, p in self._prices.items()}

    def _rebuild_cholesky(self) -> None:
        """
        Rebuild the Cholesky factor of the correlation matrix.
        Called whenever tickers are added or removed. O(n^2) but n < 50.
        """
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return

        # Build n x n correlation matrix
        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = _pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = rho
                corr[j, i] = rho

        self._cholesky = np.linalg.cholesky(corr)


def _pairwise_correlation(t1: str, t2: str) -> float:
    """Return the target correlation between two tickers."""
    t1_tech = t1 in TECH_TICKERS
    t2_tech = t2 in TECH_TICKERS
    t1_fin = t1 in FINANCE_TICKERS
    t2_fin = t2 in FINANCE_TICKERS

    if t1_tech and t2_tech:
        return INTRA_TECH_CORR
    if t1_fin and t2_fin:
        return INTRA_FINANCE_CORR

    # TSLA and all unknowns use default cross-sector correlation
    return DEFAULT_CORR
```

---

## Behavior Notes

### Price Floor
GBM prices can never reach zero or go negative — the `exp()` function is always
positive. Prices can drift very low or very high over long simulations, but realistic
GBM parameters (small drift, moderate vol) keep prices in plausible ranges for demo
durations.

### Tick Size
At `sigma=0.25` and `dt≈8.48e-8`, the per-tick standard deviation of log-returns is
`sigma * sqrt(dt) ≈ 0.000073`, or about 0.007%. For a $190 stock (AAPL), that's ~$0.01
per tick — sub-cent moves that round to meaningful price changes over seconds.

### Volatility vs. Reality
These `sigma` values correspond to annualized historical volatility. A day of
simulation (in wall-clock time at 2 ticks/second) is extremely compressed —
you'd need ~1.7 hours of simulation to cover one "trading day" of GBM time. In
practice the prices just drift entertainingly, which is the goal.

### Correlation Matrix Validity
The hardcoded correlations (0.60 tech, 0.50 finance, 0.30 cross) produce a
positive definite matrix for any combination of tickers because all off-diagonal
values are between 0 and 1 and the matrix is diagonally dominant. Cholesky
decomposition will not fail for these inputs.

### Adding Unknown Tickers
Any ticker symbol can be added at runtime (e.g., via AI chat: "add PYPL to my
watchlist"). Unknown tickers receive:
- A random seed price in the $50–$300 range
- Default GBM parameters: `sigma=0.25, mu=0.05`
- Default correlation of 0.30 with all existing tickers
- Immediate price seeding into `PriceCache` so the SSE stream shows data right away

### Event Frequency
With `event_probability=0.001` per tick per ticker and 2 ticks/second:
- Expected events per ticker per minute: `0.001 * 120 = 0.12`
- Expected events across 10 tickers per minute: `1.2`
- Roughly one dramatic move somewhere in the watchlist every minute

---

## File Structure

```
backend/
  app/
    market/
      gbm.py          # GBMSimulator class + _pairwise_correlation helper
      seed_data.py    # SEED_PRICES, TICKER_PARAMS, DEFAULT_PARAMS constants
      simulator.py    # SimulatorDataSource (wraps GBMSimulator in async loop)
```

`GBMSimulator` is a pure synchronous class with no I/O. It is wrapped by
`SimulatorDataSource` (in `simulator.py`) which runs the async event loop and writes
into `PriceCache`. This separation makes `GBMSimulator` independently testable with
`pytest` — no asyncio harness needed.

---

## Testing the Simulator

```python
# Unit test example (no asyncio needed)
from app.market.gbm import GBMSimulator

def test_prices_always_positive():
    sim = GBMSimulator(tickers=["AAPL", "TSLA", "NVDA"])
    for _ in range(1000):
        prices = sim.step()
        for ticker, price in prices.items():
            assert price > 0, f"{ticker} went non-positive: {price}"

def test_add_remove_ticker():
    sim = GBMSimulator(tickers=["AAPL"])
    sim.add_ticker("GOOGL")
    assert "GOOGL" in sim.step()
    sim.remove_ticker("GOOGL")
    assert "GOOGL" not in sim.step()

def test_unknown_ticker_gets_seed_price():
    sim = GBMSimulator(tickers=["FAKEXYZ"])
    price = sim.get_price("FAKEXYZ")
    assert 50.0 <= price <= 300.0
```
