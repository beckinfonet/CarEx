---
phase: 07-listing-schema-security-baseline-backend
plan: 02
subsystem: backend-data-model
tags: [model, audit, mongoose, append-only, moderation, listing, LDATA-03]
dependency_graph:
  requires:
    - "Plan 07-01 (Car.status enum — shares fromStatus/toStatus enum vocabulary with this audit collection)"
    - "decision D-09 (sibling-not-extension rationale vs v1.0 ModerationAction)"
    - "decision D-10 (full schema shape — 11 fields, 3 indexes, explicit collection name)"
    - "decision D-11 (six append-only Mongoose pre-hooks, shared APPEND_ONLY_ERR instance)"
    - "decision D-12 (richer-than-LDATA-03-minimal denormalized fields by design)"
    - "decision D-14a (5-value reason taxonomy — adds inactive_seller to v1.0's 4)"
    - "decision D-19 (sibling test namespace __tests__/listing-moderation/)"
    - "decision D-20 (mongodb-memory-server isolation; no server.js boot)"
    - "mongodb-memory-server ^10.4.3 (existing devDep)"
    - "mongoose ^9.1.5 (existing dep — Schema + pre hooks + Schema.Types.Mixed)"
  provides:
    - "ListingModerationAction mongoose model (sibling collection listing_moderation_actions)"
    - "Append-only contract enforced at schema layer — every mutation/deletion verb on an existing row rejects with stable shared error"
    - "Three audit indexes (listingId+ts, adminUid+ts, sellerUid+ts) for the canonical admin query shapes"
    - "Action enum vocabulary {suspend|archive|delete|restore|edit} — single source of truth for Phase 8 service-layer typing"
    - "5-value reason taxonomy {spam|policy_violation|fraud|inactive_seller|other} — shared with Car.moderationReason from Plan 07-01"
    - "__tests__/listing-moderation/ test directory established (already used by Plan 07-01 Car.status-field.test.js; this plan adds the second file)"
  affects:
    - "Plan 07-03 (listingCapabilities.js — consumes the action enum + the four-state fromStatus/toStatus enum vocabulary)"
    - "Plan 07-06 (migrate-listing-moderation.js — calls ListingModerationAction.syncIndexes() to create the 3 audit indexes at deploy time)"
    - "Phase 8 endpoint handlers (call ListingModerationAction.create({...}) inside Mongoose transactions; rely on the append-only guarantee as the immutability contract)"
    - "Phase 11 security review (LSEC-* audit — the 6 pre-hooks are the application-layer floor for tamper-evidence; hash-chain is deferred per D-13)"
tech-stack:
  added: []
  patterns:
    - "Sibling-not-extension audit collection (D-09) — separate collection per moderation domain rather than a mixed-target enum"
    - "Single shared Error instance across all 6 pre-hooks (not per-hook string literals) — stable assertion target, one source of truth"
    - "Explicit collection name in mongoose.model(name, schema, collectionName) — every src/models/* file follows this pattern"
    - "Denormalized audit fields (adminEmail, sellerUid) — D-12 ceiling beats minimal LDATA-03 floor; cheap and avoids follow-up migration"
key-files:
  created:
    - "../backend-services/carEx-services/src/models/ListingModerationAction.js (107 lines — sibling collection model)"
    - "../backend-services/carEx-services/__tests__/listing-moderation/ListingModerationAction.append-only.test.js (99 lines — 6 hook assertions)"
  modified: []
key-decisions:
  - "Used --bail instead of plan's `-x` jest flag — jest CLI does not recognize -x. Same Rule 3 deviation already proven on Plan 07-01."
  - "Initial draft of Task 1 used wrong schema shape (adapted v1.0 ModerationAction without reading D-10's full field list) and Task 2 wrong hook set (findOneAndReplace/replaceOne instead of deleteOne/findOneAndDelete) and wrong test directory (__tests__/moderation/ instead of __tests__/listing-moderation/). Caught via plan re-read before committing the SUMMARY; both backend tasks fully rewritten before final commits."
  - "Plan AC #3 for Task 1 (`grep -c \"schema.pre(\"`) requires `-i` case-insensitive flag to match — the schema variable is `listingModerationActionSchema.pre(...)` with capital S in Schema. v1.0 ModerationAction.js has the same property (capital S). The plan AC literal would return 0 on both files; semantic intent (count = 6) is satisfied via case-insensitive match."
  - "AC #3 for Task 2 (`grep -c \"ListingModerationAction is append-only\" = exactly 6`) required removing the literal message from the file docstring after first draft included it — docstring now says 'stable shared error message (D-11)' so the literal appears in exactly 6 lines (one per test assertion)."
requirements-completed: [LDATA-03]
metrics:
  duration: "~7m"
  completed: "2026-05-28"
  tasks_completed: 2
  files_touched: 2
  backend_commits: 2
  mobile_commits: 1
