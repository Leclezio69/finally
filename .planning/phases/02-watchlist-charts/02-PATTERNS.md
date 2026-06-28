# Phase 2: Watchlist & Charts — Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 8 (5 new, 3 modified)
**Analogs found:** 6 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/app/providers/WatchlistContext.tsx` | provider | event-driven | `frontend/app/providers/PriceContext.tsx` | exact |
| `frontend/app/components/watchlist/WatchlistPanel.tsx` | component | request-response | `frontend/app/page.tsx` (aside/section shell) | role-match |
| `frontend/app/components/watchlist/WatchlistRow.tsx` | component | event-driven | `frontend/app/providers/PriceContext.tsx` (usePrice consumer pattern) | role-match |
| `frontend/app/components/watchlist/Sparkline.tsx` | component | transform | none | no analog |
| `frontend/app/components/chart/MainChart.tsx` | component | event-driven | `frontend/app/providers/PriceContext.tsx` (EventSource useEffect pattern) | partial |
| `frontend/app/layout.tsx` | config | request-response | self (existing file, add provider nesting) | self |
| `frontend/app/page.tsx` | component | request-response | self (existing file, replace stubs) | self |
| `frontend/package.json` | config | — | self (existing file, add dependency) | self |

---

## Pattern Assignments

### `frontend/app/providers/WatchlistContext.tsx` (provider, event-driven)

**Analog:** `frontend/app/providers/PriceContext.tsx`

**Directive + imports pattern** (lines 1–3):
```typescript
'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { PriceContext } from './PriceContext'
```

**Context type + createContext pattern** (lines 5–23):
```typescript
// PriceContext defines a typed value shape and passes a default:
type PriceContextValue = {
  prices: Record<string, PriceUpdate>
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
}

export const PriceContext = createContext<PriceContextValue>({
  prices: {},
  status: 'connecting',
})
```
WatchlistContext follows the same shape. Its value type is:
```typescript
type WatchlistContextValue = {
  tickers: string[]
  selectedTicker: string | null
  setSelectedTicker: (ticker: string) => void
  priceHistory: Record<string, number[]>
  addTicker: (ticker: string) => Promise<void>
  removeTicker: (ticker: string) => Promise<void>
}
```

**Provider function + state init pattern** (lines 25–28):
```typescript
export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({})
  const [status, setStatus] = useState<PriceContextValue['status']>('connecting')
```
WatchlistProvider: add `const { prices } = useContext(PriceContext)` as the first line inside the provider body (before state declarations) to receive SSE data from the parent PriceProvider.

**useEffect pattern** (lines 29–52):
```typescript
// PriceContext opens EventSource in useEffect; WatchlistContext fetches watchlist on mount
// and accumulates price history with a separate useEffect on [prices].
useEffect(() => {
  const es = new EventSource('/api/stream/prices')
  es.onopen = () => setStatus('connected')
  es.onerror = () => { setStatus('reconnecting') }
  es.addEventListener('price_update', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as PriceUpdate
      setPrices((prev) => ({ ...prev, [data.ticker]: data }))
    } catch {
      // Malformed SSE data — skip silently
    }
  })
  return () => { es.close() }
}, [])
```
WatchlistContext uses TWO effects: one with `[]` dep array for the initial `GET /api/watchlist` fetch, one with `[prices]` dep array to accumulate the ring buffer.

**Ring buffer accumulation (from RESEARCH.md §2):**
```typescript
const priceHistoryRef = useRef<Record<string, number[]>>({})
const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({})

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
```
The `priceHistoryRef` avoids stale closure: the ref is mutated directly; state is only set to trigger re-renders. Without the ref, the closure over `priceHistory` state would read stale data on every tick.

**Provider JSX + hook exports pattern** (lines 54–70):
```typescript
// PriceContext exports:
return (
  <PriceContext.Provider value={{ prices, status }}>
    {children}
  </PriceContext.Provider>
)

