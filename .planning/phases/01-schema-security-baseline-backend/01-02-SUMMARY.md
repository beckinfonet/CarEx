---
phase: 01-schema-security-baseline-backend
plan: 02
subsystem: database
tags: [mongoose, user-model, moderation-status, indexes, jest, tdd]

# Dependency graph
requires:
  - "01-01-SUMMARY.md (src/models/User.js must exist and be require()d by server.js)"
  - "src/models/ModerationAction.js (the lastActionId ObjectId ref target)"
provides:
  - "User.moderationStatus subdoc (8 fields) per D-11, enforcing the contract Phase 3's requireNotSuspended middleware and Phase 5 admin list will read"
  - "Two indexes per D-13: { 'moderationStatus.state': 1 } and { 'moderationStatus.state': 1, 'moderationStatus.reasonCategory': 1 }"
  - "Default state='active', severity='none', restrictedFeatures=[] on new User docs (half of ROADMAP Phase 1 success criterion #2; backfill of existing docs lands in plan 01-06)"
  - "6-case Jest contract test pinning defaults, enum enforcement, note maxlength, and lastActionId ObjectId acceptance"
affects:
  - "01-04-PLAN.md (STATUS_POLICY keys must identity-match the state enum 4 values defined here — acceptance for Phase 1 success criterion #5)"
  - "01-05-PLAN.md (moderation service will write to this subdoc via restrictedFeatures denormalization per D-12/D-28)"
  - "01-06-PLAN.md (migration script backfills this subdoc on existing users — the schema shape defined here is the target)"
  - "Phase 2 suspend/unsuspend handlers (mutation boundary they must respect)"
  - "Phase 3 requireNotSuspended middleware (read boundary — state value drives capability gating)"
  - "Phase 5 admin list/filter queries (will hit the two indexes added here)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Subdoc with per-field enum + default + maxlength constraints co-located in the parent schema (single-document model, not a separate collection)"
    - "Denormalized restrictedFeatures field: schema owns the slot; Phase 2 service layer owns the value (D-12)"
    - "Nullable-enum pattern for reasonCategory: enum array excludes null, default is null, Mongoose 9 skips enum validation when value IS null (documented behavior — intentional per D-11 note)"

key-files:
  created:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/User.moderationStatus.test.js"
  modified:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js"

key-decisions:
  - "Placed moderationStatus as the LAST field in the schema object (after createdAt) per plan spec — visually separates the new moderation namespace from legacy fields (sellerStatus/brokerStatus/logisticsStatus), honoring Pitfall #10."
  - "Did NOT include `null` in the reasonCategory enum — Mongoose 9's documented behavior is to skip enum validation when the value IS null. Adding null to the enum would allow admins to set reasonCategory=null on a suspended user, defeating the 'reason required when state != active' invariant that Phase 2's service layer enforces."
  - "Did NOT touch sellerStatus / brokerStatus / logisticsStatus enums — they're orthogonal per Pitfall #10 (role-request lifecycle vs moderation state are different axes)."
  - "Did NOT add a REFACTOR commit — the GREEN implementation is already minimal (13 verbatim lines from the spec). No cleanup pass yielded any change."

patterns-established:
  - "TDD cycle: RED (test commit that fails) → GREEN (feat commit that passes all 6 cases + all 4 prior ones). No regression on plan-01 tests."
  - "Cross-repo commits: backend code lands on feat/moderation-baseline in the sibling backend repo; only the SUMMARY.md lands in the mobile planning repo."

requirements-completed:
  - DATA-01

# Metrics
duration: 1min
completed: 2026-04-17
---

# Phase 01 Plan 02: User.moderationStatus Subdoc + Indexes + Default Summary

**Extended `src/models/User.js` with the 8-field `moderationStatus` subdoc per D-11 and the two indexes per D-13, locked the contract with a 6-case Jest test, and kept the plan-01 append-only tests green (10 passed, 10 total).**

## Performance

