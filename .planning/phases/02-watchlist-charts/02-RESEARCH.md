# Phase 2: Watchlist & Charts — Research

**Researched:** 2026-06-28
**Domain:** React context architecture, lightweight-charts v5 API, SVG sparklines, SSE-driven UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Sparklines rendered as custom SVG polylines (not recharts, not lightweight-charts). 60px wide, 24px tall, no axes, no labels.
- **D-02:** Sparkline color: green if current price >= first price received since page load, red if lower. Determined by comparing against first SSE update, not tick direction.
- **D-03:** Buffer 100 price points per ticker (ring buffer / `slice(-100)`). ~50 seconds at 500ms tick rate.
- **D-04:** Use lightweight-charts (TradingView) for the main chart area. Single instance in the `chart` grid area.
- **D-05:** Price history data source: SSE buffer accumulated on the frontend. Same 100-point ring buffer feeds the main chart. No backend history API.
- **D-06:** Update strategy: call `series.update({ time, value })` on each new SSE tick. Do NOT call `setData()` on each tick.
- **D-07:** Add ticker: always-visible input field + Add button pinned to the bottom of the watchlist panel.
- **D-08:** Remove ticker: hover reveals an × button on the right side of each watchlist row.
- **D-09:** Create a new `WatchlistContext` (alongside `PriceContext`) that holds: `selectedTicker`, `setSelectedTicker`, `tickers`, `addTicker()`, `removeTicker()`.
- **D-10:** `WatchlistContext` owns all watchlist API calls: fetches `GET /api/watchlist` on mount; `addTicker()` calls `POST /api/watchlist`; `removeTicker()` calls `DELETE /api/watchlist/{ticker}`.
- **D-11:** Auto-select the first ticker from the watchlist on page load (when `WatchlistContext` fetches the initial list).
- **D-12:** Clicking a watchlist row calls `setSelectedTicker(ticker)`. Main chart area reads `selectedTicker` via `useWatchlist()`.

### Claude's Discretion
- Watchlist row layout / data density: ticker symbol, current price, change %, sparkline SVG. Column widths and exact styling.
- Time axis display on the main lightweight-charts chart (wall clock or relative).
- Chart series type: area or line (area chosen per UI-SPEC).
- Crosshair / tooltip behavior on the main chart.
- Input validation feedback for the add-ticker field.
- Ticker input auto-uppercase behavior.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WATCH-01 | User sees a watchlist panel with the 10 default tickers on first load | WatchlistContext fetches GET /api/watchlist on mount; default seed data confirmed in backend |
| WATCH-02 | Each ticker row shows: symbol, current price, daily change %, and a sparkline mini-chart | WatchlistRow component reads from WatchlistContext priceHistory + usePrice(); SVG sparkline calculated inline |
| WATCH-03 | Prices update live via SSE (EventSource connected to /api/stream/prices) | PriceContext.tsx already owns the EventSource; WatchlistContext reads from it via useContext |
| WATCH-04 | Price cells flash green (uptick) or red (downtick) with CSS transition fading over ~500ms | .flash-up / .flash-down already defined in globals.css; apply via useRef + className + setTimeout |
| WATCH-05 | Sparklines accumulate price history from SSE events since page load (grow progressively) | WatchlistContext maintains priceHistory Record<string, number[]>; WatchlistRow reads its own buffer |
| WATCH-06 | User can add a ticker via input field; ticker appears in watchlist and starts streaming | addTicker() in WatchlistContext calls POST /api/watchlist; backend's add_ticker() on market source starts streaming |
| WATCH-07 | User can remove a ticker from the watchlist | removeTicker() calls DELETE /api/watchlist/{ticker}; row removed from tickers state |
| CHART-01 | Clicking a ticker in the watchlist selects it and displays it in the main chart area | setSelectedTicker() in WatchlistContext; MainChart reads selectedTicker and calls series.setData() |
| CHART-02 | Main chart shows price over time for the selected ticker (canvas-based, lightweight-charts) | lightweight-charts v5.2.0 confirmed on npm; addSeries(AreaSeries, opts) API confirmed |
| CHART-03 | First ticker is auto-selected on page load | D-11: WatchlistContext sets selectedTicker to tickers[0] after GET /api/watchlist resolves |
| VIS-03 | Desktop-first dense layout — every panel visible without scrolling on a wide screen | Grid layout already established in layout.tsx; components mount into watch/chart areas |
| VIS-04 | Professional terminal aesthetic inspired by Bloomberg/trading workstations | Color scheme and typography defined in UI-SPEC.md; monospace font stack in globals.css |
</phase_requirements>

---

## Summary

Phase 2 builds two panels into the existing CSS Grid shell: the live watchlist panel (left column, `watch` area) and the main chart area (center, `chart` area). The scaffold from Phase 1 provides the grid layout, dark theme, Tailwind v4 CSS variables, flash animation keyframes, and the `PriceContext` SSE singleton. Phase 2 adds a `WatchlistContext` layer on top of `PriceContext` to coordinate tickers, price history buffers, and selected ticker state.

The critical dependency is `lightweight-charts` which is NOT yet in `package.json` and must be installed. The current npm latest is v5.2.0 — published by TradingView (confirmed official). v5 has a breaking change from v4: `chart.addAreaSeries(opts)` is replaced by `chart.addSeries(AreaSeries, opts)` where `AreaSeries` is an imported definition object, not a class. The SSE `timestamp` field is already Unix seconds (float), which is exactly what lightweight-charts `UTCTimestamp` expects — cast with `as UTCTimestamp` to satisfy TypeScript.

The `WatchlistContext` must maintain a `priceHistory: Record<string, number[]>` ring buffer. It subscribes to `PriceContext` via `useContext(PriceContext)` and a `useEffect` with `prices` in its dependency array. This is the only viable integration point given D-09 assigns `priceHistory` ownership to `WatchlistContext`. The primary performance risk is that `prices` is a new object reference on every SSE tick, which triggers the `useEffect` in `WatchlistContext` and mutates the history buffer. However, since buffer mutation via `slice(-100)` is O(1) and only runs in a context provider (not per-row), the overhead is acceptable.