export function usePrice(ticker: string): PriceUpdate | undefined {
  const { prices } = useContext(PriceContext)
  return prices[ticker]
}
export function usePriceStatus(): PriceContextValue['status'] {
  return useContext(PriceContext).status
}
```
WatchlistContext exports `useWatchlist()` as a single hook returning the full context value (rather than per-field hooks):
```typescript
export function useWatchlist(): WatchlistContextValue {
  return useContext(WatchlistContext)
}
```

---

### `frontend/app/components/watchlist/WatchlistPanel.tsx` (component, request-response)

**Analog:** `frontend/app/page.tsx` (aside shell at lines 42–51)

**Directive** (required — static export):
```typescript
'use client'
```

**Grid area assignment pattern** (page.tsx lines 42–51):
```typescript
<aside
  style={{
    gridArea: 'watch',
    backgroundColor: '#1a1a2e',
    borderRight: '1px solid #30363d',
    overflow: 'hidden',
  }}
>
  {/* content */}
</aside>
```
WatchlistPanel is the content **inside** that `<aside>`. It must not re-declare `gridArea` — it lives inside the `<aside>` in page.tsx. Its root element fills height via `height: '100%'` and uses `display: 'flex'; flexDirection: 'column'` to create three zones:
1. Fixed header bar (`WATCHLIST` label, monospace, `#ecad0a`)
2. Scrollable ticker list (`flex: 1; overflowY: 'auto'`)
3. Fixed add-ticker bar at bottom (input + button, above a `1px solid #30363d` divider)

**Color palette to use** (from globals.css custom properties):
```
Background:  #1a1a2e   (--color-bg-panel)
Border:      #30363d   (--color-border)
Text label:  #8b949e   (--color-text-muted)
Accent:      #ecad0a   (--color-accent-yellow)
Button:      #753991   (--color-accent-purple)
```

**API call pattern for addTicker / removeTicker** (matches PriceContext fetch pattern):
```typescript
// fetch inside async function, swallowed errors surface as state
async function addTicker(ticker: string): Promise<void> {
  const resp = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker: ticker.toUpperCase() }),
  })
  if (!resp.ok) throw new Error(await resp.text())
  setTickers((prev) => [...prev, ticker.toUpperCase()])
}

async function removeTicker(ticker: string): Promise<void> {
  await fetch(`/api/watchlist/${ticker}`, { method: 'DELETE' })
  setTickers((prev) => prev.filter((t) => t !== ticker))
}
```
These live in `WatchlistContext` (D-10), not in WatchlistPanel. WatchlistPanel calls `useWatchlist().addTicker(input)`.