---

# Phase 07 Plan 02: ListingModerationAction Sibling Audit Collection Summary

New `listing_moderation_actions` collection — sibling of v1.0 `moderation_actions`, not an extension — with schema-layer append-only enforcement via six Mongoose pre-hooks throwing a single shared Error, plus six matching jest assertions proving each hook rejects.

## Performance

- **Duration:** ~7 minutes
- **Started:** 2026-05-28T22:06:57Z
- **Completed:** 2026-05-28
- **Tasks:** 2
- **Files modified:** 2 (both newly created in backend repo)

## Accomplishments

- **ListingModerationAction.js model** with the full D-10 schema (11 fields: `listingId`, `sellerUid`, `adminUid`, `adminEmail`, `action` ∈ {suspend, archive, delete, restore, edit}, `fromStatus` + `toStatus` ∈ four-state enum, `reasonCategory` ∈ five-value enum including `inactive_seller` per D-14a, `reasonNote` (≤ 2000), `fieldDiff` (Mixed), `createdAt`). Three audit indexes per D-10. Explicit collection name `listing_moderation_actions` per Pattern B.
- **Six append-only pre-hooks** (`updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`) — every one throws the same `APPEND_ONLY_ERR` Error instance with the stable message `'ListingModerationAction is append-only'`. Mongoose rejects the operation before reaching MongoDB; no audit row can be mutated or deleted via the model API.
- **Six jest assertions** under `__tests__/listing-moderation/` proving every hook fires. Deliberate superset of v1.0's 4-test coverage (which was missing `updateMany` and `deleteMany`) per the D-11 invariant.
- **D-09 sibling-not-extension lock** holds: zero `require('../models/ModerationAction')` and zero `mongoose.model('ModerationAction', …)` in the new file.

## Task Commits

| # | Repo    | Hash      | Type   | Message                                                                       |
| - | ------- | --------- | ------ | ----------------------------------------------------------------------------- |
| 1 | backend | `2ef1047` | `feat` | `feat(07-02): add ListingModerationAction sibling audit model (LDATA-03)`     |
| 2 | backend | `9db8a30` | `test` | `test(07-02): assert 6 append-only hooks fire on ListingModerationAction (D-11)` |
| - | mobile  | (this)    | `docs` | `docs(07-02): complete ListingModerationAction sibling audit collection plan` |

## Files Created/Modified

- **created** `../backend-services/carEx-services/src/models/ListingModerationAction.js` — 107 lines. Schema + 3 indexes + 6 pre-hooks + explicit-collection `mongoose.model(...)` export.
- **created** `../backend-services/carEx-services/__tests__/listing-moderation/ListingModerationAction.append-only.test.js` — 99 lines. `mongodb-memory-server` fixture, single `describe('ListingModerationAction — append-only')`, one `create({...})` seed in inner `beforeAll`, six `rejects.toThrow('ListingModerationAction is append-only')` cases.

## Verification Evidence

**Task 1 — `<verify>` node one-liner output:**

```
$ node -e "const M = require('./src/models/ListingModerationAction'); ..."
OK
```

**Task 1 — acceptance criteria (10 mechanical checks):**

| # | Criterion                                                                                                   | Expected | Actual | Notes                                                                  |
| - | ----------------------------------------------------------------------------------------------------------- | -------- | ------ | ---------------------------------------------------------------------- |
| 1 | `mongoose.model('ListingModerationAction', listingModerationActionSchema, 'listing_moderation_actions')`    | 1        | 1      | single-line export literal                                             |
| 2 | `'ListingModerationAction is append-only'`                                                                  | 1        | 1      | single shared Error instance                                           |
| 3 | non-comment `schema.pre(`                                                                                   | 6        | 6      | grep needed `-i` flag — see Decisions / Deviations (also true for v1.0) |
| 4 | hook names `updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|findOneAndDelete`                    | ≥ 6      | 8      | extra matches in docstring + APPEND-ONLY comment block                  |
| 5 | `Schema.Types.Mixed`                                                                                        | 1        | 1      | `fieldDiff` only                                                       |
| 6 | `'spam', 'policy_violation', 'fraud', 'inactive_seller', 'other'`                                           | 1        | 1      | reason enum                                                            |
| 7 | `'suspend', 'archive', 'delete', 'restore', 'edit'`                                                         | 1        | 1      | action enum                                                            |
| 8 | `listingModerationActionSchema.index(`                                                                      | 3        | 3      | three audit indexes                                                    |
| 9 | `require('../models/ModerationAction')`                                                                     | 0        | 0      | D-09 sibling lock                                                      |
| 10| `mongoose.model('ModerationAction'`                                                                         | 0        | 0      | D-09 sibling lock                                                      |

