---
phase: 3
slug: portfolio-trading
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-28
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E, in `test/`) |
| **Config file** | `test/playwright.config.ts` |
| **Quick run command** | `cd test && npx playwright test --grep "portfolio"` |
| **Full suite command** | `cd test && npx playwright test` |
| **Estimated runtime** | ~60 seconds (full suite against Docker) |

---

## Sampling Rate

- **After every task commit:** Visual inspection via `npm run dev` + backend on port 8000 (no frontend unit test framework)
- **After every wave:** Visual validation of all requirements in that wave
- **Phase gate:** Full Playwright suite green before `/gsd:verify-work` (Phase 5 context)

---

## Requirement → Test Map

| Req ID | Behavior | Test Type | Validation Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PORT-01 | Header shows live total value updating via SSE | E2E | `cd test && npx playwright test --grep "portfolio value"` | No — Phase 5 |
| PORT-02 | Header shows cash balance | E2E | `cd test && npx playwright test --grep "cash"` | No — Phase 5 |
| PORT-03 | SSE connection status dot (green/yellow/red) | E2E | `cd test && npx playwright test --grep "status"` | No — Phase 5 |
| PORT-04 | Heatmap renders positions, colored by P&L | E2E | `cd test && npx playwright test --grep "heatmap"` | No — Phase 5 |
| PORT-05 | P&L chart shows data from history endpoint | E2E | `cd test && npx playwright test --grep "pnl"` | No — Phase 5 |
| PORT-06 | Positions table with correct formatting | E2E | `cd test && npx playwright test --grep "positions"` | No — Phase 5 |
| TRADE-01 | Trade bar: ticker, quantity, Buy, Sell visible | E2E | `cd test && npx playwright test --grep "trade bar"` | No — Phase 5 |
| TRADE-02 | Buy executes; cash decreases; position appears | E2E | `cd test && npx playwright test --grep "buy"` | No — Phase 5 |
| TRADE-03 | Sell executes; position disappears when fully sold | E2E | `cd test && npx playwright test --grep "sell"` | No — Phase 5 |
| TRADE-04 | Trade history shows recent trades | E2E | `cd test && npx playwright test --grep "trade history"` | No — Phase 5 |
| TRADE-05 | Error message on insufficient funds/shares | E2E | `cd test && npx playwright test --grep "insufficient"` | No — Phase 5 |

**Note:** E2E tests run against the Docker container and are written in Phase 5. Phase 3 validation is visual via `npm run dev` with backend running on port 8000. No test files are created in Phase 3.

---

## Wave 0 Gaps

No test infrastructure gaps in this phase — Playwright is already installed in `test/`. New E2E tests for portfolio/trading are a Phase 5 deliverable.

---

## Security Domain

This phase involves no authentication, no cryptography, and no multi-user data. The trade bar accepts ticker/quantity input but the backend validates and sanitizes (uppercase normalization, positive quantity, valid side). No additional security controls needed beyond what the backend already enforces.
