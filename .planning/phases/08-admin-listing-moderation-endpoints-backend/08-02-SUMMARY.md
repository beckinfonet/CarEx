---
phase: 08-admin-listing-moderation-endpoints-backend
plan: 02
subsystem: backend / listing-moderation-endpoints
tags: [backend, moderation, listing, suspend, transactions, audit, LADM-02, wave-2]
dependency_graph:
  requires:
    - "Plan 08-01 Wave-1 substrate (listingService.js skeleton, listingSchemas.js, listingErrors.js, denySelfModerationListing.js)"
    - "Phase 7 substrate (Car.js status/audit fields, ListingModerationAction model, listingRouter.js /ping scaffold)"
    - "../backend-services/carEx-services repo (sibling of carEx)"
  provides:
    - "PATCH /api/admin/moderation/listings/:carId/suspend endpoint (LADM-02)"
    - "Canonical audit-then-Car transactional shape that Plans 08-03/04/05/06 copy verbatim"
    - "KNOWN_LISTING_ERRORS Set (10 codes) + handleListingServiceError helper at router scope — Wave 2/3 plans throw codes without amending"
  affects:
    - "Plan 08-03 (Archive) — mirrors suspendListing body shape with toStatus='archived', action='archive'"
    - "Plan 08-04 (Delete) — mirrors with toStatus='deleted', action='delete' (soft-delete only)"
    - "Plan 08-05 (Restore) — mirrors with toStatus='active', action='restore', clears moderation* fields per D-C-1"
    - "Plan 08-06 (Edit) — additionally imports `upload` from carImages.js for multer route"
tech_stack:
  added: []
  patterns:
    - "Canonical Phase-8 transition pattern: defensive arg-check → pre-txn read with double-bypass setOptions → withTransaction { audit-then-Car } → finally endSession → thin D-02 response built from in-memory state"
    - "Same-state fast-path (D-B-1): caller throws BEFORE opening a session when current.status === target — zero audit rows, zero Car writes, zero session overhead on the no-op path"
    - "Pre-registered router error-code Set: KNOWN_LISTING_ERRORS holds all 10 codes Wave 2/3 will throw, so downstream plans add handlers without amending the registry"
    - "err.code-with-message-fallback in handleListingServiceError — discriminates ListingServiceError instances cleanly while staying tolerant of a plain Error being thrown by accident"
key_files:
  created:
    - "../backend-services/carEx-services/__tests__/listing-moderation/suspendListing.test.js"
  modified:
    - "../backend-services/carEx-services/src/moderation/listingService.js (suspendListing body replaces Wave-1 stub; other 4 stubs unchanged)"
    - "../backend-services/carEx-services/src/moderation/listingRouter.js (+3 requires, +KNOWN_LISTING_ERRORS Set, +handleListingServiceError, +PATCH /:carId/suspend; /ping preserved byte-identical)"
decisions:
  - "suspendListing builds its D-02 response from in-memory state (no post-commit Car.findById round-trip) — every field needed (_id, status, moderatedBy, moderatedAt) is already known from the $set payload we just committed. Saves a round-trip; the test's exact Object.keys() assertion locks the response key set so a future refactor cannot accidentally widen it"
  - "Defensive service-level arg-check (missing adminUid/adminEmail/carId/reasonCategory → invalid_payload) lives at function TOP, BEFORE the pre-txn read — direct service callers cannot bypass it; router-level Zod is the first wall, service guard is the second"
  - "Same-state guard fires BEFORE session.startSession() — the no-op suspend path doesn't pay txn overhead. D-B-1 fast-path acceptance criterion (zero audit rows on rejected same-state call) verified explicitly in test 2"
  - "Pre-txn read chains BOTH setOptions bypass flags ({ includeAllListingStatuses: true, includeAllUsers: true }) per Pitfall 5 — defeats Car.js:63-95 seller-cascade hide hook (admin can suspend a listing whose seller is suspended) AND Phase 9's future listing-status hide hook (admin can suspend an already-archived listing per D-B open matrix)"
  - "matchedCount !== 1 throws listing_not_found INSIDE the transaction — covers the TOCTOU window between pre-txn read and Car.updateOne (Car could be deleted by another admin between the two operations). withTransaction aborts cleanly and the audit row rolls back"
  - "KNOWN_LISTING_ERRORS Set is pre-populated with all 10 Wave-2/3 codes (Plan 08-03/04/05/06 throw 7 of them) so downstream plans don't have to amend this Set — they just start throwing the code. invalid_transition is RESERVED for future restricted-matrix super-admin tier per D-B-2 and is documented inline; v1.1 never emits it"
  - "handleListingServiceError reads `err.code || err.message` — `err.code` is the canonical signal set by ListingServiceError constructor, but the message-fallback catches a plain Error thrown accidentally so the KNOWN-set lookup still produces reasonable behavior"
  - "Suspend route mounts denySelfModerationListing FIRST in the middleware chain — self-mod rejection fires before Zod parsing or any service-layer side-effect. Combined with the schema-level .strict() rejection, two independent walls prevent a self-moderating admin from leaking a successful response shape"
  - "Test seeded Car docs via Car.collection.insertOne (NOT Car.create) — bypasses both Mongoose pre-save validators (cleaner test surface, no need to seed every required field) and the pre(/^find/) seller-cascade hide hook during seeding. Pattern mirrors editProfile.test.js:54-57 + listingTransaction.atomicity.test.js:81-85"