**Primary recommendation:** Install `lightweight-charts@5.2.0`, implement `WatchlistContext` with price history accumulation, build `WatchlistPanel` + `WatchlistRow` + inline SVG sparklines, and build `MainChart` using the v5 `addSeries(AreaSeries, ...)` API.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SSE price streaming | Frontend (Browser) | — | EventSource is browser API; PriceContext already owns the connection |
| Watchlist state / ticker list | Frontend Context | Backend API | WatchlistContext is source of truth; syncs to backend via REST calls |
| Price history ring buffer | Frontend Context | — | D-09/D-05 lock this to WatchlistContext; no backend history endpoint used |
| Sparkline rendering | Browser (SVG) | — | Inline SVG polyline; purely display logic in WatchlistRow |
| Main chart rendering | Browser (Canvas) | — | lightweight-charts is canvas-based; renders in MainChart component |
| Watchlist persistence | Backend API + SQLite | — | `/api/watchlist` endpoints persist tickers; frontend reads on mount |
| Add/remove ticker to streaming | Backend Market Source | — | Backend's `add_ticker()` / `remove_ticker()` on market data source updates the SSE stream |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lightweight-charts` | 5.2.0 | Canvas-based financial chart for main chart area | TradingView's official library; locked in D-04; Bloomberg-like aesthetics |
| `react` | 19.2.4 (installed) | UI rendering | Already installed; React 19 with concurrent rendering |
| `next` | 16.2.9 (installed) | App framework + static export | Already installed; no change |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser `EventSource` | Native | SSE connection | Already used in PriceContext; no library needed |
| Browser `ResizeObserver` | Native | Chart container resize detection | Observe `chartContainerRef.current` in MainChart useEffect |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `lightweight-charts` | `recharts` | recharts is React-native but lower performance for real-time; D-04 locks the choice |
| Custom SVG sparklines | recharts sparklines | D-01 locks SVG; custom approach avoids adding a dependency for 60×24px graphics |
| `slice(-100)` ring buffer | circular-buffer package | No dependency needed; `slice(-100)` is idiomatic JS and sufficient for 100 items |

**Installation:**
```bash
cd /Users/richardleclezio/projects/finally/frontend && npm install lightweight-charts@5.2.0
```

**Version verification:** [VERIFIED: npm registry] `lightweight-charts@5.2.0` — published 2026-04-24 by tradingview org. Repository: github.com/tradingview/lightweight-charts. No `postinstall` script.

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. Manual verification performed instead.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `lightweight-charts` | npm | ~7 years (first: 2019-05-28) | High (TradingView official) | github.com/tradingview/lightweight-charts | N/A | Approved — official TradingView package, VERIFIED via npm registry metadata and official docs at tradingview.github.io |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. Package verified via official source (tradingview.github.io/lightweight-charts) and npm registry metadata (published by tradingview org, 7-year history, no postinstall script). Confidence: HIGH.*

---

## Research: Phase 2 — Watchlist & Charts

### 1. lightweight-charts API (v5.2.0)

**Status:** NOT YET INSTALLED. Must be added to `frontend/package.json`.

**v5 Breaking Change from v4** [VERIFIED: tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5]

v4 per-type methods are gone. v5 uses a single unified method:

```typescript
// v4 (WRONG — will not work):
const series = chart.addAreaSeries({ topColor: '...' })

// v5 (CORRECT):
import { createChart, AreaSeries, ColorType } from 'lightweight-charts'
const series = chart.addSeries(AreaSeries, { topColor: '...' })
```

**createChart API** [VERIFIED: tradingview.github.io/lightweight-charts/docs/api/functions/createChart]

```typescript
createChart(
  container: string | HTMLElement,
  options?: DeepPartial<TimeChartOptions>
): IChartApi
```

**IChartApi key methods** [VERIFIED: tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi]

```typescript
chart.addSeries(AreaSeries, options)    // Add area series (v5 API)
chart.applyOptions(options)             // Update chart options (used for resize)
chart.resize(width, height)             // Explicit resize method
chart.timeScale()                       // Returns ITimeScaleApi
chart.remove()                          // Destroy chart + DOM cleanup (call in useEffect cleanup)
```

**ISeriesApi key methods** [VERIFIED: tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi]

```typescript
series.update({ time, value })    // Append one data point (or update latest if same time)
series.setData([...])             // Replace all data (call on ticker switch)
series.applyOptions(options)      // Update series visual options
```

**UTCTimestamp** [VERIFIED: tradingview.github.io/lightweight-charts/docs/api/type-aliases/UTCTimestamp]

- Type alias: `Nominal<number, "UTCTimestamp">`
- Unit: **Unix seconds** (NOT milliseconds)
- The SSE `timestamp` field from the backend is already Unix seconds (float from `time.time()`)
- TypeScript cast required: `update.timestamp as UTCTimestamp`

```typescript
import { UTCTimestamp } from 'lightweight-charts'
series.update({ time: update.timestamp as UTCTimestamp, value: update.price })
```

**React useEffect pattern** [VERIFIED: tradingview.github.io/lightweight-charts/tutorials/react/simple]

```typescript
'use client'
import { createChart, AreaSeries, ColorType, UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

export function MainChart() {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const seriesRef = useRef<ReturnType<typeof chartRef.current.addSeries> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#8b949e',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#161b22' },
      },
      crosshair: { mode: 1 }, // Magnet mode
      timeScale: { borderColor: '#30363d' },
      rightPriceScale: { borderColor: '#30363d' },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    chartRef.current = chart

    const series = chart.addSeries(AreaSeries, {
      topColor: 'rgba(32, 157, 215, 0.4)',
      bottomColor: 'rgba(32, 157, 215, 0.0)',
      lineColor: '#209dd7',
      lineWidth: 2,
    })
    seriesRef.current = series

    // ResizeObserver for container resize
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.resize(width, height)
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, []) // Mount once

  // ...separate useEffect for data updates
}
```

