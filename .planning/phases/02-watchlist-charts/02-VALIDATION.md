---
phase: 2
slug: watchlist-charts
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | TypeScript compiler + Next.js build (no unit test framework — deferred to Phase 5 Playwright) |
| **Config file** | `frontend/tsconfig.json` (TypeScript), `frontend/next.config.ts` (build) |
| **Quick run command** | `cd frontend && npx tsc --noEmit` |
| **Full suite command** | `cd frontend && npm run build` |
| **Estimated runtime** | ~10 seconds (tsc), ~30 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx tsc --noEmit`
- **After every plan wave:** Run `cd frontend && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-T1 | install | 1 | CHART-02 | T-02-SC | N/A | build | `cd frontend && npm install lightweight-charts@5.2.0 && npx tsc --noEmit` | ✅ 02-01 | ⬜ pending |
| 02-01-01 | context | 1 | WATCH-01,WATCH-03 | — | Ticker input auto-uppercased before API call | type | `cd frontend && npx tsc --noEmit` | ✅ 02-01 | ⬜ pending |
| 02-01-02 | context | 1 | WATCH-05,CHART-01 | — | N/A | type | `cd frontend && npx tsc --noEmit` | ✅ 02-01 | ⬜ pending |
| 02-02-01 | watchlist | 2 | WATCH-01,WATCH-02,WATCH-04 | — | No dangerouslySetInnerHTML for ticker values | type | `cd frontend && npx tsc --noEmit` | ✅ 02-02 | ⬜ pending |
| 02-02-02 | watchlist | 2 | WATCH-05 | — | N/A | type | `cd frontend && npx tsc --noEmit` | ✅ 02-02 | ⬜ pending |
| 02-02-03 | watchlist | 2 | WATCH-06,WATCH-07 | — | Input trimmed + uppercased before POST | type | `cd frontend && npx tsc --noEmit` | ✅ 02-02 | ⬜ pending |
| 02-03-01 | chart | 3 | CHART-01,CHART-02,CHART-03 | — | N/A | type+build | `cd frontend && npm run build` | ✅ 02-03 | ⬜ pending |
| 02-04-01 | layout | 4 | VIS-03,VIS-04 | — | N/A | build | `cd frontend && npm run build` | ✅ 02-03 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is satisfied by Task 1 of plan 02-01 (npm install lightweight-charts@5.2.0), which runs in Wave 1 before any MainChart implementation tasks.

- [x] `cd frontend && npm install lightweight-charts@5.2.0` — install charting library (handled in 02-01 Task 1)
- [x] Verify `frontend/package.json` contains `"lightweight-charts": "^5.2.0"` after install
- [x] Verify `npx tsc --noEmit` exits 0 on clean project before starting implementation

*Note: No new test files needed — TypeScript compilation is the automated quality gate for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prices visibly flash green/red within 1s of SSE events | WATCH-04 | CSS animation; no DOM assertion API | Open browser, watch watchlist for 2s; prices should flash on each tick |
| Flash fades within 500ms | WATCH-04 | CSS animation timing | Confirm flash disappears within 500ms; no lingering color |
| Sparklines grow progressively over time | WATCH-05 | Requires live SSE stream | On page load observe sparklines start with 1 point, grow over ~50s |
| Main chart switches on ticker click | CHART-01 | Interactive behavior | Click TSLA row; chart title and data change to TSLA |
| First ticker auto-selected on load | CHART-03 | Initial state; no action trigger | Refresh page; first watchlist ticker shown in chart without clicking |
| Dense layout, no scrolling | VIS-03 | Visual, viewport-dependent | Open on 1280px+ screen; all panels visible without scrolling |
| Terminal aesthetic | VIS-04 | Subjective visual | Confirm no rounded corners, no card shadows, data-dense rows |
| Add ticker → appears and streams | WATCH-06 | Live SSE + API | Type "PYPL", click Add Ticker; row appears, prices stream within 2s |
| Remove ticker → disappears | WATCH-07 | Interactive + API | Hover AAPL row, click ×; row disappears immediately |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-28
