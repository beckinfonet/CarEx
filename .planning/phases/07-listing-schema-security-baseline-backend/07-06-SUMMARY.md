---
phase: 07-listing-schema-security-baseline-backend
plan: 06
subsystem: database
tags: [mongodb, mongoose, migration, backfill, indexes, ldata-04, idempotent, append-only]

requires:
  - phase: 07-listing-schema-security-baseline-backend
    provides: "Car.status field + { sellerId: 1, status: 1 } compound index declared (Plan 07-01)"
  - phase: 07-listing-schema-security-baseline-backend
    provides: "ListingModerationAction model with 3 audit indexes declared (Plan 07-02)"
provides:
  - "Idempotent migration script (scripts/migrate-listing-moderation.js) that backfills Car.status='active' and creates Phase 7 indexes"
  - "Extended ensureBaseline.js with log-only Car.status drift detection at server startup"
  - "Jest in-tree proof of D-16 invariants (pre-count == post-count, zero missing-status post-run) + D-18 idempotency"
affects: [phase-09-enforcement, phase-11-buyer-banner, railway-deploy]

tech-stack:
  added: []
  patterns:
    - "Pattern F migration discipline: shebang + dotenv + idempotent filter + dual exit codes (1=uncaught, 2=D-16 invariant fail) + require.main guard so tests can import exports without triggering main()"
    - ".collection.deleteMany() escape hatch for cleanup of append-only Mongoose models in tests (bypasses pre-hooks via the native MongoDB driver)"

key-files:
  created:
    - "../backend-services/carEx-services/scripts/migrate-listing-moderation.js"
    - "../backend-services/carEx-services/__tests__/listing-moderation/migrate-listing-moderation.test.js"
  modified:
    - "../backend-services/carEx-services/src/security/ensureBaseline.js"

key-decisions:
  - "Migration is one-off operator-invoked Node script (not boot-time auto-migrate) per D-17 safety rationale"
  - "Both backfill ($exists:false filter) AND ensureIndexes() are independently idempotent — script is safe to re-run"
  - "ensureBaseline extended in place, not forked — User.countDocuments check left byte-identical to preserve v1.0 contract"

patterns-established:
  - "Pattern F migration discipline (Phase 7 LDATA-04 application of v1.0 D-29 / D-31)"
  - "Append-only model test cleanup via .collection.deleteMany() native driver escape hatch (D-19 + Plan 07-02 D-11 interaction)"

requirements-completed: [LDATA-04]

duration: 18min
completed: 2026-05-28
---

# Phase 7 Plan 6: LDATA-04 Migration Substrate Summary

**Idempotent migration script + ensureBaseline drift detection + jest in-tree proof that Car.status backfill preserves pre/post counts and leaves pre-existing non-default values untouched**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-28T (sequential executor)
- **Completed:** 2026-05-28
- **Tasks:** 2
- **Files modified:** 3 (2 created in backend, 1 modified in backend; 1 SUMMARY in mobile)

## Accomplishments

- `scripts/migrate-listing-moderation.js` — Pattern F-compliant one-off Node script with `backfillListings()` + `ensureIndexes()` exports, D-16 hard invariant check (`process.exit(2)` if any car still missing `status` post-run), and `require.main === module` guard so the jest test can import the exports without triggering `process.exit()`
- `src/security/ensureBaseline.js` — extended in place with a second `countDocuments` check on `Car.status`; existing `User.moderationStatus.state` check + log/warn shape + function signature + single `module.exports` line preserved byte-identical
- `__tests__/listing-moderation/migrate-listing-moderation.test.js` — 4 tests proving: (a) 7-of-10 backfill correctness with 3 pre-suspended docs untouched, (b) D-16 invariants (post-count == pre-count == 10, zero missing-status), (c) D-18 idempotency (second run returns 0), (d) both new Car indexes + all 3 audit indexes created by `ensureIndexes()`

## Task Commits

Backend repo (`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`):

1. **Task 1: migrate-listing-moderation.js + ensureBaseline.js extension** — `74f7571` (feat)
2. **Task 2: migrate-listing-moderation.test.js** — `ea82727` (test)

Mobile repo plan-docs commit (this commit, tracked by orchestrator).

## Files Created/Modified

- `../backend-services/carEx-services/scripts/migrate-listing-moderation.js` (NEW) — Operator-invoked migration. Backfills every `Car` doc lacking `status` with `status: 'active'` via `Car.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } })`, then `Car.syncIndexes() + ListingModerationAction.syncIndexes()`, then D-16 invariant check.
- `../backend-services/carEx-services/src/security/ensureBaseline.js` (MODIFIED) — Added `const Car = require('../models/Car');` and a `pendingListings = await Car.countDocuments({ status: { $exists: false } })` check inside the existing try block after the User check. Docstring updated to mention both `migrate-moderation.js` and `migrate-listing-moderation.js`.
- `../backend-services/carEx-services/__tests__/listing-moderation/migrate-listing-moderation.test.js` (NEW) — MongoMemoryServer + raw-driver seeded docs + assertions on `backfillListings()` return value, post-count equality, zero missing-status post-run, idempotency on rerun, and index creation on both collections.

