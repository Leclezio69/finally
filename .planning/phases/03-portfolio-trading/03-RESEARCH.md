# Phase 3: Portfolio & Trading - Research

**Researched:** 2026-06-28
**Domain:** React frontend — portfolio visualization (recharts Treemap + LineChart), state management (React Context), REST API integration, trade execution UI
**Confidence:** HIGH

## Summary

Phase 3 builds the portfolio section of the FinAlly trading workstation. The work divides into four areas: (1) a PortfolioContext provider that fetches portfolio data and recalculates live values from SSE prices, (2) header additions showing portfolio total, cash, and connection status, (3) the `port` grid area containing a heatmap (recharts Treemap), P&L chart (recharts LineChart), positions table, trade bar, and trade history, and (4) trade execution logic with error handling.

The backend APIs are complete and well-documented. The frontend already has established patterns (PriceContext for SSE, WatchlistContext for state, inline styles, `'use client'` directives). recharts is NOT currently installed but is referenced in PLAN.md as part of the stack. It must be added as a dependency along with `react-is` (a peer dependency). The recharts Treemap `content` prop accepts a custom render function that receives `TreemapNode` props (x, y, width, height, name, value, etc.), enabling dynamic fill colors and text labels for the heatmap.

**Primary recommendation:** Install recharts 3.9.0, create a PortfolioContext following the WatchlistContext pattern, build the port section as a two-row flex layout (heatmap + P&L chart top, trade bar + positions table + trade history bottom), and wire trade execution through POST /api/portfolio/trade with optimistic UI updates.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Portfolio value calculation | Browser / Client | -- | UI-SPEC mandates client-side recalculation from SSE prices, not polling the API |
| Position data fetching | API / Backend | -- | GET /api/portfolio returns enriched positions; client caches result |
| Trade execution | API / Backend | Browser / Client | POST /api/portfolio/trade does validation + DB writes; client submits and handles response |
| Heatmap visualization | Browser / Client | -- | recharts Treemap renders entirely client-side from cached position data + live prices |
| P&L chart | Browser / Client | API / Backend | Client fetches GET /api/portfolio/history and renders; backend records snapshots every 10s |
| Trade history | Browser / Client | API / Backend | Client fetches GET /api/trades; backend stores and returns trades |
| SSE connection status | Browser / Client | -- | PriceContext already tracks `status`; header reads it |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.9.0 | Treemap heatmap + LineChart for P&L | Already specified in PLAN.md; supports React 19; Treemap has `content` prop for custom rendering [ASSUMED -- PLAN.md specifies recharts but it is not yet installed] |
| react-is | 19.x | Peer dependency of recharts | Required by recharts 3.x peer dependency list [CITED: npm view recharts@3.9.0 peerDependencies] |
| React Context | (built-in) | PortfolioContext for shared portfolio state | Established project pattern (PriceContext, WatchlistContext) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lightweight-charts | ^5.2.0 | Already installed for main chart | NOT used in Phase 3 -- recharts handles all Phase 3 charts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts Treemap | D3 treemap | D3 is lower-level, more control but more code; recharts is already the project's charting library |
| React Context | Zustand/Jotai | Context is the established pattern; no need to add another state library for 3 consumers |

**Installation:**
```bash
cd frontend && npm install recharts react-is
```

**Version verification:**
- recharts: 3.9.0 confirmed via `npm view recharts version` (2026-06-28) [VERIFIED: npm registry]
- react-is: 19.2.7 latest, peer dep requires ^19.0.0 for React 19 projects [VERIFIED: npm registry]
- recharts peerDependencies: `react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` -- compatible with React 19.2.4 [VERIFIED: npm registry]

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages tagged `[ASSUMED]`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| recharts | npm | ~8 yrs | High (established React charting library) | github.com/recharts/recharts | N/A | [ASSUMED] -- planner must add checkpoint |
| react-is | npm | ~8 yrs | Very high (React team package) | github.com/facebook/react | N/A | [ASSUMED] -- planner must add checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All packages above are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
SSE Stream (/api/stream/prices)
    |
    v
