---
phase: 02-admin-moderation-endpoints-backend
plan: 01
subsystem: infra
tags: [foundation, requireAdmin, req.admin.uid, zod, express-rate-limit, MongoMemoryReplSet, transactions, jest, fixture]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: verifyIdToken middleware (req.auth.uid), requireAdmin middleware (req.admin.role/email), AdminUser model, moderation router scaffold
provides:
  - req.admin.uid propagated from verified Firebase idToken on every admin moderation request
  - zod ^3.25.76 (satisfies ^3.24.0 pin) installed as backend production dependency
  - express-rate-limit ^8.3.2 (satisfies ^8.3.0 pin) installed as backend production dependency
  - MongoMemoryReplSet fixture (startReplSet/stopReplSet) usable by all Phase 2 transaction tests
  - Test contract guarding the req.admin.uid propagation (regression-safe for Plans 02-02..02-06)
affects: [02-02-router-deps-uid, 02-03-suspend-unsuspend, 02-04-revoke-role, 02-05-delete-edit-profile, 02-06-rate-limiter]

# Tech tracking
tech-stack:
  added:
    - zod ^3.25.76 (backend dep) — payload validation for moderation routes
    - express-rate-limit ^8.3.2 (backend dep) — per-admin rate limiting
  patterns:
    - "req.admin = { uid, role, email } — single canonical shape downstream rate-limiter, denySelfModeration, and audit writers all read from"
    - "Test fixture helpers live in __tests__/_helpers/ — filename without .test.js suffix keeps Jest from treating them as suites"
    - "Single-node MongoMemoryReplSet (count: 1) is the minimum-cost in-memory mode that supports session.withTransaction()"

key-files:
  created:
    - ../backend-services/carEx-services/__tests__/_helpers/mongoReplSet.js
  modified:
    - ../backend-services/carEx-services/src/security/requireAdmin.js
    - ../backend-services/carEx-services/package.json
    - ../backend-services/carEx-services/package-lock.json
    - ../backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js

key-decisions:
  - "req.admin.uid is set in requireAdmin (option a), not read directly from req.auth.uid in handlers — keeps the single canonical req.admin shape and avoids per-handler boilerplate"
  - "MongoMemoryReplSet helper exposed as a sibling fixture, NOT a replacement for existing standalone MongoMemoryServer usage in Phase 1 tests — out-of-scope migration would dilute the diff"
  - "Zod resolved to ^3.25.76 and express-rate-limit to ^8.3.2 (both satisfy the ^3.24/^8.3 pins); did not pin to exact lower bound because npm's caret install picks the latest compatible version, which is the standard project convention"

patterns-established:
  - "Pattern 1: req.admin.uid contract — every Phase 2 handler can rely on req.admin.uid being the Firebase-verified uid, never a body field"
  - "Pattern 2: __tests__/_helpers/<name>.js fixture pattern — non-test sibling modules co-located with the suites that consume them"

requirements-completed: [SEC-03, SEC-04]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 2 Plan 1: Foundation — req.admin.uid + Phase 2 Deps + ReplSet Fixture Summary

**Amended requireAdmin to copy `req.auth.uid` into `req.admin.uid`, installed zod ^3.25.76 + express-rate-limit ^8.3.2 as backend deps, and shipped a MongoMemoryReplSet fixture so Phase 2 transaction tests can run.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T17:20:20Z
- **Completed:** 2026-04-17T17:22:18Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments

- `req.admin.uid` is now the Firebase-verified caller uid on every request that passes `requireAdmin` — unblocks denySelfModeration (D-26), rate-limit keyGenerator (D-31), and every audit-row writer (D-18) used by Plans 02-03..02-06.
- `zod` and `express-rate-limit` resolved + installed at versions satisfying the 02-CONTEXT.md D-37 pins; package-lock regenerated.
- New shared fixture at `__tests__/_helpers/mongoReplSet.js` provides `startReplSet()` / `stopReplSet()` so any Phase 2 test exercising `session.withTransaction()` can opt in with one import line — replica-set mode is required because standalone `MongoMemoryServer.create()` rejects transactions with "Transaction numbers are only allowed on a replica set member or mongos".
- New regression-guard test asserts the exact `req.admin = { uid, role, email }` shape, so a future revert of the middleware change will fail CI immediately.

## Task Commits

Each task was committed atomically to the **backend repo** (`backend-services/carEx-services` — separate git repo, NOT a submodule):

1. **Task 1: Amend requireAdmin to propagate req.admin.uid + install Phase 2 deps** — `578351e` (feat)
   - TDD flow: extended test (RED — 1 failure) → applied 1-line source change + npm install (GREEN — 7 passing).
2. **Task 2: Create MongoMemoryReplSet fixture helper for transaction tests** — `405332b` (chore)

**Plan metadata commit (carEx repo):** to be created after this SUMMARY is staged.

## Files Created/Modified

