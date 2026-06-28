# CONCERNS.md — FinAlly Technical Debt & Concerns
<!-- last_mapped_commit: 486bd7d -->
<!-- mapped: 2026-06-28 -->

## CRITICAL: Frontend Missing on This Branch

**Severity: High**

The `frontend` entry in the repo root is an **empty file** on the `finally-gsd` branch, not a directory:

```
-rw-r--r--   1 richardleclezio  staff       0 Jun 27 21:15 frontend
```

**Impact:**
- Docker Stage 1 (Node build) will fail: `COPY frontend/ ./` cannot copy from a file
- No static files to serve — FastAPI will start but `/` returns 404 (static mount skipped since `STATIC_DIR` doesn't exist)
- Backend API (`/api/*`) is fully functional without the frontend
- E2E tests that navigate to `/` will fail (frontend UI tests)

**History:** The Next.js frontend was built on the `main` branch (`44bf48b Agent Teams v1`). The `finally-gsd` branch was created from an earlier commit before the frontend was added, or the frontend directory was replaced with an empty file during branch setup.

**Resolution needed before Docker build:** Either merge frontend from `main` or recreate the Next.js project.

---

## Synchronous SQLite in Async Handlers

**Severity: Low (acceptable for current scale)**

All DB operations use the synchronous `sqlite3` module directly inside `async def` FastAPI handlers without `asyncio.run_in_executor()`. This blocks the event loop during DB I/O.

- **Current impact**: Negligible for single-user simulation (tiny DB, fast queries)
- **Future concern**: Would bottleneck under concurrent users
- **Location**: `backend/app/api/portfolio.py`, `backend/app/api/watchlist.py`, `backend/app/api/chat.py`

**Note in codebase**: The schema includes `user_id` columns (defaulting to `"default"`) as a future multi-user hook, but the sync DB pattern would need to change before real concurrency.

---

## No Frontend Unit Tests

**Severity: Medium (when frontend is restored)**

Zero frontend unit/component tests exist. Coverage is limited to:
- E2E Playwright tests (4 UI scenarios, coarse-grained)
- Visual regression depends entirely on manual inspection

When the Next.js frontend is restored, component-level tests (React Testing Library or Vitest) should be added.

---

## LLM Response Parsing: JSON in String Format

**Severity: Low**

`_parse_response()` in `backend/app/llm/chat.py` calls `json.loads(raw)` where `raw` is `response.choices[0].message.content`. LiteLLM's structured output (`response_format=LLMResponse`) should return pre-validated JSON, but the fallback `_parse_response()` handles raw string just in case.

The `reasoning_effort="low"` parameter is passed — this is a Cerebras-specific parameter that may not be supported by other providers if the routing changes.

---

## `backend/app/market/stream.py` — Legacy/Orphaned File

**Severity: Low**

`backend/app/market/stream.py` appears to be a legacy SSE helper from an earlier architecture. The active SSE endpoint is `backend/app/api/stream.py` (registered in `create_app()`). The market-layer stream module may be dead code.

**Risk**: Confusion about which stream module is in use. The `api/stream.py` is the correct one.

---

## No Database Migration System

**Severity: Low (greenfield project)**

Schema is defined as SQL strings in `backend/app/db/schema.py` with `CREATE TABLE IF NOT EXISTS`. On schema changes:
- Adding a column requires manual migration or deleting the SQLite file
- No Alembic or equivalent migration tooling
- Acceptable for a demo/course project; not production-ready

---

## Docker: No Health Check Before Static Mount

**Severity: Informational**

The `STATIC_DIR` existence check in `main.py` is silent:
```python
if static_path.exists():
    app.mount("/", StaticFiles(...))
```
If `STATIC_DIR` is missing (e.g., frontend build failed), the app starts without serving the frontend, with no logged warning. Diagnostics could be clearer.

---

## E2E Tests: Hardcoded Port 8001

**Severity: Low**

`test/specs/smoke.spec.ts` hardcodes `const BASE = 'http://localhost:8001'`. The `start.sh` maps port 8000, not 8001. E2E tests require the container to be started with `-p 8001:8000` or the test config adjusted. This is noted in `test/playwright.config.ts` but creates a friction point.

---

## Watchlist Ticker Validation: No Symbol Validation

**Severity: Low**

Both the API (`POST /watchlist`) and LLM (`_validate_watchlist_changes()`) accept any non-empty uppercase string as a valid ticker. Invalid symbols (e.g., `FAKEXYZ`) get auto-generated GBM params in the simulator — they'll appear to stream prices but won't have real-world meaning. No validation against a known symbol list.

---

## No Rate Limiting or Auth

**Severity: Informational (by design)**

No authentication, no rate limiting, no session management. This is intentional per the spec (demo/course project, single-user). Not a concern for the current use case.