PriceContext (existing)
    |
    +---> WatchlistPanel (existing, Phase 2)
    |
    +---> PortfolioContext (NEW)
    |         |
    |         +---> recalculates total_value on each price_update
    |         |     formula: sum(pos.quantity * currentPrice[pos.ticker]) + cash
    |         |
    |         +---> fetches GET /api/portfolio on mount + after trade
    |         +---> fetches GET /api/trades on mount + after trade
    |         +---> fetches GET /api/portfolio/history on mount + after trade
    |         |
    |         +---> executeTrade(ticker, qty, side) --> POST /api/portfolio/trade
    |                   |
    |                   +-- on success: re-fetch portfolio, trades, history
    |                   +-- on error: return error message string
    |
    +---> Header (reads PortfolioContext for total_value, cash, PriceContext for status)
    |
    +---> PortfolioPanel (port grid area)
              |
              +---> Heatmap (recharts Treemap)
              +---> PnLChart (recharts LineChart)
              +---> TradeBar (inputs + Buy/Sell buttons)
              +---> PositionsTable (scrollable rows)
              +---> TradeHistory (recent trades list)
```

### Recommended Project Structure
```
frontend/app/
  providers/
    PortfolioContext.tsx      # NEW: portfolio state, trade execution, refetch logic
  components/
    portfolio/
      PortfolioPanel.tsx      # NEW: port grid area container (layout)
      Heatmap.tsx             # NEW: recharts Treemap wrapper
      PnLChart.tsx            # NEW: recharts LineChart wrapper
      PositionsTable.tsx      # NEW: positions table with header + scrollable body
      TradeBar.tsx            # NEW: ticker/qty inputs + Buy/Sell buttons + error
      TradeHistory.tsx        # NEW: recent trades list
```

### Pattern 1: PortfolioContext (Context + Fetch + SSE Integration)

**What:** A React Context provider that owns all portfolio state: positions, cash, total_value, trades, history. It fetches from the API on mount and after trades, and recalculates total_value on every SSE price update.

**When to use:** Any component that needs portfolio data (header, heatmap, positions table, trade bar, P&L chart, trade history).

**Example:**
```typescript
// Source: Derived from WatchlistContext.tsx pattern + UI-SPEC interaction contract
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { PriceContext } from './PriceContext'

type Position = {
  ticker: string
  quantity: number
  avg_cost: number
  current_price: number
  unrealized_pnl: number
  pnl_percent: number
}

type Trade = {
  id: string
  ticker: string
  side: string
  quantity: number
  price: number
  executed_at: string
}

type Snapshot = {
  total_value: number
  recorded_at: string
}

type PortfolioContextValue = {
  positions: Position[]
  cashBalance: number
  totalValue: number
  trades: Trade[]
  history: Snapshot[]
  executeTrade: (ticker: string, quantity: number, side: 'buy' | 'sell') => Promise<string | null>
  // returns error message or null on success
}

// Context recalculates totalValue on each SSE price update:
// totalValue = sum(pos.quantity * prices[pos.ticker].price) + cashBalance
// This avoids polling GET /api/portfolio for live value (UI-SPEC mandate)
```

### Pattern 2: Treemap Custom Content

**What:** A custom render function passed to recharts `<Treemap content={...}>` that colors rectangles by P&L and renders ticker + percentage labels.

**When to use:** PORT-04 heatmap.

**Example:**
```typescript
// Source: recharts Treemap API docs + TreemapNode type definition
// https://cdn.jsdelivr.net/npm/recharts@3.8.1/types/chart/Treemap.d.ts
import { TreemapNode } from 'recharts' // or inline the type