## Decisions Made

None beyond the plan as written. D-15, D-16, D-17, D-18 from `07-CONTEXT.md` are followed verbatim:

- **D-15 / Pattern F:** Script structure mirrors v1.0 `migrate-moderation.js` (shebang, dotenv, mongoose, model imports, `backfillListings` + `ensureIndexes` + `main`, `require.main === module` guard, named exports).
- **D-16 hard merge-gate:** `stillMissing = Car.countDocuments({ status: { $exists: false } })` after backfill; if `> 0`, log error and `process.exit(2)`. Test asserts `expect(stillMissing).toBe(0)` after running `backfillListings()` on the 10-doc seed.
- **D-17 safety:** `ensureBaseline` logs only — never calls `await migrate(...)` or `return migrate(...)`. Anti-pattern grep `grep -cE "(await|return)[[:space:]]+.*migrate" src/security/ensureBaseline.js` returns 0 as required.
- **D-18 idempotency:** The `{ status: { $exists: false } }` filter matches zero docs on rerun; Test 2 asserts `expect(second).toBe(0)`. Pre-existing non-default values (e.g., `status: 'suspended'`) are NOT mutated; Test 1 asserts `Car.countDocuments({ status: 'suspended' })` remains 3.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All grep acceptance criteria pass on first write; jest run is 4/4 green on first execution.

One sanity note on the Task 1 grep acceptance run: the shell-side grep for `User.countDocuments({ 'moderationStatus.state': { $exists: false } })` initially appeared to return 0 because zsh expanded `$exists` as an empty variable in the unquoted grep pattern. Re-running with `grep -cF` (fixed-string) confirms the line is preserved byte-identical with count 1. The pattern-preservation contract is satisfied; the apparent miss was a shell-quoting artifact in the acceptance command, not a missing line in the file.

## User Setup Required

None — no external service configuration required.

The production-deploy step is operator-driven and intentionally out of band per `07-CONTEXT.md` §"Migration / Backfill":

1. Backend `main` merge → Railway picks up the deploy.
2. On boot, `ensureBaseline()` logs `[Baseline] N listings missing status — run: node scripts/migrate-listing-moderation.js` if any docs lack the field.
3. Operator runs `node scripts/migrate-listing-moderation.js` in the Railway shell.
4. Script exits 0; next boot's `ensureBaseline()` logs `[Baseline] All listings have status.`

Per `[[backend_deploy_gotcha]]`, the migration must land on backend `main` (not a feature branch) before mobile assumes the field is populated. The in-tree jest proof here is the CI-side mechanical verification; the manual Railway-side run is the production-side verification.

## Next Phase Readiness

- All four Phase 7 ROADMAP success criteria are now mechanically deliverable. Criterion #1 ("Every existing listing in the DB has `status: 'active'` after the migration runs and the pre-migration count equals the post-migration count") is locked by Test 1's `expect(postCount).toBe(preCount)` + `expect(stillMissing).toBe(0)` invariants.
- Phase 9 (read-time hide hooks + status-aware listing-detail GET) can ride atop the populated `status` field with confidence: every existing `Car` doc will carry the field after the operator runs the script, and the `{ status: 1 }` + `{ sellerId: 1, status: 1 }` indexes are pre-built (no first-query index-build cost).
- Phase 8 (admin moderation endpoint handlers) can write `ListingModerationAction` rows with confidence that the 3 audit indexes are pre-built and the append-only invariants are locked (Plan 07-02 + this plan's index sync).

## Threat Surface Scan

No new security-relevant surface introduced beyond the plan's `<threat_model>`. The migration script is operator-invoked (no new HTTP endpoint), and `ensureBaseline` is log-only (no new trust boundary).

## Self-Check: PASSED

Verified files exist and commits landed:

```
FOUND: ../backend-services/carEx-services/scripts/migrate-listing-moderation.js
FOUND: ../backend-services/carEx-services/src/security/ensureBaseline.js (modified)
FOUND: ../backend-services/carEx-services/__tests__/listing-moderation/migrate-listing-moderation.test.js
FOUND commit: 74f7571 (backend repo, feat 07-06)
FOUND commit: ea82727 (backend repo, test 07-06)
```

Jest: `4 passed, 4 total` on `__tests__/listing-moderation/migrate-listing-moderation.test.js`.

All grep acceptance criteria from PLAN.md Tasks 1 and 2 pass.

---
*Phase: 07-listing-schema-security-baseline-backend*
*Completed: 2026-05-28*