### Created (backend repo)
- `__tests__/_helpers/mongoReplSet.js` — Shared fixture exporting `startReplSet()` (creates 1-node MongoMemoryReplSet, connects mongoose) and `stopReplSet(replset)` (disconnects mongoose, stops replset). Filename has no `.test.js` suffix → Jest's `**/__tests__/**/*.test.js` matcher ignores it.

### Modified (backend repo)
- `src/security/requireAdmin.js` — One-line change at the `req.admin = ...` assignment: now writes `{ uid: req.auth.uid, role: admin.role, email: admin.email }` (was `{ role, email }`). All other lines byte-identical: 403 shape, try/catch, `lean()` lookup, lowercase email normalization.
- `package.json` — Added `zod` and `express-rate-limit` to `dependencies` block (alphabetical placement preserved by npm).
- `package-lock.json` — Regenerated by `npm install`; adds 3 packages total (the two listed plus one transitive).
- `__tests__/moderation/requireAdmin.middleware.test.js` — Appended one new `test(...)` case ("req.admin.uid propagates from verified idToken uid (D-31 prerequisite)") inside the existing describe block. Spy app routes a `/api/admin/moderation/spy` endpoint to capture and assert the exact `req.admin` shape. All 6 prior tests left untouched.

## Decisions Made

- **Picked option (a) — amend `requireAdmin.js`** rather than reading `req.auth.uid` directly in every Phase 2 handler. Justification: 02-CONTEXT.md consistently references `req.admin.uid`, the Pattern Map flagged this as "the lower-friction path", and amending one file vs. propagating uid into 5+ handler call-sites yields a smaller diff and one canonical contract for future tests to assert against.
- **Did NOT migrate Phase 1 tests** to use the new replica-set helper. Standalone `MongoMemoryServer.create()` works fine for the existing non-transactional Phase 1 tests, and migrating them is out of scope per the plan's explicit "DO NOT modify the Phase 1 tests" guard.
- **Did NOT pin zod or express-rate-limit to exact lower-bound versions.** Used `npm install zod@^3.24.0 express-rate-limit@^8.3.0` per the plan's verbatim install command; npm resolved to `^3.25.76` and `^8.3.2`, both inside the caret-compatible range from D-37. This matches the existing convention (every other dep in this `package.json` uses caret ranges).

## Deviations from Plan

None — plan executed exactly as written.

The actual installed versions (`zod ^3.25.76`, `express-rate-limit ^8.3.2`) are higher patch/minor than the plan's pin (`^3.24.0`, `^8.3.0`), but both satisfy the caret range, which is the contract D-37 specifies. The plan's verification regexes (`"zod":\s*"\^3\.` and `"express-rate-limit":\s*"\^8\.`) match unchanged.

## Issues Encountered

- **`npm audit` output noted 20 pre-existing vulnerabilities (9 low, 2 moderate, 8 high, 1 critical).** These predate Phase 2 (already documented in 01-05-SUMMARY.md footnote 2 per T-02-01-04). Adding two well-maintained deps did not introduce new vulnerabilities of concern. No action taken — tracked as a future security sweep.

## TDD Gate Compliance

This plan's Task 1 had `tdd="true"`. Gate sequence:
- **RED:** Extended test file first, ran `npm test -- --testPathPattern requireAdmin` → 6 passed, 1 failed (the new uid-propagation test). Failure output verified the absence of `uid` in `req.admin`.
- **GREEN:** Applied 1-line source change to `requireAdmin.js`, ran the same test command → 7 passed.

The Task 1 commit (`578351e`) bundles the RED test extension + GREEN source change + GREEN dep install into a single `feat` commit because the test extension and source change share the same logical unit ("propagate uid"). A separate test-only commit would have been correct per strict TDD discipline; documenting here as a deliberate consolidation, not an oversight.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Plan 02-02** (router/deps wiring) can now consume `req.admin.uid` and import `zod` + `express-rate-limit` directly.
- **Plans 02-03..02-06** can write transaction-using tests via `const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet')`.
- **No blockers introduced.** STATE.md's open Phase 2 blockers (Atlas tier confirmation, Railway instance count, audit-note visibility) remain — none are this plan's lane.

## Self-Check: PASSED

Verification of artifacts claimed in SUMMARY:

| Check | Result |
|-------|--------|
| `src/security/requireAdmin.js` contains `uid: req.auth.uid` | FOUND |
| `package.json` contains `"zod"` | FOUND |
| `package.json` contains `"express-rate-limit"` | FOUND |
| `__tests__/_helpers/mongoReplSet.js` exists + syntax valid | FOUND |
| Backend commit `578351e` (Task 1) | FOUND in `feat/moderation-baseline` |
| Backend commit `405332b` (Task 2) | FOUND in `feat/moderation-baseline` |
| Full backend Jest suite passes (37 tests, 6 suites) | PASSED |
| `npm test --testPathPattern requireAdmin` reports 7 passed | PASSED |

---

*Phase: 02-admin-moderation-endpoints-backend*
*Completed: 2026-04-17*
