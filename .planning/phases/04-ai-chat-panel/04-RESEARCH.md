# Phase 4: AI Chat Panel - Research

**Researched:** 2026-06-28
**Domain:** React chat UI patterns, Next.js 16 / React 19 client components, REST API integration, state synchronization
**Confidence:** HIGH

---

## Summary

Phase 4 builds the docked AI chat sidebar. The backend (`POST /api/chat`) is fully operational and auto-executes all trades and watchlist changes server-side. The frontend job is purely UI: send the message, show a loading indicator, render the response with inline action chips, and refresh portfolio/watchlist state after the response arrives.

The stack is already locked: Next.js 16.2.9 (React 19), Tailwind CSS v4, all components must be `'use client'`. No new packages are needed — everything required (fetch, useRef, useState, useEffect, useCallback) is native React. The chat area already has a reserved grid slot (`gridArea: 'chat'`, 320px wide) in `layout.tsx` that currently shows a placeholder. This phase replaces that placeholder with a real `ChatPanel` component.

The most important architectural insight is that the backend handles all execution. After `POST /api/chat` returns, the frontend calls `refetchAll()` (already on `PortfolioContext`) to pull updated positions and trades. For watchlist changes, the frontend calls `addTicker` / `removeTicker` from `WatchlistContext` to sync local state. The chat history itself lives only in React state (in-component `useState`) — the backend stores messages in SQLite but the frontend does not fetch history on mount. Messages accumulate in the session; collapsing and re-expanding the panel preserves history because the component stays mounted in the DOM (it never unmounts when collapsed, only hides).

**Primary recommendation:** Build `ChatPanel` as a single self-contained `'use client'` component under `frontend/app/components/chat/ChatPanel.tsx`. Keep the collapse state in `page.tsx` (the parent that controls the grid layout) so the 320px column can be collapsed to 0px or a narrow toggle button via CSS transition on `gridTemplateColumns`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Message send / LLM call | API (backend) | — | `POST /api/chat` handles LLM, trade execution, persistence |
| Chat history display | Browser / Client | — | In-component `useState` array; no server fetch on mount |
| Loading state | Browser / Client | — | `isLoading` flag between POST submit and response |
| Trade confirmation chips | Browser / Client | — | Render `executed_trades` from API response inline |
| Watchlist chip display | Browser / Client | — | Render `watchlist_results` from API response inline |
| State refresh after AI trade | Browser / Client | API | Call `refetchAll()` from PortfolioContext; call `addTicker`/`removeTicker` from WatchlistContext |
| Panel collapse/expand | Browser / Client | — | CSS transition on grid column width; component stays mounted |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHAT-01 | Chat panel has message input and scrolling conversation history | useState message array + overflowY auto scroll container |
| CHAT-02 | Loading indicator shown while awaiting LLM response | `isLoading` bool → spinner div; disable input during load |
| CHAT-03 | Assistant message with conversational text | Render `response.message` in assistant message bubble |
| CHAT-04 | AI-executed trades shown inline as confirmation chips | Render `response.executed_trades` array as styled chips per message |
| CHAT-05 | AI watchlist changes shown inline as confirmation chips | Render `response.watchlist_results` array as styled chips per message |
| CHAT-06 | Chat panel is collapsible/toggleable | Collapse state in page.tsx; CSS grid column transition; component stays mounted |
</phase_requirements>

---

## Standard Stack

### Core

No new packages are required. All capabilities are covered by React 19 built-ins.

| API | Source | Purpose | Why Standard |
|-----|--------|---------|--------------|
| `useState` | React 19 (built-in) | Message array, loading flag, input value | Native React state |
| `useRef` | React 19 (built-in) | Auto-scroll anchor, input focus after submit | DOM ref without re-render |
| `useEffect` | React 19 (built-in) | Scroll-to-bottom when messages change | Side-effect hook |
| `useCallback` | React 19 (built-in) | Stable submit handler | Memoized callback |
| `useContext` | React 19 (built-in) | Access PortfolioContext, WatchlistContext | Existing pattern |
| `fetch` | Browser built-in | `POST /api/chat` | Same-origin, no CORS |