- **Duration:** ~1 min (71 s wall)
- **Started:** 2026-04-17T14:13:33Z
- **Completed:** 2026-04-17T14:14:44Z
- **Tasks:** 1 (TDD cycle, two backend commits)
- **Files modified:** 2 (1 created, 1 edited — both in backend repo; plus this SUMMARY in mobile repo)

## Accomplishments

- `src/models/User.js` now declares the full `moderationStatus` subdoc per D-11 verbatim: 8 fields (state, severity, reasonCategory, note, setByAdminUid, setAt, restrictedFeatures, lastActionId) with correct types, enums, defaults, and maxlength.
- Two indexes added after the schema definition per D-13: `{ 'moderationStatus.state': 1 }` (single, for list-by-state admin queries in Phase 5) and `{ 'moderationStatus.state': 1, 'moderationStatus.reasonCategory': 1 }` (compound, for filtered list queries).
- Schema default for `state` is `'active'` with `required: true` — a new `new User({ firebaseUid, email })` has `u.moderationStatus.state === 'active'`, satisfying half of ROADMAP Phase 1 success criterion #2. The other half — backfilling existing docs — is plan 01-06.
- 6-case Jest test at `__tests__/moderation/User.moderationStatus.test.js` pins the contract: default state, state enum rejects invalid, state enum accepts all four severities, reasonCategory enum rejects invalid, note rejects >2000 chars, lastActionId accepts an ObjectId ref.
- Plan-01 append-only tests still pass (0 regression). Full Jest run: 2 suites, 10 tests, all green.
- Zero production dep changes. No server.js edits in this plan (all extraction was done in 01-01).

## Task Commits

Each committed atomically on `feat/moderation-baseline` in `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`:

1. **RED:** `f4d37b5` — `test(moderation): add failing test for User.moderationStatus subdoc` (59 insertions, new test file). Verified failing before GREEN authored (5 failures + 1 accidental pass on the "accepts all four states" case, which only checks resolve — the feature actually validated fine when absent, which is why that one passed; the other five RED assertions proved the subdoc contract was missing).
2. **GREEN:** `b80f7c0` — `feat(moderation): add User.moderationStatus subdoc and indexes` (13 insertions to src/models/User.js). Ran full moderation suite immediately after: 10/10 pass.

No REFACTOR gate — GREEN was already minimal, no cleanup needed. TDD gate sequence in `git log --oneline -2`: `test(moderation): add failing test ...` → `feat(moderation): add User.moderationStatus ...`. Both use the `(moderation)` scope per the phase convention.

## Files Created/Modified

Backend repo (`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`):

