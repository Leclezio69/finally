---
phase: 4
slug: ai-chat-panel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test ^1.61.1` (E2E) |
| **Config file** | `test/playwright.config.ts` |
| **Quick run command** | `cd /Users/richardleclezio/projects/finally/test && npx playwright test --grep "chat" --project=chromium` |
| **Full suite command** | `cd /Users/richardleclezio/projects/finally/test && npx playwright test` |
| **Estimated runtime** | ~30 seconds (chat-only grep), ~90 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `cd test && npx playwright test --grep "chat" --project=chromium`
- **After every plan wave:** Run `cd test && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green (19 existing + new chat tests)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | CHAT-01 | — | N/A | E2E smoke | `npx playwright test --grep "chat panel"` | ❌ Wave 0 | ⬜ pending |
| 4-01-02 | 01 | 1 | CHAT-02 | — | N/A | E2E smoke | `npx playwright test --grep "loading"` | ❌ Wave 0 | ⬜ pending |
| 4-01-03 | 01 | 1 | CHAT-03 | — | N/A | E2E smoke | `npx playwright test --grep "portfolio worth"` | ❌ Wave 0 | ⬜ pending |
| 4-01-04 | 01 | 1 | CHAT-04 | — | N/A | E2E smoke | `npx playwright test --grep "buy.*GOOGL"` | ❌ Wave 0 | ⬜ pending |
| 4-01-05 | 01 | 1 | CHAT-05 | — | N/A | E2E smoke | `npx playwright test --grep "watchlist"` | ❌ Wave 0 | ⬜ pending |
| 4-01-06 | 01 | 1 | CHAT-06 | — | N/A | E2E smoke | `npx playwright test --grep "collapse"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/specs/chat.spec.ts` — new file covering CHAT-01 through CHAT-06 (run with `LLM_MOCK=true`)
- [ ] `frontend/app/globals.css` — add `@keyframes spin` for spinner animation (if not already present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Price flash + chat panel visible simultaneously | CHAT-01 + VIS | Visual layering check | Open app, watch prices flash, send chat message — both must be visible without overlap |
| Chat collapse smoothly animates | CHAT-06 | CSS transition | Click collapse button — panel should animate width, not jump |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
