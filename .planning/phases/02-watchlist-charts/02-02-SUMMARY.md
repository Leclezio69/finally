---
plan: 02-02
phase: 02-watchlist-charts
status: complete
commit: 6797f3c
tags: [watchlist, sparkline, components, react, sse, flash-animation]
requirements: [WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, VIS-03, VIS-04]

dependency_graph:
  requires: [02-01]
  provides: [WatchlistPanel, WatchlistRow, Sparkline]
  affects: [frontend/app/page.tsx]

tech_stack:
  patterns:
    - useRef for DOM animation control (flash)
    - void el.offsetHeight reflow trick for CSS animation restart
    - SVG polyline with min/max normalization for sparkline

key_files:
  created:
    - frontend/app/components/watchlist/Sparkline.tsx
    - frontend/app/components/watchlist/WatchlistRow.tsx
    - frontend/app/components/watchlist/WatchlistPanel.tsx
  modified:
    - frontend/app/page.tsx

decisions:
  - WatchlistPanel add-ticker error handling checks for "UNIQUE" string in error message (matching backend convention from CLAUDE.md)
  - Error div placed inside the 40px footer row with width:100% to wrap below input+button
  - baselinePrice fallback: firstPrice[ticker] ?? (priceHistory[ticker]?.[0] ?? 0) — matches plan spec exactly
  - package-lock.json committed after npm install in worktree environment

metrics:
  completed: 2026-06-28
  tasks_completed: 3
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 02: WatchlistPanel, WatchlistRow, Sparkline Summary

## Status: Complete

## One-liner
Live watchlist panel with SSE-driven price flash animation, 60x24 SVG sparklines, and add/remove ticker controls mounted in page.tsx.

## What Was Done

- Created `Sparkline.tsx`: 60x24 SVG polyline component. Min/max Y normalization with 2px padding. Color determined by comparing last price to `baselinePrice` prop (session-start baseline from `firstPrice[ticker]` in WatchlistContext, per D-02). Returns empty `<svg>` for fewer than 2 data points to avoid division by zero.

- Created `WatchlistRow.tsx`: Single watchlist row rendering ticker symbol, live price (from `usePrice(ticker)`), change % colored green/red, sparkline, and a hover-revealed remove button. Flash animation uses `priceCellRef` with mandatory `void el.offsetHeight` DOM reflow between class remove and re-add to correctly restart the CSS animation. Selected row gets blue left border (`#209dd7`) and adjusted padding to compensate.

- Created `WatchlistPanel.tsx`: Full panel with 32px WATCHLIST header, flex-1 scrollable ticker list (renders WatchlistRow per ticker, empty state text when none), and 40px add-ticker footer with auto-uppercase input, Add Ticker button (disabled during loading), and error display auto-clearing after 3 seconds. Error distinguishes "Already watching X" (UNIQUE/409) from generic failure.

- Updated `page.tsx`: Added `import WatchlistPanel` and replaced `<PlaceholderPanel label="WATCHLIST" phase="Phase 2" />` with `<WatchlistPanel />`. Aside shell and its inline styles unchanged. page.tsx remains a Server Component (no `'use client'` added).

## Verification Results
- `npx tsc --noEmit`: exit 0, no errors
- `npm run build`: exit 0, static export produced
- `grep -c "polyline" Sparkline.tsx`: 1
- `grep -c "slice(-100)" Sparkline.tsx`: 0 (slicing handled by WatchlistContext)
- `grep -c "void el.offsetHeight" WatchlistRow.tsx`: 1
- `grep -c "flash-up" WatchlistRow.tsx`: 3
- `grep -c "e.stopPropagation" WatchlistRow.tsx`: 1
- `grep -c "WatchlistPanel" page.tsx`: 2 (import + JSX)
- `grep "PlaceholderPanel.*WATCHLIST" page.tsx`: 0 matches

## Commits
- `ad6cf9d` feat(02-02): Sparkline SVG component — 60x24 polyline with green/red baseline coloring
- `95518bc` feat(02-02): WatchlistRow — live price, flash animation, sparkline, hover-remove button
- `6797f3c` feat(02-02): WatchlistPanel component + mount in page.tsx replacing placeholder
- `2f78705` chore(02-02): update package-lock.json after npm install in worktree

## Deviations
None — plan executed exactly as written. All component specs, color values, column widths, and behavior requirements implemented as specified.

## Known Stubs
None — all data is wired to live SSE via WatchlistContext/PriceContext. No hardcoded or placeholder values in rendered output.

## Threat Flags
None — no new network endpoints, auth paths, or schema changes introduced. All user input (ticker symbol) flows through `addTicker()` in WatchlistContext which uppercases and submits to the existing `POST /api/watchlist` endpoint. React escapes all rendered strings by default.

## Self-Check
- frontend/app/components/watchlist/Sparkline.tsx: FOUND
- frontend/app/components/watchlist/WatchlistRow.tsx: FOUND
- frontend/app/components/watchlist/WatchlistPanel.tsx: FOUND
- frontend/app/page.tsx (modified): FOUND
- Commit ad6cf9d: FOUND
- Commit 95518bc: FOUND
- Commit 6797f3c: FOUND

## Self-Check: PASSED