[VERIFIED: Read from `frontend/package.json` — React 19.2.4, no new deps needed]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-component message state | A ChatContext | Context would allow other panels to read chat state — not needed for this phase |
| CSS transition on grid column | Unmount/mount ChatPanel | Unmounting loses history; CSS transition preserves it per CHAT-06 |
| Spinner div | Skeleton loader | Skeleton is better for known-shape content; chat response shape varies — spinner is simpler |

**Installation:** No new packages to install.

---

## Package Legitimacy Audit

No external packages are being installed in this phase. The implementation uses only React 19 built-ins, existing project dependencies (recharts, tailwindcss are already installed), and native browser fetch.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
User types message → ChatPanel (Client Component)
        |
        v
[isLoading = true] → Spinner visible, input disabled
        |
        v
fetch POST /api/chat  {message: string}
        |
        v (1–10s, Cerebras fast inference)
Backend: LLM call → parse → execute trades → execute watchlist changes → persist
        |
        v
Response: {message, trades, watchlist_changes, executed_trades, watchlist_results, errors}
        |
        v
[isLoading = false]
        |
        ├── Append AssistantMessage to local messages array
        │     └── message.text = response.message
        │     └── message.chips = [...executed_trades, ...watchlist_results]
        |
        ├── PortfolioContext.refetchAll()  ← refresh positions/cash/trades/history
        |
        └── For each watchlist_results:
              action=added  → WatchlistContext.addTicker() (local sync only, no re-POST)
              action=removed → WatchlistContext.removeTicker()
```

### Recommended Project Structure

```
frontend/app/components/chat/
└── ChatPanel.tsx        # Self-contained chat panel ('use client')
```

No sub-components needed at MVP scale. The panel is 320px wide; sub-splitting adds complexity without benefit.

### Pattern 1: Message State Shape

**What:** A local `messages` array in `ChatPanel` accumulates the conversation. Each entry carries a role, text, and optionally action chips from the API response.

**When to use:** Any time the frontend needs ephemeral session-only state that does not need to survive page reload.

```typescript
// Source: project convention — matches existing Trade/Snapshot type patterns in PortfolioContext
type ActionChip =
  | { kind: 'trade'; ticker: string; side: string; quantity: number; price: number }
  | { kind: 'watchlist'; ticker: string; action: string }
  | { kind: 'error'; text: string }

type ChatMessage = {
  id: string          // crypto.randomUUID() or Date.now().toString()
  role: 'user' | 'assistant'
  text: string
  chips?: ActionChip[]
}
```

[ASSUMED] — specific shape above is a design decision, not from official docs. Pattern is consistent with project conventions.

### Pattern 2: Submit Handler

**What:** On form submit (Enter key or Send button click), freeze input, POST to `/api/chat`, parse response, update messages, refresh contexts.

**When to use:** This is the core interaction loop.

```typescript
// Source: derived from existing TradeBar.tsx pattern in this codebase (PortfolioContext)
const handleSubmit = useCallback(async () => {
  const text = input.trim()
  if (!text || isLoading) return

  setInput('')
  setIsLoading(true)
  setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }])

  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    })
    const data = await resp.json()

    // Build chips from executed results (not from llm intent — use executed_trades)
    const chips: ActionChip[] = [
      ...(data.executed_trades ?? []).map((t: { ticker: string; side: string; quantity: number; price: number }) => ({
        kind: 'trade' as const, ticker: t.ticker, side: t.side,
        quantity: t.quantity, price: t.price,
      })),
      ...(data.watchlist_results ?? []).map((w: { ticker: string; action: string }) => ({
        kind: 'watchlist' as const, ticker: w.ticker, action: w.action,
      })),
      ...(data.errors ?? []).map((e: string) => ({ kind: 'error' as const, text: e })),
    ]

    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: data.message,
      chips: chips.length > 0 ? chips : undefined,
    }])

    // Refresh portfolio state (backend already executed the trades)
    await refetchAll()   // from usePortfolio()

    // Sync watchlist context for added/removed tickers (local state only — don't re-POST)
    for (const w of data.watchlist_results ?? []) {
      if (w.action === 'added') setTickersLocal(prev => [...prev, w.ticker])
      if (w.action === 'removed') setTickersLocal(prev => prev.filter(t => t !== w.ticker))
    }
  } catch {
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: 'Connection error. Please try again.',
    }])
  } finally {
    setIsLoading(false)
  }
}, [input, isLoading, refetchAll])
```

[ASSUMED] — specific implementation above is a design recommendation based on existing codebase patterns.

**Important note on watchlist sync:** `WatchlistContext.addTicker()` calls `POST /api/watchlist` — which would double-execute. The backend already added the ticker. The frontend only needs to update the local `tickers` array. Two options:

1. Call `addTicker()` from context but catch the 409 (duplicate) silently.
2. Directly manipulate via a ref to the state setter — but context doesn't expose this.
3. Refetch the watchlist from API via a `GET /api/watchlist` call.

**Recommended approach:** After `refetchAll()` for portfolio, do a separate `fetch('/api/watchlist')` call to re-sync the tickers array in WatchlistContext. This avoids the double-POST problem and keeps state consistent. However, WatchlistContext does not expose a `refetch` function. Two options: (a) add a `refetchWatchlist` function to WatchlistContext, or (b) simply call `addTicker()` from context and let the 409 be silently swallowed. Option (b) is simpler for MVP.

[ASSUMED] — the tradeoff analysis above is based on reading the WatchlistContext source code.

### Pattern 3: Auto-scroll to Bottom

**What:** On every new message, scroll the message container to the bottom.

**When to use:** Standard chat UI pattern — new messages should be visible without manual scroll.

```typescript
// Source: standard React useRef+useEffect pattern [ASSUMED]
const bottomRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])

