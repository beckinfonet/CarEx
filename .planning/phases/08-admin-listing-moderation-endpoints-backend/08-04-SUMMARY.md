---
phase: 08-admin-listing-moderation-endpoints-backend
plan: 04
subsystem: backend / listing-moderation-endpoints
tags: [backend, moderation, listing, delete, soft-delete, transactions, audit, LADM-04, wave-2]
dependency_graph:
  requires:
    - "Plan 08-01 Wave-1 substrate (listingService.js skeleton, listingSchemas.deleteListingSchema, listingErrors.js, denySelfModerationListing.js)"
    - "Plan 08-02 canonical pattern (suspendListing body shape + KNOWN_LISTING_ERRORS + handleListingServiceError)"
    - "Plan 08-03 substitution-only mirror precedent (archiveListing body) — confirms the canonical shape generalizes per state-transition label"
    - "Phase 7 substrate (Car.js status/audit fields, ListingModerationAction model, listingRouter.js /ping scaffold)"
    - "../backend-services/carEx-services repo (sibling of carEx)"
  provides:
    - "PATCH /api/admin/moderation/listings/:carId/delete endpoint (LADM-04)"
    - "deleteListing service body — third concrete consumer of the canonical Phase-8 audit-then-Car transactional shape, distinguished by the LADM-04 SOFT-DELETE invariant (Car document survives)"
  affects:
    - "Plan 08-05 (Restore) — inverse path; flips a 'deleted' Car BACK to 'active' (the document Plan 08-04 left in MongoDB is the document Plan 08-05 must be able to find and restore). Same canonical pattern with toStatus='active', action='restore', reasonCategory: null per D-C, clears moderation* fields per D-C-1"
    - "Plan 08-06 (Edit) — independent surface; uses multer multipart and computes fieldDiff but no status transition"
tech_stack:
  added: []
  patterns:
    - "Substitution-only mirror of Plan 08-02/08-03 canonical pattern (target='deleted', action='delete') — proves Phase-8 shape generalizes across THIRD label without structural deviation"
    - "LADM-04 SOFT-DELETE invariant locked in source + at grep level + at test level: function body uses Car.updateOne ONLY (no Mongoose document-removal API on Car anywhere in the function body); enforced by automated grep gate at zero matches and by deleteListing.test.js Test 2 (Car.countDocuments === 1 post-call + sellerId + createdAt preserved)"
key_files:
  created:
    - "../backend-services/carEx-services/__tests__/listing-moderation/deleteListing.test.js"
  modified:
    - "../backend-services/carEx-services/src/moderation/listingService.js (deleteListing body replaces Wave-1 stub; suspendListing + archiveListing + 2 other stubs unchanged)"
    - "../backend-services/carEx-services/src/moderation/listingRouter.js (+PATCH /:carId/delete route; Suspend + Archive routes + /ping + KNOWN_LISTING_ERRORS preserved byte-identical)"
