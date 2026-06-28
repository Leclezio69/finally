---
phase: 04-ai-chat-panel
plan: 02
subsystem: ui
tags: [react, typescript, chat, llm, playwright, e2e, next.js]

# Dependency graph
requires:
  - phase: 04-ai-chat-panel
    plan: 01
    provides: refetchPortfolio, refetchWatchlist from contexts; @keyframes spin in globals.css; LLM mock with AAPL buy + COIN add
provides:
  - ChatPanel component with messages list, spinner, trade chips, watchlist chips, collapse support
  - page.tsx collapse toggle (chatOpen state, width 320px/40px CSS transition)
  - 6 Playwright E2E tests covering CHAT-01 through CHAT-06
affects:
  - 05-docker-e2e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useCallback for handleSubmit with input/isLoading/refetch deps — avoids stale closure on submit"
    - "CSS width transition on aside for collapse (not grid changes) — ChatPanel stays mounted, history persists"
    - "crypto.randomUUID() for message IDs — no library dependency"
    - "data-role attribute on message divs for Playwright targeting"

key-files:
  created:
    - frontend/app/components/chat/ChatPanel.tsx
    - test/specs/chat.spec.ts
  modified:
    - frontend/app/page.tsx

key-decisions:
  - "Chips built from data.executed_trades (not data.trades) — executed_trades reflects what actually ran; trades is LLM intent only"
  - "refetchWatchlist() called after chat response instead of addTicker() — avoids double-POST 409 errors"
  - "ChatPanel stays mounted on collapse (width shrinks, overflow hidden) — message history persists per CHAT-06"
  - "Collapse toggle placed before SSE dot in header marginLeft:auto div — natural layout order"
  - "Unicode minus sign (U+2212) used in watchlist chip for removed action — distinct from hyphen"

requirements-completed:
  - CHAT-01
  - CHAT-02
  - CHAT-03
  - CHAT-04
  - CHAT-05
  - CHAT-06

# Metrics
duration: 3min
completed: 2026-06-28
---

# Phase 4 Plan 02: ChatPanel Component + Collapse Toggle + E2E Chat Tests Summary

**ChatPanel.tsx built as a self-contained 'use client' component with message history, spinner, trade/watchlist action chips, and Enter-key submit — wired into page.tsx with a collapse toggle and 6 Playwright E2E tests covering all CHAT requirements**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-28T14:58:00Z
- **Completed:** 2026-06-28T15:01:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `ChatPanel.tsx` created with full chat UX: scrollable messages list, empty-state prompt, user/assistant bubbles, trade chips (BUY/SELL with green/red colors from `executed_trades`), watchlist chips (from `watchlist_results`), error chips, loading spinner (`FinAlly is thinking...` with CSS animation), `<input type="text">` with Enter-key submit and Send button
- `page.tsx` updated: imports `useState` and `ChatPanel`, adds `chatOpen` state, adds collapse toggle button in header (› / ‹ chevrons), replaces `PlaceholderPanel` aside with `ChatPanel` in aside with `width: chatOpen ? '320px' : '40px'` CSS transition, removes unused `PlaceholderPanel` function
- `chat.spec.ts` created with 6 tests (CHAT-01 through CHAT-06): input render, loading indicator, assistant message, BUY chip, watchlist chip, collapse/expand toggle
- `npm run build` produces `frontend/out/index.html` with zero errors
- TypeScript (`npx tsc --noEmit`) compiles clean in frontend

## Task Commits

All three tasks committed atomically:

1. **Tasks 1-3: ChatPanel, page.tsx wiring, E2E chat tests** — `e7bc0c2` (feat)

## Files Created/Modified

- `frontend/app/components/chat/ChatPanel.tsx` — New: self-contained chat UI component with all CHAT-01–06 behaviors
- `frontend/app/page.tsx` — Modified: added `useState`, `ChatPanel` import, `chatOpen` state, collapse toggle button, replaced PlaceholderPanel aside
- `test/specs/chat.spec.ts` — New: 6 Playwright E2E tests for CHAT-01 through CHAT-06

## Decisions Made

- Chips sourced from `data.executed_trades` (not `data.trades`) — `executed_trades` reflects actual backend execution; `trades` is raw LLM intent that may include failed attempts
- `refetchWatchlist()` called post-response rather than `addTicker()` — calling addTicker would double-POST and get a 409 conflict since backend already added it
- Collapse implemented via CSS `width` transition on the `<aside>` with `overflow: hidden` — ChatPanel component never unmounts, so message history persists across collapse/expand (CHAT-06 requirement)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — ChatPanel fully wires to `/api/chat`, `refetchPortfolio`, and `refetchWatchlist`. All chip data flows from live API response fields.

## Threat Flags

No new threat surface introduced. XSS mitigation T-04-03 applied: message text rendered via `{msg.text}` JSX (React HTML escaping), never via `dangerouslySetInnerHTML`. DoS mitigation T-04-06 applied: `isLoading` guard at top of `handleSubmit` prevents concurrent submissions; input and Send button disabled during loading.

## Self-Check: PASSED

- FOUND: frontend/app/components/chat/ChatPanel.tsx
- FOUND: test/specs/chat.spec.ts
- FOUND: commit e7bc0c2
- No accidental deletions
- npm run build exits 0, frontend/out/index.html exists
