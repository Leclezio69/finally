# FinAlly — AI Trading Workstation

## What This Is

FinAlly is a visually stunning AI-powered trading workstation that streams live market data, lets users trade a simulated portfolio, and integrates an LLM chat assistant that can analyze positions and execute trades on the user's behalf. It looks and feels like a modern Bloomberg terminal with an AI copilot. Launched via a single Docker command, it runs entirely in a single container on port 8000 with no login required.

## Core Value

A user opens the app and immediately sees live streaming prices, can trade with one click, and can ask the AI to manage their portfolio — all without setup, login, or configuration.

## Requirements

### Validated

- ✓ FastAPI backend with all API routes (`/api/portfolio`, `/api/watchlist`, `/api/trades`, `/api/chat`, `/api/health`, `/api/stream/prices`) — existing
- ✓ SQLite database with lazy initialization, schema, seed data (10 default tickers, $10k cash) — existing
- ✓ GBM market simulator with correlated moves, seed prices, dynamic ticker support — existing
- ✓ Massive API client (optional real market data, same interface) — existing
- ✓ SSE price streaming endpoint (`price_update` named events, per-ticker, 500ms cadence) — existing
- ✓ LLM integration via LiteLLM → OpenRouter → Cerebras, structured output, auto-execution of trades and watchlist changes — existing
- ✓ Portfolio snapshot background task (every 10s + after each trade) — existing
- ✓ Chat history (last 20 messages) — existing
- ✓ Mock LLM mode (`LLM_MOCK=true`) for testing — existing
- ✓ Multi-stage Dockerfile (Node + Python stages) — existing
- ✓ Start/stop scripts (`scripts/start.sh`, `scripts/stop.sh`, `scripts/start.ps1`) — existing
- ✓ Playwright E2E test suite (19 tests in `test/specs/smoke.spec.ts`) — existing

### Active

- [ ] Next.js TypeScript frontend (static export `output: 'export'`) with Tailwind CSS dark theme
- [ ] Watchlist panel: ticker grid with live prices, price flash animation (green/red on change), daily change %, sparkline mini-charts (accumulated from SSE since page load)
- [ ] Main chart area: larger price-over-time chart for selected ticker (click ticker in watchlist to select)
- [ ] Portfolio heatmap: treemap of positions sized by portfolio weight, colored by P&L (green = profit, red = loss)
- [ ] P&L chart: line chart of total portfolio value over time (from `GET /api/portfolio/history`)
- [ ] Positions table: ticker, quantity, avg cost, current price, unrealized P&L, % change (quantities to 4dp, prices to 2dp)
- [ ] Trade history: recent trades from `GET /api/trades` (ticker, side, quantity, price, timestamp)
- [ ] Trade bar: ticker field, quantity field, buy button, sell button (market orders, instant fill)
- [ ] AI chat panel: message input, scrolling conversation history, loading indicator, inline trade/watchlist confirmations
- [ ] Header: live total portfolio value, cash balance, SSE connection status indicator (green/yellow/red dot)
- [ ] SSE `EventSource` connection with automatic reconnection
- [ ] Price flash CSS animations (brief green/red background highlight fading over ~500ms)
- [ ] Docker build working end-to-end (frontend static export copied into container, served by FastAPI)
- [ ] All 19 E2E Playwright tests passing against the full Docker container

### Out of Scope

- WebSockets — SSE is sufficient for one-way price push
- Login / authentication — no-login by design
- Multi-user support — single user (`user_id="default"`) hardcoded; schema supports future migration
- Limit orders / order book — market orders only eliminates partial fill complexity
- Mobile-first design — desktop-first, functional on tablet
- Terraform / cloud deployment — stretch goal not part of core build
- Real-time chat streaming (token-by-token) — Cerebras inference fast enough for complete responses

## Context

- Backend lives in `backend/` (uv project, Python 3.12, FastAPI)
- Frontend must be built in `frontend/` (currently an empty file — needs to be removed and replaced with a Next.js project directory)
- `frontend` empty file must be deleted and `frontend/` directory created before `npm create next-app`
- Static export goes to `frontend/out/` — Dockerfile copies this to `/app/static/` in the container
- FastAPI serves static files only if `STATIC_DIR` path exists — no CORS needed (same origin)
- All API calls use `/api/*` prefix; SSE at `/api/stream/prices`
- Color scheme: accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991` (submit buttons), dark bg `#0d1117` / `#1a1a2e`
- Charting: lightweight-charts (Canvas-based) for main chart and sparklines; recharts for treemap and P&L
- `.env` at project root holds `OPENROUTER_API_KEY`, `MASSIVE_API_KEY` (optional), `LLM_MOCK`

## Constraints

- **Tech Stack**: Next.js 15 TypeScript + Tailwind CSS + lightweight-charts + recharts (all `'use client'` components required for static export)
- **Output**: `output: 'export'` in `next.config.js` — no server-side rendering, pure static
- **Container**: Single Docker container, port 8000, volume `finally-data:/app/db`
- **No CORS**: Frontend served by same FastAPI origin — all `/api/*` calls are same-origin
- **E2E tests**: Must pass against container at `http://localhost:8001` with `LLM_MOCK=true`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build frontend from scratch | Frontend directory is empty file on this branch; no salvageable code | — Pending |
| Next.js static export | Single-origin serving by FastAPI; no separate Node server needed | — Pending |
| SSE via native EventSource | No library needed; browser-native; automatic reconnect | ✓ Good (backend proven) |
| SQLite over Postgres | No auth = no multi-user = no need for a DB server | ✓ Good (backend proven) |
| LiteLLM → Cerebras | Fast inference, structured output, deterministic mock mode | ✓ Good (backend proven) |
| lightweight-charts for sparklines/charts | Canvas-based performance for real-time price data | — Pending |

---
*Last updated: 2026-06-28 after initialization*

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state