// In JSX — at the bottom of the messages list:
<div ref={bottomRef} />
```

### Pattern 4: Panel Collapse (in page.tsx)

**What:** The collapse state lives in `page.tsx` which owns the grid layout. When collapsed, the `chat` column shrinks to 40px (showing only a toggle button icon). When expanded, it's 320px. CSS transition animates the width.

**When to use:** Grid column transitions are the correct approach when the panel spans multiple grid rows (here it spans `watch` and `port` rows).

```typescript
// Source: layout.tsx shows gridTemplateColumns: '280px 1fr 320px' [VERIFIED: Read layout.tsx]
// Collapse: change gridTemplateColumns to '280px 1fr 40px'

const [chatOpen, setChatOpen] = useState(true)

// In the grid div style:
{
  gridTemplateColumns: chatOpen ? '280px 1fr 320px' : '280px 1fr 40px',
  transition: 'grid-template-columns 200ms ease',
}
```

The `ChatPanel` component always renders (never unmounts) — it just gets a 40px container when collapsed. The panel header should show the AI label and a toggle chevron button.

[ASSUMED] — CSS grid transition behavior is based on training knowledge; confirm it works in the target browser versions.

### Anti-Patterns to Avoid

- **Unmounting ChatPanel on collapse:** Loses message history. Use CSS hide (`overflow: hidden` on the parent) instead.
- **Calling `WatchlistContext.addTicker()` for AI-added tickers:** Double-POSTs to `/api/watchlist` (backend already executed it). Either silently swallow the 409 or refetch from API.
- **Using `data.trades` for chips instead of `data.executed_trades`:** `trades` is the LLM's intent (may include failed trades); `executed_trades` is what actually happened. Always show `executed_trades`.
- **Not disabling the input during loading:** Users will double-submit. Disable input and send button when `isLoading` is true.
- **Server Actions for chat form:** The app is a static export (`output: 'export'`). Server Actions require a Node.js server. Use plain `fetch` in the event handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing of chat response | Custom parser | `resp.json()` | Standard fetch API |
| Scroll-to-bottom | IntersectionObserver | `useRef` + `.scrollIntoView()` | 3 lines, correct |
| Debounce on chat submit | Lodash debounce | `isLoading` flag guard | Loading state already prevents double-submit |

**Key insight:** Chat UI at this scale is pure React state management. Third-party chat libraries add bundle weight without benefit for a single-panel interface this size.

---

## Common Pitfalls

### Pitfall 1: Wrong chip data field
**What goes wrong:** Displaying `data.trades` (LLM intent) as chips instead of `data.executed_trades` (actual results). A trade the LLM requested may have failed (insufficient funds); showing it as "executed" misleads the user.
**Why it happens:** Both fields exist in the response; `trades` is shorter to type.
**How to avoid:** Always use `data.executed_trades` for success chips and `data.errors` for error chips.
**Warning signs:** Chips appear for trades that didn't affect portfolio balance.

### Pitfall 2: Double-posting watchlist changes
**What goes wrong:** Calling `WatchlistContext.addTicker()` after AI adds a ticker causes a second `POST /api/watchlist` → backend returns 409 (duplicate).
**Why it happens:** `addTicker()` is designed for user-initiated adds, not for syncing state after backend execution.
**How to avoid:** Either catch the 409 silently, or refetch `GET /api/watchlist` and push result into context.
**Warning signs:** Console 409 errors after chat messages that include watchlist additions.

### Pitfall 3: Grid column transition not working
**What goes wrong:** CSS `transition` on `grid-template-columns` requires the property to be present in both states (not changing from `none` to a value).
**Why it happens:** If the initial style doesn't include `transition`, the first collapse has no animation.
**How to avoid:** Always include `transition: 'grid-template-columns 200ms ease'` in the grid `style` object, regardless of `chatOpen` state.
**Warning signs:** Collapse is instant (no animation) on first click.

### Pitfall 4: Enter key submits outside textarea
**What goes wrong:** Using a `<textarea>` and handling `onKeyDown` for Enter — Shift+Enter should add a newline, Enter should submit.
**Why it happens:** Default `<textarea>` Enter behavior inserts newlines; must suppress `e.preventDefault()` conditionally.
**How to avoid:** For a single-line-style input, use `<input type="text">` — simpler, no newline issue. The project brief doesn't require multi-line input.
**Warning signs:** Pressing Enter adds newlines instead of submitting.

### Pitfall 5: Server Actions incompatible with static export
**What goes wrong:** Using `<form action={serverAction}>` or `'use server'` directive causes build failure.
**Why it happens:** Static export (`output: 'export'`) does not support server-side features.
**How to avoid:** Use plain `fetch` in a `'use client'` event handler. `<form onSubmit={...}>` with `e.preventDefault()` is the correct pattern.
**Warning signs:** `next build` error mentioning "Server Actions are not supported in static export".

---

## Code Examples

### Complete API Response Shape

```typescript
// Source: Read backend/app/api/chat.py lines 202-209 [VERIFIED: Read source file]
// POST /api/chat returns:
{
  message: string,                         // LLM conversational text
  trades: [{ticker, side, quantity}],      // What LLM intended
  watchlist_changes: [{ticker, action}],   // What LLM intended
  executed_trades: [{                      // What actually executed
    id: string,
    ticker: string,
    side: string,
    quantity: number,
    price: number,
    executed_at: string,
  }],
  watchlist_results: [{ticker, action}],   // Result: 'added'|'removed'|'not_found'|'already_in_watchlist'
  errors: string[],                        // Trade validation errors
}
```

### Spinner Loading Indicator

```typescript
// Source: project convention — matches TradeBar loading pattern [ASSUMED]
// Simple CSS spinner matching terminal aesthetic
{isLoading && (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    color: '#8b949e',
    fontSize: 11,
  }}>
    <div style={{
      width: 12,
      height: 12,
      border: '2px solid #30363d',
      borderTop: '2px solid #209dd7',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    FinAlly is thinking...
  </div>
)}
```

Add `@keyframes spin { to { transform: rotate(360deg); } }` to `globals.css`.

### Trade Confirmation Chip

```typescript
// Source: design recommendation matching project color scheme [ASSUMED]
function TradeChip({ ticker, side, quantity, price }: { ticker: string; side: string; quantity: number; price: number }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      backgroundColor: side === 'buy' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
      border: `1px solid ${side === 'buy' ? '#22c55e' : '#ef4444'}`,
      fontSize: 11,
      color: side === 'buy' ? '#22c55e' : '#ef4444',
    }}>
      {side.toUpperCase()} {quantity} {ticker} @ ${price.toFixed(2)}
    </div>
  )
}
```

### Watchlist Chip

```typescript
// Source: design recommendation [ASSUMED]
function WatchlistChip({ ticker, action }: { ticker: string; action: string }) {
  const isAdd = action === 'added'
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      backgroundColor: 'rgba(32, 157, 215, 0.15)',
      border: '1px solid #209dd7',
      fontSize: 11,
      color: '#209dd7',
    }}>
      {isAdd ? '+' : '−'} {ticker} watchlist
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Streaming LLM responses (token-by-token) | Complete JSON response | Deliberate design choice | No streaming UI needed — simpler state management |
| Separate chat history fetch on mount | In-component session state only | Deliberate design choice | Simpler; history not needed across page reloads |

