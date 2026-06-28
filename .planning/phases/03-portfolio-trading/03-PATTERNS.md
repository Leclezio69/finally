# Phase 3: Portfolio & Trading - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 8 (7 new, 1 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/app/providers/PortfolioContext.tsx` | provider | request-response + SSE | `frontend/app/providers/WatchlistContext.tsx` | exact |
| `frontend/app/components/portfolio/PortfolioPanel.tsx` | component | transform | `frontend/app/components/watchlist/WatchlistPanel.tsx` | exact |
| `frontend/app/components/portfolio/Heatmap.tsx` | component | transform | `frontend/app/components/chart/MainChart.tsx` | role-match |
| `frontend/app/components/portfolio/PnLChart.tsx` | component | transform | `frontend/app/components/chart/MainChart.tsx` | role-match |
| `frontend/app/components/portfolio/PositionsTable.tsx` | component | transform | `frontend/app/components/watchlist/WatchlistRow.tsx` | exact |
| `frontend/app/components/portfolio/TradeBar.tsx` | component | request-response | `frontend/app/components/watchlist/WatchlistPanel.tsx` | exact |
| `frontend/app/components/portfolio/TradeHistory.tsx` | component | transform | `frontend/app/components/watchlist/WatchlistRow.tsx` | role-match |
| `frontend/app/page.tsx` | page | transform | (self — modification) | exact |

## Pattern Assignments

### `frontend/app/providers/PortfolioContext.tsx` (provider, request-response + SSE)

**Analog:** `frontend/app/providers/WatchlistContext.tsx`

**Imports pattern** (lines 1-2):
```typescript
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PriceContext } from './PriceContext'
```

**Context type + default pattern** (lines 6-24):
```typescript
export type WatchlistContextValue = {
  tickers: string[]
  selectedTicker: string | null
  setSelectedTicker: (ticker: string) => void
  priceHistory: Record<string, number[]>
  firstPrice: Record<string, number>
  addTicker: (ticker: string) => Promise<void>
  removeTicker: (ticker: string) => Promise<void>
}

export const WatchlistContext = createContext<WatchlistContextValue>({
  tickers: [],
  selectedTicker: null,
  setSelectedTicker: () => {},
  priceHistory: {},
  firstPrice: {},
  addTicker: async () => {},
  removeTicker: async () => {},
})
```
**Key convention:** Type exported as `XxxContextValue`, context exported as `XxxContext`, default values match types.

**Provider function signature** (line 26):
```typescript
export function WatchlistProvider({ children }: { children: React.ReactNode }) {
```

**Consuming another context inside a provider** (line 27):
```typescript
  const { prices } = useContext(PriceContext)
```
**Key insight:** PortfolioContext will also need `useContext(PriceContext)` to access SSE prices for live totalValue recalculation.

**Mount-fetch pattern** (lines 37-50):
```typescript
  // Effect 1 — mount fetch: load watchlist from API and auto-select first ticker
  useEffect(() => {
    fetch('/api/watchlist')
      .then((resp) => resp.json())
      .then((data: { tickers: Array<{ ticker: string }> }) => {
        const list = data.tickers.map((t) => t.ticker)
        setTickers(list)
        if (list.length > 0) {
          setSelectedTicker(list[0])
        }
      })
      .catch(() => {
        // Silently fail — tickers remain empty on network error
      })
  }, [])
```
**PortfolioContext equivalent:** Fetch `GET /api/portfolio`, `GET /api/trades`, `GET /api/portfolio/history` on mount. Silent catch on error.

**Mutation function pattern** (lines 82-101):
```typescript
  async function addTicker(ticker: string): Promise<void> {
    const uppercased = ticker.toUpperCase()
    const resp = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker: uppercased }),
    })
    if (!resp.ok) throw new Error(await resp.text())
    setTickers((prev) => [...prev, uppercased])
  }
```
**PortfolioContext equivalent:** `executeTrade` function will POST to `/api/portfolio/trade`, but instead of throwing, return error string or null per RESEARCH.md design.

**Provider render pattern** (lines 104-118):
```typescript
  return (
    <WatchlistContext.Provider
      value={{
        tickers,
        selectedTicker,
        setSelectedTicker,
        priceHistory,
        firstPrice,
        addTicker,
        removeTicker,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  )
```