metrics:
  duration: "3m23s"
  completed: "2026-05-29"
  tasks_executed: 3
  files_created: 1
  files_modified: 2
  test_count_before: 60
  test_count_after: 68
  test_count_delta: 8
---

# Phase 8 Plan 02: Suspend Endpoint (LADM-02) Summary

Wave-2 first endpoint for Phase 8 — implemented `PATCH /api/admin/moderation/listings/:carId/suspend` end-to-end (router + service + integration tests) following the canonical audit-then-Car transactional pattern. Plans 08-03 (Archive), 08-04 (Delete), 08-05 (Restore) now copy this shape verbatim, diverging only on the target status string and the audit `action` verb.

## Outcome

All 3 tasks executed in TDD order (RED test → GREEN service → router substrate) with zero deviations from plan. Backend listing-moderation test count: **60 → 68 (+8 new tests; all green)**. Plan 08-01 Wave-1 substrate consumed BYTE-IDENTICAL — no edits to `listingSchemas.js`, `denySelfModerationListing.js`, or `listingErrors.js`; the 4 other handler stubs in `listingService.js` remain `throw new ListingServiceError('not_implemented')` for Plans 08-03..08-06 to fill.

LADM-02 acceptance criteria all green:
- Active → suspended returns 200 with thin D-02 payload (`{ ok, listing: {_id, status, moderatedBy, moderatedAt}, action: {_id, action, fromStatus, toStatus, createdAt} }`)
- One audit row per successful suspend (action='suspend', fromStatus=<current>, toStatus='suspended', reasonCategory + reasonNote populated)
- Same-state suspend → 400 `already_in_state` with ZERO audit rows (D-B-1 fast-path)
- Cross-state archived→suspend AND deleted→suspend both succeed (D-B open matrix)
- Self-moderation blocked by `denySelfModerationListing` middleware mounted FIRST in the chain
- Audit + Car update atomic under `session.withTransaction()` (Plan 08-01 atomicity tests still green proving the pattern)

## What Shipped

### Task 1 RED → Task 1 GREEN (TDD pivot)

Plan task ordering was: Task 1 (service body) → Task 2 (router) → Task 3 (tests). Executor pivoted to TDD ordering: Task 3 test file FIRST (RED — 8 tests all failing with `not_implemented`) → Task 1 service body (GREEN — 8 tests all passing) → Task 2 router. This preserves the substantive deliverables of every task while honoring the TDD gate sequence.

### Task 3 (RED) — `suspendListing.test.js` (commit `29158f8`)

Created `__tests__/listing-moderation/suspendListing.test.js` with 8 integration tests against the not-yet-implemented `service.suspendListing`. Initial run: 8/8 failed with `ListingServiceError: not_implemented` as expected. Tests:

