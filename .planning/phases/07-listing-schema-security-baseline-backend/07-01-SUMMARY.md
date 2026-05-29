---
phase: 07-listing-schema-security-baseline-backend
plan: 01
subsystem: backend-data-model
tags: [schema, mongoose, audit, moderation, listing, LDATA-01, LDATA-02]
dependency_graph:
  requires:
    - "../backend-services/carEx-services/src/models/Car.js (pre-existing schema + pre(/^find/) hook preserved byte-identical per D-02)"
    - "mongodb-memory-server (devDep, used by test isolation per D-20)"
    - "mongoose (Schema + path.enumValues + maxlength + validate)"
  provides:
    - "Car.status: 'active'|'suspended'|'archived'|'deleted' field with default 'active' + required: true + inline single-field index (LDATA-01)"
    - "Car.moderationReason / moderationNote / moderatedBy / moderatedAt / lastEditedBy / lastEditedAt (LDATA-01 + LADM-01 audit attribution)"
    - "carSchema.index({ sellerId: 1, status: 1 }) compound index for admin 'deleted listings' filter (LUI-04 prerequisite, Phase 10)"
    - "CAUTION banner comment + D-08 lock test asserting listingStatus vs status enums are disjoint except for shared 'active' default"
    - "__tests__/listing-moderation/ directory established (first test in the sibling Phase 7 testing namespace per D-19)"
  affects:
    - "Plan 07-02 audit collection (consumes 'inactive_seller' reason enum extension D-14a via the reused 5-value reason taxonomy)"
    - "Plan 07-03 listingCapabilities.js (consumes Car.schema.path('status').enumValues to verify policy-map keys match schema enum)"
    - "Plan 07-06 migrate-listing-moderation.js (consumes carSchema.index() declarations via Car.syncIndexes())"
    - "Phase 8 endpoint handlers (consume Car.status enum + moderationReason enum + moderatedBy/lastEditedBy audit fields)"
    - "Phase 9 read-time hide hook (will add a SECOND pre(/^find/) filtering by status !== 'active' — current hook preserved byte-identical to enable this)"
tech-stack:
  added: []
  patterns:
    - "Schema extension in place (D-02 preservation contract — existing fields, hooks, and module.exports unchanged)"
    - "Banner-comment-as-collision-warning (D-08) backed by a CI-failing jest assertion — comment alone is not load-bearing; the test is the lock"
    - "Inline `index: true` for single-field index + separate `carSchema.index(...)` for compound index"
key-files:
  created:
    - "../backend-services/carEx-services/__tests__/listing-moderation/Car.status-field.test.js"
  modified:
    - "../backend-services/carEx-services/src/models/Car.js"
decisions:
  - "D-08 lock encoded as a jest test (test 7) — not just a banner comment. A future PR collapsing listingStatus and status will fail the test suite at CI."
  - "moderationNote maxlength fixed at 2000 chars (T-07-01-03 mitigation) — mirrors v1.0 ModerationAction.note ceiling; no payload-size concerns surfaced yet to justify a different cap."
  - "compound index { sellerId: 1, status: 1 } declared via carSchema.index(...) AFTER the schema literal but BEFORE the seller-cascade pre-hook — visually groups with schema field declarations, not hook logic; preserves the hook block intact."
  - "Used --bail instead of plan's `-x` jest flag because jest CLI does not recognize -x (Rule 3 deviation, see Deviations section)."
metrics:
  duration: "~1m50s"
  tasks_complete: 2
  files_touched: 2
  completed: "2026-05-28T22:03:56Z"
---

# Phase 7 Plan 01: Listing Schema — Car Moderation Fields Summary

Extended `Car` schema in place with 7 moderation fields, a `{ sellerId, status }` compound index, and a banner-warning-plus-jest-lock against the `listingStatus` / `status` naming collision (D-08), while preserving the existing `pre(/^find/)` seller-cascade hook byte-identical (D-02).

## What was built

**Task 1: Car.js schema extension (`feat(07-01)` — backend `bf58a52`)**

Three additions to `../backend-services/carEx-services/src/models/Car.js`, zero deletions:

