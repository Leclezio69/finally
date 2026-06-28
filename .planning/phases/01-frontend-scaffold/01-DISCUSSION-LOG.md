# Phase 1 Discussion Log — Frontend Scaffold

**Date:** 2026-06-28
**Phase:** 1 — Frontend Scaffold
**Format:** Decisions discussed before planning

---

## Gray Areas Identified

4 gray areas presented for discussion. User selected all 4.

---

## Area 1: Router Style

**Question:** App Router (app/) or Pages Router (pages/)?

**Discussion:** Next.js 15 defaults to App Router. layout.tsx is the natural home for the PriceContext provider. Static export works with both but App Router is forward-looking. No reason to use Pages Router on a greenfield project.

**Decision:** App Router. Root `app/layout.tsx` holds the CSS Grid shell and PriceContext provider. All interactive components use `'use client'`.

---

## Area 2: SSE Architecture

**Questions covered:**
- Where does the EventSource live? (component, custom hook, or context provider?)
- What does the context store? (latest price only, or full PriceUpdate object?)
- Manual reconnect logic or native EventSource retry?

**Discussion:**
- Singleton context in layout.tsx ensures one SSE connection for the whole app — no duplication, no prop drilling
- Full PriceUpdate object (price, previous_price, change_percent, direction, timestamp) needed for price flash animations (need direction) and sparklines (need history assembly)
- Native EventSource retry is automatic and battle-tested — browser handles exponential backoff. No manual reconnect logic needed.
- Connection status: `onopen` → connected, `onerror` → reconnecting (browser retrying), prolonged error → disconnected

**Decision:** `PriceContext` singleton in `app/layout.tsx`. Stores `Record<string, PriceUpdate>` (latest per ticker). `usePrice(ticker)` convenience hook. Native EventSource retry. Status tracked via onopen/onerror.

---

## Area 3: Layout Grid

**Questions covered:**
- Fixed CSS Grid with named areas, or flexible component positioning?
- What renders in Phase 1's unfilled slots?

**Discussion:**
- Fixed grid established in Phase 1 means Phase 2–4 just drop components into named slots — no layout rework
- Named areas (header, watch, chart, chat, port) make intent clear in CSS
- Placeholder panels with dark `#1a1a2e` background and label text make the layout visible and debuggable in Phase 1

**Decision:** Fixed `grid-template-areas` in layout.tsx. Three columns (280px / 1fr / 320px), three rows (48px header + 1fr + 1fr). Phase 1 renders dark placeholder divs in unfilled areas.

---

## Area 4: Dev Proxy

**Questions covered:**
- How does the frontend reach `/api/*` in dev? (next.config.js rewrites, CORS headers, or run both on same port?)
- Does SSE need special handling through the proxy?

**Discussion:**
- `next.config.js` rewrites are the cleanest solution — no CORS config, no separate ports, matches production mental model (same-origin)
- Single rule `/api/:path*` → `http://localhost:8000/api/:path*` covers all REST endpoints AND SSE
- SSE works through Next.js dev server rewrites — the proxy passes through `text/event-stream` with streaming intact
- In production (Docker), frontend is served by FastAPI at the same origin — no proxy, no rewrites needed

**Decision:** `next.config.js` rewrites with one rule. No CORS. No special SSE config. Dev only.

---

## Outcome

All 4 gray areas resolved. CONTEXT.md written. Ready for `/gsd:plan-phase 1`.