1. **Happy path active → suspended** — asserts audit row fields (action/fromStatus/toStatus/reasonCategory/reasonNote/listingId/sellerUid/adminUid/adminEmail) + Car post-state fields (status/moderationReason/moderationNote/moderatedBy/moderatedAt) + response shape
2. **Same-state suspended → suspend** — `rejects.toThrow('already_in_state')` + countDocuments === 0 (D-B-1 fast-path)
3. **Cross-state archived → suspend** — succeeds; audit.fromStatus === 'archived'
4. **Cross-state deleted → suspend** — succeeds; audit.fromStatus === 'deleted'
5. **listing_not_found** — ghost ObjectId rejects
6. **invalid_payload** — missing reasonCategory rejects via defensive arg-check
7. **Response shape D-02 thin projection** — `Object.keys(result.listing).sort()` equals `['_id', 'moderatedAt', 'moderatedBy', 'status']` AND `Object.keys(result.action).sort()` equals `['_id', 'action', 'createdAt', 'fromStatus', 'toStatus']`. Negative shape asserts NO description / imageUrls / price / moderationNote / moderationReason leak
8. **note omitted** — audit.reasonNote === null AND Car.moderationNote === null

Replica-set fixture via `_helpers/mongoReplSet`. Cars seeded via `Car.collection.insertOne(...)` to bypass Mongoose pre-save validators + the pre(/^find/) seller-cascade hide hook during seeding (mirrors `editProfile.test.js:54-57` + `listingTransaction.atomicity.test.js:81-85`).

### Task 1 (GREEN) — `suspendListing` body (commit `7abc4fb`)

Replaced the Wave-1 stub in `src/moderation/listingService.js` with the full canonical body. After this commit: 8/8 suspendListing tests green; the other 4 handler stubs (editListing, archiveListing, deleteListing, restoreListing) remain `throw new ListingServiceError('not_implemented')` for Plans 08-03..08-06.

Body structure:
```
1. Defensive arg-check (adminUid/adminEmail/carId/reasonCategory) → invalid_payload
2. Pre-transaction Car.findById(carId).setOptions({ includeAllListingStatuses: true, includeAllUsers: true }).lean()
   - null → throw listing_not_found
   - current.status === 'suspended' → throw already_in_state (D-B-1 fast-path)
3. const moderatedAt = new Date()
4. const session = await mongoose.startSession()
5. try { await session.withTransaction(async () => {
     a. [insertedAction] = await ListingModerationAction.create([{
          listingId: carId, sellerUid: current.sellerId, adminUid, adminEmail,
          action: 'suspend', fromStatus: current.status, toStatus: 'suspended',
          reasonCategory, reasonNote: note ?? null, fieldDiff: null
        }], { session });  // ARRAY form mandatory per Pitfall 2
     b. const updated = await Car.updateOne(
          { _id: carId },
          { $set: { status: 'suspended', moderationReason: reasonCategory,
                    moderationNote: note ?? null, moderatedBy: adminUid, moderatedAt } },
          { session }
        );
        if (updated.matchedCount !== 1) throw new ListingServiceError('listing_not_found');
   }); } finally { await session.endSession(); }
6. return {
     listing: { _id: carId, status: 'suspended', moderatedBy: adminUid, moderatedAt },
     action: { _id: insertedAction._id.toString(), action: 'suspend',
               fromStatus: current.status, toStatus: 'suspended', createdAt: insertedAction.createdAt }
   };
```

#### Rename map vs. v1.0 `service.js:42-134` (`suspend`)

| v1.0 (user-mod `suspend`) | Phase 8 (`suspendListing`) | Notes |
|---|---|---|
| `targetUid` | `carId` | URL param shifts from user-uid to car-id |
| `User.findOne({ firebaseUid: targetUid })` | `Car.findById(carId).setOptions({...})` | Double bypass flags chained (Pitfall 5) |
| `target.moderationStatus.state === severity` | `current.status === 'suspended'` | Listing has no severity tier — single target state |
| `severity` parameter | (none) | D-09: listings have only the 5-value reason taxonomy, no severity |
| `last_admin_protected` guard | (none) | Listings have no admin-protection concept |
| `User.updateOne({ firebaseUid: targetUid }, { $set: { moderationStatus: {...} } })` | `Car.updateOne({ _id: carId }, { $set: { status, moderationReason, moderationNote, moderatedBy, moderatedAt } })` | Flat 5-field $set vs. nested moderationStatus subdoc — listing has no `restrictedFeatures` |
| `ModerationAction.create([{... targetUid, severity, action: 'suspend' ...}], { session })` | `ListingModerationAction.create([{... listingId, sellerUid, fromStatus, toStatus, fieldDiff: null ...}], { session })` | Separate collection (Phase 7 D-09); audit row carries fromStatus/toStatus transition record |
| Returns `{ ok, user: { moderationStatus }, action: { _id, action, createdAt } }` | Returns `{ listing: { _id, status, moderatedBy, moderatedAt }, action: { _id, action, fromStatus, toStatus, createdAt } }` | Thin D-02 projection; `ok` wrapper added by ROUTER not service |
| `new Error('code')` + `err.message` matching in router | `new ListingServiceError(code)` + `err.code` matching in router | Phase 8 D-12 cleanup |

