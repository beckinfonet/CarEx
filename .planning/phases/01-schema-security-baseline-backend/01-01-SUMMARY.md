---
phase: 01-schema-security-baseline-backend
plan: 01
subsystem: database
tags: [mongoose, jest, supertest, mongodb-memory-server, moderation, append-only]

# Dependency graph
requires: []
provides:
  - "src/models/ scaffold inside backend-services/carEx-services with User, AdminUser, ModerationAction as importable modules"
  - "__tests__/moderation/ Jest test harness wired via mongodb-memory-server (no live Mongo required)"
  - "Append-only enforcement for ModerationAction at the Mongoose layer (six pre-hooks)"
  - "npm test script running Jest (replaces the error-stub)"
  - "Four-case append-only contract (ROADMAP Phase 1 success criterion #4)"
affects:
  - "01-02-PLAN.md (adds moderationStatus subdoc to src/models/User.js — this plan put it there)"
  - "01-03-PLAN.md (firebase-admin + verifyIdToken — imports AdminUser from src/models/)"
  - "01-04-PLAN.md (providerSnapshot extension — uses the Jest harness set up here)"
  - "01-05-PLAN.md (capability map + moderation service — tests land in this same __tests__/moderation/ directory)"
  - "01-06-PLAN.md (migration script — imports the extracted models)"
  - "All Phase 2+ backend work (endpoints reach ModerationAction via the model this plan created)"

# Tech tracking
tech-stack:
  added:
    - "jest@^29.7.0 (devDependency)"
    - "supertest@^7.2.2 (devDependency)"
    - "mongodb-memory-server@^10.4.3 (devDependency)"
  patterns:
    - "src/models/*.js one-model-per-file with explicit collection name via mongoose.model('Name', schema, 'collection_name')"
    - "Append-only Mongoose schemas via six pre-hooks (updateOne, updateMany, findOneAndUpdate, deleteOne, deleteMany, findOneAndDelete) that throw a shared Error instance"
    - "__tests__/<domain>/*.test.js conventions: mongodb-memory-server spun up in beforeAll, disconnected in afterAll, test expectations use rejects.toThrow(message)"

key-files:
  created:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/AdminUser.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/ModerationAction.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/ModerationAction.append-only.test.js"
  modified:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package.json"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package-lock.json"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js"

key-decisions:
  - "Kept Jest configuration inline in package.json rather than jest.config.js — plan explicitly permits either; inline keeps config in one place."
  - "Extracted userSchema and adminUserSchema verbatim — no field additions or default changes in this plan (moderationStatus subdoc deferred to 01-02 per D-11)."
  - "Left the pre-existing duplicate-email-index Mongoose warning on AdminUser alone — it was in the original inline schema and was preserved verbatim per the extraction mandate. Not a Rule 1 bug this plan introduced; not in scope."

patterns-established:
  - "RED → GREEN → REFACTOR TDD gate for model-behaviour work: failing test committed as test(scope), implementation as feat(scope), extraction as refactor(scope)"
  - "Append-only data pattern: six pre-hooks + one shared Error instance"
  - "Cross-repo execution pattern: backend code commits land on feat/moderation-baseline in sibling repo; planning SUMMARY.md lands in the mobile planning repo"

requirements-completed:
  - DATA-02

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 01 Plan 01: Modularization Skeleton Summary

**Extracted User + AdminUser to src/models/, added ModerationAction with six append-only pre-hooks, and wired Jest + mongodb-memory-server so the four-case append-only contract is locked in by CI.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-17T14:07:20Z
- **Completed:** 2026-04-17T14:10:37Z
- **Tasks:** 2
- **Files modified:** 7 (3 created in src/models/, 1 created in __tests__/moderation/, package.json + package-lock.json + server.js modified)

## Accomplishments

- Jest (v29), supertest (v7), and mongodb-memory-server (v10) installed as devDependencies; `npm test` now runs Jest instead of the error stub. Inline Jest config: `testEnvironment: node`, `testMatch: **/__tests__/**/*.test.js`, `testTimeout: 30000`.
- `src/models/ModerationAction.js` implements the D-15/D-16/D-17 spec verbatim: full schema, two compound indexes (`{targetUid:1,createdAt:-1}`, `{adminUid:1,createdAt:-1}`), collection name `moderation_actions`, and six pre-hooks (`updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`) each throwing `Error('ModerationAction is append-only')`.
- `src/models/User.js` and `src/models/AdminUser.js` are verbatim extractions of the inline blocks at server.js lines 128-146 and 200-207 respectively. Inline blocks removed from server.js; two new `require()`s added after `dotenv.config()`.
- `__tests__/moderation/ModerationAction.append-only.test.js` proves the contract with four test cases. All four pass against the in-memory Mongo from `mongodb-memory-server` — no live DB dependency for tests.
- ROADMAP Phase 1 success criterion #4 (ModerationAction tamper-resistance) is now satisfied and regression-guarded.

