---
id: 01-PLAN-scaffold
wave: 1
depends_on: []
files_modified:
  - frontend/  # directory (replaces empty file)
  - frontend/next.config.ts
  - frontend/package.json
  - frontend/tsconfig.json
  - frontend/app/globals.css
  - frontend/app/layout.tsx
  - frontend/app/page.tsx
autonomous: true
requirements:
  - SETUP-02
  - SETUP-03
  - SETUP-04
  - VIS-01
  - VIS-02
---

# Plan 01: Next.js Scaffold, Config, Dark Theme & Grid Shell

## Objective

Remove the empty `frontend` file, create a Next.js 15 TypeScript project with Tailwind CSS, configure static export for production and dev proxy for development, apply the dark theme with brand colors, and build a CSS Grid layout shell with placeholder panels.

## must_haves

### truths (verified before starting)
- `frontend` at project root is a 0-byte file: `ls -la frontend` shows `-rw-r--r-- ... 0 ... frontend`
- Backend is running or will be started separately; this plan does not touch `backend/`
- Node.js 20+ is installed: `node --version` shows v20+
- Project root is `/Users/richardleclezio/projects/finally`

### goal (what done looks like)
- `frontend/` is a directory containing a Next.js 15 TypeScript project
- `npm run build` in `frontend/` exits 0 and produces `frontend/out/index.html`
- `npm run dev` starts the dev server on port 3000 without errors
- App loads at `http://localhost:3000` with dark background (`#0d1117`) and "FinAlly" branding text
- Brand colors defined in `globals.css` using Tailwind v4 `@theme` block
- CSS Grid shell renders 5 named areas: header, watch, chart, chat, port — each showing a dark placeholder panel

---

## Tasks

### Task 1: Remove Empty `frontend` File

<task id="T01">
<title>Delete the empty frontend file at project root</title>

<read_first>
- Run: `ls -la /Users/richardleclezio/projects/finally/frontend` — confirm it's a file (not directory)
</read_first>

<action>
Run `rm /Users/richardleclezio/projects/finally/frontend` to delete the 0-byte file.
Verify with `ls -la /Users/richardleclezio/projects/finally/frontend` — should return "No such file or directory".
Do NOT delete anything else at the project root.
</action>

<acceptance_criteria>
- `ls /Users/richardleclezio/projects/finally/frontend` returns "No such file or directory"
- All other project root files (`backend/`, `Dockerfile`, `scripts/`, etc.) are untouched
</acceptance_criteria>
</task>

---

### Task 2: Create Next.js 15 TypeScript Project

<task id="T02">
<title>Run create-next-app to scaffold the frontend directory</title>

<read_first>
- Run: `node --version` — confirm Node 20+
- Run: `ls /Users/richardleclezio/projects/finally/` — confirm `frontend` file is gone (T01 complete)
</read_first>

<action>
From `/Users/richardleclezio/projects/finally/`, run:
```
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*" --yes
```

