# Review Findings

## 1. `.claude/settings.json` now triggers a Codex review on every Claude stop
Severity: high

The new `Stop` hook uses an empty `matcher`, so it fires for every Claude stop event and runs `codex exec "Review changes since last commit..."` unconditionally. That makes ordinary Claude usage rewrite `planning/REVIEW.md` as a side effect, even when no review was requested. The same edit also replaced the previous `enabledPlugins` block instead of extending it, so the earlier plugin configuration is no longer present.

References:
- `.claude/settings.json:2`
- `.claude/settings.json:5`
- `.claude/settings.json:9`

## 2. The new planning docs are presented as current implementation references, but they point to files that do not exist in this checkout
Severity: high

`PLAN.md`, `MARKET_INTERFACE.md`, and `MARKET_SIMULATOR.md` describe concrete modules and paths such as `backend/app/db/`, `backend/app/main.py`, `backend/app/routes/stream.py`, `backend/app/market/gbm.py`, `backend/app/market/seed_data.py`, top-level `scripts/`, top-level `db/`, `Dockerfile`, and `docker-compose.yml`. Those locations are not present in the repository today. The actual backend layout includes files like `backend/app/market/stream.py`, `backend/app/market/seed_prices.py`, and tests under `backend/tests/`. Because `PLAN.md` explicitly says agents should treat these docs as the shared contract, this drift is likely to misdirect follow-up implementation work.

References:
- `planning/PLAN.md:91`
- `planning/PLAN.md:95`
- `planning/PLAN.md:100`
- `planning/PLAN.md:102`
- `planning/PLAN.md:103`
- `planning/MARKET_INTERFACE.md:357`
- `planning/MARKET_INTERFACE.md:420`
- `planning/MARKET_INTERFACE.md:469`
- `planning/MARKET_INTERFACE.md:470`
- `planning/MARKET_SIMULATOR.md:374`
- `planning/MARKET_SIMULATOR.md:375`
- `backend/app/market/stream.py:1`
- `backend/app/market/simulator.py:14`

## 3. The Docker persistence story is inconsistent between the updated README and plan
Severity: medium

The README now shows a named-volume setup with `docker run -v finally-data:/app/db ...`, but `PLAN.md` still says the project-root `db/` directory maps to `/app/db` and describes that directory as the runtime mount target. Those are different persistence models with different operational behavior. This matters because it changes where the SQLite database actually lives and what the start/stop scripts should manage.

References:
- `README.md:31`
- `README.md:32`
- `planning/PLAN.md:100`
- `planning/PLAN.md:113`
- `planning/PLAN.md:399`
- `planning/PLAN.md:402`
- `planning/PLAN.md:405`

## Open Questions

- Should the review hook be scoped to an explicit command or workflow instead of every Claude `Stop` event?
- Was removing the previous `enabledPlugins` configuration intentional?
- Are `README.md` and the planning docs meant to describe the current repository or a future target state? If they are future-state docs, they should be labeled that way.