**Deliberate non-features:**
- No markdown rendering in chat messages (not required by spec; monospace font handles code blocks visually)
- No message timestamps in display (not required by spec; adds visual noise)
- No persistent history across page refresh (backend stores in SQLite but frontend doesn't fetch it on mount — not in spec)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data.executed_trades` uses the Trade DB shape (includes `price`, `executed_at`) | Code Examples | Chips might display undefined price |
| A2 | CSS `grid-template-columns` transition works in Chrome/Safari (static export target) | Pattern 4 | Collapse has no animation; functional but not polished |
| A3 | `WatchlistContext.addTicker()` will get a 409 and throw if ticker already exists (AI added it) | Pattern 2 | Could surface error to user if not caught |
| A4 | The `refetchAll()` from `PortfolioContext` is publicly accessible via `usePortfolio()` | Pattern 2 | Would need to expose it or restructure |
| A5 | A simple `<input type="text">` (not textarea) is sufficient for chat input | Common Pitfalls | If user needs multi-line messages, needs textarea with Shift+Enter handling |
| A6 | Spinner `@keyframes spin` does not conflict with existing `globals.css` animations | Code Examples | CSS keyframe name collision (low risk) |

**Claim A4 verification:** Read `PortfolioContext.tsx` lines 29-36, 127-130. `usePortfolio()` returns `{ positions, cashBalance, totalValue, trades, history, executeTrade }`. `refetchAll` is NOT in the public API — it is an internal `useCallback`. The planner must account for this: either expose `refetchAll` from the context, or after chat response call `executeTrade` dummy (no), or call portfolio APIs directly in the chat handler. [VERIFIED: Read source file]

**Revised approach for A4:** The simplest fix is to add `refetchPortfolio: () => Promise<void>` to `PortfolioContextValue` and expose `refetchAll`. This is a one-line addition to the context. The planner should include this as a Wave 0 task.

---

## Open Questions

1. **Expose `refetchAll` from PortfolioContext?**
   - What we know: `refetchAll` exists but is not in the public API
   - What's unclear: Whether to add it to context or call portfolio APIs directly in ChatPanel
   - Recommendation: Add `refetchPortfolio: () => Promise<void>` to `PortfolioContextValue` — cleanest approach

2. **Watchlist sync after AI changes**
   - What we know: `addTicker()` from context re-POSTs to backend; backend already executed it
   - What's unclear: Whether to swallow the 409 or refetch the list
   - Recommendation: Add a `refetchWatchlist` function to WatchlistContext (parallel to `refetchPortfolio`), or simply call `GET /api/watchlist` directly in chat handler and push results

3. **Chat collapse toggle placement**
   - What we know: `page.tsx` owns the grid; collapse state should live there
   - What's unclear: Whether the toggle button lives in the header or as a tab on the panel edge
   - Recommendation: Add a small chevron button to the existing header row; clicking it toggles `chatOpen` state in `page.tsx`

---

## Environment Availability

Step 2.6: SKIPPED — this phase installs no external tools or services. All dependencies (Node.js, npm, Next.js, React) are already installed and verified working from Phase 3.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test ^1.61.1` (E2E); no unit test framework in frontend |
| Config file | `test/playwright.config.ts` |
| Quick run command | `cd /Users/richardleclezio/projects/finally/test && npx playwright test --grep "chat"` |
| Full suite command | `cd /Users/richardleclezio/projects/finally/test && npx playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Chat input and message list render | E2E smoke | `npx playwright test --grep "chat panel"` | ❌ Wave 0 |
| CHAT-02 | Loading indicator visible on submit | E2E smoke | `npx playwright test --grep "loading"` | ❌ Wave 0 |
| CHAT-03 | Assistant message text displayed | E2E smoke | `npx playwright test --grep "portfolio worth"` | ❌ Wave 0 |
| CHAT-04 | Trade chip shows after AI trade | E2E smoke | `npx playwright test --grep "buy.*GOOGL"` | ❌ Wave 0 |
| CHAT-05 | Watchlist chip shows after AI change | E2E smoke | `npx playwright test --grep "watchlist"` | ❌ Wave 0 |
| CHAT-06 | Panel collapses and re-expands | E2E smoke | `npx playwright test --grep "collapse"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd /Users/richardleclezio/projects/finally/test && npx playwright test --grep "chat" --project=chromium`
- **Per wave merge:** `cd /Users/richardleclezio/projects/finally/test && npx playwright test`
- **Phase gate:** Full suite green (19 existing + new chat tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test/specs/chat.spec.ts` — new file covering CHAT-01 through CHAT-06 (run with `LLM_MOCK=true`)
- [ ] `globals.css` — add `@keyframes spin` for spinner animation

---

## Security Domain

This phase is a client-side UI with no authentication, no sensitive data handling, and no server logic. The backend already validates and sanitizes all LLM output. Applicable ASVS categories:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes (minimal) | Chat message is plain string; length guard `text.trim()` before POST |
| V2 Authentication | No | No-login design by spec |
| V3 Session Management | No | Stateless frontend |
| V6 Cryptography | No | No crypto in this phase |

**Threat pattern:** XSS via LLM response text. Mitigation: React's JSX rendering escapes all string content by default — `{message.text}` is safe. Do not use `dangerouslySetInnerHTML` for any chat content.

---

## Sources

### Primary (HIGH confidence)
- `frontend/app/providers/PortfolioContext.tsx` — confirmed `refetchAll` is not in public API, `executeTrade` signature, `refetchAll` pattern
- `frontend/app/providers/WatchlistContext.tsx` — confirmed `addTicker` re-POSTs, no `refetchWatchlist` exists
- `frontend/app/layout.tsx` — confirmed grid areas, column widths, provider nesting
- `frontend/app/page.tsx` — confirmed `PlaceholderPanel` for chat area, grid area `chat`
- `backend/app/api/chat.py` — confirmed API response shape (lines 202-209), auto-execution behavior
- `backend/app/llm/chat.py` — confirmed mock response shape, `MOCK_RESPONSE` content
- `frontend/next.config.ts` — confirmed static export in production, dev proxy for `/api/*`
- `frontend/package.json` — confirmed React 19.2.4, Next.js 16.2.9, no chat libraries installed
- `frontend/app/globals.css` — confirmed existing `@keyframes flash-up/down`; no `spin` keyframe exists
- `frontend/node_modules/next/dist/docs/01-app/02-guides/static-exports.md` — confirmed Server Actions not supported in static export

### Secondary (MEDIUM confidence)
- `frontend/app/components/portfolio/TradeBar.tsx` — reference pattern for loading state, disabled inputs, error display
- `frontend/app/components/portfolio/TradeHistory.tsx` — reference pattern for scrollable list with `overflowY: auto`
- `frontend/app/components/portfolio/PortfolioPanel.tsx` — reference pattern for flex column layout within grid area

### Tertiary (LOW confidence / Assumed)
- CSS `grid-template-columns` transition behavior — from training knowledge, not verified in-browser
- Specific chip styling dimensions — design recommendation, not from official source

---

## Metadata

**Confidence breakdown:**
- API response shape: HIGH — read `backend/app/api/chat.py` directly
- Context integration: HIGH — read both context files directly; confirmed `refetchAll` gap
- Standard stack: HIGH — no new packages needed, React 19 built-ins
- Architecture patterns: HIGH — derived from existing components in codebase
- CSS grid transition: MEDIUM — based on training knowledge, not verified in browser
- Chip visual design: LOW — pure design recommendation

**Research date:** 2026-06-28
**Valid until:** 2026-07-28 (stable stack, no fast-moving dependencies)
