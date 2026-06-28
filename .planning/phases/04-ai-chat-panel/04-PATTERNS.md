# Phase 4: AI Chat Panel - Pattern Map

**Mapped:** 2026-06-28
**Files analyzed:** 7 (1 new, 5 modified, 1 new E2E test)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/app/components/chat/ChatPanel.tsx` | component | request-response | `frontend/app/components/portfolio/TradeBar.tsx` | role-match (async fetch, loading state, error handling) |
| `frontend/app/providers/PortfolioContext.tsx` | provider | CRUD | self (modify: expose `refetchAll`) | exact |
| `frontend/app/providers/WatchlistContext.tsx` | provider | CRUD | self (modify: add `refetchWatchlist`) | exact |
| `frontend/app/page.tsx` | component | request-response | self (modify: add collapse state + `ChatPanel`) | exact |
| `frontend/app/layout.tsx` | config | — | self (possibly modify: grid column transition) | exact |
| `frontend/app/globals.css` | config | — | self (modify: add `@keyframes spin`) | exact |
| `test/specs/chat.spec.ts` | test | request-response | `test/specs/smoke.spec.ts` | role-match (same Playwright pattern) |

---

## Pattern Assignments

### `frontend/app/components/chat/ChatPanel.tsx` (component, request-response)

**Analog:** `frontend/app/components/portfolio/TradeBar.tsx`

**Imports pattern** (`TradeBar.tsx` lines 1-4):
```typescript
'use client'

import { useState } from 'react'
import { usePortfolio } from '../../providers/PortfolioContext'
```

ChatPanel will extend this to:
```typescript
'use client'

import { useState, useRef, useEffect, useCallback, useContext } from 'react'
import { usePortfolio } from '../../providers/PortfolioContext'
import { WatchlistContext } from '../../providers/WatchlistContext'
```

**Loading state + disabled input pattern** (`TradeBar.tsx` lines 28-30, 63, 85, 101-112):
```typescript
setLoading(true)
// ... async operation ...
setLoading(false)

// Input disabled during load:
disabled={loading}

// Button shows indicator during load:
{loading ? '...' : 'Buy'}
// Button cursor + opacity:
cursor: loading ? 'not-allowed' : 'pointer',
opacity: loading ? 0.6 : 1,
```

**Async fetch + error handling pattern** (`TradeBar.tsx` lines 13-42):
```typescript
async function handleTrade(side: 'buy' | 'sell') {
  // Guard: validate before network call
  if (!ticker) {
    setError('Enter a ticker symbol.')
    setTimeout(() => setError(null), 3000)
    return
  }

  setLoading(true)
  setError(null)

  const result = await executeTrade(ticker, qty, side)

  if (result !== null) {
    setError(result)
    setTimeout(() => setError(null), 3000)
  } else {
    setTickerInput('')
    setQtyInput('')
  }

  setLoading(false)
}
```

**Error display pattern** (`TradeBar.tsx` lines 141-153):
```typescript
{error && (
  <div
    style={{
      fontSize: 11,
      color: '#ef4444',
      padding: '2px 8px 0 8px',
      width: '100%',
      boxSizing: 'border-box',
    }}
  >
    {error}
  </div>
)}
```

**Input field style** (`TradeBar.tsx` lines 58-75):
```typescript
<input
  value={tickerInput}
  onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
  placeholder="Ticker"
  disabled={loading}
  style={{
    flex: 1,
    minWidth: 64,
    height: 28,
    background: '#0d1117',
    border: '1px solid #30363d',
    color: '#e6edf3',
    fontSize: 13,
    paddingLeft: 8,
    outline: 'none',
    borderRadius: 0,
  }}
/>
```

**Scrollable list container pattern** (`TradeHistory.tsx` lines 78-123):
```typescript
// Flex column container holding a fixed header + scrollable body
<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
  {/* Fixed section header */}
  <div style={{
    height: 32,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    borderBottom: '1px solid #30363d',
    flexShrink: 0,
  }}>
    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.15em' }}>
      HISTORY
    </span>
  </div>

  {/* Scrollable body — flex: 1, overflowY: auto */}
  <div style={{ flex: 1, overflowY: 'auto' }}>
    {trades.length === 0 ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', fontSize: 11, color: '#30363d' }}>
        No trades yet
      </div>
    ) : (
      trades.map((trade) => <TradeRow key={trade.id} trade={trade} />)
    )}
  </div>