**ResizeObserver vs window resize:** Use `ResizeObserver` on the container element directly, not `window.addEventListener('resize')`. The container element's size is what matters, and ResizeObserver avoids the need to compute dimensions manually.

**React Strict Mode double-mounting:** In development, React 18+ Strict Mode runs effects twice (mount → unmount → remount). The cleanup `chart.remove()` handles this cleanly. However, note that `seriesRef.current` will be the second mount's series after the double-mount — this is fine because both the chart and series refs are reassigned on remount.

**Static export / SSR guard:** lightweight-charts uses browser APIs (HTMLCanvasElement). In Next.js static export, components with `'use client'` run only in the browser, so no SSR guard is needed as long as the component has `'use client'` at the top. Do NOT use `dynamic(() => import(...), { ssr: false })` unless the component is imported from a Server Component — since `page.tsx` renders placeholders today and will import `MainChart` directly, `'use client'` on `MainChart` is sufficient.

---

### 2. WatchlistContext Architecture

**Decision D-09 locks:** `WatchlistContext` owns `priceHistory`. This means WatchlistContext must observe PriceContext's `prices` map and update its own ring buffers.

**Integration approach (Option A — mandated by D-09):**

```typescript
// frontend/app/providers/WatchlistContext.tsx
'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { PriceContext } from './PriceContext'

type WatchlistContextValue = {
  tickers: string[]
  selectedTicker: string | null
  setSelectedTicker: (ticker: string) => void
  priceHistory: Record<string, number[]>        // raw price values, 100-point ring buffer
  addTicker: (ticker: string) => Promise<void>
  removeTicker: (ticker: string) => Promise<void>
}

export const WatchlistContext = createContext<WatchlistContextValue>(...)

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const { prices } = useContext(PriceContext)
  const [tickers, setTickers] = useState<string[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const priceHistoryRef = useRef<Record<string, number[]>>({})
  const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({})

  // Mount: fetch initial watchlist
  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(data => {
        const list: string[] = data.tickers.map((t: { ticker: string }) => t.ticker)
        setTickers(list)
        setSelectedTicker(list[0] ?? null)  // D-11: auto-select first
      })
  }, [])

  // Subscribe to PriceContext price updates; accumulate ring buffers
  useEffect(() => {
    const updated: Record<string, number[]> = { ...priceHistoryRef.current }
    let changed = false
    for (const [ticker, update] of Object.entries(prices)) {
      const prev = updated[ticker] ?? []
      const next = [...prev, update.price].slice(-100)  // D-03: 100-point ring buffer
      updated[ticker] = next
      changed = true
    }
    if (changed) {
      priceHistoryRef.current = updated
      setPriceHistory(updated)
    }
  }, [prices])
  // ...
}
```

**Key architectural points:**

1. `prices` from `PriceContext` is a new object reference on every SSE tick (due to `setPrices(prev => ({ ...prev, [ticker]: data }))` in PriceContext). This means the `useEffect([prices])` in WatchlistContext fires on every tick — by design.

2. The `priceHistoryRef` avoids a closure stale-state problem: without it, the useEffect closure would capture stale `priceHistory` state and overwrite accumulated history.

3. `setPriceHistory` triggers a re-render of WatchlistProvider, which propagates to all consumers. To prevent per-tick re-renders of all 10 WatchlistRow components, consider using `React.memo` on `WatchlistRow` and passing only the specific ticker's history slice as a stable prop.

4. **Alternative (simpler) approach:** Store `priceHistory` as a `useRef` only (no state) and let each `WatchlistRow` compute its sparkline directly from `usePrice(ticker)` by maintaining its own local history buffer in a `useRef`. This avoids centralizing history in context entirely. HOWEVER, D-09 explicitly locks `priceHistory` to WatchlistContext, so this alternative is out of scope.

5. **The UI-SPEC defines `priceHistory` as `Record<string, number[]>`** (raw price values), not `Array<{time, value}>`. This is the right shape for sparklines. The MainChart component converts to `{time: UTCTimestamp, value: number}` pairs using the SSE timestamp separately.

**WatchlistProvider placement in layout.tsx:** Add `WatchlistProvider` wrapping children inside `PriceProvider` (WatchlistProvider needs PriceContext to be available above it):

```typescript
<PriceProvider>
  <WatchlistProvider>
    {children}
  </WatchlistProvider>
</PriceProvider>
```

---

### 3. Price Flash Animation Pattern

The `.flash-up` and `.flash-down` CSS classes are already defined in `globals.css`:

```css
.flash-up  { animation: flash-up  500ms ease-out forwards; }
.flash-down { animation: flash-down 500ms ease-out forwards; }
```

The animation uses `forwards` fill mode, meaning the element stays at the end state (transparent) after 500ms. The class must be **removed and re-added** to restart the animation when a new tick arrives.

**Correct React pattern — useRef to avoid stale closure:**

```typescript
'use client'
import { useEffect, useRef } from 'react'
import { usePrice } from '../providers/PriceContext'

function WatchlistRow({ ticker }: { ticker: string }) {
  const update = usePrice(ticker)
  const priceCellRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!update || !priceCellRef.current) return
    const el = priceCellRef.current

    // Clear any in-progress flash and cancel pending timer
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    el.classList.remove('flash-up', 'flash-down')

    // Force reflow to restart CSS animation
    void el.offsetHeight

    // Apply new flash class
    if (update.direction === 'up') el.classList.add('flash-up')
    else if (update.direction === 'down') el.classList.add('flash-down')

    // Remove after animation completes
    flashTimerRef.current = setTimeout(() => {
      el.classList.remove('flash-up', 'flash-down')
      flashTimerRef.current = null
    }, 500)

    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    }
  }, [update])

  return (
    <div ref={priceCellRef}>
      {update?.price.toFixed(2)}
    </div>
  )
}
```