**Input auto-uppercase pattern** (Claude's Discretion):
```typescript
<input
  value={input}
  onChange={(e) => setInput(e.target.value.toUpperCase())}
  placeholder="Ticker…"
/>
```

---

### `frontend/app/components/watchlist/WatchlistRow.tsx` (component, event-driven)

**Analog:** `frontend/app/providers/PriceContext.tsx` → `usePrice()` consumer pattern

**Directive + imports**:
```typescript
'use client'
import { useEffect, useRef } from 'react'
import { usePrice } from '../../providers/PriceContext'
import { useWatchlist } from '../../providers/WatchlistContext'
import Sparkline from './Sparkline'
```

**Flash animation pattern** (from RESEARCH.md §3, using globals.css `.flash-up` / `.flash-down`):
```typescript
const update = usePrice(ticker)
const priceCellRef = useRef<HTMLDivElement>(null)
const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

useEffect(() => {
  if (!update || !priceCellRef.current) return
  const el = priceCellRef.current

  if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  el.classList.remove('flash-up', 'flash-down')
  void el.offsetHeight   // force reflow — REQUIRED to restart CSS animation

  if (update.direction === 'up') el.classList.add('flash-up')
  else if (update.direction === 'down') el.classList.add('flash-down')

  flashTimerRef.current = setTimeout(() => {
    el.classList.remove('flash-up', 'flash-down')
    flashTimerRef.current = null
  }, 500)

  return () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }
}, [update])
```
The flash applies to the **price cell `<div>` only** (ref attached to `priceCellRef`), not the entire row element.

**Row layout pattern** (Claude's Discretion — terminal aesthetic, from page.tsx color cues):
```typescript
// Row: ticker | price (flash cell) | change% | sparkline | ×-button (on hover)
// Remove button: CSS opacity 0 by default, 1 on row hover — use group/group-hover or inline onMouseEnter
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '52px 1fr 52px 60px 24px',
    alignItems: 'center',
    padding: '6px 8px',
    cursor: 'pointer',
    borderBottom: '1px solid #21262d',
    fontFamily: 'monospace',
    fontSize: 12,
  }}
  onClick={() => setSelectedTicker(ticker)}
>
  <span style={{ color: '#e6edf3', fontWeight: 600 }}>{ticker}</span>
  <div ref={priceCellRef} style={{ textAlign: 'right', color: '#e6edf3' }}>
    {update?.price.toFixed(2) ?? '—'}
  </div>
  <span style={{ textAlign: 'right', color: changePercent >= 0 ? '#22c55e' : '#ef4444', fontSize: 11 }}>
    {changePercent >= 0 ? '+' : ''}{changePercent?.toFixed(2)}%
  </span>
  <Sparkline prices={priceHistory[ticker] ?? []} />
  <button onClick={(e) => { e.stopPropagation(); removeTicker(ticker) }}>×</button>
</div>
```

**Hover reveal for × button** — use `onMouseEnter`/`onMouseLeave` on the row div to toggle a `hovered` state, then conditionally set `opacity: hovered ? 1 : 0` on the button.

---

### `frontend/app/components/watchlist/Sparkline.tsx` (component, transform)

**No codebase analog.** Pattern is fully derived from RESEARCH.md §4 (locked by D-01–D-03).

**Complete implementation pattern** (from RESEARCH.md §4):
```typescript
'use client'

interface SparklineProps {
  prices: number[]
}

export default function Sparkline({ prices }: SparklineProps) {
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

**Key formulas:**
- Y range: `[2px, 22px]` — 2px padding top and bottom within the 24px height
- Y inversion: SVG Y=0 is top, so `price === max` → `Y = 2` (top), `price === min` → `Y = 22` (bottom)
- Color (D-02): compare `prices[prices.length - 1]` vs `prices[0]` (first SSE update ever received, not the tick direction)
- Edge case `range === 0`: all prices equal → flat line at `Y = 12` (midpoint)
- Edge case `< 2 points`: return empty `<svg>` to avoid division by zero in X calculation

---

### `frontend/app/components/chart/MainChart.tsx` (component, event-driven)

**Analog:** `frontend/app/providers/PriceContext.tsx` (useEffect lifecycle / cleanup pattern, lines 29–52)

**Directive + imports** (lightweight-charts v5.2.0 — NOT YET INSTALLED):
```typescript
'use client'
import { createChart, AreaSeries, ColorType, UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { usePrice } from '../../providers/PriceContext'
import { useWatchlist } from '../../providers/WatchlistContext'
```

**Chart initialization pattern** (from RESEARCH.md §1, matches PriceContext cleanup pattern):
```typescript
// PriceContext cleanup model:
return () => { es.close() }

// MainChart equivalent:
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
    crosshair: { mode: 1 },  // Magnet mode
    timeScale: { borderColor: '#30363d' },
    rightPriceScale: { borderColor: '#30363d' },
    width: containerRef.current.clientWidth,
    height: containerRef.current.clientHeight,
  })
  chartRef.current = chart

  const series = chart.addSeries(AreaSeries, {   // v5 API — NOT addAreaSeries()
    topColor: 'rgba(32, 157, 215, 0.4)',
    bottomColor: 'rgba(32, 157, 215, 0.0)',
    lineColor: '#209dd7',
    lineWidth: 2,
  })
  seriesRef.current = series

  const observer = new ResizeObserver((entries) => {
    if (!chartRef.current) return          // guard: may fire before chart is ready
    const { width, height } = entries[0].contentRect
    chartRef.current.resize(width, height)
  })
  observer.observe(containerRef.current)

  return () => {
    observer.disconnect()
    chart.remove()             // Destroys canvas + DOM — matches es.close() pattern
  }
}, [])  // mount once — same [] dep array as PriceContext EventSource
```

**Data update pattern — separate useEffect, DO NOT call setData on every tick (D-06):**
```typescript
const update = usePrice(selectedTicker ?? '')