</div>
```

**Panel flex column layout** (`PortfolioPanel.tsx` lines 9-11):
```typescript
<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
  {/* Fixed header (flexShrink: 0) */}
  {/* Scrollable content (flex: 1, overflow: hidden) */}
```

**Section header label style** (`PortfolioPanel.tsx` lines 22-32):
```typescript
<span style={{
  fontSize: 11,
  fontWeight: 600,
  color: '#8b949e',
  letterSpacing: '0.15em',
}}>
  PORTFOLIO
</span>
```

**Context access pattern** (`TradeHistory.tsx` line 75; `TradeBar.tsx` lines 7):
```typescript
// Destructure only what you need from the hook:
const { trades } = usePortfolio()
const { executeTrade } = usePortfolio()
```

**useContext (non-hook accessor) pattern** (`WatchlistContext.tsx` lines 26-27 analog):
```typescript
// For WatchlistContext in ChatPanel (no useWatchlist hook needed — use useContext directly
// since ChatPanel only needs setTickers for local sync):
const { tickers, setTickers } = useContext(WatchlistContext)
// OR use the exported hook:
const { addTicker, removeTicker } = useWatchlist()
```

---

### `frontend/app/providers/PortfolioContext.tsx` (provider, CRUD — MODIFY)

**Analog:** self

**Current `PortfolioContextValue` type** (lines 29-36):
```typescript
export type PortfolioContextValue = {
  positions: Position[]
  cashBalance: number
  totalValue: number
  trades: Trade[]
  history: Snapshot[]
  executeTrade: (ticker: string, quantity: number, side: 'buy' | 'sell') => Promise<string | null>
}
```

**Change required:** Add `refetchPortfolio: () => Promise<void>` to this type (line 35, after `executeTrade`).

**Existing `refetchAll` callback** (lines 55-78) — this is what gets exposed:
```typescript
const refetchAll = useCallback(async () => {
  try {
    const [portResp, tradesResp, histResp] = await Promise.all([
      fetch('/api/portfolio'),
      fetch('/api/trades'),
      fetch('/api/portfolio/history'),
    ])
    if (portResp.ok) {
      const port = (await portResp.json()) as { cash_balance: number; positions: Position[] }
      setPositions(port.positions)
      setCashBalance(port.cash_balance)
    }
    if (tradesResp.ok) {
      const t = (await tradesResp.json()) as Trade[]
      setTrades(t)
    }
    if (histResp.ok) {
      const h = (await histResp.json()) as Snapshot[]
      setHistory(h)
    }
  } catch {
    // Silently fail — state remains at last known values
  }
}, [])
```

**Provider value object** (lines 119-121) — add `refetchPortfolio: refetchAll` here:
```typescript
<PortfolioContext.Provider
  value={{ positions, cashBalance, totalValue, trades, history, executeTrade }}
>
```

**Default context value** (lines 38-45) — add `refetchPortfolio: async () => {}`:
```typescript
export const PortfolioContext = createContext<PortfolioContextValue>({
  positions: [],
  cashBalance: 0,
  totalValue: 0,
  trades: [],
  history: [],
  executeTrade: async () => null,
})
```

---

### `frontend/app/providers/WatchlistContext.tsx` (provider, CRUD — MODIFY)

**Analog:** self

**Current `WatchlistContextValue` type** (lines 6-14):
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
```

**Change required:** Add `refetchWatchlist: () => Promise<void>` to the type. This enables ChatPanel to re-sync the tickers array after AI watchlist changes without double-POSTing.

**Existing mount fetch** (lines 37-50) — extract into a named function and expose it:
```typescript
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

Pattern: extract the fetch body into `const refetchWatchlist = useCallback(async () => { ... }, [])`, call it in the `useEffect`, and add it to the context value and default value.

**addTicker function** (lines 82-91) — note the throw on non-ok (ChatPanel must catch this when used for sync):
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

---

### `frontend/app/page.tsx` (component — MODIFY)

**Analog:** self

**Current imports pattern** (lines 1-8):
```typescript
'use client'

import MainChart from './components/chart/MainChart'
import WatchlistPanel from './components/watchlist/WatchlistPanel'
import PortfolioPanel from './components/portfolio/PortfolioPanel'
import { usePortfolio } from './providers/PortfolioContext'
import { usePriceStatus } from './providers/PriceContext'
```

Add: `import { useState } from 'react'` and `import ChatPanel from './components/chat/ChatPanel'`

**useState pattern used in page.tsx** — currently none. New pattern to add (following the `priceStatus` derivation style at lines 12-27):
```typescript
const [chatOpen, setChatOpen] = useState(true)
```

**Current AI chat placeholder section** (lines 145-155):
```typescript
{/* AI chat placeholder */}
<aside
  style={{
    gridArea: 'chat',
    backgroundColor: '#1a1a2e',
    borderLeft: '1px solid #30363d',
    overflow: 'hidden',
  }}