**Task 2 — jest run:**

```
PASS __tests__/listing-moderation/ListingModerationAction.append-only.test.js
  ListingModerationAction — append-only
    ✓ updateOne throws (7 ms)
    ✓ updateMany throws
    ✓ findOneAndUpdate throws (1 ms)
    ✓ deleteOne throws
    ✓ deleteMany throws
    ✓ findOneAndDelete throws

Tests:       6 passed, 6 total
Time:        1.972 s
```

**Task 2 — acceptance criteria:**

| # | Criterion                                                                  | Expected | Actual |
| - | -------------------------------------------------------------------------- | -------- | ------ |
| 1 | `describe('ListingModerationAction — append-only'`                          | 1        | 1      |
| 2 | `test(` count                                                              | 6        | 6      |
| 3 | `'ListingModerationAction is append-only'` literal count                   | 6        | 6      |
| 4 | Each hook name appears at least once (`ListingModerationAction.<hook>(`)   | ≥ 1 each | 1 each |
| 5 | `MongoMemoryServer.create`                                                 | 1        | 1      |
| 6 | jest run exits 0 with `Tests: 6 passed`                                    | green    | green  |

## Decisions Made

| Decision | Rationale |
|---|---|
| Single shared `APPEND_ONLY_ERR` instance across all 6 hooks | Matches v1.0 `ModerationAction.js` exactly; gives a single stable assertion target for the test file and prevents per-hook message drift over time. The plan's AC #2 lock (`grep -c "ListingModerationAction is append-only" = 1`) only holds with this pattern. |
| Test docstring rewritten to NOT contain the literal append-only message | Plan AC #3 for Task 2 requires exactly 6 matches (one per test). Mentioning the message in the file docstring would have brought the count to 7. Docstring now references "the stable shared error message (D-11)" and lets the assertions own the literal. |
| Test path corrected to `__tests__/listing-moderation/` (sibling namespace per D-19) | First draft put the file under `__tests__/moderation/` (v1.0 namespace). Caught via plan re-read of D-19 + Plan 07-01's existing `Car.status-field.test.js` in the correct directory. Phase 7 sibling namespace is locked. |
| Hook set corrected to `updateOne / updateMany / findOneAndUpdate / deleteOne / deleteMany / findOneAndDelete` | First draft used `findOneAndReplace` and `replaceOne` instead of `deleteOne` and `findOneAndDelete`. D-11 verbatim names the 6 hooks; both Phase 7 ROADMAP success criterion #4 wording and v1.0's `ModerationAction.js` lines 19–25 confirm the canonical six. |
| Used `--bail` instead of plan's `-x` jest flag | Jest CLI does not recognize `-x`. Same Rule 3 deviation already documented in Plan 07-01 SUMMARY. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug, self-corrected before commit] Initial draft used wrong schema shape, wrong hook set, and wrong test path**

- **Found during:** Plan re-read at SUMMARY-write time
- **Issue:** First draft of `ListingModerationAction.js` (a) abbreviated the schema (dropped `adminUid`, `adminEmail`, `fromStatus`, `toStatus`, `previousStatus/newStatus` confusion); (b) used `findOneAndReplace` and `replaceOne` instead of the D-11-prescribed `deleteOne` and `findOneAndDelete`; (c) test landed at `__tests__/moderation/` instead of the D-19 sibling path `__tests__/listing-moderation/`. Initial backend commit `a8d7137` (test-only) and the wrong model file were caught before the SUMMARY commit.
- **Fix:** Soft-reset both the backend commit and the mobile SUMMARY commit. Rewrote `ListingModerationAction.js` against D-10's full 11-field schema (verified via plan's `<verify>` node one-liner: `OK`). Rewrote the test file at the correct path with the correct 6 hooks. Re-committed cleanly as `2ef1047` (feat) and `9db8a30` (test).
- **Files modified:** `src/models/ListingModerationAction.js`, `__tests__/listing-moderation/ListingModerationAction.append-only.test.js`.
- **Verification:** All 10 Task-1 ACs green; all 6 Task-2 ACs green; all 6 jest assertions pass.
- **Committed in:** `2ef1047` + `9db8a30` (clean final commits — no record of the buggy intermediate state in main branch git log).

**2. [Rule 3 — Blocking] Replaced invalid `-x` jest flag with `--bail`**

- **Found during:** Task 2 verification
- **Issue:** Plan's `<verify><automated>` block specified `npx jest <path> -x`. Jest does not recognize `-x` — it errors before running any tests. Same flag bug previously documented in Plan 07-01 SUMMARY.
- **Fix:** Substituted `--bail` (jest-documented flag, same semantic — stop on first failure). All 6 tests pass under `npx jest ... --bail`.
- **Files modified:** None — command-line substitution only.
- **Committed in:** N/A (no source change).

