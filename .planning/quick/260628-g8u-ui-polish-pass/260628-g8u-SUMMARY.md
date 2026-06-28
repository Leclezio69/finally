---
phase: quick
plan: 260628-g8u
subsystem: frontend/layout
tags: [ui, layout, polish, css-grid]
dependency_graph:
  requires: []
  provides: [wide-portfolio-layout, chart-polish, watchlist-row-polish]
  affects: [frontend/app/layout.tsx, frontend/app/page.tsx, frontend/app/components/chart/MainChart.tsx, frontend/app/components/watchlist/WatchlistRow.tsx, frontend/app/globals.css]
tech_stack:
  added: []
  patterns: [css-grid named areas, inline-style-only, no new npm packages]
key_files:
  created: []
  modified:
    - frontend/app/layout.tsx
    - frontend/app/page.tsx
    - frontend/app/components/chart/MainChart.tsx
    - frontend/app/components/watchlist/WatchlistRow.tsx
    - frontend/app/globals.css
decisions:
  - "Portfolio bottom row set to 40vh so heatmap and P&L chart have sufficient space to render meaningfully"
  - "4-column grid (220px | 1fr | 1fr | 320px) chosen over 3-column to give chart 2 flex columns while keeping watchlist narrower"
  - "Pill badges applied unconditionally to change% (even null case) for visual consistency"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-28T15:46:30Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase quick Plan 260628-g8u: UI Polish Pass Summary

**One-liner:** 4-column CSS grid giving PortfolioPanel a full-width 40vh bottom row, plus chart/watchlist/scrollbar polish for a Bloomberg-terminal aesthetic.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Restructure CSS Grid — portfolio gets wide bottom row | c249ddc | layout.tsx, page.tsx |
| 2 | Polish main chart and watchlist row visuals | b02ad20 | MainChart.tsx, WatchlistRow.tsx, globals.css |

## What Was Built

### Task 1 — CSS Grid Restructure
- Grid changed from 3-column (`280px 1fr 320px`, 3 rows) to 4-column (`220px 1fr 1fr 320px`, 3 rows)
- `gridTemplateAreas` now puts `port` spanning cols 1–3 in row 3 at `40vh` height
- Chart (`chart`) spans 2 center columns in row 2 — no more single-column chart
- Header row bumped from 48px to 52px for breathing room
- Header portfolio value: 13px/600 → 16px/700
- Header cash balance: 13px → 15px
- Vertical separator `div` (1px solid #30363d, height 28px) added between wordmark and stats

### Task 2 — Visual Polish
**MainChart.tsx:**
- `lineWidth`: 2 → 3
- `topColor`: rgba alpha 0.4 → 0.28 (slightly more transparent gradient fill)
- `horzLines.color`: #161b22 → #1a1e24 (slightly more visible grid lines)
- `layout.fontFamily`: added monospace font stack matching body font
- Header height: 32px → 40px
- Header background: #0d1117 → #0f1318 (distinct from canvas)
- Header `boxShadow`: blue glow bottom border (`0 1px 0 #30363d, 0 2px 0 rgba(32,157,215,0.15)`)
- Ticker label: 13px/600 → 15px/700 with `letterSpacing: '0.04em'`
- Live price: 13px → 15px/600 with directional coloring
- Empty state: "Select a ticker to view chart" placeholder at 12px #8b949e (centered)

**WatchlistRow.tsx:**
- Row height: 36 → 38px
- Selected background: `#161b22` → `#1a2030` (subtle blue tint for selected state)
- Hover background: `#161b22` (unchanged) vs. selected `#1a2030`
- Row `transition: 'background-color 120ms ease'` added
- Ticker label: 13px/600 → 12px/700 with `letterSpacing: '0.04em'`
- Price cell: 13px/normal → 12px/600
- Change% span: 11px → 10px with pill background (`rgba(34,197,94,0.12)` or `rgba(239,68,68,0.12)`), `padding: '1px 4px'`, `borderRadius: 2`

**globals.css:**
- Added thin WebKit scrollbar block: 4px width, transparent track, #30363d thumb, #484f58 on hover

## Verification

- `npm run build`: passes clean (TypeScript + static export) — confirmed after each task
- No new npm packages added
- All components retain `'use client'` directive
- All styling uses `style={{}}` inline — no Tailwind classes added

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure layout/style change. No data wiring or stubs introduced.

## Threat Flags

None — pure CSS/layout changes, no new trust surfaces.

## Self-Check: PASSED

- frontend/app/layout.tsx: exists and modified
- frontend/app/page.tsx: exists and modified
- frontend/app/components/chart/MainChart.tsx: exists and modified
- frontend/app/components/watchlist/WatchlistRow.tsx: exists and modified
- frontend/app/globals.css: exists and modified
- Commit c249ddc: confirmed in git log
- Commit b02ad20: confirmed in git log