>
  <PlaceholderPanel label="AI CHAT" phase="Phase 4" />
</aside>
```

Replace `<PlaceholderPanel>` with `<ChatPanel />` and add toggle button. The `aside` wrapper style stays; add `chatOpen` prop or co-locate toggle logic.

**Header section pattern** (lines 31-120) — the collapse toggle button should be added in the header's `marginLeft: 'auto'` flex area (lines 102-119), next to the SSE dot:
```typescript
<div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
  {/* SSE dot */}
  <div title={statusTitle} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor }} />
</div>
```

---

### `frontend/app/layout.tsx` (config — MODIFY if grid transition needed)

**Analog:** self

**Current grid container** (lines 23-37):
```typescript
<div
  style={{
    display: 'grid',
    gridTemplateAreas: `
      "header header header"
      "watch  chart  chat"
      "port   chart  chat"
    `,
    gridTemplateColumns: '280px 1fr 320px',
    gridTemplateRows: '48px 1fr 1fr',
    height: '100vh',
    overflow: 'hidden',
  }}
>
```

**Layout modification option:** If collapse state is owned by `page.tsx` (recommended), `layout.tsx` does not need to change — `page.tsx` controls the `aside` element's style directly (width, overflow: hidden). The grid template stays `280px 1fr 320px` permanently; the `aside` collapses internally.

**Alternative if grid-level collapse is needed:** Change `gridTemplateColumns` to a CSS variable or pass through a `className`. Not recommended for static export — `page.tsx` approach is simpler.

---

### `frontend/app/globals.css` (config — MODIFY)

**Analog:** self

**Existing `@keyframes` pattern** (lines 47-71) — the spin keyframe follows the exact same structure:
```css
/* Price flash animations — used in Phase 2 watchlist */
@keyframes flash-up {
  0% { background-color: rgba(34, 197, 94, 0.35); }
  100% { background-color: transparent; }
}

@keyframes flash-down {
  0% { background-color: rgba(239, 68, 68, 0.35); }
  100% { background-color: transparent; }
}

.flash-up {
  animation: flash-up 500ms ease-out forwards;
}
```

**New keyframe to add** (append after line 71):
```css
/* Spinner animation — used in ChatPanel loading state */
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

No `.spin` class needed — the spinner div uses `animation: 'spin 0.8s linear infinite'` inline (as shown in RESEARCH.md Code Examples). Consistent with how `flash-up`/`flash-down` are defined but `.flash-up` is applied via className while spinner is inline style.

---

### `test/specs/chat.spec.ts` (test — NEW)

**Analog:** `test/specs/smoke.spec.ts`

**File header + imports pattern** (`smoke.spec.ts` lines 1-3):
```typescript
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8001';
```

**API-level test pattern** (`smoke.spec.ts` lines 204-214):
```typescript
test('Chat endpoint returns message in mock mode', async ({ request }) => {
  const res = await request.post(`${BASE}/api/chat`, {
    data: { message: 'Hello, what is my portfolio worth?' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body.message).toBe('string');
  expect(body.message.length).toBeGreaterThan(0);
  expect(Array.isArray(body.trades)).toBe(true);
  expect(Array.isArray(body.watchlist_changes)).toBe(true);
});
```

**UI test with `page` fixture + waitForTimeout pattern** (`smoke.spec.ts` lines 227-235):
```typescript
test('Frontend shows watchlist tickers', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  const hasAapl = await page.locator('text=AAPL').count() > 0;
  const hasGoogl = await page.locator('text=GOOGL').count() > 0;
  expect(hasAapl || hasGoogl).toBe(true);
});
```

**Section grouping comment pattern** (`smoke.spec.ts` lines 5, 15, 74, 149, 165, 202, 216):
```typescript
// ─── Chat Panel UI ────────────────────────────────────────────────────────────
```

**Test coverage map for `chat.spec.ts`:**

