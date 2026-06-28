# Requirements: FinAlly — AI Trading Workstation

**Defined:** 2026-06-28
**Core Value:** A user opens the app and immediately sees live streaming prices, can trade with one click, and can ask the AI to manage their portfolio — all without setup, login, or configuration.

## v1 Requirements

### Setup

- [x] **SETUP-01**: Backend API is fully operational (FastAPI, all routes, SQLite, SSE, LLM) ✓ existing
- [ ] **SETUP-02**: `frontend` empty file is removed and replaced with a Next.js TypeScript project directory
- [ ] **SETUP-03**: Next.js project configured with `output: 'export'` and Tailwind CSS dark theme
- [ ] **SETUP-04**: Frontend builds successfully to `frontend/out/` static export
- [ ] **SETUP-05**: Docker multi-stage build succeeds (Node stage builds frontend, Python stage serves it)
- [ ] **SETUP-06**: `./scripts/start.sh` launches the container and app is accessible at `http://localhost:8000`

### Watchlist

- [ ] **WATCH-01**: User sees a watchlist panel with the 10 default tickers on first load
- [ ] **WATCH-02**: Each ticker row shows: symbol, current price, daily change %, and a sparkline mini-chart
- [ ] **WATCH-03**: Prices update live via SSE (`EventSource` connected to `/api/stream/prices`)
- [ ] **WATCH-04**: Price cells flash green (uptick) or red (downtick) with a CSS transition fading over ~500ms
- [ ] **WATCH-05**: Sparklines accumulate price history from SSE events since page load (grow progressively)
- [ ] **WATCH-06**: User can add a ticker via input field; ticker appears in watchlist and starts streaming
- [ ] **WATCH-07**: User can remove a ticker from the watchlist

### Charts

- [ ] **CHART-01**: Clicking a ticker in the watchlist selects it and displays it in the main chart area
- [ ] **CHART-02**: Main chart shows price over time for the selected ticker (canvas-based, lightweight-charts)
- [ ] **CHART-03**: First ticker is auto-selected on page load

### Portfolio

- [ ] **PORT-01**: Header shows live total portfolio value (updates as prices stream)
- [ ] **PORT-02**: Header shows current cash balance
- [ ] **PORT-03**: Header shows SSE connection status indicator: green dot (connected), yellow (reconnecting), red (disconnected)
- [ ] **PORT-04**: Portfolio heatmap (treemap) shows all positions sized by portfolio weight, colored by P&L
- [ ] **PORT-05**: P&L chart shows total portfolio value over time using data from `GET /api/portfolio/history`
- [ ] **PORT-06**: Positions table shows: ticker, quantity (up to 4dp trimming trailing zeros), avg cost, current price, unrealized P&L, % change

### Trading

- [ ] **TRADE-01**: Trade bar has ticker field, quantity field, Buy button, Sell button
- [ ] **TRADE-02**: Buy executes market order instantly at current price; cash decreases; position appears
- [ ] **TRADE-03**: Sell executes market order instantly; cash increases; position updates or disappears if fully sold
- [ ] **TRADE-04**: Trade history panel shows recent trades (ticker, side, quantity, price, timestamp) from `GET /api/trades`
- [ ] **TRADE-05**: Insufficient funds or shares shows an error message (not a crash)

### AI Chat

- [ ] **CHAT-01**: AI chat panel has a message input and scrolling conversation history
- [ ] **CHAT-02**: User sends a message; loading indicator appears while waiting for LLM response
- [ ] **CHAT-03**: LLM response appears as assistant message; conversational text is shown
- [ ] **CHAT-04**: Trades executed by AI are shown inline in the chat as confirmations
- [ ] **CHAT-05**: Watchlist changes made by AI are shown inline in the chat as confirmations
- [ ] **CHAT-06**: Chat panel is docked/collapsible (sidebar or panel)

### Visual Design

- [ ] **VIS-01**: Dark theme: backgrounds `#0d1117` / `#1a1a2e`, muted gray borders
- [ ] **VIS-02**: Color scheme: accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991` for submit buttons
- [ ] **VIS-03**: Desktop-first dense layout — every panel visible without scrolling on a wide screen
- [ ] **VIS-04**: Professional terminal aesthetic inspired by Bloomberg/trading workstations

### Testing

- [ ] **TEST-01**: All 19 existing Playwright E2E tests pass against the full Docker container

## v2 Requirements

### Enhanced Charts
- **CHART-V2-01**: Candlestick chart mode for selected ticker
- **CHART-V2-02**: Volume bars on main chart

### Notifications
- **NOTIF-01**: In-app alerts for significant price moves (>5%)
- **NOTIF-02**: Trade confirmation toast notifications

### Portfolio Analytics
- **ANA-01**: Sector breakdown of portfolio
- **ANA-02**: Risk metrics (beta, volatility) per position

## Out of Scope

| Feature | Reason |
|---------|--------|
| WebSockets | SSE is sufficient; one-way push only |
| Login / authentication | No-login by design — demo workstation |
| Multi-user support | Single user hardcoded; schema ready for future |
| Limit orders / order book | Market orders only; eliminates partial fill complexity |
| Mobile-first design | Desktop-first; tablet functional |
| Terraform / cloud deployment | Stretch goal; not part of core build |
| Token-by-token chat streaming | Cerebras fast enough for complete responses |
| OAuth / 2FA | No auth layer at all |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-02 | Phase 1 | Pending |
| SETUP-03 | Phase 1 | Pending |
| SETUP-04 | Phase 1 | Pending |
| WATCH-01 | Phase 2 | Pending |
| WATCH-02 | Phase 2 | Pending |
| WATCH-03 | Phase 2 | Pending |
| WATCH-04 | Phase 2 | Pending |
| WATCH-05 | Phase 2 | Pending |
| WATCH-06 | Phase 2 | Pending |
| WATCH-07 | Phase 2 | Pending |
| CHART-01 | Phase 2 | Pending |
| CHART-02 | Phase 2 | Pending |
| CHART-03 | Phase 2 | Pending |
| PORT-01 | Phase 3 | Pending |
| PORT-02 | Phase 3 | Pending |
| PORT-03 | Phase 3 | Pending |
| PORT-04 | Phase 3 | Pending |
| PORT-05 | Phase 3 | Pending |
| PORT-06 | Phase 3 | Pending |
| TRADE-01 | Phase 3 | Pending |
| TRADE-02 | Phase 3 | Pending |
| TRADE-03 | Phase 3 | Pending |
| TRADE-04 | Phase 3 | Pending |
| TRADE-05 | Phase 3 | Pending |
| CHAT-01 | Phase 4 | Pending |
| CHAT-02 | Phase 4 | Pending |
| CHAT-03 | Phase 4 | Pending |
| CHAT-04 | Phase 4 | Pending |
| CHAT-05 | Phase 4 | Pending |
| CHAT-06 | Phase 4 | Pending |
| VIS-01 | Phase 1 | Pending |
| VIS-02 | Phase 1 | Pending |
| VIS-03 | Phase 2 | Pending |
| VIS-04 | Phase 2 | Pending |
| SETUP-05 | Phase 5 | Pending |
| SETUP-06 | Phase 5 | Pending |
| TEST-01 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-28*
*Last updated: 2026-06-28 after initial definition*
