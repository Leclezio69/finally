# Phase 1 Context — Frontend Scaffold

**Phase:** 1 — Frontend Scaffold
**Status:** Ready for planning
**Created:** 2026-06-28

## What We're Building

Remove the empty `frontend` file, create a Next.js 15 TypeScript project with Tailwind CSS dark theme, configure static export, and establish a live SSE price hook. By the end of this phase, the app loads at `localhost:3000`, shows a dark-themed page with FinAlly branding, and receives `price_update` events from the backend.

## Requirements in Scope

- SETUP-02: `frontend` empty file removed; replaced with Next.js TypeScript project directory
- SETUP-03: Next.js configured with `output: 'export'`, Tailwind CSS, dark theme base styles
- SETUP-04: `npm run build` produces static export in `frontend/out/`
- VIS-01: Dark theme applied globally (`#0d1117` / `#1a1a2e` backgrounds, muted gray borders)
- VIS-02: Brand colors configured: accent yellow `#ecad0a`, blue `#209dd7`, purple `#753991`

## Decisions

### 1. Router Style: App Router

**Decision:** Use Next.js App Router (`app/` directory), not Pages Router.

**Rationale:**
- Next.js 15 default and recommended approach
- `layout.tsx` is the natural place for the PriceContext provider (wraps all routes)
- `'use client'` directive on components works cleanly with App Router + static export
- No performance reasons to prefer Pages Router for this project

**Constraints:**
- All interactive components need `'use client'` at the top (required for static export)
- `app/layout.tsx` is the root — this is where the CSS Grid shell and PriceContext provider live

### 2. SSE Architecture: Singleton PriceContext in layout.tsx

**Decision:** Single `PriceContext` React Context created once in `app/layout.tsx`, distributing SSE data to all components.

**Architecture:**
```
app/layout.tsx
  └── <PriceProvider>          ← opens one EventSource to /api/stream/prices
        └── {children}
              ├── WatchlistPanel  ← usePrice("AAPL")
              ├── MainChart       ← usePrice(selectedTicker)
              └── Header          ← usePriceStatus()
```

**Context shape:**
```typescript
type PriceUpdate = {
  ticker: string
  price: number
  previous_price: number
  change_percent: number
  direction: 'up' | 'down' | 'flat'
  timestamp: string
}

type PriceContextValue = {
  prices: Record<string, PriceUpdate>   // latest per ticker
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
}
```

**Reconnection:** Native `EventSource` automatic retry — no manual reconnect logic needed. `onopen` → `'connected'`, `onerror` → `'reconnecting'` (browser retries), after N failures → `'disconnected'`.

**Why singleton:** One SSE connection for the whole app. No prop drilling. Components subscribe via `useContext(PriceContext)` or a `usePrice(ticker)` convenience hook.

### 3. Layout Grid: Fixed CSS Grid with Named Areas

**Decision:** Fixed CSS Grid with named template areas in `app/layout.tsx`. Phase 1 renders dark placeholder panels in all unfilled slots.

**Grid structure:**
```
┌──────────────────────────────────────────────┐
│ header      header       header              │
├────────┬───────────────────────┬─────────────┤
│ watch  │ chart                 │ chat        │
│        │                       │             │
├────────┤                       │             │
│ port   │                       │             │
└────────┴───────────────────────┴─────────────┘
```

**CSS:**
```css
grid-template-areas:
  'header header header'
  'watch  chart  chat'
  'port   chart  chat';
grid-template-columns: 280px 1fr 320px;
grid-template-rows: 48px 1fr 1fr;
height: 100vh;
```

**Phase 1 placeholder:** Each named area renders a `<div>` with `bg-[#1a1a2e]` and a centered label (e.g., "WATCHLIST — Phase 2"). The grid structure is established now so Phase 2–4 can drop real components in without touching layout.

### 4. Dev Proxy: next.config.js Rewrites

**Decision:** `next.config.js` rewrites proxy `/api/:path*` → `http://localhost:8000/api/:path*`. This single rule covers both REST and SSE.

**Config:**
```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ]
  },
}
```

**SSE note:** `EventSource` opens to `/api/stream/prices`. The rewrite proxies it to `http://localhost:8000/api/stream/prices` transparently. No special SSE config needed — Next.js dev server passes through the `text/event-stream` response with streaming intact.

**Production:** In Docker, the frontend is a static export served by FastAPI at the same origin — no proxy needed. Rewrites only apply in `next dev`.

## What's NOT Decided Here (Deferred to Later Phases)

- Watchlist component internals (Phase 2)
- Chart library integration details (Phase 2)
- Portfolio / trade UI (Phase 3)
- AI chat panel implementation (Phase 4)
- Docker multi-stage build wiring (Phase 5)

## Key Constraints for Implementer

1. **Delete `frontend` file first** — it's a 0-byte file at the project root, not a directory. `rm frontend` before `npx create-next-app@latest frontend ...`
2. **All components need `'use client'`** — static export requires no server components with interactivity
3. **`output: 'export'` in next.config.js** — required from the start; adding it later breaks things
4. **Tailwind dark theme** — configure `darkMode: 'class'` and add `dark` to `<html>` in layout, OR just use the color values directly (simpler given we always want dark)
5. **No `rewrites()` in static export** — `rewrites()` works in `next dev` only; in `output: 'export'` mode Next.js ignores rewrites. This is fine — dev proxy for development, same-origin in production (Docker).

## Success Criteria (from ROADMAP.md)

1. `rm frontend && npx create-next-app@latest frontend --typescript --tailwind` runs without error; project directory exists
2. `next.config.js` has `output: 'export'`; `npm run build` in `frontend/` exits 0 and `frontend/out/` contains `index.html`
3. App loads at `http://localhost:3000` (dev) and shows a dark-themed page with FinAlly branding
4. SSE hook connects to `/api/stream/prices` (proxied via `next.config.js` rewrites) and receives `price_update` events
5. No TypeScript or build errors

## File Map (what to create)

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout: CSS Grid shell + PriceProvider
│   ├── page.tsx            # Home page (thin shell, delegates to layout grid)
│   ├── globals.css         # Tailwind base + CSS custom properties (colors)
│   └── providers/
│       └── PriceContext.tsx  # EventSource singleton, context, usePrice hook
├── next.config.js          # output: 'export', rewrites proxy
├── tailwind.config.ts      # dark theme colors
├── tsconfig.json           # (generated by create-next-app)
└── package.json            # (generated by create-next-app)
```