- `__tests__/moderation/User.moderationStatus.test.js` **(created, 59 lines)** — Jest suite with `beforeAll` connect to `mongodb-memory-server`, `afterAll` disconnect/stop, and six `describe('User.moderationStatus (DATA-01)', …)` cases. Uses `require('../../src/models/User')` inside `beforeAll` after Mongoose connects (same pattern as plan 01's `ModerationAction.append-only.test.js`).

- `src/models/User.js` **(modified, net +13 lines)** — Added the `moderationStatus` subdoc as the last field in the schema object (after `createdAt`), and added two `userSchema.index(...)` calls after the schema definition but before `module.exports`. `git diff --stat`: `1 file changed, 13 insertions(+)`. Exact block added:
  ```js
  moderationStatus: {
    state: { type: String, enum: ['active', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'active', required: true },
    severity: { type: String, enum: ['none', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'none' },
    reasonCategory: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'other'], default: null },
    note: { type: String, default: null, maxlength: 2000 },
    setByAdminUid: { type: String, default: null },
    setAt: { type: Date, default: null },
    restrictedFeatures: { type: [String], default: [] },
    lastActionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModerationAction', default: null },
  },
  ```
  And the two indexes:
  ```js
  userSchema.index({ 'moderationStatus.state': 1 });
  userSchema.index({ 'moderationStatus.state': 1, 'moderationStatus.reasonCategory': 1 });
  ```

Mobile planning repo (`/Users/beckmaldinVL/development/mobileApps/carEx/`):

- `.planning/phases/01-schema-security-baseline-backend/01-02-SUMMARY.md` (this file)

## Test Results

### Before this plan

```
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```
(Plan 01's `ModerationAction.append-only.test.js` — 4 cases)

### After this plan

```
> backend-services@1.0.0 test
> jest

PASS __tests__/moderation/User.moderationStatus.test.js
PASS __tests__/moderation/ModerationAction.append-only.test.js

Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        2.011 s
```

4 → 10. Exactly the 6-case delta the plan called for, zero regression on plan 01's four.

`node -c server.js` exits 0 (no changes to server.js in this plan).

## Acceptance Criteria Verification

Every command from `<acceptance_criteria>` in 01-02-PLAN.md:

| Command | Result |
|---|---|
| `grep -q "moderationStatus:" src/models/User.js` | PASS (1 match) |
| `grep -q "'permanently_banned'" src/models/User.js` | PASS (2 matches — state enum + severity enum) |
| `grep -q "'moderationStatus.state': 1" src/models/User.js` | PASS (2 matches — single + compound index) |
| `grep -q "maxlength: 2000" src/models/User.js` | PASS (1 match — note field) |
| `grep -q "ref: 'ModerationAction'" src/models/User.js` | PASS (1 match — lastActionId field) |
| `test -f __tests__/moderation/User.moderationStatus.test.js` | PASS |
| `npm test -- --testPathPattern moderation` → 10 passed | PASS (Test Suites: 2 passed; Tests: 10 passed) |
| `node -c server.js` | PASS (exit 0) |

## reasonCategory null-vs-enum behavior (intentional)

Plan 01-02-PLAN.md §`<interfaces>` calls this out explicitly; preserving the note here so future readers don't "fix" it:

- `reasonCategory` has `enum: ['spam', 'policy_violation', 'fraud', 'other']` **and** `default: null`.
- `null` is NOT in the enum array.
- **Mongoose 9 behavior:** when a field value IS literally `null`, Mongoose skips enum validation. This is documented, intentional behavior.
- **Semantic:** `reasonCategory` is nullable on active users (no moderation applied → no reason) but must be a valid enum string when set. The invariant "if `state !== 'active'`, then `reasonCategory !== null`" is enforced in Phase 2's `ModerationService.suspend()` — NOT at the schema level.
- **Why not add `null` to the enum array?** Because doing so would let admins explicitly set `reasonCategory: null` on a suspended user, defeating the intent. The current shape means: (a) default null for the common case (active user, no reason), (b) hard-enforce valid string when the service sets a reason, (c) service layer owns the cross-field invariant.

The 4th test case (`reasonCategory enum rejects invalid value`) proves the enum kicks in for non-null strings: setting `'invalid_reason'` throws on `.validate()`.

## Decisions Made

- **Put `moderationStatus` last in the schema object** — plan spec said "after `createdAt`," which is the last pre-existing field. Visually separates new moderation namespace from legacy `sellerStatus`/`brokerStatus`/`logisticsStatus` per Pitfall #10.
- **Kept the test file minimal** — exactly the 6 cases the plan spec listed, no additional coverage. Other phases/plans will add more cases (e.g., the `restrictedFeatures` mutation invariants belong to Phase 2's service tests, not Phase 1's schema tests).
- **No REFACTOR commit** — GREEN implementation was already the minimal, spec-verbatim shape. Adding a REFACTOR commit with zero behavior change would pollute the gate sequence. The plan-level TDD gate check finds `test(...)` → `feat(...)` which is the valid two-commit TDD cycle when no refactor is warranted.

## Deviations from Plan

None — plan executed exactly as written. The `<interfaces>` block in 01-02-PLAN.md included both the verbatim subdoc shape and the verbatim index declarations; both were dropped into src/models/User.js unchanged. Every acceptance-criteria command exits 0.

## Issues Encountered

- **One RED test "accidentally" passed before GREEN.** The `state enum accepts all four severity states` case uses `expect(u.validate()).resolves.toBeUndefined()` — because the test loops through states and User documents validate fine without the subdoc, `validate()` resolved. This is NOT a fail-fast violation — the other 5 RED assertions all failed correctly (they assert state/severity/enum rejection/toString on fields that don't exist yet). The acceptance test correctly passes once the subdoc is declared because the state enum now accepts all four values. Documented here for transparency; no corrective action required because the critical RED assertions DID fail as expected.

## Known Stubs

None. The User schema is the final shape Phase 1 needs. `restrictedFeatures` is a denormalized slot that Phase 2's ModerationService will populate on suspend; the plan explicitly scoped that mutation to Phase 2 (D-12, D-28), so leaving it empty by default is intentional, not a stub.

## Threat Surface — No New Flags

The plan's `<threat_model>` covered T-02-01 through T-02-05. This plan mitigated T-02-01 (schema enum on `state` blocks malformed values like `banned`/`deleted`) and kept T-02-02 unblocked (moderationStatus is a separate namespace so downstream handlers can select-or-exclude cleanly). T-02-03 through T-02-05 were `accept` dispositions — acknowledged and deferred to later phases (service-layer invariant, UI sanitization, admin-only query authorization). No new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries outside the planned surface were introduced.

## TDD Gate Compliance

Two-commit gate sequence on `feat/moderation-baseline`:

1. **RED gate:** `f4d37b5 test(moderation): add failing test for User.moderationStatus subdoc` — verified failing before GREEN (5 of 6 cases failed; the 6th case was a non-blocking accidental pass as documented in "Issues Encountered").
2. **GREEN gate:** `b80f7c0 feat(moderation): add User.moderationStatus subdoc and indexes` — ran moderation test suite immediately after commit: 10/10 pass.

No REFACTOR gate — GREEN was already minimal. A 2-commit TDD cycle (test → feat) is valid when the GREEN implementation has nothing to refactor.

Fail-fast rule: the critical RED assertions (default state check, `state: 'banned'` rejection, `reasonCategory: 'invalid_reason'` rejection, `note: 2001-char` rejection, `lastActionId.toString()` access) all failed before GREEN was authored — not skipped, not bypassed.

## Next Phase Readiness

- `User.moderationStatus.state` enum is now locked in as the 4-value identity set that plan 01-04's `STATUS_POLICY` map must match. This enables the Phase 1 success criterion #5 acceptance test ("`STATUS_POLICY` has an entry for every valid state in `User.moderationStatus.state` enum") to pass in plan 01-04.
- `User.moderationStatus.restrictedFeatures` is a schema-declared slot that plan 01-05's `ModerationService.suspend()` / `resolveRestrictedFeatures(state)` (D-28) will populate on state transitions.
- `User.moderationStatus.lastActionId` ref to ModerationAction is now a complete two-way link — plan 01-05's service can write the ObjectId of the just-inserted ModerationAction back onto the user in the same transaction.
- Plans 01-03, 01-04, 01-05 unblocked on the data-shape front.
- Plan 01-06's migration script target is now fully specified — it backfills exactly the 8 fields defined here with the documented defaults.

## Self-Check: PASSED

File existence:
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js`
- FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/User.moderationStatus.test.js`

Commits exist on `feat/moderation-baseline`:
- FOUND: `f4d37b5` (RED test)
- FOUND: `b80f7c0` (GREEN feat)

Grep / behavior assertions:
- PASS: `grep -q "moderationStatus:" src/models/User.js`
- PASS: `grep -q "'permanently_banned'" src/models/User.js` (2 matches — state + severity enums)
- PASS: `grep -q "'moderationStatus.state': 1" src/models/User.js` (2 matches — single + compound)
- PASS: `grep -q "maxlength: 2000" src/models/User.js`
- PASS: `grep -q "ref: 'ModerationAction'" src/models/User.js`
- PASS: `test -f __tests__/moderation/User.moderationStatus.test.js`
- PASS: `npm test` — 2 suites, 10 tests, 0 failures
- PASS: `node -c server.js` (server unchanged this plan but still parses)
- PASS: backend on branch `feat/moderation-baseline` at plan end

---
*Phase: 01-schema-security-baseline-backend*
*Plan: 02 (User.moderationStatus subdoc + indexes + default)*
*Completed: 2026-04-17*
