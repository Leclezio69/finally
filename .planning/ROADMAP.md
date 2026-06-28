# FinAlly Roadmap

**Project:** FinAlly — AI Trading Workstation
**Mode:** Vertical MVP — each phase delivers an end-to-end user capability
**Phases:** 5 | **Requirements:** 35 v1 requirements | **Coverage:** 100% ✓

---

## Phase Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|-----------------|
| 1 | Frontend Scaffold | Working Next.js app with SSE connection | SETUP-02, SETUP-03, SETUP-04, VIS-01, VIS-02 | 5 |
| 2 | Watchlist & Charts | 2/3 | In Progress|  |
| 3 | Portfolio & Trading | Heatmap, P&L chart, positions table, trade bar | PORT-01–06, TRADE-01–05 | 5 |
| 4 | AI Chat Panel | 2/2 | Complete   | 2026-06-28 |
| 5 | Docker & E2E | Full container build, all tests passing | SETUP-05, SETUP-06, TEST-01 | 4 |

---

### Phase 1: Frontend Scaffold

**Goal:** Remove the `frontend` empty file, create a Next.js TypeScript project with Tailwind CSS dark theme, configure static export, and establish an SSE price hook that connects to the backend — resulting in a compilable frontend that loads in the browser and receives live price data.
**Mode:** mvp
**UI hint**: yes

**Requirements:**
- SETUP-02: `frontend` empty file removed; replaced with Next.js TypeScript project directory
- SETUP-03: Next.js configured with `output: 'export'`, Tailwind CSS, dark theme base styles
- SETUP-04: `npm run build` produces static export in `frontend/out/`
- VIS-01: Dark theme applied globally (`#0d1117` / `#1a1a2e` backgrounds, muted gray borders)
- VIS-02: Brand colors configured: accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`

**Success Criteria:**
1. `rm frontend && npx create-next-app@latest frontend --typescript --tailwind` runs without error; project directory exists
2. `next.config.js` has `output: 'export'`; `npm run build` in `frontend/` exits 0 and `frontend/out/` contains `index.html`
3. App loads at `http://localhost:3000` (dev) and shows a dark-themed page with FinAlly branding
4. SSE hook connects to `/api/stream/prices` (proxied in dev via `next.config.js` rewrites) and receives `price_update` events
5. No TypeScript or build errors

---

### Phase 2: Watchlist & Charts

**Goal:** Build the live watchlist panel showing 10 default tickers with real-time price updates, green/red flash animations, progressive sparkline mini-charts, add/remove ticker controls, and a main chart area that updates when the user clicks a ticker.
**Mode:** mvp
**UI hint**: yes

**Requirements:**
- WATCH-01: Watchlist panel shows 10 default tickers on first load
- WATCH-02: Each row: symbol, current price, daily change %, sparkline
- WATCH-03: Prices update live via SSE
- WATCH-04: Price flash animation (green up, red down, fading ~500ms CSS transition)
- WATCH-05: Sparklines accumulate SSE price history since page load
- WATCH-06: User can add a ticker via input; it appears and starts streaming
- WATCH-07: User can remove a ticker from the watchlist
- CHART-01: Clicking a ticker selects it and updates the main chart
- CHART-02: Main chart shows price over time (lightweight-charts, canvas-based)
- CHART-03: First ticker auto-selected on load
- VIS-03: Dense desktop-first layout — watchlist and chart visible without scrolling
- VIS-04: Terminal aesthetic — no rounded cards, minimal padding, data-dense

**Plans:** 2/3 plans executed

**Wave 1**
- [x] 02-01-PLAN.md — Install lightweight-charts + create WatchlistContext (provider, hooks, price history ring buffer)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 02-02-PLAN.md — WatchlistPanel + WatchlistRow + Sparkline + mount in page.tsx (live watchlist visible)
- [x] 02-03-PLAN.md — MainChart component + mount in page.tsx (ticker selection and live chart) *(parallel with 02-02)*

**Cross-cutting constraints:**
- All new components require `'use client'` directive (static export)
- `WatchlistProvider` must be nested inside `<PriceProvider>` in `layout.tsx`
- `firstPrice` per ticker (session baseline) tracks the first SSE update for correct sparkline color

**Success Criteria:**
1. Page loads showing all 10 default tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX) with prices
2. Prices visibly update and cells flash green/red within 1s of SSE events; flash fades within 500ms
3. Sparklines grow progressively as prices arrive — first 1 point on load, grows over time
4. Adding "PYPL" via the ticker input: `POST /api/watchlist` succeeds, ticker row appears, prices stream
5. Main chart updates to show TSLA price history when user clicks TSLA row

---

### Phase 3: Portfolio & Trading

**Goal:** Build the complete portfolio section — header with live total value and cash, portfolio heatmap (treemap), P&L chart, positions table with precise formatting, trade history list, and a functional trade bar that executes market orders and immediately reflects in the portfolio view.
**Mode:** mvp
**UI hint**: yes

