# Phase 1 Research — Frontend Scaffold

**Phase:** 1 — Frontend Scaffold
**Researched:** 2026-06-28

---

## Key Findings

### 1. Tailwind CSS v4 — Breaking Change vs v3

`create-next-app@latest` with `--tailwind` installs **Tailwind v4**, not v3. Tailwind v4 is a fundamentally different configuration model:

| v3 | v4 |
|----|-----|
| `tailwind.config.ts` with `theme.extend.colors` | No config file — CSS-only configuration |
| `darkMode: 'class'` in config | `@custom-variant dark (&:where(.dark, .dark *));` in CSS |
| `@tailwind base/components/utilities` | `@import "tailwindcss"` |
| Custom colors in JS config | `@theme { --color-accent: #ecad0a; }` in CSS |

**Impact on plan:** All color customization and dark mode configuration goes in `app/globals.css`, not in a JS config file. No `tailwind.config.ts` needed.

**Dark mode approach for FinAlly:** Since we always want dark mode (no light mode toggle), add `class="dark"` to `<html>` in `layout.tsx` and define the custom variant:
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-bg-base: #0d1117;
  --color-bg-panel: #1a1a2e;
  --color-accent-yellow: #ecad0a;
  --color-accent-blue: #209dd7;
  --color-accent-purple: #753991;
}
```

### 2. next.config.ts — Rewrites Incompatible with `output: 'export'`

**Critical:** The Next.js docs explicitly list "Rewrites" as an **unsupported feature** with `output: 'export'`. Defining `rewrites()` alongside `output: 'export'` will cause a build error.

**Resolution — Conditional config by NODE_ENV:**
```typescript
// next.config.ts
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

const nextConfig: NextConfig = {
  // Static export only in production (build). Dev server runs normally.
  ...(isDev ? {} : { output: 'export' as const }),
  images: { unoptimized: true },
  // Dev proxy: rewrites only apply when running `next dev`
  ...(isDev ? {
    async rewrites() {
      return [
        { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
      ]
    }
  } : {}),
}

export default nextConfig
```

**How it works:**
- `next dev` → `NODE_ENV=development` → rewrites active, no static export → SSE proxy works
- `next build` → `NODE_ENV=production` → `output: 'export'`, no rewrites → produces `out/`
- In Docker: frontend served by FastAPI at same origin, `/api/*` is same-origin → no proxy needed

**Alternative (simpler):** Enable CORS on the backend for dev only. Rejected — project spec says no CORS.

### 3. Image Optimization Must Be Disabled

Static export requires `images: { unoptimized: true }` (or a custom loader). Without it, `next/image` components throw a build error:
```
Error: Image Optimization using the default loader is not compatible with next export.
```
Even if Phase 1 doesn't use `next/image`, including `unoptimized: true` upfront prevents this error in later phases.

### 4. `'use client'` Directive — Required for All Interactive Components

With `output: 'export'`, Next.js still uses App Router but generates static HTML. Any component using React hooks (`useState`, `useEffect`, `useContext`) MUST have `'use client'` at the top. This includes:
- `PriceContext.tsx` (uses `useEffect` for EventSource, `useState` for prices)
- Any component that subscribes to price updates

Server components (without `'use client'`) are fine for pure layout/structure.

### 5. EventSource SSE Pattern for App Router

EventSource is browser-only (not available in Node.js/RSC). Implementation:
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
    es.onerror = () => setStatus('reconnecting')
    es.addEventListener('price_update', (e) => {
      const data = JSON.parse(e.data) as PriceUpdate
      setPrices(prev => ({ ...prev, [data.ticker]: data }))
    })
    return () => es.close()
  }, [])

  return (
    <PriceContext.Provider value={{ prices, status }}>
      {children}
    </PriceContext.Provider>
  )
}

export const usePrice = (ticker: string) => {
  const { prices } = useContext(PriceContext)
  return prices[ticker]
}

export const usePriceStatus = () => useContext(PriceContext).status
```

**Key detail:** The SSE event name from the backend is `price_update` (named event). Must use `es.addEventListener('price_update', ...)` — NOT `es.onmessage` which only catches unnamed events.

### 6. CSS Grid Shell in layout.tsx

The grid uses named template areas. Since this is a client component (PriceProvider), `layout.tsx` needs `'use client'` OR split: keep layout.tsx as server component and make only the `<PriceProvider>` wrapper a client component.

**Recommended: Split approach**
- `layout.tsx` → Server component (no `'use client'`) — renders `<html>`, `<body>`, grid shell
- `providers/PriceContext.tsx` → Client component (has `'use client'`) — wraps children with EventSource logic
- Grid panels → Server components with `'use client'` only when they use hooks

The grid CSS:
```css
.grid-shell {
  display: grid;
  grid-template-areas:
    'header header header'
    'watch  chart  chat'
    'port   chart  chat';
  grid-template-columns: 280px 1fr 320px;
  grid-template-rows: 48px 1fr 1fr;
  height: 100vh;
  overflow: hidden;
}
```

Or using Tailwind v4 arbitrary grid utilities directly in JSX.

### 7. create-next-app Command

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*"
```

This creates:
- `app/` directory (App Router)
- TypeScript config
- Tailwind CSS v4
- ESLint
- `@/*` import alias

**CRITICAL PRE-STEP:** The `frontend` entry at the project root is currently an empty FILE (0 bytes), not a directory. Must `rm frontend` BEFORE running create-next-app:
```bash
rm /path/to/finally/frontend
```

### 8. next.config.ts vs next.config.js

Next.js 15 generates `next.config.ts` (TypeScript) by default when TypeScript is selected. Use TypeScript config:
```typescript
import type { NextConfig } from 'next'
const nextConfig: NextConfig = { ... }
export default nextConfig
```

---

## Validation Architecture

### Unit-Level
- `npm run build` in `frontend/` exits 0
- `frontend/out/index.html` exists after build
- No TypeScript errors (`npx tsc --noEmit`)

### Integration-Level
- `next dev` server starts on port 3000
- `GET /api/stream/prices` proxied to backend (with backend running)
- SSE events received: browser console shows `price_update` events

### Visual
- App loads with dark background (`#0d1117`)
- Brand colors visible (yellow accent, etc.)
- FinAlly branding text shown

---

## Risks & Landmines

| Risk | Severity | Mitigation |
|------|----------|------------|
| `rewrites()` + `output: 'export'` build error | HIGH | Conditional config by NODE_ENV |
| Tailwind v4 vs v3 API differences | HIGH | Use CSS-based config, no tailwind.config.ts |
| `frontend` is a file not a directory | HIGH | `rm frontend` before create-next-app |
| `next/image` without unoptimized | MEDIUM | Add `images: { unoptimized: true }` in config |
| EventSource named events vs onmessage | MEDIUM | Use `addEventListener('price_update', ...)` |
| PriceProvider needs `'use client'` | LOW | Keep layout.tsx as server component, wrap children |

---

## RESEARCH COMPLETE

Phase 1 research complete. Critical findings:
1. Tailwind v4 CSS-based config (no JS config file)
2. Rewrites incompatible with `output: 'export'` → conditional NODE_ENV config
3. `rm frontend` required before create-next-app
4. EventSource named event listener pattern confirmed
5. `images: { unoptimized: true }` required