## Task Commits

Each task was committed atomically on `feat/moderation-baseline` in `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`:

1. **Task 1: Install test tooling and scaffold Jest configuration** — `73649a0` (chore)
2. **Task 2 RED: Failing append-only test for ModerationAction** — `372a8a8` (test)
3. **Task 2 GREEN: ModerationAction model with append-only guards** — `92231a5` (feat)
4. **Task 2 REFACTOR: Extract User + AdminUser models and wire server.js imports** — `27bd39f` (refactor)

TDD gate sequence intact: `test(...)` → `feat(...)` → `refactor(...)`.

**Plan metadata commit:** lands separately in the mobile planning repo via `gsd-tools commit` for the SUMMARY.md only.

## Files Created/Modified

Backend repo (`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`):

- `src/models/User.js` (created, 21 lines) — Mongoose User model extracted verbatim from server.js:128-146. Unchanged schema, unchanged enums, unchanged defaults. Exported as `module.exports = mongoose.model('User', userSchema)`.
- `src/models/AdminUser.js` (created, 11 lines) — Mongoose AdminUser model extracted verbatim from server.js:200-207. Preserves the `admin_users` collection name and the email unique index.
- `src/models/ModerationAction.js` (created, 27 lines) — New append-only model per D-15/D-16/D-17. Six pre-hooks share a single `APPEND_ONLY_ERR` instance. Collection name `moderation_actions`.
- `__tests__/moderation/ModerationAction.append-only.test.js` (created, 57 lines) — Jest test with `beforeAll` connect to `mongodb-memory-server`, `afterAll` disconnect/stop, and four `rejects.toThrow('ModerationAction is append-only')` assertions.
- `package.json` (modified) — Replaced error-stub test script with `"test": "jest"`, added `"test:watch": "jest --watch"`, added inline `"jest"` config block, added three devDependencies. No production dependency touched.
- `package-lock.json` (modified) — 306 new packages in lock. Audit: 12 vulns reported (1 low, 2 moderate, 8 high, 1 critical). These all come from transitive deps of the new test tooling chain (jest/supertest/mongodb-memory-server) and are confined to devDependencies — they ship nothing to prod. Tracked for a future deferred tech-debt milestone; out of scope per the scope boundary rule.
- `server.js` (modified, net -23 lines) — Removed inline `userSchema` + `const User = ...` block (lines 127-146) and inline `adminUserSchema` + `const AdminUser = ...` block (lines 200-207). Added two `require()` imports immediately after `dotenv.config()`:
  ```js
  const User = require('./src/models/User');
  const AdminUser = require('./src/models/AdminUser');
  ```
  `git diff --stat server.js` reports `1 file changed, 5 insertions(+), 28 deletions(-)`. All 32 existing `User` references and 10 existing `AdminUser` references (including `verifyAdminByUid` and the legacy `/api/admin/*` routes) are untouched and continue to work — Mongoose returns the same registered model by name (D-03).

Mobile planning repo (`/Users/beckmaldinVL/development/mobileApps/carEx/`):

- `.planning/phases/01-schema-security-baseline-backend/01-01-SUMMARY.md` (created — this file)

## server.js Diff Summary

```
server.js | 33 +++++----------------------------
 1 file changed, 5 insertions(+), 28 deletions(-)
```

- **Removed:** 23 lines of inline `userSchema` definition + `mongoose.model('User', userSchema)` line (server.js:127-146 in pre-edit)
- **Removed:** 8 lines of inline `adminUserSchema` definition + `adminUserSchema.index(...)` + `mongoose.model('AdminUser', ...)` line (server.js:200-207 in pre-edit)
- **Added:** 2 `require()` import lines at the top of the file after `dotenv.config()`
- **Added:** 2 breadcrumb comments replacing each removed block so future greppers find the new location
- **Preserved:** all other schemas (VehicleMake, VehicleModel, Car, Broker, LogisticsPartner, OTP, ServiceOrder) exactly as D-02 required; `verifyAdminByUid` helper, `seedSuperAdmin`, all routes, all middleware.

## Test Results

Exact output from `npm test` after the final commit:

```
> backend-services@1.0.0 test
> jest

PASS __tests__/moderation/ModerationAction.append-only.test.js
  ModerationAction — append-only
    ✓ updateOne throws (8 ms)
    ✓ findOneAndUpdate throws
    ✓ deleteOne throws (1 ms)
    ✓ findOneAndDelete throws

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        1.999 s
```