**Custom hook export pattern** (lines 122-124):
```typescript
/** Access the full watchlist context: tickers, selected ticker, price history, add/remove */
export function useWatchlist(): WatchlistContextValue {
  return useContext(WatchlistContext)
}
```
**PortfolioContext equivalent:** Export `usePortfolio()` hook.

---

### `frontend/app/components/portfolio/PortfolioPanel.tsx` (component, layout container)

**Analog:** `frontend/app/components/watchlist/WatchlistPanel.tsx`

**Imports + directive** (lines 1-4):
```typescript
'use client'

import { useState } from 'react'
import { useWatchlist } from '../../providers/WatchlistContext'
```

**Full-height flex column container** (lines 37-38):
```typescript
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
```

**Panel header (32px)** (lines 39-59):
```typescript
      {/* Panel header */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          borderBottom: '1px solid #30363d',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#8b949e',
            letterSpacing: '0.15em',
          }}
        >
          WATCHLIST
        </span>
      </div>
```
**PortfolioPanel equivalent:** Same 32px header with "PORTFOLIO" label, same styling. Content area below is a two-row flex split (heatmap+PnL top, trade bar+positions+history bottom).

**Scrollable content area** (lines 62-63):
```typescript
      {/* Scrollable ticker list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
```

---

### `frontend/app/components/portfolio/Heatmap.tsx` (component, recharts Treemap)

**Analog:** `frontend/app/components/chart/MainChart.tsx` (for container/header pattern)

**Component structure pattern** (lines 1-6, 98-140):
```typescript
'use client'

import { createChart, AreaSeries, ColorType, UTCTimestamp } from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import { usePrice } from '../../providers/PriceContext'
import { useWatchlist } from '../../providers/WatchlistContext'

// ... component body ...

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chart header bar — 32px, shows selected ticker + live price */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid #30363d',
          gap: 12,
          flexShrink: 0,
          backgroundColor: '#0d1117',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3' }}>
          {selectedTicker ?? '—'}
        </span>
      </div>

      {/* Chart canvas container — flex: 1 fills remaining height; minHeight: 0 allows shrink */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
```
**Key convention:** Full `width: '100%', height: '100%'` outer div, flex column with optional header, `flex: 1, minHeight: 0` for chart container. Heatmap uses `<ResponsiveContainer>` from recharts instead of a ref-based canvas.

**No analog for recharts Treemap itself** -- use RESEARCH.md Pattern 2 (Treemap Custom Content) and the code example in RESEARCH.md "Treemap Heatmap Setup" section.

---

### `frontend/app/components/portfolio/PnLChart.tsx` (component, recharts LineChart)

**Analog:** `frontend/app/components/chart/MainChart.tsx` (container pattern only)

Same container pattern as Heatmap above. For recharts LineChart specifics, use RESEARCH.md "P&L LineChart Setup" code example (lines 367-427).

**Color constants from globals.css** (for chart styling):
```
Background: #0d1117 (bg-base)
Grid lines: #21262d (darker border)
Text/tick: #8b949e (text-muted)
Line stroke: #209dd7 (accent-blue)
Panel surface: #161b22 (bg-surface)
Border: #30363d (border)
```

---

### `frontend/app/components/portfolio/PositionsTable.tsx` (component, data rows)

**Analog:** `frontend/app/components/watchlist/WatchlistRow.tsx`

**Row grid pattern** (lines 44-61):
```typescript
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 64px 52px 60px 16px',
        alignItems: 'center',
        height: 36,
        padding: '0 8px',
        paddingLeft: isSelected ? '6px' : '8px',
        cursor: 'pointer',
        borderBottom: '1px solid #21262d',
        borderLeft: isSelected ? '2px solid #209dd7' : 'none',
        backgroundColor: isSelected || hovered ? '#161b22' : 'transparent',
      }}
      onClick={() => setSelectedTicker(ticker)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
```
**Key conventions:** Grid layout for columns, 36px row height, `#21262d` bottom border, `#161b22` hover background. PositionsTable needs different columns (ticker, qty, avg cost, current price, unrealized P&L, %).

**Green/red color convention** (lines 72-81):
```typescript
      {/* Change % */}
      <span
        style={{
          textAlign: 'right',
          color: changePercent != null && changePercent >= 0 ? '#22c55e' : '#ef4444',
          fontSize: 11,
        }}
      >
        {changePercent != null
          ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
          : '—'}
      </span>
```
**Key convention:** Green `#22c55e` for positive, red `#ef4444` for negative. Sign prefix `+`/`-`. `.toFixed(2)` for percentages. Em dash `—` for missing data.