useEffect(() => {
  if (!update || !seriesRef.current) return
  seriesRef.current.update({
    time: update.timestamp as UTCTimestamp,  // SSE timestamp is already Unix seconds
    value: update.price,
  })
}, [update])  // fires on each SSE tick for the selected ticker
```

**Ticker switch pattern — call setData then scrollToRealTime (from RESEARCH.md §7, Pitfall 9):**
```typescript
useEffect(() => {
  if (!selectedTicker || !seriesRef.current || !chartRef.current) return
  const history = priceHistory[selectedTicker] ?? []
  // Convert raw number[] buffer to UTCTimestamp series — use current time, spaced backward
  // (backend provides exact timestamps via SSE; for existing buffer, synthesize times)
  const now = Math.floor(Date.now() / 1000)
  const data = history.map((price, i) => ({
    time: (now - (history.length - 1 - i) * 0.5) as UTCTimestamp,  // 500ms intervals
    value: price,
  }))
  seriesRef.current.setData(data)
  chartRef.current.timeScale().scrollToRealTime()
}, [selectedTicker])
```

**Container JSX:**
```typescript
return (
  <div
    ref={containerRef}
    style={{ width: '100%', height: '100%' }}
  />
)
```
The container fills its grid area because `page.tsx` assigns `gridArea: 'chart'` and `overflow: 'hidden'` to the `<main>` element. MainChart sets `width: 100%; height: 100%` to fill that parent.

**Critical v5 warning:** `chart.addAreaSeries(opts)` (v4 API) does not exist in v5 and will throw at runtime. Always use `chart.addSeries(AreaSeries, opts)` where `AreaSeries` is imported from `'lightweight-charts'`.

---

### `frontend/app/layout.tsx` (config — add WatchlistProvider)

**Analog:** self — existing file at lines 1–39

**Current provider nesting** (lines 15–35):
```typescript
<PriceProvider>
  <div style={{ display: 'grid', ... }}>
    {children}
  </div>
</PriceProvider>
```

**Required change — add WatchlistProvider inside PriceProvider:**
```typescript
import { WatchlistProvider } from './providers/WatchlistContext'

<PriceProvider>
  <WatchlistProvider>        {/* NEW — must be inside PriceProvider */}
    <div style={{ display: 'grid', ... }}>
      {children}
    </div>
  </WatchlistProvider>
</PriceProvider>
```
Order is critical: `WatchlistProvider` calls `useContext(PriceContext)`, so `PriceProvider` must be the outer wrapper.

**No other changes to layout.tsx.** Grid template areas, column/row sizes, body styles — all remain identical.

---

### `frontend/app/page.tsx` (component — replace placeholder stubs)

**Analog:** self — existing file

**Stubs to replace** (lines 42–62):
```typescript
// BEFORE (lines 42–51):
<aside style={{ gridArea: 'watch', backgroundColor: '#1a1a2e', borderRight: '1px solid #30363d', overflow: 'hidden' }}>
  <PlaceholderPanel label="WATCHLIST" phase="Phase 2" />
</aside>

// BEFORE (lines 53–62):
<main style={{ gridArea: 'chart', backgroundColor: '#0d1117', overflow: 'hidden' }}>
  <PlaceholderPanel label="CHART" phase="Phase 2" />
</main>
```

**AFTER — import real components:**
```typescript
import WatchlistPanel from './components/watchlist/WatchlistPanel'
import MainChart from './components/chart/MainChart'

// Replace stub content, keep shell elements and their styles identical:
<aside style={{ gridArea: 'watch', backgroundColor: '#1a1a2e', borderRight: '1px solid #30363d', overflow: 'hidden' }}>
  <WatchlistPanel />
</aside>

<main style={{ gridArea: 'chart', backgroundColor: '#0d1117', overflow: 'hidden' }}>
  <MainChart />