`node -c server.js` exits 0 (syntax check passes).
`node -e "require('./src/models/User'); require('./src/models/AdminUser')"` loads cleanly; both models register with the correct `modelName` and `collection.name`.

## TDD Gate Compliance

All TDD gates present in git history on `feat/moderation-baseline`:

1. **RED gate:** `372a8a8 test(moderation): add failing append-only test for ModerationAction` — test run confirmed to fail with `Cannot find module '../../src/models/ModerationAction'` (module didn't exist yet).
2. **GREEN gate:** `92231a5 feat(moderation): add ModerationAction model with append-only guards` — test run immediately after confirms 4/4 pass.
3. **REFACTOR gate:** `27bd39f refactor(moderation): extract User and AdminUser models to src/models/` — test run after refactor confirms 4/4 still pass; `node -c server.js` passes.

Fail-fast rule honored: RED was verified failing BEFORE the GREEN commit was authored.

## Decisions Made

- **Inline Jest config over separate jest.config.js** — plan explicitly allowed either. Chose inline (in package.json) to keep config colocated with scripts. No downstream cost; a Task-2 requirement for advanced config would have triggered a switch, but none was needed.
- **No schema changes during extraction** — the plan explicitly reserved `moderationStatus` (D-11) for Plan 01-02 and all other schema edits for later plans. Followed the verbatim-extraction mandate strictly.
- **Shared `APPEND_ONLY_ERR` constant** — matches the spec's example code. Keeps all six pre-hooks throwing the same instance, which is what the Jest `rejects.toThrow('ModerationAction is append-only')` matcher relies on.

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed, every acceptance-criteria command in the plan exits 0, and the verbatim schemas from the `<interfaces>` block were preserved unchanged.

## Issues Encountered

- **npm audit reports 12 vulnerabilities post-install.** All transitive through the new jest/supertest/mongodb-memory-server dev tree. Production dependencies are untouched. Out of scope for this plan per the scope boundary rule (these are not bugs introduced by the task; they are a known cost of the pinned major versions the plan specified). Logged here for awareness; addressing it would belong to a deferred tech-debt milestone or a future dependency refresh.
- **Pre-existing duplicate-index warning on AdminUser.email.** Mongoose prints "Duplicate schema index on {\"email\":1}" when the AdminUser model loads because the original inline schema declared `email: { unique: true }` AND `adminUserSchema.index({ email: 1 }, { unique: true })`. This predates this plan — the original server.js lines 200-207 had it. The plan's extraction mandate said "verbatim," so it was preserved. A future plan can collapse the redundancy without schema risk.

## Known Stubs

None. All three new model files and the test file are complete and self-sufficient.

## Threat Surface — No New Flags

The plan's `<threat_model>` covered T-01-01 through T-01-05. This plan mitigated T-01-01 and T-01-04 as planned (pre-hooks + the syntax-check gate). No new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries outside the planned surface were introduced.

## Next Phase Readiness

Plan 01-02 can proceed immediately:

- `src/models/User.js` exists and can be edited to add the `moderationStatus` subdoc (D-11).
- `__tests__/moderation/` directory exists and is wired to Jest + mongodb-memory-server — plan 01-02's `capabilities.test.js` slots straight in.
- `src/moderation/`, `src/security/`, and `scripts/` directories exist (empty) ready for plans 01-03 through 01-06 to populate.

Plans 01-03..06 unblocked on the scaffold front.

## Self-Check: PASSED

File existence:
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js`
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/AdminUser.js`
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/ModerationAction.js`
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/ModerationAction.append-only.test.js`

Commits exist on `feat/moderation-baseline`:
- FOUND: `73649a0` (Task 1 chore)
- FOUND: `372a8a8` (Task 2 RED test)
- FOUND: `92231a5` (Task 2 GREEN feat)
- FOUND: `27bd39f` (Task 2 REFACTOR)

Grep / behaviour assertions:
- PASS: `grep -q "require('./src/models/User')" server.js`
- PASS: `grep -q "require('./src/models/AdminUser')" server.js`
- PASS: `grep -q "ModerationAction is append-only" src/models/ModerationAction.js`
- PASS: `! grep -q "const userSchema = new mongoose.Schema" server.js`
- PASS: `! grep -q "const adminUserSchema = new mongoose.Schema" server.js`
- PASS: `npm test` — 4 passed, 4 total
- PASS: `node -c server.js` — syntax OK
- PASS: backend repo still on branch `feat/moderation-baseline`

---
*Phase: 01-schema-security-baseline-backend*
*Plan: 01 (Modularization skeleton)*
*Completed: 2026-04-17*
