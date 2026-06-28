---
phase: 04-ai-chat-panel
plan: 01
subsystem: ui
tags: [react, context, typescript, next.js, animation, llm-mock]

# Dependency graph
requires:
  - phase: 03-portfolio-trading
    provides: PortfolioContext with refetchAll callback, WatchlistContext with tickers state
provides:
  - refetchPortfolio exported from PortfolioContextValue (mapped to refetchAll)
  - refetchWatchlist exported from WatchlistContextValue (useCallback wrapping GET /api/watchlist)
  - "@keyframes spin in globals.css for ChatPanel spinner"
  - LLM MOCK_RESPONSE with deterministic trade and watchlist_change for E2E tests
affects:
  - 04-02-chat-panel
  - 05-docker-e2e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useCallback wrapping fetch logic extracted from useEffect for reuse across components
    - Context value objects expose named refetch callbacks so consumers can trigger data refresh without page reload

key-files:
  created: []
  modified:
    - frontend/app/providers/PortfolioContext.tsx
    - frontend/app/providers/WatchlistContext.tsx
    - frontend/app/globals.css
    - backend/app/llm/chat.py

key-decisions:
  - "refetchPortfolio mapped to existing refetchAll rather than duplicating fetch logic"
  - "refetchWatchlist checks !selectedTicker before auto-selecting first ticker to avoid clobbering user selection on refetch"
  - "MOCK_RESPONSE uses AAPL buy (quantity 1) and COIN add — both safe within $10k starting balance and graceful if COIN already watched"

patterns-established:
  - "Refetch pattern: expose named refetch callback from context value so child components can pull fresh data after AI actions without POSTing"

requirements-completed:
  - CHAT-01
  - CHAT-02

# Metrics
duration: 8min
completed: 2026-06-28
---

# Phase 4 Plan 01: Context Refetch Callbacks + Spin Keyframe + LLM Mock Update Summary

**Exposed refetchPortfolio and refetchWatchlist from React contexts and added @keyframes spin to globals.css — three prerequisites for ChatPanel (Plan 02) to refresh state after AI trade execution without page reload**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-28T00:00:00Z
- **Completed:** 2026-06-28T00:08:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `usePortfolio()` now returns `refetchPortfolio: () => Promise<void>` mapped to the existing `refetchAll` callback
- `useWatchlist()` now returns `refetchWatchlist: () => Promise<void>` — fetch logic extracted from mount useEffect into a `useCallback` so ChatPanel can call it after AI watchlist changes without double-POSTing
- `globals.css` has `@keyframes spin { to { transform: rotate(360deg); } }` for ChatPanel's inline spinner style
- `MOCK_RESPONSE` in `backend/app/llm/chat.py` now returns deterministic `trades: [{AAPL, buy, 1}]` and `watchlist_changes: [{COIN, add}]` so E2E chip assertions are unconditional
- TypeScript check (`npx tsc --noEmit`) passes clean; `npm run build` produces `frontend/out/index.html`

## Task Commits

Each task was committed atomically:

1. **Tasks 1-3: expose refetchPortfolio/refetchWatchlist, add spin keyframe, update LLM mock** - `4ab6d24` (feat)

## Files Created/Modified
- `frontend/app/providers/PortfolioContext.tsx` - Added `refetchPortfolio: () => Promise<void>` to type, default context, and provider value
- `frontend/app/providers/WatchlistContext.tsx` - Added `useCallback` import; added `refetchWatchlist` to type, default context, and provider value; extracted mount fetch into `useCallback`
- `frontend/app/globals.css` - Appended `@keyframes spin` after existing flash keyframes
- `backend/app/llm/chat.py` - Updated `MOCK_RESPONSE.trades` and `MOCK_RESPONSE.watchlist_changes` from empty arrays to deterministic test values

## Decisions Made
- `refetchPortfolio` references the existing `refetchAll` useCallback directly in the provider value — no duplication of fetch logic
- `refetchWatchlist` guards auto-selection of first ticker with `!selectedTicker` to preserve any ticker the user has already selected when refetch is called post-AI-action
- MOCK trade uses `quantity: 1` (well within $10k starting balance); MOCK watchlist uses `COIN` add (backend gracefully handles already-in-watchlist case)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (ChatPanel component) can now import `usePortfolio().refetchPortfolio` and `useWatchlist().refetchWatchlist` directly
- Spinner inline style `animation: 'spin 0.8s linear infinite'` will resolve against the new `@keyframes spin`
- E2E tests can assert BUY chip (AAPL) and watchlist chip (COIN) presence unconditionally when `LLM_MOCK=true`

---
*Phase: 04-ai-chat-panel*
*Completed: 2026-06-28*