**Key details:**
- `void el.offsetHeight` forces a style recalculation (reflow), which resets the CSS animation so it replays from 0% even if the same class is re-applied.
- `clearTimeout` before `setTimeout` prevents stacking timers if two ticks arrive within 500ms.
- The `useEffect` return cleanup cancels the timer on unmount to prevent memory leaks.
- Flash applies only to the **price cell** element (`priceCellRef`), not the entire row.

---

### 4. SVG Sparkline Calculation

Per D-01, D-02, D-03 and the UI-SPEC:

**Dimensions:** 60×24px SVG, single `<polyline>`, stroke width 1.5px, fill none.

**X calculation:**
```typescript
const x = points.length <= 1
  ? 30  // center single point
  : (index / (points.length - 1)) * 60
```

**Y calculation (2px...22px range):**
```typescript
const min = Math.min(...points)
const max = Math.max(...points)
const range = max - min

const y = range === 0
  ? 12  // flat line: center vertically at 12px (midpoint of 24px)
  : 22 - ((price - min) / range) * 20  // map [min,max] → [22,2]
```

Note the Y inversion: SVG Y=0 is top, so higher prices → lower Y value. The formula maps:
- `price === max` → Y = 2px (top padding)
- `price === min` → Y = 22px (bottom padding)

**Edge cases:**
- **0 points:** Render nothing (empty SVG or `null`)
- **1 point:** Render a horizontal line or dot at center — `<polyline points="0,12 60,12" />` or skip rendering
- **All same price:** `range === 0` → Y = 12 for all points → flat horizontal line at midpoint
- **100 points (max buffer):** X spacing = 60/99 ≈ 0.6px per point — very dense but valid

**Color per D-02:**
```typescript
// Compare current price to FIRST price in buffer (index 0)
const firstPrice = priceHistory[ticker]?.[0] ?? 0
const currentPrice = priceHistory[ticker]?.slice(-1)[0] ?? 0
const sparkColor = currentPrice >= firstPrice ? '#22c55e' : '#ef4444'
```

**Complete Sparkline component:**
```typescript
function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <svg width={60} height={24} />

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * 60
      const y = range === 0 ? 12 : 22 - ((p - min) / range) * 20
      return `${x},${y}`
    })
    .join(' ')

  const color = prices[prices.length - 1] >= prices[0] ? '#22c55e' : '#ef4444'

  return (
    <svg width={60} height={24} style={{ display: 'block' }}>
      <polyline
        points={points}
        stroke={color}
        strokeWidth={1.5}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
```

---

### 5. File Structure

All files to create or modify for Phase 2:

**NEW FILES:**
```
frontend/app/providers/WatchlistContext.tsx     # WatchlistContext + WatchlistProvider + useWatchlist
frontend/app/components/watchlist/WatchlistPanel.tsx    # Panel shell (header, list, add-ticker area)
frontend/app/components/watchlist/WatchlistRow.tsx      # Single ticker row with flash + sparkline
frontend/app/components/watchlist/Sparkline.tsx         # Inline SVG polyline component
frontend/app/components/chart/MainChart.tsx             # lightweight-charts canvas component
```

**MODIFIED FILES:**
```
frontend/app/layout.tsx        # Add <WatchlistProvider> inside <PriceProvider>
frontend/app/page.tsx          # Replace PlaceholderPanel stubs in 'watch' and 'chart' areas
frontend/package.json          # Add lightweight-charts@5.2.0 dependency
frontend/package-lock.json     # Updated by npm install
```

**Component directory convention:** The Phase 1 SUMMARY notes no `components/` directory exists yet. Creating `frontend/app/components/watchlist/` and `frontend/app/components/chart/` establishes the pattern for future phases.

---

### 6. Performance Considerations

**Re-render analysis at 500ms tick rate for 10 tickers:**

1. `PriceContext.setPrices()` → rerenders all `PriceContext` consumers
2. `WatchlistContext` subscribes to `prices` via `useEffect([prices])` → runs buffer update on every tick
3. Each `WatchlistRow` calls `usePrice(ticker)` → rerenders on each tick for its ticker
4. `Sparkline` rerenders with new `prices` array on each tick

At 10 tickers × 2Hz = 20 rerenders/sec of WatchlistRow. Each rerender is a lightweight DOM diff + SVG recalculation of up to 100 points. `Math.min(...prices)` and `Math.max(...prices)` on 100 numbers is negligible.

**Optimization recommendations:**

- **`React.memo` on `WatchlistRow`:** Prevents re-renders if the row's specific ticker data hasn't changed. However, since prices update every 500ms for all tickers simultaneously, memo provides no benefit here — every row will re-render. Skip `React.memo` for simplicity.

- **`React.memo` on `Sparkline`:** Since `Sparkline` receives a new `prices` array reference on every tick (due to `slice(-100)` creating a new array), memo won't help without a custom comparator. Skip.

- **Avoid `Math.min/max` with spread on large arrays:** `Math.min(...array)` uses the call stack and can fail with very large arrays. For 100 items it is safe. As an alternative, `Array.prototype.reduce` avoids spread but is not necessary at this scale.

- **Ring buffer mutation:** `[...prev, update.price].slice(-100)` creates two new arrays per tick per ticker. For 10 tickers at 2Hz = 20 new arrays/sec — well within browser GC capacity. No optimization needed.

- **Ref-based history (if re-render performance becomes an issue):** Store `priceHistoryRef.current` as the live buffer and only `setPriceHistory(...)` to schedule a render. WatchlistRow can read from the ref directly during render if passed via context. This is premature optimization for this phase.

**MainChart re-render isolation:**

The MainChart component should read `selectedTicker` from `useWatchlist()` and subscribe to the selected ticker's price via `usePrice(selectedTicker)`. On each SSE tick, it calls `seriesRef.current.update(...)` directly on the canvas — this does NOT cause a React re-render. The chart is updated imperatively via the ref, not via state.