**Text styling conventions** (line 63):
```typescript
      {/* Ticker symbol */}
      <span style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>{ticker}</span>
```
Ticker labels: `#e6edf3`, weight 600, size 13. Numeric values: `#e6edf3`, size 13, right-aligned.

---

### `frontend/app/components/portfolio/TradeBar.tsx` (component, input + buttons)

**Analog:** `frontend/app/components/watchlist/WatchlistPanel.tsx` (add-ticker footer)

**Input + button + error pattern** (lines 73-128):
```typescript
      {/* Add-ticker footer */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ height: 1, backgroundColor: '#30363d' }} />
        <div
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: 4,
            flexWrap: 'wrap',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
            placeholder="Ticker..."
            disabled={loading}
            style={{
              flex: 1,
              height: 28,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#e6edf3',
              fontSize: 13,
              paddingLeft: 8,
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            disabled={loading}
            style={{
              width: 72,
              height: 28,
              background: '#209dd7',
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              borderRadius: 0,
            }}
          >
            Add Ticker
          </button>
          {error && (
            <div style={{ fontSize: 11, color: '#ef4444', padding: '2px 0 0 0', width: '100%' }}>
              {error}
            </div>
          )}
        </div>
      </div>
```
**Key conventions for TradeBar:**
- Input style: `#0d1117` background, `#30363d` border, `#e6edf3` text, height 28px, no border-radius.
- Button style: `#209dd7` (blue) background for primary action, height 28px, font 11px weight 600, no border-radius. Use `#753991` (purple) for submit/Buy per brand spec, or differentiate Buy (green `#22c55e`) / Sell (red `#ef4444`).
- Error display: `#ef4444` red, fontSize 11, auto-dismiss via `setTimeout(() => setError(null), 3000)`.
- Auto-uppercase: `onChange={(e) => setInput(e.target.value.toUpperCase())}`.

**Error handling + loading state pattern** (lines 13-33):
```typescript
  async function handleAdd() {
    const ticker = input.trim()
    if (!ticker) return

    setLoading(true)
    setError(null)

    try {
      await addTicker(ticker)
      setInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (message.includes('UNIQUE') || message.includes('409')) {
        setError(`Already watching ${ticker}`)
      } else {
        setError('Failed to add ticker. Try again.')
      }
      setTimeout(() => setError(null), 3000)
    } finally {
      setLoading(false)
    }
  }
```
**TradeBar adaptation:** Instead of try/catch with throw, `executeTrade` returns `string | null`. If non-null, display the error. Same 3-second auto-dismiss.

---

### `frontend/app/components/portfolio/TradeHistory.tsx` (component, data rows)

**Analog:** `frontend/app/components/watchlist/WatchlistRow.tsx`

Same row grid pattern as PositionsTable. Columns: ticker, side (buy/sell with color), quantity, price, timestamp. Use the same grid row styling conventions (36px height, `#21262d` border, `#e6edf3` text).

**Side color convention (from WatchlistRow green/red pattern):**
- Buy: `#22c55e` (green)
- Sell: `#ef4444` (red)

---

### `frontend/app/page.tsx` (modification)

**Current file:** Already read (lines 1-120).

**What to modify:**
1. Replace the `port` section PlaceholderPanel (lines 79-90) with `<PortfolioPanel />` import and render.
2. Add header content: portfolio total value, cash balance, connection status dot. Currently header is lines 8-42. Add spans for total value and cash, and a status dot using `usePriceStatus()` and `usePortfolio()`.
3. The page must become `'use client'` (or the header values must be extracted to a client component) since it will call hooks.

**Current port placeholder** (lines 79-90):
```typescript
      {/* Portfolio placeholder */}
      <section
        style={{
          gridArea: 'port',
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #30363d',
          borderTop: '1px solid #30363d',
          overflow: 'hidden',
        }}
      >
        <PlaceholderPanel label="PORTFOLIO" phase="Phase 3" />
      </section>
```
**Replace:** `<PlaceholderPanel label="PORTFOLIO" phase="Phase 3" />` with `<PortfolioPanel />`.