| Req | Test name | Fixture | Pattern |
|---|---|---|---|
| CHAT-01 | `'Chat panel renders input and message area'` | `page` | `page.goto('/') + locator` |
| CHAT-02 | `'Loading indicator appears while awaiting response'` | `page` | `page.goto('/') + type + waitFor` |
| CHAT-03 | `'Assistant message text is displayed after submit'` | `page` | mock response text visible |
| CHAT-04 | `'Trade chip appears for AI-executed trade'` | `page` | locator for buy/sell chip text |
| CHAT-05 | `'Watchlist chip appears for AI watchlist change'` | `page` | locator for chip |
| CHAT-06 | `'Chat panel collapse toggle hides and restores panel'` | `page` | click toggle, check visibility |

---

## Shared Patterns

### `'use client'` directive
**Source:** Every component file: `TradeBar.tsx` line 1, `TradeHistory.tsx` line 1, `PortfolioContext.tsx` line 1, `WatchlistContext.tsx` line 1
**Apply to:** `ChatPanel.tsx` — required for static export; all interactive components must be `'use client'`
```typescript
'use client'
```

### Color tokens (inline style values)
**Source:** `globals.css` lines 7-24, used consistently across all components
**Apply to:** `ChatPanel.tsx` — use these exact values (not Tailwind classes) consistent with all other components:
```typescript
// Backgrounds
'#0d1117'   // bg-base — message input background
'#1a1a2e'   // bg-panel — chat panel background
'#161b22'   // bg-surface — message bubble backgrounds

// Brand accents
'#ecad0a'   // accent-yellow — panel label
'#209dd7'   // accent-blue — watchlist chip border, send button ring
'#753991'   // accent-purple — send button background (matches Sell button)

// Text
'#e6edf3'   // text-primary — user messages, main text
'#8b949e'   // text-muted — labels, timestamps, panel headers

// Borders
'#30363d'   // border — all dividers
'#21262d'   // border-subtle — row separators (see TradeHistory.tsx line 29)

// Status colors (re-use from page.tsx lines 13-18)
'#22c55e'   // green — buy side, success
'#ef4444'   // red — sell side, error
```

### Fetch + try/catch error handling
**Source:** `PortfolioContext.tsx` lines 55-78 (`refetchAll`), `TradeBar.tsx` lines 13-42
**Apply to:** `ChatPanel.tsx` submit handler
```typescript
try {
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
  })
  const data = await resp.json()
  // ... process data ...
} catch {
  // Silently fail or set error state — never throw from component
  setMessages(prev => [...prev, { id: ..., role: 'assistant', text: 'Connection error. Please try again.' }])
} finally {
  setIsLoading(false)
}
```

### Panel section header
**Source:** `PortfolioPanel.tsx` lines 13-33, `TradeHistory.tsx` lines 80-101
**Apply to:** `ChatPanel.tsx` top header bar
```typescript
<div style={{
  height: 32,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  borderBottom: '1px solid #30363d',
  flexShrink: 0,
}}>
  <span style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', letterSpacing: '0.15em' }}>
    AI CHAT
  </span>
</div>
```

### Empty state display
**Source:** `TradeHistory.tsx` lines 104-116
**Apply to:** `ChatPanel.tsx` when messages array is empty
```typescript
<div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  fontSize: 11,
  color: '#30363d',
}}>
  Ask FinAlly anything about your portfolio
</div>
```

### `useCallback` for stable async handlers
**Source:** `PortfolioContext.tsx` lines 55-78, 93-116
**Apply to:** `ChatPanel.tsx` submit handler (prevents recreation on every render while holding correct closure)
```typescript
const handleSubmit = useCallback(async () => {
  // ...
}, [input, isLoading, refetchPortfolio])
```

---

## No Analog Found

No files in this phase lack a close analog. All patterns are derivable from existing codebase files.

---

## Metadata

**Analog search scope:** `frontend/app/components/`, `frontend/app/providers/`, `frontend/app/`, `test/specs/`
**Files scanned:** 10 source files read in full
**Pattern extraction date:** 2026-06-28

**Key architectural constraints confirmed:**
- `refetchAll` in `PortfolioContext.tsx` is NOT in public API (line 120 value object omits it) — must be added as `refetchPortfolio`
- `WatchlistContext.addTicker()` throws on 409 (line 89: `if (!resp.ok) throw new Error(...)`) — calling it for AI-added tickers will throw; use `refetchWatchlist` instead
- All components use inline `style={{}}` objects, never Tailwind utility classes (consistent throughout codebase)
- Static export constraint: no Server Actions, no `use server`, no `next/headers` — plain `fetch` only
- `layout.tsx` grid column is hardcoded string `'280px 1fr 320px'` at line 31 — collapse approach via `page.tsx` controlling the `aside` overflow/width is cleaner than modifying layout