If prompted interactively despite `--yes`, answer:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- src/ directory: No
- App Router: Yes
- Import alias: @/*

Do NOT run `npm install` separately — create-next-app handles it.
</action>

<acceptance_criteria>
- `ls /Users/richardleclezio/projects/finally/frontend/` shows: `app/`, `node_modules/`, `package.json`, `tsconfig.json`, `next.config.ts`
- `frontend/package.json` contains `"next"` in dependencies
- `frontend/app/layout.tsx` exists
- `frontend/app/page.tsx` exists
</acceptance_criteria>
</task>

---

### Task 3: Configure next.config.ts (Static Export + Dev Proxy)

<task id="T03">
<title>Configure next.config.ts with conditional static export and dev proxy rewrites</title>

<read_first>
- `frontend/next.config.ts` — read the generated default content first
- `.planning/phases/01-frontend-scaffold/01-CONTEXT.md` → "Dev proxy" and "Key Constraints" sections
- `.planning/phases/01-frontend-scaffold/01-RESEARCH.md` → Section 2 (rewrites incompatible with output: 'export') and Section 8 (next.config.ts format)
</read_first>

<action>
Replace the entire content of `frontend/next.config.ts` with:

```typescript
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
  // Static export for production (Docker). Dev runs as normal Next.js server.
  ...(isDev ? {} : { output: 'export' as const }),
  // Required for static export — default image optimizer needs a server
  images: { unoptimized: true },
  // Dev proxy: forward /api/* to FastAPI backend running on port 8000
  // Only applies during `next dev` (rewrites are unsupported in static export)
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:8000/api/:path*',
            },
          ]
        },
      }
    : {}),
}

export default nextConfig
```
</action>

<acceptance_criteria>
- `frontend/next.config.ts` contains `output: 'export'` inside a production-only conditional
- `frontend/next.config.ts` contains `images: { unoptimized: true }`
- `frontend/next.config.ts` contains `rewrites()` returning `[{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]` inside a dev-only conditional
- `cd frontend && npx tsc --noEmit` exits 0 (no TypeScript errors in config)
</acceptance_criteria>
</task>

---

### Task 4: Configure Tailwind v4 Dark Theme and Brand Colors

<task id="T04">
<title>Replace globals.css with Tailwind v4 dark theme and FinAlly brand colors</title>

<read_first>
- `frontend/app/globals.css` — read the generated default content first
- `.planning/phases/01-frontend-scaffold/01-RESEARCH.md` → Section 1 (Tailwind v4 CSS-based config)
- `.planning/phases/01-frontend-scaffold/01-CONTEXT.md` → "Key Constraints" section (brand colors)
- `planning/PLAN.md` → Section "Color Scheme" (`#ecad0a`, `#209dd7`, `#753991`, `#0d1117`, `#1a1a2e`)
</read_first>

<action>
Replace the entire content of `frontend/app/globals.css` with the following (Tailwind v4 syntax):

```css
@import "tailwindcss";

/* Class-based dark mode for Tailwind v4 */
@custom-variant dark (&:where(.dark, .dark *));

/* FinAlly brand theme — accessible via Tailwind classes like bg-bg-base, text-accent-yellow */
@theme {
  /* Backgrounds */
  --color-bg-base: #0d1117;
  --color-bg-panel: #1a1a2e;
  --color-bg-surface: #161b22;

  /* Brand accents */
  --color-accent-yellow: #ecad0a;
  --color-accent-blue: #209dd7;
  --color-accent-purple: #753991;

  /* Text */
  --color-text-primary: #e6edf3;
  --color-text-muted: #8b949e;

  /* Borders */
  --color-border: #30363d;
}

/* Base reset for dark terminal aesthetic */
*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #0d1117;
  color: #e6edf3;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* Price flash animations */
@keyframes flash-up {
  0% { background-color: rgba(34, 197, 94, 0.35); }
  100% { background-color: transparent; }
}

@keyframes flash-down {
  0% { background-color: rgba(239, 68, 68, 0.35); }
  100% { background-color: transparent; }
}

.flash-up {
  animation: flash-up 500ms ease-out forwards;
}