function HeatmapCell(props: TreemapNode) {
  const { x, y, width, height, name } = props
  // Custom data fields passed through from data array:
  const pnl = (props as Record<string, unknown>).unrealized_pnl as number
  const pnlPct = (props as Record<string, unknown>).pnl_percent as number

  const fill = pnl > 0
    ? 'rgba(34, 197, 94, 0.6)'   // #22c55e at 60%
    : pnl < 0
    ? 'rgba(239, 68, 68, 0.6)'   // #ef4444 at 60%
    : '#30363d'                    // breakeven

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0d1117" />
      {width > 30 && height > 24 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle"
                fill="#e6edf3" fontSize={11} fontWeight={600}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 8} textAnchor="middle"
                fill="#e6edf3" fontSize={11} fontWeight={600}>
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </text>
        </>
      )}
    </g>
  )
}
```

### Pattern 3: Quantity Formatting (4dp Trim Trailing Zeros)

**What:** Format quantities to up to 4 decimal places, trimming trailing zeros.

**Example:**
```typescript
// Cleanest approach: parseFloat(n.toFixed(4)).toString()
// 10.0000 -> "10"
// 2.5000 -> "2.5"
// 0.1234 -> "0.1234"
// 1.2300 -> "1.23"
function formatQuantity(qty: number): string {
  return parseFloat(qty.toFixed(4)).toString()
}

