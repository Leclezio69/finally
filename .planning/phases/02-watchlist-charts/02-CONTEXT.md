# Phase 2: Watchlist & Charts - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a live watchlist panel and main chart area. The watchlist shows all watched tickers with streaming prices, flash animations, sparkline mini-charts, and add/remove controls. Clicking a ticker selects it in the main chart area, which renders a live-updating price chart using price history accumulated from the SSE stream since page load.

</domain>

<decisions>
## Implementation Decisions

### Sparklines
- **D-01:** Render sparklines as **custom SVG polylines** (not recharts, not lightweight-charts). Build an SVG path from the per-ticker price history array. 60px wide, 24px tall, no axes, no labels.
- **D-02:** Sparkline color: **green if current price >= first price received since page load, red if lower**. Color is determined by comparing against the first SSE update for that ticker, not the tick direction.
- **D-03:** Buffer **100 price points per ticker** (ring buffer / `slice(-100)`). ~50 seconds of data at 500ms tick rate. Sufficient to show recent trend without unbounded memory growth.

### Main Chart
- **D-04:** Use **lightweight-charts** (Tradingview) for the main chart area. Canvas-based, designed for financial data, Bloomberg-like aesthetic matching the terminal look. Single instance in the `chart` grid area.
- **D-05:** Price history data source: **SSE buffer accumulated on the frontend**. Same 100-point ring buffer used for sparklines feeds the main chart. No backend history API needed for this phase. Chart fills in progressively as prices arrive.
- **D-06:** Update strategy: **call `series.update({ time, value })` on each new SSE tick**. Do NOT call `setData()` on each tick — `update()` only redraws the changed area.

### Add / Remove Ticker UX
- **D-07:** Add ticker: **always-visible input field + Add button pinned to the bottom of the watchlist panel**, separated from the ticker list by a divider. No click required to reveal it.
- **D-08:** Remove ticker: **hover reveals an × button** on the right side of each watchlist row. Hidden when not hovering to avoid visual noise.

### Selected Ticker State
- **D-09:** Create a **new `WatchlistContext`** (alongside `PriceContext`) that holds: `selectedTicker`, `setSelectedTicker`, `tickers` (watchlist order), `addTicker()`, `removeTicker()`.
- **D-10:** `WatchlistContext` owns all watchlist API calls: fetches `GET /api/watchlist` on mount; `addTicker()` calls `POST /api/watchlist`; `removeTicker()` calls `DELETE /api/watchlist/{ticker}`.
- **D-11:** Auto-select the first ticker from the watchlist on page load (when `WatchlistContext` fetches the initial list). Chart area shows this ticker immediately.
- **D-12:** Clicking a watchlist row calls `setSelectedTicker(ticker)`. The main chart area reads `selectedTicker` via `useWatchlist()`.

### Claude's Discretion
- Watchlist row layout / data density: ticker symbol, current price, change %, sparkline SVG. Claude decides column widths and exact styling.
- Time axis display on the main lightweight-charts chart (wall clock or relative): Claude decides.
- Chart series type: area or line — Claude picks whichever looks better for the terminal aesthetic.
- Crosshair / tooltip behavior on the main chart: Claude decides.
- Input validation feedback for the add-ticker field (invalid ticker, duplicate, API error): Claude decides the error display approach.
- Ticker input auto-uppercase behavior: Claude should auto-uppercase as the user types.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Frontend Code
- `frontend/app/providers/PriceContext.tsx` — SSE singleton with `usePrice(ticker)` and `usePriceStatus()` hooks. New `WatchlistContext` must follow the same provider pattern.
- `frontend/app/layout.tsx` — CSS Grid shell. `watch` (280px left column) and `chart` (1fr center) grid areas are already defined. New components mount into these areas.
- `frontend/app/globals.css` — `.flash-up` and `.flash-down` CSS animation classes are already defined. Watchlist rows must apply these on price change.
- `frontend/app/page.tsx` — Replace the `<PlaceholderPanel>` stubs in the `watch` and `chart` grid areas with real components.

### Backend API
- `backend/app/api/watchlist.py` — `GET /api/watchlist` returns `{tickers: [{ticker, price, ...}]}`. `POST /api/watchlist` body: `{ticker: string}`. `DELETE /api/watchlist/{ticker}`. Prices come from the live price cache.
- `backend/app/api/stream.py` — `GET /api/stream/prices` SSE stream, emits `event: price_update` per-ticker named events. `PriceUpdate` shape: `{ticker, price, previous_price, change, change_percent, direction, timestamp}`.

### Project Spec
- `planning/PLAN.md` §10 — Frontend Design: watchlist panel requirements (WATCH-01–07), main chart requirements (CHART-01–03), visual design requirements (VIS-03–04).
- `planning/PLAN.md` §2 — Visual Design: dark theme colors, flash animation behavior, connection status indicator.

### Charting Library
- `frontend/node_modules/next/dist/docs/` — Next.js version-specific docs (per `frontend/AGENTS.md` — read before writing Next.js code)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `usePrice(ticker: string): PriceUpdate | undefined` — subscribe to latest price for any ticker from PriceContext. Watchlist rows call this per ticker.
- `usePriceStatus()` — returns SSE connection status. Header connection indicator uses this.
- `.flash-up` / `.flash-down` CSS classes in `globals.css` — apply on price change, remove after animation completes (~500ms). Apply to the price cell in watchlist rows.
- CSS Grid areas `watch` and `chart` in `layout.tsx` — components set `style={{ gridArea: 'watch' }}` / `style={{ gridArea: 'chart' }}`.

### Established Patterns
- All interactive components need `'use client'` directive (static export requirement).
- Provider pattern: `PriceContext.tsx` exports `PriceProvider` + `usePrice` + `usePriceStatus`. `WatchlistContext.tsx` should follow the same export shape.
- `PriceProvider` wraps children in `layout.tsx`. `WatchlistProvider` should also be added to `layout.tsx` (wrap alongside or inside `PriceProvider`).
- Flash animation: apply CSS class on price update, use `setTimeout` to remove it after the animation duration.

### Integration Points
- `WatchlistContext` → `GET /api/watchlist` on mount to seed the ticker list and selected ticker
- `WatchlistContext.addTicker()` → `POST /api/watchlist` → update local `tickers` state → market source begins streaming new ticker
- `WatchlistContext.removeTicker()` → `DELETE /api/watchlist/{ticker}` → update local state
- `PriceContext` price history buffer → sparkline SVG data (each watchlist row tracks its own 100-point buffer, or a shared map in context)
- `PriceContext` price history buffer → lightweight-charts `series.update()` calls in the chart component
- `usePrice(selectedTicker)` in chart component → feeds the chart on each new tick

</code_context>

<specifics>
## Specific Ideas

- Sparkline size: 60px wide × 24px tall, no axes, no labels, no borders
- Main chart: single lightweight-charts instance, fills the entire `chart` grid area, canvas not React-rendered
- Watchlist panel layout: `WATCHLIST` header at top, scrollable ticker list in the middle, divider, always-visible add-ticker input at bottom
- Remove × button: visible only on row hover, positioned on the far right of the row
- Terminal aesthetic: monospace font, muted borders, data-dense rows — consistent with the existing `#0d1117` / `#1a1a2e` palette established in Phase 1

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Watchlist & Charts*
*Context gathered: 2026-06-28*