decisions:
  - "deleteListing body is a substitution-only mirror of archiveListing (target='deleted', action='delete') — third concrete substitution proof that Plan 08-02's canonical shape generalizes across state-transition labels without structural deviation"
  - "Plan task ordering pivoted from author-order (service → router → tests) to TDD-canonical (tests RED → service GREEN → router) — third consecutive pivot in Phase 8 (matches Plans 08-02 + 08-03); mandatory under MVP+TDD gate when tdd=\"true\" is set on behavior-adding tasks"
  - "LADM-04 SOFT-DELETE invariant: enforced at THREE layers — (1) source comment block at function header explicitly forbids Mongoose document-removal APIs (.delete*One, .delete*Many, .findOne*AndDelete) on Car; (2) automated grep gate at zero matches for those API tokens in the deleteListing function body; (3) deleteListing.test.js Test 2 asserts Car.countDocuments({_id: carId}) === 1 BOTH pre- and post-call. Any future refactor that introduces a runtime call to one of those APIs trips both the grep gate and the integration test"
  - "Inline header comment in deleteListing function rephrased to avoid the literal API tokens (Car.deleteOne, etc.) — the plan's verify script is a literal grep that does not distinguish comments from code. Rephrased to 'NO call to any Mongoose document-removal API on Car' which preserves the prescriptive intent while satisfying the grep gate. Documented as deviation below"
  - "Cross-state assertions for suspended→delete AND archived→delete included in the test catalog — third concrete proof that D-B open matrix holds (Plan 08-02 proved archived→suspend + deleted→suspend; Plan 08-03 proved suspended→archive + deleted→archive; this plan proves the symmetric pair)"
  - "Happy-path test uses 'spam' reasonCategory — punitive Delete's canonical reason; cross-state tests use 'fraud' (suspended→delete) and 'policy_violation' (archived→delete) so all three punitive enum values are exercised across the catalog (D-A-1 — schema permits any reasonCategory enum value)"
  - "Same-state guard fires BEFORE session.startSession() (D-B-1 fast-path mirrored from Suspend + Archive) — verified explicitly in Test 3 (countDocuments === 0 of audit rows after rejected deleted→delete call)"
  - "Test file is a near-clone of archiveListing.test.js — 'inactive_seller' → 'spam' in happy path, 'archive' / 'archived' → 'delete' / 'deleted' throughout; adds one dedicated LADM-04 soft-delete invariant test (Test 2) that has no analog in Suspend or Archive; total 5 tests (matches plan floor)"
  - "Soft-delete invariant Test 2 seeds with explicit fixedCreatedAt Date('2026-01-15T12:00:00.000Z') so the createdAt-preservation assertion uses a known sentinel value rather than the dynamic new Date() — toEqual on Dates checks epoch equality, which sentinel makes failure messages diagnosable"
  - "Router NO multer addition — D-D-1 lock preserved; Delete is JSON-body only (reasonCategory + optional note). grep -c upload.array listingRouter.js still returns 0"
  - "Router no KNOWN_LISTING_ERRORS additions — all 4 codes Delete emits (listing_not_found / already_in_state / invalid_payload / cannot_moderate_own_listing) were pre-registered by Plan 08-02; downstream Wave 2/3 plans throw without amending"
metrics:
  duration: "3m50s"
  completed: "2026-05-29"
  tasks_executed: 3
  files_created: 1
  files_modified: 2
  test_count_before: 73
  test_count_after: 78
  test_count_delta: 5
---

# Phase 8 Plan 04: Soft-Delete Endpoint (LADM-04) Summary

Wave-2 third endpoint for Phase 8 — implemented `PATCH /api/admin/moderation/listings/:carId/delete` end-to-end (router + service + integration tests) as a substitution-only mirror of Plans 08-02 / 08-03 with the LADM-04 SOFT-DELETE invariant added on top. Confirms the canonical audit-then-Car transaction shape generalizes across THREE labels (suspend / archive / delete) and locks the soft-delete semantics at three independent layers (source comment + automated grep gate + integration test).

## Outcome

All 3 tasks executed in TDD-canonical order (RED test → GREEN service → router substrate) with one tiny inline-comment phrasing adjustment to satisfy a grep-strict verify script (documented in Deviations). Backend listing-moderation test count: **73 → 78 (+5 new tests; all green)**. Plans 08-01 + 08-02 + 08-03 substrate consumed BYTE-IDENTICAL — no edits to `listingSchemas.js`, `denySelfModerationListing.js`, `listingErrors.js`, the `suspendListing` body, the `archiveListing` body, or `KNOWN_LISTING_ERRORS`. The 2 remaining handler stubs (`editListing`, `restoreListing`) still throw `not_implemented` for Plans 08-05 + 08-06.

LADM-04 acceptance criteria all green:
- Active → deleted returns 200 with thin D-02 payload (`{ ok, listing: {_id, status, moderatedBy, moderatedAt}, action: {_id, action, fromStatus, toStatus, createdAt} }`)
- One audit row per successful delete (action='delete', fromStatus=<current>, toStatus='deleted', reasonCategory='spam'/'fraud'/'policy_violation' across catalog, reasonNote populated or null)
- Same-state deleted→delete → throws `already_in_state` with ZERO audit rows (D-B-1 fast-path)
- Cross-state suspended→delete AND archived→delete both succeed (D-B open matrix)
- **LADM-04 SOFT-DELETE invariant locked**: Car document NOT removed from MongoDB after a successful delete-soft. `Car.countDocuments({ _id: carId })` returns 1 BOTH pre- and post-call. The persisted document has `status === 'deleted'`, original `sellerId === 'seller-x'` preserved, and original `createdAt === Date('2026-01-15T12:00:00.000Z')` preserved (only audit/status fields modified). Plan 08-05's Restore can find this document and flip it back to 'active'.
- Self-moderation blocked by `denySelfModerationListing` middleware mounted FIRST in the chain
- Audit + Car update atomic under `session.withTransaction()` (Plan 08-01 atomicity tests still green proving the pattern)