// Dollar formatting:
function formatDollars(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
```

### Anti-Patterns to Avoid

- **Polling GET /api/portfolio for live value:** The UI-SPEC explicitly forbids this. Client must recalculate from SSE prices + cached positions. Only fetch portfolio data on mount and after trades.
- **Polling GET /api/portfolio/history on SSE events:** Backend snapshots every 10s. Fetching on every SSE event would be wasteful. Fetch on mount + after each trade only.
- **Using `useEffect` to set state from props in every render:** The heatmap data should be derived via `useMemo` from positions + prices, not via effect-driven state updates.
- **Treemap data without `[key: string]: unknown`:** TypeScript will reject treemap data objects that don't satisfy the `TreemapDataType` index signature. All data objects must include this or use type assertion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Treemap layout algorithm | Custom squarify implementation | recharts `<Treemap>` | Squarify algorithm has edge cases around aspect ratio and tiny rectangles |
| Responsive chart sizing | Manual ResizeObserver | recharts `<ResponsiveContainer>` | Handles debouncing, initial dimensions, and cleanup |
| Currency formatting | Manual string manipulation | `Intl.NumberFormat` / `toLocaleString` | Handles comma separators, decimal places, negative formatting |
| Time formatting on chart axes | Manual date parsing | `new Date(iso).toLocaleTimeString` with options | Handles timezone, 24h/12h |

**Key insight:** recharts handles the SVG rendering, layout algorithms, and responsive sizing. The custom work is limited to: (a) a `content` function for treemap cell colors/labels, (b) data transformation from API response to recharts data format, and (c) the PortfolioContext that glues everything together.

## Common Pitfalls

### Pitfall 1: Treemap TreemapDataType Index Signature
**What goes wrong:** TypeScript error when passing custom data objects to `<Treemap data={...}>` because they lack `[key: string]: unknown`.
**Why it happens:** recharts 3.x defines `TreemapDataType` with an index signature requirement.
**How to avoid:** Either add the index signature to your data type interface, or use a type assertion when constructing data.
**Warning signs:** TS2322 error on the `data` prop of `<Treemap>`.

### Pitfall 2: ResponsiveContainer Requires a Parent with Explicit Dimensions
**What goes wrong:** Chart renders with 0 width/height or doesn't render at all.
**Why it happens:** `<ResponsiveContainer>` uses ResizeObserver on its parent. If the parent has no explicit height (e.g., `height: auto`), the container can't determine dimensions.
**How to avoid:** Ensure the parent element has an explicit height (via flex, grid, or fixed px). The port grid area is `1fr` which resolves to a concrete pixel value -- this works.
**Warning signs:** Blank chart area, console warning about 0 dimensions.

### Pitfall 3: Stale Portfolio Data After Trade
**What goes wrong:** After executing a trade, the positions table, heatmap, cash balance, and trade history don't update.
**Why it happens:** Forgetting to re-fetch all dependent data after a successful trade.
**How to avoid:** The `executeTrade` function in PortfolioContext must re-fetch: (1) GET /api/portfolio (positions + cash), (2) GET /api/trades (trade history), (3) GET /api/portfolio/history (P&L chart).
**Warning signs:** Old position data visible after trade, cash not changing.

### Pitfall 4: SSE Recalculation Performance
**What goes wrong:** Re-rendering the entire portfolio on every SSE price update (~500ms interval, 10+ tickers) causes jank.
**Why it happens:** Naive implementation creates new objects on every price update, triggering full tree re-render.
**How to avoid:** Use `useMemo` for derived values (totalValue, heatmap data). Only recalculate when positions array identity OR relevant prices change. The header totalValue can use a ref-based approach to avoid context consumers re-rendering.
**Warning signs:** Visible lag in the UI, high CPU usage in React DevTools profiler.

### Pitfall 5: Trade Error Message Format
**What goes wrong:** Error message parsing fails or shows raw JSON/HTML.
**Why it happens:** The backend returns `{"detail": "Insufficient funds. Need $X, have $Y"}` with status 400. The frontend needs to extract the `detail` field.
**How to avoid:** Parse the response body as JSON and read `.detail`. The UI-SPEC maps: funds-related messages to "Insufficient funds", shares-related to "Insufficient shares", otherwise show API error verbatim.
**Warning signs:** `[object Object]` displayed as error text.

### Pitfall 6: Recharts in Next.js Static Export
**What goes wrong:** Build fails or SSR errors with recharts components.
**Why it happens:** recharts uses browser APIs (SVG, DOM measurement) that aren't available during SSR.
**How to avoid:** All recharts components must be in files with `'use client'` directive. Since the project uses `output: 'export'`, this is critical -- the build will fail without it.
**Warning signs:** `ReferenceError: window is not defined` or `document is not defined` during build.

## Code Examples

### Backend API Response Shapes

**GET /api/portfolio** [VERIFIED: backend/app/api/portfolio.py lines 27-73]
```json
{
  "cash_balance": 10000.0,
  "total_value": 12345.67,
  "unrealized_pnl": 2345.67,
  "positions": [
    {
      "ticker": "AAPL",
      "quantity": 10.0,
      "avg_cost": 190.50,
      "current_price": 195.25,
      "unrealized_pnl": 47.50,
      "pnl_percent": 2.49
    }
  ]
}
```

**POST /api/portfolio/trade** [VERIFIED: backend/app/api/portfolio.py lines 76-152]
```json
// Request: { "ticker": "AAPL", "quantity": 5, "side": "buy" }
// Success response:
{
  "success": true,
  "trade": {
    "id": "uuid",
    "ticker": "AAPL",
    "side": "buy",
    "quantity": 5,
    "price": 195.25,
    "executed_at": "2026-06-28T12:00:00+00:00"
  },
  "new_cash_balance": 9023.75
}
// Error response (400):
{ "detail": "Insufficient funds. Need $976.25, have $100.00" }
{ "detail": "Insufficient shares. Need 100, have 5.0" }
```

**GET /api/trades** [VERIFIED: backend/app/api/trades.py + backend/app/db/queries.py]
```json
[
  {
    "id": "uuid",
    "ticker": "AAPL",
    "side": "buy",
    "quantity": 5.0,
    "price": 195.25,
    "executed_at": "2026-06-28T12:00:00+00:00"
  }
]
```

**GET /api/portfolio/history** [VERIFIED: backend/app/db/queries.py lines 216-229]
```json
[
  { "total_value": 10000.0, "recorded_at": "2026-06-28T12:00:00+00:00" },
  { "total_value": 10025.50, "recorded_at": "2026-06-28T12:00:10+00:00" }
]
```

### P&L LineChart Setup

```typescript
// Source: recharts API docs (ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip)
'use client'

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

// Data from GET /api/portfolio/history:
// [{ total_value: 10000, recorded_at: "2026-..." }, ...]

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDollarAxis(value: number): string {
  return `$${value.toLocaleString()}`
}

<ResponsiveContainer width="100%" height="100%">
  <LineChart data={history}>
    <CartesianGrid horizontal vertical={false} stroke="#21262d" strokeDasharray="3 3" />
    <XAxis
      dataKey="recorded_at"
      tickFormatter={formatTime}
      tick={{ fill: '#8b949e', fontSize: 11, fontWeight: 600 }}
      axisLine={false}
      tickLine={false}
    />
    <YAxis
      tickFormatter={formatDollarAxis}
      tick={{ fill: '#8b949e', fontSize: 11, fontWeight: 600 }}
      orientation="right"
      axisLine={false}
      tickLine={false}
      width={60}
    />
    <Tooltip
      contentStyle={{
        backgroundColor: '#161b22',
        border: '1px solid #30363d',
        color: '#e6edf3',
        fontSize: 11,
      }}
      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Value']}
      labelFormatter={formatTime}
    />
    <Line
      type="monotone"
      dataKey="total_value"
      stroke="#209dd7"
      strokeWidth={1.5}
      dot={false}
      isAnimationActive={false}
    />
  </LineChart>
</ResponsiveContainer>
```

### Treemap Heatmap Setup

```typescript
// Source: recharts Treemap API + TreemapNode type
'use client'

import { ResponsiveContainer, Treemap } from 'recharts'

type HeatmapData = {
  name: string
  value: number  // position_value for sizing
  unrealized_pnl: number
  pnl_percent: number
  [key: string]: unknown  // REQUIRED: satisfies TreemapDataType
}

// Transform positions to heatmap data:
const data: HeatmapData[] = positions.map(pos => ({
  name: pos.ticker,
  value: Math.abs(pos.quantity * currentPrice),  // size by absolute value
  unrealized_pnl: pos.unrealized_pnl,
  pnl_percent: pos.pnl_percent,
}))

<ResponsiveContainer width="100%" height="100%">
  <Treemap
    data={data}
    dataKey="value"
    content={<HeatmapCell />}  // custom render function (see Pattern 2 above)
    isAnimationActive={false}
    stroke="#0d1117"
  />
</ResponsiveContainer>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recharts 2.x `customizedContent` prop | recharts 3.x `content` prop (same API, renamed internally) | recharts 3.0 (2024) | Import path unchanged; `content` prop works the same way |
| Class components for charts | Function components with hooks | React 18+ | All recharts 3.x examples use function components |
| `colorPanel` prop on Treemap | Custom `content` function | recharts 3.x | `colorPanel` only cycles colors by index; `content` gives full control |

**Deprecated/outdated:**
- recharts 2.x: Still widely documented online but 3.x is current. Key difference: 3.x has better TypeScript types and React 19 support.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PORT-01 | Header shows live total portfolio value (recalculates as prices stream) | PortfolioContext pattern recalculates from SSE prices + cached positions; useMemo for performance |
| PORT-02 | Header shows current cash balance | PortfolioContext exposes cashBalance; updates after trade execution |
| PORT-03 | Header shows SSE connection status dot (green/yellow/red) | PriceContext already has `status` field with 'connecting'/'connected'/'reconnecting'/'disconnected' |
| PORT-04 | Portfolio heatmap (treemap): positions sized by weight, green = profit, red = loss | recharts Treemap with custom `content` function; TreemapNode props provide x/y/width/height; custom fill based on P&L |
| PORT-05 | P&L chart (line): total portfolio value over time | recharts LineChart + GET /api/portfolio/history; backend snapshots every 10s + after each trade |
| PORT-06 | Positions table: ticker, quantity (4dp trim), avg cost, current price, unrealized P&L, % change | `parseFloat(qty.toFixed(4)).toString()` for quantity; `toFixed(2)` for dollars; green/red P&L colors |
| TRADE-01 | Trade bar has ticker, quantity, Buy, Sell | Input + number input + 2 buttons; follows WatchlistPanel add-ticker pattern |
| TRADE-02 | Buy executes instantly; cash decreases; position appears in table and heatmap | POST /api/portfolio/trade with side='buy'; on success re-fetch portfolio, trades, history |
| TRADE-03 | Sell executes; position updates or disappears when fully sold | POST /api/portfolio/trade with side='sell'; backend deletes position row when qty reaches 0 |
| TRADE-04 | Trade history shows recent trades (ticker, side, qty, price, time) | GET /api/trades returns array; most recent first; fetch on mount + after trade |
| TRADE-05 | Error shown on insufficient funds or shares (not a crash) | Parse 400 response detail field; display below trade bar; auto-dismiss 3s |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech Stack**: Next.js TypeScript + Tailwind CSS + recharts (all `'use client'` components required for static export)
- **Output**: `output: 'export'` in next.config.ts -- no SSR, pure static
- **No CORS**: Frontend served by same FastAPI origin -- all `/api/*` calls are same-origin
- **Next.js version**: 16.2.9 -- per `frontend/AGENTS.md`, read docs in `node_modules/next/dist/docs/` before writing code; APIs may differ from training data
- **Inline styles**: Existing codebase uses inline `style={{}}` objects, not Tailwind utility classes for layout (Tailwind is used for theme tokens in globals.css only)
- **GSD Workflow**: Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (E2E, in `test/`) |
| Config file | `test/playwright.config.ts` |
| Quick run command | `cd test && npx playwright test --grep "portfolio"` |
| Full suite command | `cd test && npx playwright test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PORT-01 | Header shows live total value | E2E | `npx playwright test --grep "portfolio value"` | No -- Wave 0 |
| PORT-02 | Header shows cash balance | E2E | `npx playwright test --grep "cash"` | No -- Wave 0 |
| PORT-03 | SSE connection status dot | E2E | `npx playwright test --grep "status"` | No -- Wave 0 |
| PORT-04 | Heatmap renders with positions | E2E | `npx playwright test --grep "heatmap"` | No -- Wave 0 |
| PORT-05 | P&L chart shows data | E2E | `npx playwright test --grep "pnl"` | No -- Wave 0 |
| PORT-06 | Positions table format | E2E | `npx playwright test --grep "positions"` | No -- Wave 0 |
| TRADE-01 | Trade bar elements present | E2E | `npx playwright test --grep "trade bar"` | No -- Wave 0 |
| TRADE-02 | Buy trade execution | E2E | `npx playwright test --grep "buy"` | No -- Wave 0 |
| TRADE-03 | Sell trade execution | E2E | `npx playwright test --grep "sell"` | No -- Wave 0 |
| TRADE-04 | Trade history display | E2E | `npx playwright test --grep "trade history"` | No -- Wave 0 |
| TRADE-05 | Error on insufficient funds | E2E | `npx playwright test --grep "insufficient"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Visual inspection (dev server) -- no unit test framework in frontend
- **Per wave merge:** `cd test && npx playwright test` (requires Docker container)
- **Phase gate:** Full Playwright suite green before `/gsd:verify-work`

### Wave 0 Gaps
- Note: E2E tests run against the Docker container (Phase 5). During Phase 3 development, validation is visual via `npm run dev` + backend running on port 8000. New E2E tests for portfolio/trading will be written in Phase 5. No test files need to be created in Phase 3 Wave 0.

## Security Domain

> This phase involves no authentication, no cryptography, no user-supplied data persisted beyond the single-user SQLite (no multi-user). The trade bar accepts ticker/quantity input but the backend validates and sanitizes (uppercase, positive quantity, valid side). No additional security controls needed beyond what the backend already enforces.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- no auth by design |
| V3 Session Management | no | N/A -- single user |
| V4 Access Control | no | N/A -- single user |
| V5 Input Validation | yes | Backend validates ticker (uppercase), quantity (positive), side (buy/sell). Frontend should also validate before sending to avoid unnecessary API calls |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for Frontend

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via ticker input | Tampering | React auto-escapes JSX; ticker is uppercased and validated by backend |
| CSRF on trade endpoint | Spoofing | Same-origin only (no CORS); no auth tokens to steal |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | recharts 3.9.0 Treemap `content` prop accepts a function receiving TreemapNode props (x, y, width, height, name, value) | Architecture Patterns | Heatmap rendering would need a different approach; verified against type definitions but not runtime-tested |
| A2 | recharts 3.9.0 is compatible with React 19.2.4 in static export mode | Standard Stack | Build would fail; peer deps say ^19.0.0 is supported but not tested with Next.js 16 static export specifically |
| A3 | `react-is` is needed as a separate install (not auto-resolved) | Standard Stack | May already be resolved transitively; npm install would be a no-op if so |
| A4 | The port grid area has enough vertical space for a two-row layout at typical screen heights | Architecture Patterns | If viewport is too short, content may overflow; the grid row is `1fr` which adapts but could be very small on 768px screens |

## Open Questions

1. **Two-row layout vs. tabs for port area**
   - What we know: UI-SPEC says "Recommended: Row A (top half) Heatmap + P&L chart, Row B (bottom half) Trade bar + Positions table + Trade history. Alternatively: tabs." Both are acceptable.
   - What's unclear: Whether the vertical space in the `port` cell (which is `1fr` in a `48px 1fr 1fr` grid on a 1080p screen = ~516px) is enough for a two-row split.
   - Recommendation: Use two-row split. At 516px: Row A = ~240px (enough for charts), Row B = ~276px (40px trade bar + 28px table header + ~208px scrollable rows). This works. On smaller screens, positions table scrolls. The planner should include both options in the plan and let the executor decide at implementation time.

2. **PortfolioProvider placement in component tree**
   - What we know: Must be inside PriceProvider (needs SSE prices). WatchlistProvider is already inside PriceProvider in layout.tsx.
   - Recommendation: Add PortfolioProvider inside WatchlistProvider (or as a sibling) in layout.tsx: `<PriceProvider><WatchlistProvider><PortfolioProvider>{children}</PortfolioProvider></WatchlistProvider></PriceProvider>`

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- this is a frontend-only code phase using npm packages).