.flash-down {
  animation: flash-down 500ms ease-out forwards;
}
```
</action>

<acceptance_criteria>
- `frontend/app/globals.css` starts with `@import "tailwindcss"`
- File contains `@custom-variant dark (&:where(.dark, .dark *));`
- File contains `@theme {` block with `--color-accent-yellow: #ecad0a`, `--color-accent-blue: #209dd7`, `--color-accent-purple: #753991`
- File contains `--color-bg-base: #0d1117` and `--color-bg-panel: #1a1a2e`
- File contains `.flash-up` and `.flash-down` keyframe animations
- `cd frontend && npm run build` does not fail due to CSS syntax errors
</acceptance_criteria>
</task>

---

### Task 5: Create PriceContext Provider

<task id="T05">
<title>Create app/providers/PriceContext.tsx with singleton EventSource SSE hook</title>

<read_first>
- `.planning/phases/01-frontend-scaffold/01-CONTEXT.md` → "SSE architecture" decision section
- `.planning/phases/01-frontend-scaffold/01-RESEARCH.md` → Section 5 (EventSource SSE pattern)
- `backend/app/api/stream.py` — confirm the SSE event name is `price_update` and the data shape
</read_first>

<action>
Create directory `frontend/app/providers/` and file `frontend/app/providers/PriceContext.tsx` with:

```typescript
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type PriceUpdate = {
  ticker: string
  price: number
  previous_price: number
  change_percent: number
  direction: 'up' | 'down' | 'flat'
  timestamp: string
}

type PriceContextValue = {
  prices: Record<string, PriceUpdate>
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
}

export const PriceContext = createContext<PriceContextValue>({
  prices: {},
  status: 'connecting',
})

export function PriceProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({})
  const [status, setStatus] = useState<PriceContextValue['status']>('connecting')

  useEffect(() => {
    const es = new EventSource('/api/stream/prices')

    es.onopen = () => setStatus('connected')

    es.onerror = () => {
      setStatus('reconnecting')
      // Native EventSource handles reconnection automatically with exponential backoff
    }

    // Named event — backend emits: event: price_update\ndata: {...}
    es.addEventListener('price_update', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as PriceUpdate
        setPrices((prev) => ({ ...prev, [data.ticker]: data }))
      } catch {
        // Malformed SSE data — skip silently
      }
    })

    return () => {
      es.close()
    }
  }, [])

  return (
    <PriceContext.Provider value={{ prices, status }}>
      {children}
    </PriceContext.Provider>
  )
}

/** Subscribe to the latest price update for a specific ticker */
export function usePrice(ticker: string): PriceUpdate | undefined {
  const { prices } = useContext(PriceContext)
  return prices[ticker]
}

/** Subscribe to the SSE connection status */
export function usePriceStatus(): PriceContextValue['status'] {
  return useContext(PriceContext).status
}
```
</action>

<acceptance_criteria>
- `frontend/app/providers/PriceContext.tsx` exists and starts with `'use client'`
- File exports: `PriceContext`, `PriceProvider`, `usePrice`, `usePriceStatus`, `PriceUpdate` type
- `es.addEventListener('price_update', ...)` is used (NOT `es.onmessage`)
- `cd frontend && npx tsc --noEmit` exits 0
</acceptance_criteria>
</task>

---

### Task 6: Build CSS Grid Shell in app/layout.tsx

<task id="T06">
<title>Replace app/layout.tsx with CSS Grid shell and PriceProvider wrapper</title>

<read_first>
- `frontend/app/layout.tsx` — read the generated default content first
- `.planning/phases/01-frontend-scaffold/01-CONTEXT.md` → "Layout grid" decision section
- `frontend/app/providers/PriceContext.tsx` — confirm PriceProvider export name
- `frontend/app/globals.css` — confirm CSS is imported correctly
</read_first>

<action>
Replace `frontend/app/layout.tsx` with:

```typescript
import type { Metadata } from 'next'
import './globals.css'
import { PriceProvider } from './providers/PriceContext'

export const metadata: Metadata = {
  title: 'FinAlly — AI Trading Workstation',
  description: 'Live market data, portfolio management, and AI-powered trading',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-base text-text-primary overflow-hidden">
        <PriceProvider>
          <div
            style={{
              display: 'grid',
              gridTemplateAreas: `
                "header header header"
                "watch  chart  chat"
                "port   chart  chat"
              `,
              gridTemplateColumns: '280px 1fr 320px',
              gridTemplateRows: '48px 1fr 1fr',
              height: '100vh',
              overflow: 'hidden',
            }}
          >
            {children}
          </div>
        </PriceProvider>
      </body>
    </html>
  )
}
```
</action>

<acceptance_criteria>
- `frontend/app/layout.tsx` imports `PriceProvider` from `./providers/PriceContext`
- `<html>` element has `className="dark"`
- Layout contains inline `grid-template-areas` with `"header header header"`, `"watch chart chat"`, `"port chart chat"` rows
- `gridTemplateColumns: '280px 1fr 320px'` present
- `gridTemplateRows: '48px 1fr 1fr'` present
- `cd frontend && npx tsc --noEmit` exits 0
</acceptance_criteria>
</task>

---

### Task 7: Build Placeholder Panels in app/page.tsx

<task id="T07">
<title>Replace app/page.tsx with dark placeholder panels for each grid area</title>

<read_first>
- `frontend/app/page.tsx` — read the generated default content first
- `frontend/app/layout.tsx` — confirm grid area names (header, watch, chart, chat, port)
- `.planning/phases/01-frontend-scaffold/01-CONTEXT.md` → "Layout grid" section (dark `#1a1a2e` placeholders)
</read_first>

<action>
Replace `frontend/app/page.tsx` with:

```typescript
export default function Home() {
  return (
    <>
      {/* Header — full width top bar */}
      <header
        style={{ gridArea: 'header', backgroundColor: '#161b22', borderBottom: '1px solid #30363d' }}
        className="flex items-center px-4 gap-6"
      >
        <span style={{ color: '#ecad0a', fontWeight: 700, fontSize: 15, letterSpacing: '0.05em' }}>
          FinAlly
        </span>
        <span style={{ color: '#8b949e', fontSize: 11 }}>AI Trading Workstation</span>
      </header>

      {/* Watchlist placeholder */}
      <aside
        style={{ gridArea: 'watch', backgroundColor: '#1a1a2e', borderRight: '1px solid #30363d', overflow: 'hidden' }}
        className="flex flex-col"
      >
        <PlaceholderPanel label="WATCHLIST" phase="Phase 2" />
      </aside>

      {/* Main chart placeholder */}
      <main
        style={{ gridArea: 'chart', backgroundColor: '#0d1117', overflow: 'hidden' }}
        className="flex flex-col"
      >
        <PlaceholderPanel label="CHART" phase="Phase 2" />
      </main>

      {/* AI chat placeholder */}
      <aside
        style={{ gridArea: 'chat', backgroundColor: '#1a1a2e', borderLeft: '1px solid #30363d', overflow: 'hidden' }}
        className="flex flex-col"
      >
        <PlaceholderPanel label="AI CHAT" phase="Phase 4" />
      </aside>

      {/* Portfolio placeholder */}
      <section
        style={{ gridArea: 'port', backgroundColor: '#1a1a2e', borderRight: '1px solid #30363d', borderTop: '1px solid #30363d', overflow: 'hidden' }}
        className="flex flex-col"
      >
        <PlaceholderPanel label="PORTFOLIO" phase="Phase 3" />
      </section>
    </>
  )
}

function PlaceholderPanel({ label, phase }: { label: string; phase: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-1">
      <span style={{ color: '#30363d', fontSize: 11, letterSpacing: '0.2em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ color: '#21262d', fontSize: 10 }}>
        — {phase} —
      </span>
    </div>
  )
}
```
</action>

<acceptance_criteria>
- `frontend/app/page.tsx` contains elements with `gridArea` values: `'header'`, `'watch'`, `'chart'`, `'chat'`, `'port'`
- `<header>` contains the text "FinAlly" with color `#ecad0a`
- `PlaceholderPanel` component renders a label and phase indicator
- `cd frontend && npx tsc --noEmit` exits 0
</acceptance_criteria>
</task>

---

### Task 8: Verify Build and Dev Server

<task id="T08">
<title>Run build verification and smoke-test the dev server</title>

<read_first>
- `frontend/next.config.ts` — confirm output: 'export' conditional is in place
- `frontend/package.json` — confirm build/dev scripts exist
</read_first>

<action>
Run the following in sequence from `frontend/`:

1. `npx tsc --noEmit` — TypeScript check, must exit 0
2. `npm run build` — production build, must exit 0 and produce `frontend/out/index.html`
3. Verify: `ls frontend/out/index.html` — file must exist
4. `npm run dev` — start dev server, confirm it starts on port 3000 without errors (Ctrl+C after confirming startup message)

If `npm run build` fails due to any TypeScript error, fix the error before marking this task done.
</action>

<acceptance_criteria>
- `npx tsc --noEmit` exits 0 with no TypeScript errors
- `npm run build` exits 0
- `frontend/out/index.html` exists and contains `<html`
- `npm run dev` prints "ready" or "Local: http://localhost:3000" without crashing
</acceptance_criteria>
</task>

---

## Verification

### Phase Success Criteria Check

| Criterion | How to Verify |
|-----------|--------------|
| SETUP-02: `frontend` directory exists with Next.js project | `ls frontend/package.json` exits 0 |
| SETUP-03: `output: 'export'` configured | `grep -r "output.*export" frontend/next.config.ts` |
| SETUP-04: `npm run build` produces `frontend/out/` | `ls frontend/out/index.html` exits 0 |
| VIS-01: Dark theme applied | `grep "#0d1117" frontend/app/globals.css` |
| VIS-02: Brand colors in theme | `grep "#ecad0a\|#209dd7\|#753991" frontend/app/globals.css` |

### Failure Scenarios

- **`next build` fails with "rewrites not supported"**: Check that `rewrites()` is inside the `isDev` conditional — it must NOT run when `NODE_ENV=production`
- **TypeScript error on `output: 'export' as const`**: The `as const` cast is required due to TypeScript narrowing; ensure it's present
- **Tailwind classes not working**: Confirm `@import "tailwindcss"` is the FIRST line in `globals.css` (Tailwind v4 requires this)
- **PriceContext not found**: Confirm `frontend/app/providers/PriceContext.tsx` exists and `layout.tsx` imports from `./providers/PriceContext`