```typescript
// In MainChart useEffect for data updates:
useEffect(() => {
  if (!update || !seriesRef.current) return
  seriesRef.current.update({
    time: update.timestamp as UTCTimestamp,
    value: update.price,
  })
}, [update])  // update = usePrice(selectedTicker)
```

---

### 7. Pitfalls and Landmines

**Pitfall 1: lightweight-charts v5 API confusion**
- What goes wrong: Using `chart.addAreaSeries(opts)` (v4 API) — throws "chart.addAreaSeries is not a function".
- Why it happens: Training data and most tutorials target v4. v5 released with breaking change.
- How to avoid: Import `AreaSeries` from `'lightweight-charts'` and call `chart.addSeries(AreaSeries, opts)`.
- Warning signs: TypeScript will catch this — `addAreaSeries` does not exist on `IChartApi` in v5.

**Pitfall 2: UTCTimestamp unit mismatch**
- What goes wrong: Passing `Date.now()` (milliseconds) as UTCTimestamp → chart renders ~50 years in the future.
- Why it happens: `Date.now()` returns ms; UTCTimestamp expects seconds.
- How to avoid: The SSE `timestamp` from the backend is already Unix seconds (float from Python `time.time()`). Use `update.timestamp as UTCTimestamp` directly — do NOT divide by 1000 again.
- Warning signs: Chart time axis shows years like 2040+ or jumps wildly on first render.

**Pitfall 3: CSS animation restart without reflow**
- What goes wrong: Removing and immediately re-adding `.flash-up` does nothing — the browser doesn't restart the animation.
- Why it happens: The browser batches style changes; removing and re-adding the same class in the same JS task is a no-op.
- How to avoid: Force a reflow between remove and add: `void el.offsetHeight` (reads layout, causing a synchronous reflow).
- Warning signs: Flash only works on the first price update; subsequent updates show no animation.

**Pitfall 4: stale closure in WatchlistContext price history accumulation**
- What goes wrong: `useEffect` closes over stale `priceHistory` state → history always has only the latest single tick.
- Why it happens: `setPriceHistory(prev => ...)` requires the functional update form; direct closure over `priceHistory` reads stale state.
- How to avoid: Use a `useRef` (`priceHistoryRef.current`) as the mutable accumulator; call `setPriceHistory({ ...priceHistoryRef.current })` to trigger renders with the latest ref value.
- Warning signs: Sparklines only ever show 1-2 data points; sparkline never grows.

**Pitfall 5: lightweight-charts SSR / static export**
- What goes wrong: Build fails with "HTMLCanvasElement is not defined" or similar during `next build`.
- Why it happens: `createChart` accesses `document` / canvas APIs which don't exist in Node.js during static export generation.
- How to avoid: Ensure `MainChart` has `'use client'` at the top. In Next.js static export with `'use client'`, the component is excluded from server-side rendering. Do NOT call `createChart` at module level — only inside `useEffect`.
- Warning signs: Build error mentioning `canvas`, `document`, or `window` not defined.

**Pitfall 6: WatchlistContext consuming PriceContext before PriceProvider mounts**
- What goes wrong: `useWatchlist()` or `useContext(PriceContext)` inside `WatchlistProvider` returns default values.
- Why it happens: Component is rendered outside the provider tree.
- How to avoid: In `layout.tsx`, wrap in correct order: `<PriceProvider><WatchlistProvider>{children}</WatchlistProvider></PriceProvider>`. PriceProvider must be the outer wrapper.
- Warning signs: `prices` is always `{}` inside WatchlistContext; price history never accumulates.

**Pitfall 7: `page.tsx` is a Server Component (no `'use client'`)**
- What goes wrong: Adding interactive components directly inside `page.tsx` causes a build error.
- Why it happens: `page.tsx` has no `'use client'` directive — it's a Server Component. Cannot use hooks or event handlers.
- How to avoid: Import `WatchlistPanel` and `MainChart` as separate `'use client'` components into `page.tsx`. The server component can import client components.
- Warning signs: "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with 'use client'."

**Pitfall 8: `chart.resize()` called before chart is initialized**
- What goes wrong: ResizeObserver fires immediately on `observe()`, calling `chart.resize()` before the chart is assigned to `chartRef.current`.
- Why it happens: ResizeObserver calls back synchronously on first observation in some browsers.
- How to avoid: Guard the resize callback: `if (chartRef.current) chartRef.current.resize(width, height)`.

**Pitfall 9: selectedTicker ticker switch — stale series data**
- What goes wrong: Switching tickers shows the new ticker's history starting from where the old ticker left off visually.
- Why it happens: `series.update()` only appends; it doesn't clear old data.
- How to avoid: On `selectedTicker` change, call `series.setData(historyAsTimeSeries)` first, then continue with `series.update()` per tick. Also call `chart.timeScale().scrollToRealTime()` to show the latest data.

---

### 8. Build Validation Checklist

After implementing Phase 2, verify:

1. **TypeScript:** `cd frontend && npx tsc --noEmit` — 0 errors. Specifically verify:
   - `AreaSeries` imported from `'lightweight-charts'` (not `addAreaSeries`)
   - `UTCTimestamp` cast used on timestamp values
   - All new components have `'use client'` directive
   - `WatchlistContext` default value matches `WatchlistContextValue` type

2. **Build:** `npm run build` exits 0. Static export regenerated to `frontend/out/`.

3. **No dynamic imports required:** `'use client'` on MainChart is sufficient for static export. Verify no `dynamic(() => import(...), { ssr: false })` was used unnecessarily.

4. **Flash animation:** Open browser, watch a price update — price cell should flash green/red and fade within 500ms.

5. **Sparkline growth:** On page load, sparklines start empty (or with 1 point) and grow progressively as SSE data arrives. After ~50 seconds, sparklines show 100 points.

6. **Main chart ticker switch:** Click a different ticker in the watchlist — chart should switch to that ticker's accumulated history immediately.

