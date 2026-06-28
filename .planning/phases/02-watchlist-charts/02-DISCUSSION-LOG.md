# Phase 2: Watchlist & Charts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-28
**Phase:** 2-Watchlist & Charts
**Areas discussed:** Sparklines, Chart library, Add/remove ticker UX, Selected ticker state

---

## Sparklines

### Q1: How should sparklines be rendered in each watchlist row?

| Option | Description | Selected |
|--------|-------------|----------|
| Custom SVG path | Build tiny SVG polyline from price history array. No extra library, ultra-lightweight, easy to color. | ✓ |
| recharts mini chart | Small LineChart per row. Already in stack but mounts full component per row (10+ instances). | |
| lightweight-charts sparkline | Canvas per row — overkill for sparklines, save lwc for main chart. | |

**User's choice:** Custom SVG path
**Notes:** Recommended option — fits inline in a table row, zero library overhead.

---

### Q2: How should the sparkline color work?

| Option | Description | Selected |
|--------|-------------|----------|
| Price vs page-load baseline | Green if current price >= first SSE price for that ticker, red if lower. | ✓ |
| Last segment direction | Color matches the most recent tick direction from PriceUpdate.direction. | |
| Neutral color | Always render in muted blue — color meaning lives in price/change columns. | |

**User's choice:** Price vs page-load baseline
**Notes:** Simple and consistent with watchlist row coloring.

---

### Q3: How many price points should the sparkline buffer per ticker?

| Option | Description | Selected |
|--------|-------------|----------|
| 100 points | ~50 seconds at 500ms. Ring buffer / slice(-100). | ✓ |
| 50 points | ~25 seconds. May feel choppy on slow-moving tickers. | |
| 200 points | ~100 seconds. Minimal memory impact, visually similar to 100. | |

**User's choice:** 100 points
**Notes:** Recommended option.

---

## Chart Library

### Q1: Which library should render the main chart area?

| Option | Description | Selected |
|--------|-------------|----------|
| lightweight-charts | Canvas-based, designed for financial data, Bloomberg-like aesthetic. Single instance in the chart area. | ✓ |
| recharts LineChart | React-native SVG. Simpler state integration but re-renders on every price update. Less financial aesthetic. | |

**User's choice:** lightweight-charts
**Notes:** Matches the terminal aesthetic goal; `update()` API avoids full re-renders.

---

### Q2: Where does the main chart get its price history data?

| Option | Description | Selected |
|--------|-------------|----------|
| SSE buffer accumulated in frontend | Same 100-point ring buffer as sparklines. No API call needed. Fills in progressively. | ✓ |
| Dedicated history endpoint | Backend GET /api/chart-history/{ticker}. Would require backend changes — out of scope. | |
| SSE + fallback to portfolio snapshots | Portfolio snapshots are total portfolio value, not per-ticker. Effectively same as option 1. | |

**User's choice:** SSE buffer accumulated in frontend
**Notes:** Keeps Phase 2 entirely frontend — no backend changes needed.

---

### Q3: How should lightweight-charts update as new SSE prices arrive?

| Option | Description | Selected |
|--------|-------------|----------|
| update() on each tick | Only redraws the changed area. Designed for this use case. | ✓ |
| setData() on each tick | Full series redraw on each tick — unnecessary overhead. | |

**User's choice:** update() on each tick
**Notes:** Recommended lightweight-charts pattern for streaming data.

---

## Add/Remove Ticker UX

### Q1: How should the user add a new ticker to the watchlist?

| Option | Description | Selected |
|--------|-------------|----------|
| Always-visible input at bottom | Text field + Add button pinned below a divider at the bottom of the panel. No click to reveal. | ✓ |
| + button reveals input | [+] in the header reveals an input row. More compact when not adding. | |

**User's choice:** Always-visible input at bottom
**Notes:** Matches terminal aesthetic — always ready to type.

---

### Q2: How should the user remove a ticker from the watchlist?

| Option | Description | Selected |
|--------|-------------|----------|
| Hover reveals × button | × appears on row hover on the far right. Clean when browsing. | ✓ |
| Right-click context menu | Less obvious without a visual cue. | |
| Always-visible × on each row | Simple but adds visual noise to every row. | |

**User's choice:** Hover reveals × button
**Notes:** Recommended option — minimal noise.

---

## Selected Ticker State

### Q1: How should the app track which ticker's chart is shown?

| Option | Description | Selected |
|--------|-------------|----------|
| React context — new WatchlistContext | Holds selectedTicker, setSelectedTicker, tickers, addTicker, removeTicker. Both panels subscribe. | ✓ |
| Local state in page.tsx | Hoist useState to page.tsx, pass as props. Leads to prop-drilling as Phase 3 needs selected ticker too. | |
| URL query param | Shareable links but adds router dependency. SSE history lost on page refresh anyway. | |

**User's choice:** React context — new WatchlistContext
**Notes:** Selected ticker will be needed by Phase 3 (trade bar) — context avoids future prop-drilling.

---

### Q2: Should WatchlistContext also own the API calls for add/remove ticker?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — consolidate in WatchlistContext | Fetches GET /api/watchlist on mount; exposes addTicker() / removeTicker() for API calls. | ✓ |
| No — watchlist panel manages its own API calls | Panel handles fetch directly, context is just selectedTicker. | |

**User's choice:** Yes — consolidate in WatchlistContext
**Notes:** Keeps API logic centralized; panel components call context methods without knowing about fetch.

---

## Claude's Discretion

- Watchlist row layout and column widths (ticker, price, change %, sparkline)
- Chart series type: area or line (whichever suits the terminal aesthetic)
- Time axis format on the main chart (wall clock vs relative)
- Crosshair / tooltip behavior on the main chart
- Error display for add-ticker validation (invalid ticker, duplicate, API error)
- Ticker input auto-uppercase behavior (should auto-uppercase as user types)

## Deferred Ideas

None — discussion stayed within phase scope.