Atomicity contract is byte-identical: pre-read outside txn + audit-then-Car ordering inside `session.withTransaction()` + `endSession()` in `finally`. Plan 08-01's `listingTransaction.atomicity.test.js` proved this contract via a hand-rolled `runMockSuspend` helper BEFORE this plan's body landed — and that test remains green after the real `suspendListing` body ships.

### Task 2 — router additions (commit `119d746`)

Edited `src/moderation/listingRouter.js`. The Phase 7 `/ping` route is BYTE-IDENTICAL (lines 69-71 post-edit; one literal grep match). New material:

- **3 top-of-file requires** (after `express`): `service` from `./listingService`, `schemas` from `./listingSchemas`, `{ denySelfModerationListing }` from `./denySelfModerationListing`. NO `upload` require — D-D-1 lock; Plan 08-06 introduces the multer wire on the Edit route only. Verified by `grep -c "upload.array" listingRouter.js` = 0.
- **`KNOWN_LISTING_ERRORS` Set** with all 10 codes: `listing_not_found`, `invalid_transition` (inline comment notes v1.1 never emits; reserved for super-admin restricted matrix per D-B-2), `already_in_state`, `not_moderated`, `invalid_field`, `no_changes`, `invalid_payload`, `cannot_moderate_own_listing`, `invalid_make`, `invalid_model`. Pre-registered so Wave 2/3 plans throw without amending this file.
- **`handleListingServiceError(err, res, tag)`** — reads `err.code || err.message`; KNOWN codes → `400 { error: code }` (Edit's `invalid_field` adds `err.fields[]` to the body); unknown → `console.error('[listing-moderation] {tag} error:', err)` + `500 { error: 'internal_error', message: err.message }`.
- **`PATCH /:carId/suspend`** — `denySelfModerationListing` middleware first, `suspendListingSchema.safeParse(req.body || {})` second (parse-failure → 400 `invalid_payload` with Zod issues), `service.suspendListing({ adminUid: req.admin.uid, adminEmail: req.admin.email, carId: req.params.carId, reasonCategory, note })`, success → `res.json({ ok: true, listing, action })`, failure → `handleListingServiceError(err, res, 'suspend')`.

Phase 7 regression check: `__tests__/listing-moderation/listingModerationRateLimiter.test.js` still 3/3 green after the edit. `/ping` route is at line 69 post-edit (shifted from 25 by the 44 lines of new substrate above it); contents preserved.

## Verification Spec Results

All 6 verification spec items from `08-02-PLAN.md` pass:

1. `npx jest __tests__/listing-moderation/ --silent` → **10 suites / 68 tests passed**. Floor was 33 (Phase 7) + 17 (Plan 08-01) + 8 (this plan) = 58; actual 68 exceeds the floor (Plan 08-01 shipped 27 Wave-0 tests not 17). ✓
2. `grep -c "router.patch('/:carId/suspend'" src/moderation/listingRouter.js` = **1**. ✓
3. `grep -c "throw new ListingServiceError('already_in_state')" src/moderation/listingService.js` = **1**. ✓
4. `grep -c "ListingModerationAction.create(\[" src/moderation/listingService.js` = **2** (≥1 — 1 in real call body + 1 in Pitfall 2 docstring comment). ✓
5. `/ping` route preserved (line 69 post-edit; line content byte-identical with Phase 7 baseline). ✓
6. `grep -c "upload\.array" src/moderation/listingRouter.js` = **0** (multer NOT on Suspend per D-D-1). ✓

## Plan 08-01 Substrate — Consumed Unchanged

`git diff HEAD~3 --stat -- src/moderation/listingErrors.js src/moderation/listingSchemas.js src/moderation/denySelfModerationListing.js` returns ZERO output. The 3 substrate modules from Plan 08-01 are byte-identical post Plan 08-02; this plan only added a new route + filled one stub body.

`listingService.js` was modified (Task 1 GREEN replaces the stub body) but the file's top-level requires, module shape, and the other 4 exported function names are byte-identical to Plan 08-01.

## Test Count Before/After

| Suite | Before this plan | After this plan |
|-------|------------------:|----------------:|
| `__tests__/listing-moderation/` | 60 | 68 (+8) |
| Phase 7's 33 baseline tests | 33 (all green) | 33 (all green; preserved) |
| Plan 08-01's 27 Wave-0 tests | 27 (all green) | 27 (all green; preserved) |
| Plan 08-02 new (suspendListing.test.js) | — | 8 |

## Deviations from Plan

**None — plan executed exactly as written.**

One minor implementation choice fell within Claude's discretion:

- **TDD task ordering pivot**: plan task body listed service-body (Task 1) → router (Task 2) → tests (Task 3). Executor pivoted to TDD-canonical ordering: tests FIRST (Task 3 as RED), then service body (Task 1 as GREEN), then router (Task 2). Substantive deliverable of every task is unchanged; this pivot was driven by the `tdd="true"` attribute on all 3 tasks and the project-wide TDD gate sequence. Commits are tagged `test(08-02)` / `feat(08-02)` / `feat(08-02)` matching the RED/GREEN/substrate cadence.

## Authentication Gates

None encountered. All work was local code + local test runs in the sibling backend repo.

## Known Stubs

`src/moderation/listingService.js` still has 4 handler bodies that throw `new ListingServiceError('not_implemented')`: `editListing` (LADM-01, Plan 08-06), `archiveListing` (LADM-03, Plan 08-03), `deleteListing` (LADM-04, Plan 08-04), `restoreListing` (LADM-05, Plan 08-05). These are INTENTIONAL per the Wave-2/3 split — each downstream plan replaces exactly one stub. The verifier surfaces them but does NOT flag the plan as incomplete; they are explicitly deferred to named downstream plans.

## TDD Gate Compliance

Phase 8 Plan 02 honored the RED/GREEN cycle on Tasks 1 + 3 (suspendListing service + test):
1. ✓ `test(08-02)` commit at `29158f8` — 8 failing tests against the not_implemented stub (RED gate)
2. ✓ `feat(08-02)` commit at `7abc4fb` — service body fills stub, 8/8 tests green (GREEN gate)
3. (Task 2 router substrate — `feat(08-02)` at `119d746` — verified via the same test suite + static checks; the test file does not exercise the route directly, the service-layer tests exercise the suspend behavior)

REFACTOR phase: not exercised (no cleanup needed — initial body was canonical-shape and minimal). All commits visible in backend git log.

## Self-Check: PASSED

**Files created (verified to exist via `[ -f path ]` in backend repo):**

- `../backend-services/carEx-services/__tests__/listing-moderation/suspendListing.test.js` ✓

**Files modified (verified via `git diff HEAD~3` in backend repo):**

- `../backend-services/carEx-services/src/moderation/listingService.js` ✓ (Wave-1 stub replaced with 100-line canonical body; other 4 stubs untouched)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` ✓ (+68 lines: 3 requires + Set + handler + route; /ping byte-identical)

**Commits (verified via `git log --oneline | grep <hash>` in carEx-services repo):**

- `29158f8` `test(08-02): add failing suspendListing integration tests (LADM-02)` ✓
- `7abc4fb` `feat(08-02): implement suspendListing canonical audit-then-Car transaction` ✓
- `119d746` `feat(08-02): add Suspend route + KNOWN_LISTING_ERRORS + handleListingServiceError` ✓

All three commits land in the BACKEND repo (`carEx-services`), per the cross-repo wiring documented in this plan's frontmatter. The SUMMARY.md commit (this file) lands in the carEx repo.