## What Shipped

### TDD pivot reprise (third instance in Phase 8)

Plan task ordering was: Task 1 (service body) → Task 2 (router) → Task 3 (tests). Executor pivoted to TDD-canonical ordering (Task 3 → Task 1 → Task 2), same as Plans 08-02 and 08-03. Substantive deliverables unchanged; pivot is mandatory under the MVP+TDD gate when `tdd="true"` is set on the behavior-adding tasks.

### Task 3 (RED) — `deleteListing.test.js` (commit `7268ac4`)

Created `__tests__/listing-moderation/deleteListing.test.js` with 5 integration tests against the not-yet-implemented `service.deleteListing`. Initial run: 5/5 failed with `ListingServiceError: not_implemented` as expected.

Tests (per D-16 catalog + plan's 5-test floor):

1. **Happy path active → deleted (spam)** — asserts audit row fields (action='delete' / fromStatus='active' / toStatus='deleted' / reasonCategory='spam' / reasonNote='confirmed spam listing' / listingId / sellerUid / adminUid / adminEmail) + Car post-state fields (status='deleted' / moderationReason='spam' / moderationNote / moderatedBy='admin-uid' / moderatedAt instanceof Date) + response shape (literal values)
2. **LADM-04 SOFT-DELETE invariant — Car document survives delete-soft** — seeds Car with `sellerId: 'seller-x'`, `status: 'active'`, `createdAt: new Date('2026-01-15T12:00:00.000Z')`. Pre-call: `Car.countDocuments({ _id: carId })` returns **1**. Calls `service.deleteListing({ adminUid: 'admin-1', adminEmail: 'a@x', carId, reasonCategory: 'spam', note: null })`. Post-call: `Car.countDocuments({ _id: carId })` STILL returns **1** (LADM-04 critical invariant). Reads persisted doc with `.setOptions({ includeAllListingStatuses: true, includeAllUsers: true }).lean()`; asserts `persisted !== null`, `persisted.status === 'deleted'`, `persisted.sellerId === 'seller-x'` (seeded sellerId preserved), `persisted.createdAt === Date('2026-01-15T12:00:00.000Z')` via `toEqual` (seeded createdAt preserved — only audit/status fields modified)
3. **Same-state deleted → delete** — `rejects.toThrow('already_in_state')` + `ListingModerationAction.countDocuments({ listingId: carId }) === 0` (D-B-1 fast-path) + Car.status unchanged
4. **Cross-state suspended → delete** — succeeds; audit.fromStatus === 'suspended'; audit.action === 'delete'; reasonCategory='fraud'
5. **Cross-state archived → delete** — succeeds; audit.fromStatus === 'archived'; audit.action === 'delete'; reasonCategory='policy_violation'

Replica-set fixture via `_helpers/mongoReplSet`. Cars seeded via `Car.collection.insertOne(...)` (mirrors Plans 08-02 + 08-03 seed helper byte-equivalent).

### Task 1 (GREEN) — `deleteListing` body (commit `4579b23`)

Replaced the Wave-1 stub in `src/moderation/listingService.js` with the canonical body. After this commit: 5/5 deleteListing tests green; suspendListing + archiveListing + 2 other stubs unchanged.

Body diff vs. `archiveListing` (the only structural differences):

| Position | Archive value | Delete value |
|---|---|---|
| Same-state guard literal | `'archived'` | `'deleted'` |
| Audit `action` | `'archive'` | `'delete'` |
| Audit `toStatus` | `'archived'` | `'deleted'` |
| Car `$set.status` | `'archived'` | `'deleted'` |
| Return `listing.status` | `'archived'` | `'deleted'` |
| Return `action.action` | `'archive'` | `'delete'` |
| Return `action.toStatus` | `'archived'` | `'deleted'` |
| Header comment | "Archive is non-punitive (LADM-03 — inactive_seller reason most common)" | "LADM-04 SOFT-DELETE: document survives. This handler MUST NOT call any of Mongoose's document-removal APIs on the Car model ... The document remains in MongoDB with status='deleted' so Plan 08-05's restoreListing can flip it back to 'active'." |

Everything else — defensive arg check, pre-txn read with double-bypass setOptions, same-state guard placement (BEFORE startSession), withTransaction(audit-then-Car), array-form create with { session }, matchedCount !== 1 TOCTOU guard, finally endSession, thin D-02 response built from in-memory state — is byte-equivalent to `archiveListing` and `suspendListing`. This is the Plan 08-04 design intent: the canonical pattern generalizes to a third label, and the soft-delete invariant rides on top of it WITHOUT modifying the pattern shape.

**LADM-04 invariant — three enforcement layers:**

1. **Source comment.** Header block above the function explicitly states "this handler MUST NOT call any of Mongoose's document-removal APIs on the Car model (the *.delete*One, *.delete*Many, *.findOne*AndDelete family)." Inline comment at the `Car.updateOne` call site repeats: "SOFT-DELETE: Car.updateOne ONLY — NO call to any Mongoose document-removal API on Car anywhere in this function (LADM-04 invariant)."
2. **Automated grep gate.** Plan's verification spec runs `node -e "..."` against the deleteListing function body; rejects if any of `Car.deleteOne` / `Car.deleteMany` / `Car.findOneAndDelete` literal tokens appear. Current count: **0 matches** in the function body (verified via `grep -c "Car.deleteOne\|Car.deleteMany\|Car.findOneAndDelete" src/moderation/listingService.js` = 0).
3. **Integration test (Test 2).** Asserts `Car.countDocuments({ _id: carId })` returns 1 both pre- AND post-call; further asserts the persisted document has the seeded `sellerId` and `createdAt` preserved verbatim. Any future refactor that introduces a runtime call to a removal API trips this test immediately because `countDocuments` would go from 1 → 0.

### Task 2 — router additions (commit `2cfbfe0`)

Edited `src/moderation/listingRouter.js`. The Phase 7 `/ping` route, Plan 08-02 Suspend route, Plan 08-03 Archive route, KNOWN_LISTING_ERRORS Set, and handleListingServiceError function are ALL BYTE-IDENTICAL post-edit (one literal grep match each). New material is a single new route block at the end of the router:

- **`PATCH /:carId/delete`** — `denySelfModerationListing` middleware first, `deleteListingSchema.safeParse(req.body || {})` second (parse-failure → 400 `invalid_payload` with Zod issues), `service.deleteListing({ adminUid: req.admin.uid, adminEmail: req.admin.email, carId: req.params.carId, reasonCategory, note })`, success → `res.json({ ok: true, listing, action })`, failure → `handleListingServiceError(err, res, 'delete')`.
- **NO new top-of-file requires** — `service`, `schemas`, `denySelfModerationListing` all imported in Plan 08-02.
- **NO additions to `KNOWN_LISTING_ERRORS`** — the existing 10 codes cover Delete's possible failures (`listing_not_found`, `already_in_state`, `invalid_payload`, `cannot_moderate_own_listing`).
- **NO multer** — D-D-1 lock; Edit-only in Plan 08-06. `grep -c "upload.array" listingRouter.js` = 0.

Phase 7 regression check: `__tests__/listing-moderation/listingModerationRateLimiter.test.js` runs 3/3 green in isolation. The known intermittent cross-file ordering flake (documented in 08-01-SUMMARY.md "Phase 7 cross-file ordering flake") surfaced once in the full-suite run and resolved on rerun; it is NOT a Plan 08-04 regression (rate-limiter file was not modified).

## Verification Spec Results

All 5 verification spec items from `08-04-PLAN.md` pass:

1. `npx jest __tests__/listing-moderation/ --silent` → **12 suites / 78 tests passed**. Floor was 33 (Phase 7) + 27 (Plan 08-01) + 8 (Plan 08-02) + 5 (Plan 08-03) + 5 (this plan) = 78; actual 78 matches. ✓
2. `grep -c "router.patch('/:carId/" src/moderation/listingRouter.js` = **3** (Suspend + Archive + Delete; Restore + Edit not yet). ✓
3. `grep -c "Car.deleteOne\|Car.deleteMany\|Car.findOneAndDelete" src/moderation/listingService.js` = **0** (LADM-04 invariant — no removal APIs anywhere in the service). ✓
4. `grep -c "toStatus: 'deleted'" src/moderation/listingService.js` = **2** (≥1 — 1 in audit insert + 1 in return action.toStatus). ✓
5. `grep -c "action: 'delete'" src/moderation/listingService.js` = **2** (≥1 — 1 in audit insert + 1 in return action.action). ✓

## LADM-04 Soft-Delete Invariant — Exact Assertions

Test 2 (`'LADM-04 soft-delete invariant: Car document survives delete-soft'`) asserts the following after a successful `service.deleteListing` call against a Car seeded with `{ sellerId: 'seller-x', status: 'active', createdAt: Date('2026-01-15T12:00:00.000Z') }`:

| Assertion | Type | Value |
|---|---|---|
| `Car.countDocuments({ _id: carId })` (pre-call) | toBe | `1` |
| `Car.countDocuments({ _id: carId })` (post-call) | toBe | `1` (LADM-04 invariant — document survives) |
| `persisted` (read with double-bypass setOptions) | not.toBeNull | non-null Car doc |
| `persisted.status` | toBe | `'deleted'` (status field flipped) |
| `persisted.sellerId` | toBe | `'seller-x'` (seeded sellerId preserved) |
| `persisted.createdAt` | toEqual | `Date('2026-01-15T12:00:00.000Z')` (seeded createdAt preserved) |

The fixedCreatedAt sentinel (`Date('2026-01-15T12:00:00.000Z')`) makes failure messages diagnosable: a regression that touches `createdAt` produces a Jest diff showing the new Date vs. the sentinel. Other seeded fields (status='active') are intentionally NOT asserted as preserved because the test expects them to change.

## Plan 08-01 + 08-02 + 08-03 Substrate — Consumed Unchanged

`git diff HEAD~3 --stat -- src/moderation/listingErrors.js src/moderation/listingSchemas.js src/moderation/denySelfModerationListing.js` returns ZERO output. The 3 Plan 08-01 substrate modules + Plan 08-02's `suspendListing` body + Plan 08-03's `archiveListing` body + KNOWN_LISTING_ERRORS Set + handleListingServiceError function are byte-identical post Plan 08-04. This plan added one new route block + filled one stub body + landed one new test file.

`listingService.js` was modified (Task 1 GREEN replaces the `deleteListing` stub body) but the file's top-level requires, module shape, exported function names, and the bodies of suspendListing + archiveListing + 2 remaining stubs are byte-identical to their Plan 08-03 state.

## Test Count Before/After

| Suite | Before this plan | After this plan |
|-------|------------------:|----------------:|
| `__tests__/listing-moderation/` | 73 | 78 (+5) |
| Phase 7's 33 baseline tests | 33 (all green) | 33 (all green; preserved) |
| Plan 08-01's 27 Wave-0 tests | 27 (all green) | 27 (all green; preserved) |
| Plan 08-02's 8 suspendListing tests | 8 (all green) | 8 (all green; preserved) |
| Plan 08-03's 5 archiveListing tests | 5 (all green) | 5 (all green; preserved) |
| Plan 08-04 new (deleteListing.test.js) | — | 5 |

## Deviations from Plan

**One minor deviation — inline comment phrasing adjusted to satisfy a grep-strict verify script.**

- **Inline header comment rephrased to avoid literal API token strings.** The plan Task 1 `<action>` block prescribed an inline header comment explaining the LADM-04 invariant. The verbatim text suggested in the plan (`"... MUST NOT call Car.deleteOne / Car.deleteMany / Car.findOneAndDelete..."`) was implemented as-written on the first pass — but it tripped the plan's own automated verify script (which is a literal grep that does NOT distinguish source comments from runtime code). Rephrased the comment to `"this handler MUST NOT call any of Mongoose's document-removal APIs on the Car model (the *.delete*One, *.delete*Many, *.findOne*AndDelete family)"` which preserves the prescriptive intent (and is arguably clearer) while satisfying the literal grep gate. The inline comment at the `Car.updateOne` call site was similarly rephrased to `"NO call to any Mongoose document-removal API on Car anywhere in this function (LADM-04 invariant)"`. Same Rule 1/Rule 2 trade-off Plan 08-03 considered — preserve the gate's machine-checkability over verbatim prose, because the gate is the load-bearing artifact. Auto-applied (no user permission needed) because both formulations communicate the same constraint.

Two implementation choices fell within Claude's discretion:

- **TDD task ordering pivot**: plan task body listed service-body (Task 1) → router (Task 2) → tests (Task 3). Executor pivoted to TDD-canonical ordering: tests FIRST (Task 3 as RED), then service body (Task 1 as GREEN), then router (Task 2). Third consecutive pivot in Phase 8 (matches Plans 08-02 + 08-03); commits tagged `test(08-04)` / `feat(08-04)` / `feat(08-04)` matching the RED/GREEN/substrate cadence.
- **Seeded fixedCreatedAt sentinel in Test 2** (`Date('2026-01-15T12:00:00.000Z')`) rather than the dynamic `new Date()` returned by the default seedCar helper. Plan action block explicitly allowed `"<fixed Date>"` in the pseudocode and the sentinel value makes Jest diff messages diagnosable on regression.

## Authentication Gates

None encountered. All work was local code + local test runs in the sibling backend repo.

## Known Stubs

`src/moderation/listingService.js` still has 2 handler bodies that throw `new ListingServiceError('not_implemented')`: `editListing` (LADM-01, Plan 08-06), `restoreListing` (LADM-05, Plan 08-05). These are INTENTIONAL per the Wave-2/3 split — each downstream plan replaces exactly one stub. The verifier surfaces them but does NOT flag the plan as incomplete; they are explicitly deferred to named downstream plans.

## TDD Gate Compliance

Phase 8 Plan 04 honored the RED/GREEN cycle on Tasks 1 + 3 (deleteListing service + test):
1. ✓ `test(08-04)` commit at `7268ac4` — 5 failing tests against the not_implemented stub (RED gate)
2. ✓ `feat(08-04)` commit at `4579b23` — service body fills stub, 5/5 tests green (GREEN gate)
3. (Task 2 router substrate — `feat(08-04)` at `2cfbfe0` — verified via static checks + Phase 7 rate-limit regression isolation pass + full listing-moderation suite at 78/78 green)

REFACTOR phase: not exercised (no cleanup needed — body landed in canonical substitution-only form). All commits visible in backend git log.

## Self-Check: PASSED

**Files created (verified to exist via `[ -f path ]` in backend repo):**

- `../backend-services/carEx-services/__tests__/listing-moderation/deleteListing.test.js` ✓

**Files modified (verified via `git diff HEAD~3` in backend repo):**

- `../backend-services/carEx-services/src/moderation/listingService.js` ✓ (Wave-1 deleteListing stub replaced with 94-line canonical body; suspendListing + archiveListing + 2 other stubs untouched)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` ✓ (+25 lines: 1 new route block; /ping + Suspend + Archive routes + KNOWN_LISTING_ERRORS + handleListingServiceError byte-identical)

**Commits (verified via `git log --oneline | grep <hash>` in carEx-services repo):**

- `7268ac4` `test(08-04): add failing deleteListing integration tests (LADM-04)` ✓
- `4579b23` `feat(08-04): implement deleteListing canonical audit-then-Car transaction (LADM-04)` ✓
- `2cfbfe0` `feat(08-04): add Delete route to listingRouter.js (LADM-04)` ✓

All three commits land in the BACKEND repo (`carEx-services`), per the cross-repo wiring documented in this plan's frontmatter. The SUMMARY.md commit (this file) lands in the carEx repo.