**Current header style** (lines 8-42):
```typescript
      <header
        style={{
          gridArea: 'header',
          backgroundColor: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 24,
        }}
      >
        <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em' }}>
          FinAlly
        </span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>
          AI Trading Workstation
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#30363d', letterSpacing: '0.1em' }}>
          LIVE
        </span>
      </header>
```
**Add between "AI Trading Workstation" and "LIVE":** Total value, cash balance, and connection status dot spans.

---

### `frontend/app/layout.tsx` (modification)

**Current file:** Already read (lines 1-42).

**What to modify:** Add `PortfolioProvider` wrapping children inside `WatchlistProvider` (line 21):
```typescript
        <PriceProvider>
          <WatchlistProvider>
            <PortfolioProvider>    {/* NEW */}
              <div style={{ ... }}>
                {children}
              </div>
            </PortfolioProvider>   {/* NEW */}
          </WatchlistProvider>
        </PriceProvider>
```

---

## Shared Patterns

### Color Palette
**Source:** `frontend/app/globals.css` (lines 7-24)
**Apply to:** All new component files
```
Background base:    #0d1117
Background panel:   #1a1a2e
Background surface: #161b22
Accent yellow:      #ecad0a
Accent blue:        #209dd7
Accent purple:      #753991
Text primary:       #e6edf3
Text muted:         #8b949e
Border:             #30363d
Border subtle:      #21262d
Positive (green):   #22c55e
Negative (red):     #ef4444
```

### Component File Convention
**Source:** All existing components
**Apply to:** All new files
```typescript
'use client'                                    // REQUIRED: static export
import { ... } from 'react'                     // React hooks
import { useXxx } from '../../providers/...'    // Context hooks
// Inline style={{}} objects                     // NOT Tailwind utility classes
// Named export for providers, default export for components
```

### Panel Header Pattern
**Source:** `frontend/app/components/watchlist/WatchlistPanel.tsx` (lines 39-59)
**Apply to:** PortfolioPanel, any sub-section headers
```typescript
<div style={{
  height: 32,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  borderBottom: '1px solid #30363d',
  flexShrink: 0,
}}>
  <span style={{
    fontSize: 11,
    fontWeight: 600,
    color: '#8b949e',
    letterSpacing: '0.15em',
  }}>
    SECTION LABEL
  </span>
</div>
```

### Data Row Pattern
**Source:** `frontend/app/components/watchlist/WatchlistRow.tsx` (lines 44-60)
**Apply to:** PositionsTable rows, TradeHistory rows
```typescript
<div style={{
  display: 'grid',
  gridTemplateColumns: '...px ...px ...px',
  alignItems: 'center',
  height: 36,
  padding: '0 8px',
  borderBottom: '1px solid #21262d',
  backgroundColor: hovered ? '#161b22' : 'transparent',
}}>
```

### Number Formatting
**Source:** RESEARCH.md Pattern 3
**Apply to:** PositionsTable, TradeHistory, TradeBar, Header
```typescript
// Quantities: up to 4dp, trim trailing zeros
parseFloat(qty.toFixed(4)).toString()

// Dollar amounts: 2dp with currency
amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Percentages: 2dp with sign
`${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`

// Missing data placeholder
'—'
```

### Error Handling (User-Facing)
**Source:** `frontend/app/components/watchlist/WatchlistPanel.tsx` (lines 22-33)
**Apply to:** TradeBar
```typescript
// Error display: red text, auto-dismiss 3s
setError('error message')
setTimeout(() => setError(null), 3000)

// Error element: fontSize 11, color #ef4444
{error && (
  <div style={{ fontSize: 11, color: '#ef4444', padding: '2px 0 0 0', width: '100%' }}>
    {error}
  </div>
)}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have codebase analogs or RESEARCH.md patterns |

**Note:** The recharts Treemap and LineChart components have no direct codebase analog (MainChart uses lightweight-charts, not recharts). However, RESEARCH.md provides complete code examples for both. The container/header pattern from MainChart applies, while the chart internals follow RESEARCH.md examples.

## Metadata

**Analog search scope:** `frontend/app/` (providers, components, page, layout)
**Files scanned:** 7 (PriceContext, WatchlistContext, WatchlistPanel, WatchlistRow, MainChart, page.tsx, layout.tsx, globals.css)
**Pattern extraction date:** 2026-06-28