**3. [Rule 3 — Blocking] Plan AC #3 for Task 1 needs `-i` flag to match**

- **Found during:** Task 1 acceptance verification
- **Issue:** Plan's AC #3 reads `grep -v '^[[:space:]]*//' .../ListingModerationAction.js | grep -c "schema.pre("` expecting 6. Because the schema variable is named `listingModerationActionSchema` (capital `S` in `Schema`), the case-sensitive substring `schema.pre(` does not match. Same property holds for v1.0 `ModerationAction.js`. Renaming the variable to `listingmoderationactionschema` would break naming convention.
- **Fix:** Ran the grep with `-i` (case-insensitive). Returns 6, satisfying the semantic intent. Variable name kept conventional.
- **Files modified:** None — command-line flag added.
- **Committed in:** N/A.

---

**Total deviations:** 3 auto-fixed (1 self-corrected bug, 2 plan-command Rule 3s)
**Impact on plan:** No scope creep. The bug deviation is the only material one — the two `-x → --bail` and `grep → grep -i` adjustments are inherited planning-template issues that will repeat across every Phase 7 plan until the plan template is corrected.

## Issues Encountered

None beyond the self-corrected bug documented as Deviation #1.

## Authentication Gates

None — pure backend model + test work; no auth surfaces touched.

## Threat Surface Audit

All 6 entries in the plan's `<threat_model>` accounted for:

| Threat ID | Mitigated by | Evidence |
|-----------|--------------|----------|
| T-07-02-01 (Tampering — post-write modification) | 6 pre-hooks throw `APPEND_ONLY_ERR` | Tests 1–6 lock all 6 hooks in CI |
| T-07-02-02 (Tampering — bulk-mutation via updateMany/deleteMany) | Explicit hooks added (v1.0 was missing them) | Test 2 + Test 5 — explicit coverage that v1.0 lacked |
| T-07-02-03 (Repudiation — admin denies action) | `adminUid` + `adminEmail` both `required: true` | Schema field declarations in `ListingModerationAction.js` |
| T-07-02-04 (Info disclosure — fieldDiff PII) | Accepted | `fieldDiff` is admin-only readable; future CSV export must redact |
| T-07-02-05 (Tampering — direct MongoDB shell bypass) | Accepted | D-13 deferral; DB-user-level insert-only Atlas privilege is future security milestone |
| T-07-02-06 (Tampering — concurrent same-(listingId, createdAt)) | Accepted | Multiple audit rows per listing-per-second is expected during admin batch actions |

No new threat surface introduced beyond the register — no network endpoints, no auth paths, no schema changes at trust boundaries other than the documented audit collection.

## Known Stubs

None. The `fieldDiff` `Mixed` type and the `default: null` on `reasonCategory` / `reasonNote` / `previousStatus` analogs are intentional schema shapes per D-10 + D-12, not deferred functionality. Population is the responsibility of Phase 8 endpoint handlers.

## Next Phase Readiness

- **Plan 07-03 (listingCapabilities.js)** can now consume `ListingModerationAction.schema.path('fromStatus').enumValues` if its cross-check needs to validate the four-state vocabulary against the policy-map keys.
- **Plan 07-06 (migrate-listing-moderation.js)** can call `ListingModerationAction.syncIndexes()` against the deployed cluster to create the 3 audit indexes at deploy time without paying first-query index-build cost in production.
- **Phase 8 endpoint handlers** can build atop the model immediately — `.create({...})` is the only write surface available, and the schema-layer append-only contract guarantees no handler refactor can later mutate an existing audit row.
- **Phase 11 security review (LSEC-* audit)** has the application-layer append-only floor in place. DB-user-level insert-only privilege and hash-chain tamper-evidence remain deferred per D-11 / D-13.

## Self-Check: PASSED

Verified after writing SUMMARY.md:

- **Files exist:**
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/ListingModerationAction.js` (new — 107 lines)
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/listing-moderation/ListingModerationAction.append-only.test.js` (new — 99 lines)
  - FOUND: `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/07-listing-schema-security-baseline-backend/07-02-SUMMARY.md` (this file)
- **Commits exist (backend repo git log):**
  - FOUND: `2ef1047` feat(07-02): add ListingModerationAction sibling audit model (LDATA-03)
  - FOUND: `9db8a30` test(07-02): assert 6 append-only hooks fire on ListingModerationAction (D-11)
- **Tests green:** 6/6 passing under `npx jest __tests__/listing-moderation/ListingModerationAction.append-only.test.js --bail` (1.972s).
- **Mobile state untouched:** STATE.md and ROADMAP.md NOT modified by this executor (per sequential-execution contract).

---

*Phase: 07-listing-schema-security-baseline-backend*
*Plan: 02*
*Completed: 2026-05-28*
