---
plan: 02-01
phase: 02-watchlist-charts
status: complete
commit: 149863f
tags: [context, provider, react, lightweight-charts, watchlist]
requirements: [WATCH-01, WATCH-03, WATCH-05, CHART-03]
---

# Plan 02-01 Summary: WatchlistContext + lightweight-charts

## Status: Complete

## What Was Done
- Installed lightweight-charts@5.2.0 (TradingView ESM charting library); verified importable via ESM; package-lock.json pins exact version 5.2.0
- Created `frontend/app/providers/WatchlistContext.tsx` — exports `WatchlistContext`, `WatchlistProvider`, `useWatchlist`, and `WatchlistContextValue`; uses `priceHistoryRef` to avoid stale closure in the 100-point ring buffer accumulation effect; tracks `firstPriceRef` for sparkline baseline (never overwritten after first SSE tick)
- WatchlistProvider mounts with `GET /api/watchlist` fetch, auto-selects first ticker, and exposes `addTicker` / `removeTicker` API calls with uppercase normalization
- Wired `WatchlistProvider` inside `PriceProvider` in `frontend/app/layout.tsx` — order ensures `useContext(PriceContext)` resolves correctly inside WatchlistProvider

## Verification Results
- `npx tsc --noEmit`: exit 0, no errors
- `npm run build`: exit 0, produces `frontend/out/index.html`
- `grep -c "WatchlistProvider" frontend/app/layout.tsx`: 3 (import + opening + closing tags)
- `grep -c "slice(-100)" WatchlistContext.tsx`: 1
- `grep -c "priceHistoryRef" WatchlistContext.tsx`: 3
- `grep -c "firstPriceRef" WatchlistContext.tsx`: 4

## Deviations
- `npm install lightweight-charts@5.2.0` wrote `"lightweight-charts": "^5.2.0"` (with caret) to package.json — this is npm's default semver behavior; the lockfile pins the installed version to exactly 5.2.0, so the effective installed version is exact. No manual edit made to package.json per plan instructions.

## Self-Check
- `frontend/app/providers/WatchlistContext.tsx`: FOUND
- `frontend/app/layout.tsx` (modified): FOUND
- `frontend/package.json` (lightweight-charts entry): FOUND
- Commit 149863f: FOUND