**Requirements:**
- PORT-01: Header shows live total portfolio value (recalculates as prices stream)
- PORT-02: Header shows current cash balance
- PORT-03: Header shows SSE connection status dot (green/yellow/red)
- PORT-04: Portfolio heatmap (treemap): positions sized by weight, green = profit, red = loss
- PORT-05: P&L chart (line): total portfolio value over time from `GET /api/portfolio/history`
- PORT-06: Positions table: ticker, quantity (4dp trim), avg cost, current price, unrealized P&L, % change
- TRADE-01: Trade bar has ticker, quantity, Buy, Sell
- TRADE-02: Buy executes instantly; cash decreases; position appears in table and heatmap
- TRADE-03: Sell executes; position updates or disappears when fully sold
- TRADE-04: Trade history shows recent trades (ticker, side, qty, price, time)
- TRADE-05: Error shown on insufficient funds or shares (not a crash)

**Plans:** 3/3 plans executed

**Wave 1**
- [x] 03-01-PLAN.md — Install recharts + PortfolioContext + Header live values + SSE status dot + PortfolioPanel shell
**Wave 2**
- [x] 03-02-PLAN.md — Trade bar + Positions table (full trade execution vertical slice)
- [x] 03-03-PLAN.md — Heatmap (Treemap) + P&L chart (LineChart) + Trade history

**Cross-cutting constraints:**
- All new components require `'use client'` directive (static export)
- PortfolioProvider must be nested inside WatchlistProvider in layout.tsx
- Live totalValue recalculated client-side from SSE prices (NOT polling GET /api/portfolio)
- recharts required for Treemap and LineChart (installed in Plan 01)

**Success Criteria:**
1. Header shows total value and cash; values update within 1s as prices stream without page interaction
2. After buying 5 shares of AAPL: position appears in table with correct quantity, avg cost, and P&L; heatmap shows AAPL rectangle
3. After selling all AAPL shares: position row disappears from table; heatmap rectangle gone
4. P&L chart shows at least one data point and updates after a trade
5. Attempting to buy 1,000,000 shares shows an error message within the UI (no crash, no blank screen)

---

### Phase 4: AI Chat Panel

**Goal:** Build the docked AI chat sidebar where users can converse with FinAlly, see their portfolio context used in responses, and have trades or watchlist changes executed automatically with inline confirmations shown in the chat history.
**Mode:** mvp
**UI hint**: yes

**Requirements:**
- CHAT-01: Chat panel with message input and scrolling conversation history
- CHAT-02: Loading indicator shown while awaiting LLM response
- CHAT-03: Assistant message appears with conversational text
- CHAT-04: Trades executed by AI shown inline as trade confirmation chips
- CHAT-05: Watchlist changes shown inline as confirmation chips
- CHAT-06: Chat panel is collapsible/toggleable to reclaim screen space

**Plans:** 2/2 plans complete

**Wave 1**
- [x] 04-01-PLAN.md — Expose refetchPortfolio + refetchWatchlist from contexts; update LLM mock response for E2E determinism; add @keyframes spin

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — ChatPanel component + page.tsx wiring + collapse toggle + E2E tests

**Cross-cutting constraints:**
- All new components require `'use client'` directive (static export)
- No new npm packages — React 19 built-ins only
- Chips sourced from executed_trades (not trades) to show actual results, not LLM intent
- ChatPanel stays mounted on collapse (never unmounts) — message history persists

**Success Criteria:**
1. Sending "What's my portfolio worth?" returns a response mentioning the dollar value within 10s
2. Loading indicator (spinner or skeleton) is visible between message submission and response arrival
3. Asking "Buy 2 shares of GOOGL" → AI responds, trade executes, positions table updates, trade appears as confirmation chip in chat
4. Chat panel can be collapsed and re-expanded; conversation history persists during toggle

---

### Phase 5: Docker & E2E

**Goal:** Ensure the multi-stage Docker build succeeds with the new frontend, the container launches cleanly via `start.sh`, and all 19 existing Playwright E2E tests pass against the live container — delivering a fully shippable, self-contained trading workstation.
**Mode:** mvp

**Requirements:**
- SETUP-05: Docker multi-stage build succeeds (Node stage produces `frontend/out/`, Python stage copies it to `/app/static/`)
- SETUP-06: `./scripts/start.sh` builds (or reuses) the image, starts the container, container passes health check at `http://localhost:8000/api/health`
- TEST-01: All 19 Playwright E2E tests pass (`cd test && npx playwright test`) against container at `http://localhost:8001`

**Success Criteria:**
1. `docker build -t finally .` exits 0 with no errors from either build stage
2. `./scripts/start.sh` completes and opens browser to `http://localhost:8000`; `GET /api/health` returns `{"status": "ok"}`
3. `cd test && npx playwright test` reports **19 passed, 0 failed**
4. Container restarts cleanly (`./scripts/stop.sh && ./scripts/start.sh`) without data loss (SQLite volume persists positions)

---

## Requirement Coverage Verification

| Phase | Requirements | Count |
|-------|-------------|-------|
| Phase 1 | SETUP-02, SETUP-03, SETUP-04, VIS-01, VIS-02 | 5 |
| Phase 2 | WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, CHART-01, CHART-02, CHART-03, VIS-03, VIS-04 | 12 |
| Phase 3 | PORT-01, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, TRADE-01, TRADE-02, TRADE-03, TRADE-04, TRADE-05 | 11 |
| Phase 4 | CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06 | 6 |
| Phase 5 | SETUP-05, SETUP-06, TEST-01 | 3 |
| **Total** | | **37** |

> Note: SETUP-01 (backend complete) is already Validated — not in active phases. 35 active requirements + 1 validated = 36 tracked; 37 phase-mapped entries include VIS-03 and VIS-04 which appear in Phase 2.

All v1 requirements mapped ✓