## Sources

### Primary (HIGH confidence)
- `backend/app/api/portfolio.py` -- exact API response shapes for GET /api/portfolio, POST /api/portfolio/trade
- `backend/app/api/trades.py` + `backend/app/db/queries.py` -- GET /api/trades response shape and GET /api/portfolio/history
- `frontend/app/providers/PriceContext.tsx` -- SSE connection status values and price update shape
- `frontend/app/providers/WatchlistContext.tsx` -- Context provider pattern to follow
- `frontend/app/components/watchlist/WatchlistPanel.tsx` -- Error handling, input/button style patterns
- `frontend/app/layout.tsx` -- Grid layout with named areas, provider nesting
- `frontend/app/page.tsx` -- Header structure, port placeholder to replace
- [recharts Treemap TypeScript definitions](https://cdn.jsdelivr.net/npm/recharts@3.8.1/types/chart/Treemap.d.ts) -- TreemapDataType, TreemapNode, TreemapContentType

### Secondary (MEDIUM confidence)
- [recharts API docs - Treemap](https://recharts.github.io/en-US/api/Treemap/) -- props, content, data format
- [recharts API docs - ResponsiveContainer](https://recharts.github.io/en-US/api/ResponsiveContainer/) -- responsive chart wrapper
- npm registry -- recharts 3.9.0 version and peer dependencies verified

### Tertiary (LOW confidence)
- [Custom Content Treemap example](https://recharts.github.io/en-US/examples/CustomContentTreemap/) -- referenced but page content was not fully extractable

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- recharts is specified in PLAN.md, version verified on npm, peer deps compatible
- Architecture: HIGH -- patterns derived directly from existing codebase (WatchlistContext, WatchlistPanel) and verified backend API code
- Pitfalls: HIGH -- based on TypeScript type analysis and established React patterns

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable -- recharts 3.x is mature, backend APIs are frozen)