1. **D-08 banner comment** (4 lines) at the very top of the file — calls out the two-status-field contract with examples and a pointer to 07-CONTEXT.md.
2. **7 new schema fields** inserted directly after the existing `stripePaymentIntentId` field and before the schema-literal's closing `})`, in this order:
   - `status` — enum `['active','suspended','archived','deleted']` + default `'active'` + `required: true` + inline `index: true`
   - `moderationReason` — enum `['spam','policy_violation','fraud','inactive_seller','other']` (5 values per D-14a — adds `inactive_seller` to v1.0's 4) + default `null`
   - `moderationNote` — string + `default: null` + `maxlength: 2000` (T-07-01-03 mitigation)
   - `moderatedBy`, `moderatedAt` — admin attribution at moderation time
   - `lastEditedBy`, `lastEditedAt` — admin attribution for LADM-01 Edit action
3. **Compound index** `carSchema.index({ sellerId: 1, status: 1 })` declared on its own line between the schema literal's closing `})` and the existing `carSchema.pre(/^find/, ...)` hook.

Preservation contract verified by grep — the existing `pre(/^find/)` hook (39 lines), `listingStatus: { enum: ['active','booked','sold'] }` field, and `module.exports = mongoose.model('Car', carSchema)` line are byte-identical to pre-edit.

**Task 2: Car.status-field.test.js (`test(07-01)` — backend `8a21b98`)**

New file at `../backend-services/carEx-services/__tests__/listing-moderation/Car.status-field.test.js` (the first test in the Phase 7 sibling testing namespace per D-19). 7 schema assertions:

1. Defaults `status: 'active'` on a new Car + all 6 audit fields default `null`.
2. `status` enum accepts all 4 moderation states via `.validate()`.
3. `status` enum rejects `'banned'` with error matching `/status/`.
4. `moderationReason` enum accepts all 5 values including `inactive_seller` (D-14a) via `.validate()`.
5. `moderationReason` enum rejects `'flagged'` with error matching `/moderationReason/`.
6. `moderationNote` rejects 2001-char strings with error matching `/moderationNote/`.
7. **D-08 lock**: reads both enums via `Car.schema.path('listingStatus').enumValues` and `Car.schema.path('status').enumValues`; asserts `listingStatus = {'active','booked','sold'}`, `status = {'active','suspended','archived','deleted'}`, and the overlap is exactly `['active']` (the intentional shared default).

Test isolation per D-20: each test uses `mongodb-memory-server`; no `server.js` boot. All 7 tests pass under `npx jest __tests__/listing-moderation/Car.status-field.test.js --bail`.

## Verification evidence

**Task 1 — node one-liner from `<verify>`:**

```bash
cd ../backend-services/carEx-services && node -e "const Car = require('./src/models/Car'); const s = Car.schema; if (!s.path('status')) throw new Error('status field missing'); if (s.path('status').enumValues.join(',') !== 'active,suspended,archived,deleted') throw new Error('status enum wrong: ' + s.path('status').enumValues); if (s.path('listingStatus').enumValues.join(',') !== 'active,booked,sold') throw new Error('listingStatus enum changed'); if (s.path('moderationNote').options.maxlength !== 2000) throw new Error('maxlength wrong'); console.log('OK');"
# Output: OK
```

**Task 1 — all 13 grep acceptance criteria pass:**

| # | Criterion | Expected | Actual |
|---|-----------|----------|--------|
| 1 | `status: { type: String, enum: ['active', 'suspended', 'archived', 'deleted']` | 1 | 1 |
| 2 | `carSchema.index({ sellerId: 1, status: 1 })` | 1 | 1 |
| 3 | `moderationReason:` | 1 | 1 |
| 4 | `moderationNote:` | 1 | 1 |
| 5 | `moderatedBy:` | 1 | 1 |
| 6 | `moderatedAt:` | 1 | 1 |
| 7 | `lastEditedBy:` | 1 | 1 |
| 8 | `lastEditedAt:` | 1 | 1 |
| 9 | `CAUTION (Phase 7 v1.1)` banner | 1 | 1 |
| 10 | `carSchema.pre(/^find/` preserved | 1 | 1 |
| 11 | `mongoose.model('Car', carSchema)` preserved | 1 | 1 |
| 12 | `listingStatus: { type: String, enum: ['active', 'booked', 'sold']` preserved | 1 | 1 |
| 13 | `'suspended', 'archived', 'deleted'` (only 1 enum has them — not added to listingStatus) | 1 | 1 |

**Task 2 — jest run:**

```
PASS __tests__/listing-moderation/Car.status-field.test.js
  Car.status (LDATA-01 + D-07 + D-08)
    ✓ defaults status to "active" on new car (4 ms)
    ✓ status enum accepts the four moderation states (3 ms)
    ✓ status enum rejects invalid value (5 ms)
    ✓ moderationReason enum accepts all five values incl. inactive_seller (D-14a) (1 ms)
    ✓ moderationReason enum rejects invalid value (1 ms)
    ✓ moderationNote rejects strings over 2000 chars (1 ms)
    ✓ D-08 lock: listingStatus (lifecycle) and status (moderation) are distinct with disjoint enums except for shared default

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

**Task 2 — grep acceptance criteria:**

| # | Criterion | Expected | Actual |
|---|-----------|----------|--------|
| 1 | `describe('Car.status (LDATA-01 + D-07 + D-08)'` | 1 | 1 |
| 2 | `D-08 lock` | 1 | 1 |
| 3 | `test(` (count of `test(...)` calls) | >= 7 | 7 |
| 4 | `MongoMemoryServer.create` (D-20 isolation) | 1 | 1 |
| 5 | does NOT boot `server.js` | true | true (only `require('mongodb-memory-server')` matches; zero `require(...server)` outside that) |
| 6 | `npx jest ... --bail` exits 0 with `Tests: 7 passed` | green | green |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| D-08 lock as a jest test (not just a banner comment) | Banner comments rot silently across refactors; a failing CI test surfaces collisions at PR review time. Test 7 reads `Car.schema.path(...).enumValues` directly so any future PR that collapses or overlaps the two enums fails immediately. |
| Compound index declared between schema literal and pre-hook | Visually groups with schema field declarations rather than hook logic; preserves the 39-line hook block as a single readable unit. Matches PATTERNS.md §6 adaptation note placement. |
| `moderationNote.maxlength = 2000` | Mirrors v1.0 `User.moderationStatus.note` ceiling (Phase 1 D-15). No payload-size concerns surfaced in Phase 7 scope to justify a different cap; deferred to Phase 8 if endpoint testing reveals load issues. |
| Used `--bail` instead of plan's `-x` jest flag | Jest CLI does not recognize `-x` (errors: "Unrecognized option 'x'"). `--bail` is the semantic equivalent (stop on first failure) and is the documented flag. Recorded as Rule 3 deviation. |
| `'inactive_seller'` reason added to the 5-value enum | Per D-14a — v1.0's 4-value enum had no semantic fit for the Archive action's "non-punitive, for abandoned sellers" design intent. Single source of truth shared across `Car.moderationReason` (this plan) and `ListingModerationAction.reasonCategory` (Plan 07-02). |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan's `<verify>` jest command used invalid `-x` flag**

- **Found during:** Task 2 verification
- **Issue:** Plan's `<verify><automated>` block specified `npx jest <path> -x`. Jest does not recognize `-x` — it errors with "Unrecognized option 'x'" and exits non-zero before running any tests, which would block the verify step.
- **Fix:** Substituted `--bail` (the jest-documented flag that stops on first failure, which is what `-x` typically means in other test runners). Tests run cleanly and all 7 pass.
- **Files modified:** None — only the verify command was adjusted.
- **Acceptance impact:** The plan's grep acceptance criterion #6 specified `cd ../backend-services/carEx-services && npx jest __tests__/listing-moderation/Car.status-field.test.js -x` exits 0 with `Tests: 7 passed`. Using `--bail` satisfies the intent (all 7 tests pass with bail-on-failure semantics); pasting the verbatim `-x` flag would have failed the acceptance entirely. Recommend amending plan template for future Phase 7 plans.

### Authentication Gates

None.

### Architectural Changes (Rule 4)

None — both tasks were pure schema/test work fully covered by the plan.

## Threat Surface Audit

All 5 STRIDE entries from `<threat_model>` accounted for:

| Threat ID | Mitigated by | Evidence |
|-----------|--------------|----------|
| T-07-01-01 (Tampering — Car.status enum) | Mongoose enum validation | Test 3 (`'banned'` rejected with `/status/` error) |
| T-07-01-02 (Tampering — naming collision) | D-08 banner comment + Task 2 test 7 D-08 lock | Banner comment + jest test 7 reads both enums and asserts disjoint |
| T-07-01-03 (Info disclosure — moderationNote size) | `maxlength: 2000` | Test 6 (`'x'.repeat(2001)` rejected with `/moderationNote/` error) |
| T-07-01-04 (DoS — index creation) | Accepted | Small enum + 4-value status + Atlas online-by-default index build (no migration-time DoS for current Car collection size) |
| T-07-01-05 (Repudiation — admin attribution) | Accepted (out of scope for this plan) | Fields exist; population happens in Phase 8 handlers; audit-row append-only is Plan 07-02 |

No new threat surface beyond the register — no network endpoints, no auth paths, no schema changes at trust boundaries other than the documented `Car.status` and `Car.moderation*` fields.

## Known Stubs

None — both files are fully realized for Phase 7 scope. The `moderatedBy` / `moderatedAt` / `lastEditedBy` / `lastEditedAt` fields default to `null` by design (population is Phase 8 endpoint handlers' responsibility per D-07's "audit attribution fields" note and the threat-register T-07-01-05 disposition). Not stubs in the deferred-functionality sense.

## Commits

| Repo | Type | Commit | Message (summary) |
|------|------|--------|-------------------|
| backend (`carEx-services`) | feat | `bf58a52` | extend Car schema with 7 moderation fields + compound index + D-08 banner |
| backend (`carEx-services`) | test | `8a21b98` | add Car.status-field.test.js with 7 schema assertions incl. D-08 lock |
| mobile (`carEx`) | docs | (this SUMMARY commit) | complete 07-01 plan |

## Downstream Unlocks

This plan unblocks (within Phase 7 Wave 1 + Wave 2):

- **Plan 07-02 (ListingModerationAction audit collection)** — can reuse the 5-value reason enum verbatim from `Car.moderationReason` definition (single-source-of-truth pattern).
- **Plan 07-03 (listingCapabilities.js)** — can consume `Car.schema.path('status').enumValues` in the capabilities-test schema-vs-policy cross-check.
- **Plan 07-06 (migrate-listing-moderation.js)** — `Car.syncIndexes()` will now create both `{ status: 1 }` and `{ sellerId: 1, status: 1 }` indexes against a real cluster.
- **Phase 8 endpoint handlers** — `Car.status` write surface is ready; handlers will set `status` + `moderationReason` + `moderationNote` + `moderatedBy` + `moderatedAt` per action.
- **Phase 9 read-time hide hook** — the preserved single-hook structure leaves room for a second `pre(/^find/)` with a `status !== 'active'` filter and `includeAllListingStatuses` bypass option (orthogonal to the seller-cascade hook's `includeAllUsers` bypass).

## Self-Check

PASSED — see Self-Check section below.

## Self-Check: PASSED

Verified after writing SUMMARY.md:

- **Files exist:**
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/Car.js` (modified — 94 lines, was 84)
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/listing-moderation/Car.status-field.test.js` (new — 73 lines)
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/07-listing-schema-security-baseline-backend/07-01-SUMMARY.md` (this file)
- **Commits exist (backend repo git log):**
  - FOUND: `bf58a52` feat(07-01): extend Car schema with 7 moderation fields + compound index + D-08 banner
  - FOUND: `8a21b98` test(07-01): add Car.status-field.test.js with 7 schema assertions incl. D-08 lock
- **Tests green:** 7/7 passing under `npx jest __tests__/listing-moderation/Car.status-field.test.js --bail` (3.022s).
- **Mobile state untouched:** STATE.md and ROADMAP.md NOT modified by this executor (per sequential-execution contract).