</main>
```

**Keep unchanged:** header (lines 5–39), chat aside (lines 64–74), portfolio section (lines 76–87), `PlaceholderPanel` function (lines 92–117) — still used by chat and portfolio stubs.

**Note:** `page.tsx` has no `'use client'` and must stay a Server Component. Importing `WatchlistPanel` and `MainChart` (which have `'use client'`) is valid — Server Components can import Client Components.

---

### `frontend/package.json` (config — add dependency)

**Analog:** self — existing file

**Current dependencies** (lines 11–15):
```json
"dependencies": {
  "next": "16.2.9",
  "react": "19.2.4",
  "react-dom": "19.2.4"
}
```

**Required addition:**
```json
"dependencies": {
  "next": "16.2.9",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "lightweight-charts": "5.2.0"
}
```

**Installation command** (run before any implementation task):
```bash
cd /Users/richardleclezio/projects/finally/frontend && npm install lightweight-charts@5.2.0
```
This also updates `frontend/package-lock.json`. Both files are modified by the install.

---

## Shared Patterns

### `'use client'` directive
**Source:** `frontend/app/providers/PriceContext.tsx` line 1
**Apply to:** ALL new component and provider files (WatchlistContext, WatchlistPanel, WatchlistRow, Sparkline, MainChart)
**Reason:** Next.js static export (`output: 'export'`). Any component using hooks, EventSource, canvas, or browser APIs must be a Client Component. Server Components cannot use these APIs.
```typescript
'use client'
```

### Color palette (inline styles — no Tailwind class names needed)
**Source:** `frontend/app/globals.css` lines 7–24, `frontend/app/page.tsx` inline styles
**Apply to:** All new components
```
Background panels:  #1a1a2e   (bg-panel)
Background base:    #0d1117   (bg-base)
Surface (header):   #161b22   (bg-surface)
Border:             #30363d   (border)
Text primary:       #e6edf3   (text-primary)
Text muted:         #8b949e   (text-muted)
Accent yellow:      #ecad0a   (accent-yellow) — labels, logo
Accent blue:        #209dd7   (accent-blue) — chart line
Accent purple:      #753991   (accent-purple) — submit/add button
Price up green:     #22c55e
Price down red:     #ef4444
```
These are defined as CSS custom properties (`--color-*`) in globals.css but all existing code uses hex literals in inline styles. New components must follow the same pattern — inline style hex literals, not Tailwind utility classes, for consistency.

### Flash animation classes
**Source:** `frontend/app/globals.css` lines 47–71
**Apply to:** `WatchlistRow.tsx` price cell only
```css
.flash-up  { animation: flash-up  500ms ease-out forwards; }
.flash-down { animation: flash-down 500ms ease-out forwards; }
```
Apply via `el.classList.add/remove()` in a `useEffect([update])`. Force reflow with `void el.offsetHeight` between remove and re-add to restart the animation.

### Monospace font
**Source:** `frontend/app/globals.css` lines 40–43
**Apply to:** All data-display text in new components (prices, tickers, percentages)
```css
font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
```
Applied globally via `body` selector — no per-component font-family needed unless overriding.

### useEffect cleanup
**Source:** `frontend/app/providers/PriceContext.tsx` lines 49–51
**Apply to:** MainChart (chart.remove + observer.disconnect), WatchlistRow (clearTimeout)
```typescript
return () => {
  es.close()  // pattern: always clean up subscriptions/resources in useEffect return
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `frontend/app/components/watchlist/Sparkline.tsx` | component | transform | No SVG data visualization components exist in the codebase. Pattern is fully specified by RESEARCH.md §4 (D-01 through D-03). |
| `frontend/app/components/chart/MainChart.tsx` | component | event-driven | No canvas-based charting components exist. Pattern derived from RESEARCH.md §1 (lightweight-charts v5 official docs, verified). |

---

## Metadata

**Analog search scope:** `frontend/app/` (all `.tsx` files)
**Files scanned:** 3 source files (PriceContext.tsx, layout.tsx, page.tsx) + globals.css + package.json
**Pattern extraction date:** 2026-06-28