7. **Add ticker:** Type "PYPL" in the add ticker input, press Enter or click "Add Ticker". Ticker appears in watchlist and starts receiving price updates.

8. **Remove ticker:** Hover over a watchlist row, click ×. Ticker disappears. If it was selected, first remaining ticker is auto-selected.

9. **SSE connection indicator:** Header shows green dot (already in Phase 1 LIVE text — Phase 3 will upgrade this to a proper indicator per PORT-03, but ensure Phase 2 doesn't break existing header).

---

### 9. Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — this section is required.

**Test Framework:**

| Property | Value |
|----------|-------|
| Framework | None installed in frontend yet |
| Config file | None — Wave 0 must install |
| Quick run command | `cd frontend && npx tsc --noEmit` (type check as proxy) |
| Full suite command | `npm run build` (static export build) |

Note: The project's primary validation for frontend phases is `npx tsc --noEmit` + `npm run build`. No React unit testing framework (Jest/Vitest/RTL) is currently installed. The existing E2E tests (Playwright in `test/`) are the integration layer but require the full Docker container (Phase 5 scope).

**Phase Requirements → Test Map:**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WATCH-01 | 10 default tickers visible on load | Build smoke | `npm run build` | ❌ Wave 0 — not applicable (build-time only) |
| WATCH-02 | Each row shows symbol, price, change %, sparkline | Type check | `npx tsc --noEmit` | ❌ Wave 0 |
| WATCH-03 | Prices update via SSE | Manual / E2E | Playwright (Phase 5) | ❌ Deferred |
| WATCH-04 | Price flash animation | Manual | Visual inspection | Manual only |
| WATCH-05 | Sparklines grow progressively | Manual / E2E | Playwright (Phase 5) | ❌ Deferred |
| WATCH-06 | Add ticker works | Manual / E2E | Playwright (Phase 5) | ❌ Deferred |
| WATCH-07 | Remove ticker works | Manual / E2E | Playwright (Phase 5) | ❌ Deferred |
| CHART-01 | Click ticker selects it in chart | Manual / E2E | Playwright (Phase 5) | ❌ Deferred |
| CHART-02 | Main chart renders with lightweight-charts | Build smoke | `npm run build` | ❌ Wave 0 |
| CHART-03 | First ticker auto-selected | Manual | Visual inspection | Manual only |
| VIS-03 | Dense layout, no scrolling | Manual | Visual inspection | Manual only |
| VIS-04 | Terminal aesthetic | Manual | Visual inspection | Manual only |

**Sampling Rate:**
- Per task: `cd frontend && npx tsc --noEmit` (fast, catches type errors)
- Per wave merge: `cd frontend && npm run build` (full static export)
- Phase gate: `npm run build` exits 0 + manual visual check of all 12 requirements

**Wave 0 Gaps:**
- [ ] No testing framework installed — deferred to Phase 5 (Playwright E2E covers integration scenarios)
- [ ] `frontend/package.json` missing `lightweight-charts` — install before any implementation task

*No frontend unit test infrastructure exists or is planned for this phase. The build pipeline (`tsc --noEmit` + `npm run build`) serves as the automated quality gate. Visual inspection and Playwright E2E (Phase 5) provide behavioral coverage.*

---

## Architecture Patterns

### System Architecture Diagram

```
SSE Stream (/api/stream/prices)
        |
        v
[PriceContext] (EventSource singleton)
  prices: Record<string, PriceUpdate>   <-- new ref on every 500ms tick
        |
        +---> [WatchlistContext] (useEffect on prices)
        |       tickers: string[]
        |       selectedTicker: string | null
        |       priceHistory: Record<string, number[]>  <-- 100-pt ring buffer per ticker
        |              |
        |              +---> [WatchlistPanel]
        |              |         |
        |              |         +---> [WatchlistRow] x10  (usePrice(ticker) for flash)
        |              |                   |
        |              |                   +---> [Sparkline]  (pure SVG, no deps)
        |              |
        |              +---> [MainChart]  (lightweight-charts canvas)
        |                       seriesRef.update({time, value}) on each tick (imperative, no re-render)
        |                       series.setData([...]) on selectedTicker change
        |
        v
[page.tsx] (Server Component — imports client components)
  <aside gridArea="watch"> <WatchlistPanel /> </aside>
  <main  gridArea="chart"> <MainChart />      </main>
```

### Recommended Project Structure

```
frontend/app/
├── providers/
│   ├── PriceContext.tsx          # Existing — SSE singleton
│   └── WatchlistContext.tsx      # New — ticker list, history buffers, selection
├── components/
│   ├── watchlist/
│   │   ├── WatchlistPanel.tsx    # New — panel shell with header + list + add-ticker
│   │   ├── WatchlistRow.tsx      # New — single ticker row with flash animation
│   │   └── Sparkline.tsx         # New — pure SVG polyline component
│   └── chart/
│       └── MainChart.tsx         # New — lightweight-charts canvas component
├── globals.css                   # Existing — flash animations already defined
├── layout.tsx                    # Modified — add WatchlistProvider
└── page.tsx                      # Modified — replace watch + chart placeholders
```

### Pattern 1: Imperative Chart Update (no React re-render)

**What:** lightweight-charts is a canvas library controlled imperatively. Data updates go directly to the chart instance via refs, bypassing React's render cycle entirely.

**When to use:** Any time SSE data arrives for the selected ticker — call `seriesRef.current.update()` directly, do not store chart data in React state.

```typescript
// Source: tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi
const priceUpdate = usePrice(selectedTicker)

useEffect(() => {
  if (!priceUpdate || !seriesRef.current) return
  seriesRef.current.update({
    time: priceUpdate.timestamp as UTCTimestamp,
    value: priceUpdate.price,
  })
}, [priceUpdate])
```

### Pattern 2: Ticker Switch — setData then update

**What:** When `selectedTicker` changes, load the full history buffer, then switch to per-tick updates.

```typescript
// Source: tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi
useEffect(() => {
  if (!selectedTicker || !seriesRef.current || !priceHistory[selectedTicker]) return

  // Convert raw price array to {time, value} pairs
  // Note: we don't have per-point timestamps in the history buffer (only raw prices)
  // Use current time minus (buffer.length - i) * 0.5 as approximate timestamps
  const now = Date.now() / 1000
  const buffer = priceHistory[selectedTicker]
  const data = buffer.map((price, i) => ({
    time: (now - (buffer.length - 1 - i) * 0.5) as UTCTimestamp,
    value: price,
  }))

  seriesRef.current.setData(data)
  chartRef.current?.timeScale().scrollToRealTime()
}, [selectedTicker])
```

**Important:** The `priceHistory` buffer stores only raw prices (per D-09 / UI-SPEC). When loading history into the chart on ticker switch, timestamps must be reconstructed. The recommended approach is to store `{time, value}` pairs in the history buffer instead of raw prices, OR reconstruct approximate timestamps as shown above. Since WatchlistContext's `priceHistory` is typed as `Record<string, number[]>` in the UI-SPEC, use the reconstruction approach for ticker switch. For live updates, use the actual `update.timestamp` from the SSE event.

**Recommendation for implementation:** To avoid the timestamp reconstruction hack, store `{time: number, value: number}[]` in `priceHistory` within `WatchlistContext` (instead of just `number[]`). This contradicts the exact UI-SPEC type but makes MainChart dramatically simpler and more accurate. The planner should note this as a discretion call since the UI-SPEC defines `priceHistory: Record<string, number[]>` — the planner may clarify or adjust.

### Anti-Patterns to Avoid

- **Calling `chart.addSeries()` on every render:** Only call in `useEffect(() => {...}, [])` (mount once). Creating multiple chart instances causes memory leaks.
- **Storing chart/series instances in React state:** Use `useRef`. State triggers re-renders; chart instances are mutable and should not be in state.
- **Using `setData()` on every SSE tick:** Per D-06, only use `update()` per tick. `setData()` re-renders the entire chart; `update()` redraws only the changed portion.
- **Spread operator on PriceHistory for large buffers:** `Math.min(...array)` with 100 items is safe; would fail at ~125,000 items (call stack limit).
- **Importing lightweight-charts in a Server Component:** Always import inside `'use client'` files or dynamic imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Financial canvas chart | Custom canvas drawing | `lightweight-charts` | Time scaling, crosshair, resize, panning built in |
| SVG sparkline | ❌ don't use recharts | Custom SVG polyline (D-01) | 60×24px sparkline doesn't need a full charting library |
| SSE connection management | Custom reconnect loop | Native `EventSource` | Already implemented in PriceContext; browser handles reconnection |
| Ring buffer | Circular buffer package | `array.slice(-100)` | No dependency; 100-item slicing is O(1) in JS engines |
| Price formatting | numeral.js / accounting.js | `price.toFixed(2)` | No dependency needed for simple 2dp formatting |

**Key insight:** The only new external dependency this phase is `lightweight-charts`. Everything else is implemented using React primitives and browser APIs.

---

## Common Pitfalls

### Pitfall 1: lightweight-charts v5 `addSeries` API
**What goes wrong:** Using the v4 `addAreaSeries()` method name causes a runtime error.
**Why it happens:** The v4→v5 migration replaced all type-specific add methods with a single `addSeries(SeriesType, options)` call.
**How to avoid:** `chart.addSeries(AreaSeries, opts)` where `AreaSeries` is imported from `'lightweight-charts'`.
**Warning signs:** TypeScript error "Property 'addAreaSeries' does not exist on type 'IChartApi'".

### Pitfall 2: UTCTimestamp expects seconds, not milliseconds
**What goes wrong:** Chart time axis shows dates far in the future.
**Why it happens:** Passing milliseconds instead of seconds.
**How to avoid:** The SSE `timestamp` is already seconds (Python `time.time()`). Cast directly: `update.timestamp as UTCTimestamp`.
**Warning signs:** Chart shows year 2040+ on time axis; massive time jumps on first data point.

### Pitfall 3: CSS animation doesn't replay without reflow
**What goes wrong:** Price flash only works once; subsequent ticks produce no animation.
**Why it happens:** Adding the same CSS class again without removing it first is a no-op; removing and adding in the same frame is also a no-op without a forced reflow.
**How to avoid:** Remove class → `void el.offsetHeight` (forces reflow) → add class.
**Warning signs:** Flash visible on first price update only; animation stops working after that.

### Pitfall 4: Stale closure captures old priceHistory in WatchlistContext
**What goes wrong:** Price history only accumulates 1-2 points; sparklines never grow.
**Why it happens:** `useEffect` closure captures the initial (empty) `priceHistory` state.
**How to avoid:** Use `useRef` as the mutable accumulator: `priceHistoryRef.current = {...priceHistoryRef.current, [ticker]: newBuffer}` then `setPriceHistory({...priceHistoryRef.current})`.
**Warning signs:** `priceHistory[ticker].length` never exceeds 2 after many SSE ticks.

### Pitfall 5: MainChart canvas not visible (height 0)
**What goes wrong:** Chart renders but is invisible; canvas has 0px height.
**Why it happens:** The `<div>` container has no explicit height; `createChart` reads `clientHeight` = 0.
**How to avoid:** Set `height: '100%'` on the container div AND ensure the parent (`<main gridArea="chart">`) has `overflow: hidden` with a defined height (it does, from the CSS Grid `1fr` row). Pass explicit `height: containerRef.current.clientHeight` to `createChart`.
**Warning signs:** Chart instance created but invisible; `containerRef.current.clientHeight === 0` in console.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chart.addAreaSeries(opts)` | `chart.addSeries(AreaSeries, opts)` | v5.0.0 (2024) | Breaking — must use new API |
| `chart.applyOptions({ width, height })` | `chart.resize(width, height)` | v5 | New explicit resize method (applyOptions still works) |
| `createSeriesMarkers` | Separate plugin import | v5 | Not needed in this phase |
| Tailwind config.js | CSS-based `@theme {}` in globals.css | Tailwind v4 | Already handled in Phase 1 |

**Deprecated/outdated:**
- `chart.addLineSeries()`, `chart.addAreaSeries()`, `chart.addCandlestickSeries()`: All replaced by `chart.addSeries(SeriesType, opts)` in v5.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, next build | ✓ | (in Docker Stage 1) | — |
| npm | Package installation | ✓ | Available in project | — |
| `lightweight-charts` | MainChart component | ✗ (not installed) | 5.2.0 on npm | — (no fallback; must install) |
| Browser `EventSource` | PriceContext SSE | ✓ | All modern browsers | — |
| Browser `ResizeObserver` | Chart resize | ✓ | All modern browsers | `window.resize` listener |

**Missing dependencies with no fallback:**
- `lightweight-charts@5.2.0` — must be installed before any MainChart implementation. Command: `cd frontend && npm install lightweight-charts@5.2.0`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `priceHistory` storing `number[]` (raw prices) requires timestamp reconstruction for MainChart `setData()` | WatchlistContext Architecture, Pattern 2 | If reconstruction timestamps are inaccurate, chart shows wrong time axis on ticker switch |
| A2 | React Strict Mode is NOT enabled in this Next.js project (double-mount is not a problem) | Pitfalls | If enabled, useEffect runs twice — chart.remove() cleanup handles it, but brief flash of double initialization may occur |
| A3 | The `GET /api/watchlist` response shape is `{ tickers: [{ ticker: string, price: number, ... }] }` | WatchlistContext Architecture | If shape differs, initial ticker list fetch fails silently |

**A3 verification:** [VERIFIED from codebase] `backend/app/api/watchlist.py` referenced in CONTEXT.md returns `{tickers: [{ticker, price, ...}]}` — confirmed by canonical refs in CONTEXT.md.

---

## Open Questions

1. **priceHistory type: `number[]` vs `{time: number, value: number}[]`**
   - What we know: UI-SPEC defines `priceHistory: Record<string, number[]>` (raw prices). Sparklines only need prices. MainChart needs `{time, value}` for `setData()` on ticker switch.
   - What's unclear: Should we store timestamps alongside prices in the history buffer, or reconstruct them approximately?
   - Recommendation: The planner should consider storing `{time: number, value: number}[]` in `priceHistory` to simplify MainChart. This is a discretion-area adjustment from the UI-SPEC type. Sparklines can extract `.value` for their calculations.

2. **Watchlist API response shape for `GET /api/watchlist`**
   - What we know: CONTEXT.md states it returns `{tickers: [{ticker, price, ...}]}`.
   - What's unclear: Full shape (does it include `change_percent`? Does it return current live prices?).
   - Recommendation: WatchlistContext initial fetch only needs the ticker symbols. Use `data.tickers.map(t => t.ticker)` and rely on SSE for live prices.

---

## Security Domain

> `security_enforcement` not explicitly set in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth layer (single-user design per spec) |
| V3 Session Management | No | No sessions (stateless frontend) |
| V4 Access Control | No | No auth at all |
| V5 Input Validation | Yes | Add ticker input: auto-uppercase, trim whitespace, validate non-empty before API call |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for Frontend/SSE Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via ticker symbol in DOM | Tampering | React escapes content by default; never use `dangerouslySetInnerHTML` for ticker values |
| Open Redirect via error messages | Tampering | Error text is hardcoded copy per UI-SPEC; never render raw API error messages as HTML |
| EventSource to untrusted origin | Elevation | SSE connects to same origin (`/api/stream/prices`); no CORS risk |

---

## Sources

### Primary (HIGH confidence)
- `tradingview.github.io/lightweight-charts/docs/api/functions/createChart` — createChart signature, container parameter, options type
- `tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi` — addSeries, applyOptions, remove, resize, timeScale methods
- `tradingview.github.io/lightweight-charts/docs/api/interfaces/ISeriesApi` — update, setData, applyOptions methods
- `tradingview.github.io/lightweight-charts/docs/api/type-aliases/UTCTimestamp` — Unix seconds, as UTCTimestamp cast
- `tradingview.github.io/lightweight-charts/docs/migrations/from-v4-to-v5` — v5 breaking change: addSeries(AreaSeries, opts)
- `tradingview.github.io/lightweight-charts/tutorials/react/simple` — React useEffect + cleanup pattern, AreaSeries import
- `npm view lightweight-charts` — version 5.2.0, published 2026-04-24, repository: github.com/tradingview/lightweight-charts
- `frontend/app/providers/PriceContext.tsx` (codebase) — SSE hook, PriceUpdate type, prices map structure
- `frontend/app/globals.css` (codebase) — .flash-up / .flash-down animation classes confirmed
- `frontend/app/layout.tsx` (codebase) — grid layout, PriceProvider placement confirmed
- `backend/app/market/models.py` (codebase) — timestamp is Unix seconds float (time.time())
- `frontend/package.json` (codebase) — lightweight-charts NOT installed; must be added

### Secondary (MEDIUM confidence)
- `tradingview.github.io/lightweight-charts/tutorials/react/advanced` — advanced React pattern with useLayoutEffect; resize via window.addEventListener
- `tradingview.github.io/lightweight-charts/docs/series-types#area` — area series topColor, bottomColor, lineColor options

### Tertiary (LOW confidence)
- WebSearch results on React ResizeObserver patterns — used for general pattern validation; specific lightweight-charts resize implementation from official docs preferred

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry confirmed, official docs verified
- Architecture: HIGH — existing codebase fully read; integration points confirmed from actual source files
- Pitfalls: HIGH — verified against official v5 migration docs and actual codebase
- lightweight-charts API: HIGH — verified via official docs at tradingview.github.io

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (lightweight-charts v5 API stable; Next.js/React unlikely to change within 30 days)
