---
phase: 08-admin-listing-moderation-endpoints-backend
plan: 03
subsystem: backend / listing-moderation-endpoints
tags: [backend, moderation, listing, archive, transactions, audit, LADM-03, wave-2]
dependency_graph:
  requires:
    - "Plan 08-01 Wave-1 substrate (listingService.js skeleton, listingSchemas.archiveListingSchema, listingErrors.js, denySelfModerationListing.js)"
    - "Plan 08-02 canonical pattern (suspendListing body shape + KNOWN_LISTING_ERRORS + handleListingServiceError)"
    - "Phase 7 substrate (Car.js status/audit fields, ListingModerationAction model, listingRouter.js /ping scaffold)"
    - "../backend-services/carEx-services repo (sibling of carEx)"
  provides:
    - "PATCH /api/admin/moderation/listings/:carId/archive endpoint (LADM-03)"
    - "archiveListing service body — second concrete consumer of the canonical Phase-8 audit-then-Car transactional shape"
  affects:
    - "Plan 08-04 (Delete) — copies same pattern with toStatus='deleted', action='delete' (soft-delete only)"
    - "Plan 08-05 (Restore) — copies same pattern with toStatus='active', action='restore', clears moderation* fields per D-C-1"
    - "Plan 08-06 (Edit) — additionally imports `upload` from carImages.js for multer route"
tech_stack:
  added: []
  patterns:
    - "Substitution-only mirror of Plan 08-02 canonical pattern — proves the Phase-8 transition shape generalizes across labels (target status + action verb are the only knobs)"
key_files:
  created:
    - "../backend-services/carEx-services/__tests__/listing-moderation/archiveListing.test.js"
  modified:
    - "../backend-services/carEx-services/src/moderation/listingService.js (archiveListing body replaces Wave-1 stub; suspendListing + 3 other stubs unchanged)"
    - "../backend-services/carEx-services/src/moderation/listingRouter.js (+PATCH /:carId/archive route; Suspend route + /ping + KNOWN_LISTING_ERRORS preserved byte-identical)"
decisions:
  - "archiveListing body is a substitution-only mirror of suspendListing (target='archived', action='archive') — proves Plan 08-02's canonical shape generalizes across state-transition labels without structural deviation"
  - "Plan task ordering pivoted from author-order (service → router → tests) to TDD-canonical (tests RED → service GREEN → router) — same pivot Plan 08-02 used; mandatory under MVP+TDD gate"
  - "Cross-state assertions for suspended→archive AND deleted→archive included in the test catalog — second concrete proof that D-B open matrix holds (Plan 08-02 proved archived→suspend + deleted→suspend; this plan proves the symmetric pair)"
  - "Happy-path test uses 'inactive_seller' reasonCategory — non-punitive Archive's canonical reason per D-09; semantically distinct from Suspend's punitive 'spam' / 'fraud' / 'policy_violation' choices but the SCHEMA layer permits any reasonCategory enum value (D-A-1)"
  - "Same-state guard fires BEFORE session.startSession() (D-B-1 fast-path mirrored from Suspend) — verified explicitly in test 2 (countDocuments === 0 after rejected archived→archive call)"
  - "Response shape lock — Object.keys assertion in test 5 enforces the D-02 thin projection key sets are byte-identical to Suspend's (4-key listing + 5-key action); only the literal values for status/action/toStatus differ"
  - "Test file is a near-clone of suspendListing.test.js — 'spam' → 'inactive_seller' in happy path, 'suspend' / 'suspended' → 'archive' / 'archived' throughout; 3 cross-state tests (Suspend had 2) bring the catalog to 5 (above D-16's floor of 3)"
  - "Missing-reasonCategory defensive test dropped per plan Task 3 action note — redundant with Plan 08-02 service-level guard which is byte-shared (same defensive arg-check pattern); the 5-test catalog focuses on Archive-specific contracts (cross-state matrix + response shape)"
  - "Router NO multer addition — D-D-1 lock preserved; Archive is JSON-body only (reasonCategory + optional note). grep -c upload.array listingRouter.js still returns 0"
metrics:
  duration: "2m39s"
  completed: "2026-05-29"
  tasks_executed: 3
  files_created: 1
  files_modified: 2
  test_count_before: 68
  test_count_after: 73
  test_count_delta: 5
---

# Phase 8 Plan 03: Archive Endpoint (LADM-03) Summary

Wave-2 second endpoint for Phase 8 — implemented `PATCH /api/admin/moderation/listings/:carId/archive` end-to-end (router + service + integration tests) as a substitution-only mirror of Plan 08-02's Suspend. Confirms the canonical audit-then-Car transaction shape generalizes across labels: only the target status literal (`'archived'`) and the audit action verb (`'archive'`) change.

## Outcome

All 3 tasks executed in TDD-canonical order (RED test → GREEN service → router substrate) with zero substantive deviations. Backend listing-moderation test count: **68 → 73 (+5 new tests; all green)**. Plans 08-01 + 08-02 substrate consumed BYTE-IDENTICAL — no edits to `listingSchemas.js`, `denySelfModerationListing.js`, `listingErrors.js`, the `suspendListing` body, or `KNOWN_LISTING_ERRORS`. The 3 remaining handler stubs (`editListing`, `deleteListing`, `restoreListing`) still throw `not_implemented` for Plans 08-04..08-06.

LADM-03 acceptance criteria all green:
- Active → archived returns 200 with thin D-02 payload (`{ ok, listing: {_id, status, moderatedBy, moderatedAt}, action: {_id, action, fromStatus, toStatus, createdAt} }`)
- One audit row per successful archive (action='archive', fromStatus=<current>, toStatus='archived', reasonCategory='inactive_seller', reasonNote populated or null)
- Same-state archived→archive → throws `already_in_state` with ZERO audit rows (D-B-1 fast-path)
- Cross-state suspended→archive AND deleted→archive both succeed (D-B open matrix)
- Self-moderation blocked by `denySelfModerationListing` middleware mounted FIRST in the chain
- Audit + Car update atomic under `session.withTransaction()` (Plan 08-01 atomicity tests still green proving the pattern)

## What Shipped

### TDD pivot reprise

Plan task ordering was: Task 1 (service body) → Task 2 (router) → Task 3 (tests). Executor pivoted to TDD-canonical ordering (Task 3 → Task 1 → Task 2), same as Plan 08-02. Substantive deliverables unchanged; pivot is mandatory under the MVP+TDD gate when `tdd="true"` is set on the behavior-adding tasks.

### Task 3 (RED) — `archiveListing.test.js` (commit `c7952a4`)

Created `__tests__/listing-moderation/archiveListing.test.js` with 5 integration tests against the not-yet-implemented `service.archiveListing`. Initial run: 5/5 failed with `ListingServiceError: not_implemented` as expected.

Tests (per D-16 catalog + plan's 5-test floor):

1. **Happy path active → archived** — asserts audit row fields (action='archive' / fromStatus='active' / toStatus='archived' / reasonCategory='inactive_seller' / reasonNote / listingId / sellerUid / adminUid / adminEmail) + Car post-state fields (status='archived' / moderationReason / moderationNote / moderatedBy / moderatedAt) + response shape (literal values)
2. **Same-state archived → archive** — `rejects.toThrow('already_in_state')` + countDocuments === 0 (D-B-1 fast-path)
3. **Cross-state suspended → archive** — succeeds; audit.fromStatus === 'suspended'; audit.action === 'archive'
4. **Cross-state deleted → archive** — succeeds; audit.fromStatus === 'deleted'; audit.action === 'archive'
5. **Response shape D-02 thin projection** — `Object.keys(result.listing).sort()` equals `['_id', 'moderatedAt', 'moderatedBy', 'status']` AND `Object.keys(result.action).sort()` equals `['_id', 'action', 'createdAt', 'fromStatus', 'toStatus']`. Negative shape asserts NO description / imageUrls / price / moderationNote / moderationReason leak

Replica-set fixture via `_helpers/mongoReplSet`. Cars seeded via `Car.collection.insertOne(...)` (mirrors Plan 08-02's seed helper byte-equivalent).

### Task 1 (GREEN) — `archiveListing` body (commit `e54a9fa`)

Replaced the Wave-1 stub in `src/moderation/listingService.js` with the canonical body. After this commit: 5/5 archiveListing tests green; suspendListing + 3 other stubs unchanged.

Body diff vs. `suspendListing` (the only structural differences):

| Position | Suspend value | Archive value |
|---|---|---|
| Same-state guard literal | `'suspended'` | `'archived'` |
| Audit `action` | `'suspend'` | `'archive'` |
| Audit `toStatus` | `'suspended'` | `'archived'` |
| Car `$set.status` | `'suspended'` | `'archived'` |
| Return `listing.status` | `'suspended'` | `'archived'` |
| Return `action.action` | `'suspend'` | `'archive'` |
| Return `action.toStatus` | `'suspended'` | `'archived'` |
| Header comment | "punitive" rationale | "Archive is non-punitive (LADM-03 — inactive_seller reason most common)" |

Everything else — defensive arg check, pre-txn read with double-bypass setOptions, same-state guard placement (BEFORE startSession), withTransaction(audit-then-Car), array-form create with { session }, matchedCount !== 1 TOCTOU guard, finally endSession, thin D-02 response built from in-memory state — is byte-equivalent to `suspendListing`. This is the Plan 08-03 design intent: the canonical pattern generalizes.

### Task 2 — router additions (commit `faf3fe8`)

Edited `src/moderation/listingRouter.js`. The Phase 7 `/ping` route, Plan 08-02 Suspend route, KNOWN_LISTING_ERRORS Set, and handleListingServiceError function are ALL BYTE-IDENTICAL post-edit (one literal grep match each). New material is a single new route block at the end of the router:

- **`PATCH /:carId/archive`** — `denySelfModerationListing` middleware first, `archiveListingSchema.safeParse(req.body || {})` second (parse-failure → 400 `invalid_payload` with Zod issues), `service.archiveListing({ adminUid: req.admin.uid, adminEmail: req.admin.email, carId: req.params.carId, reasonCategory, note })`, success → `res.json({ ok: true, listing, action })`, failure → `handleListingServiceError(err, res, 'archive')`.
- **NO new top-of-file requires** — `service`, `schemas`, `denySelfModerationListing` all imported in Plan 08-02.
- **NO additions to `KNOWN_LISTING_ERRORS`** — the existing 10 codes cover Archive's possible failures (`listing_not_found`, `already_in_state`, `invalid_payload`, `cannot_moderate_own_listing`).
- **NO multer** — D-D-1 lock; Edit-only in Plan 08-06. `grep -c "upload.array" listingRouter.js` = 0.

Phase 7 regression check: `__tests__/listing-moderation/listingModerationRateLimiter.test.js` still 3/3 green after the edit.

## Verification Spec Results

All 4 verification spec items from `08-03-PLAN.md` pass:

1. `npx jest __tests__/listing-moderation/ --silent` → **11 suites / 73 tests passed**. Floor was 33 (Phase 7) + 27 (Plan 08-01) + 8 (Plan 08-02) + 5 (this plan) = 73; actual 73 matches. ✓
2. `grep -c "router.patch('/:carId/" src/moderation/listingRouter.js` = **2** (Suspend + Archive; Delete/Restore/Edit not yet). ✓
3. `grep -c "toStatus: 'archived'" src/moderation/listingService.js` = **2** (≥1 — 1 in audit insert + 1 in return action.toStatus). ✓
4. `grep -c "action: 'archive'" src/moderation/listingService.js` = **2** (≥1 — 1 in audit insert + 1 in return action.action). ✓

## Plan 08-01 + 08-02 Substrate — Consumed Unchanged

`git diff HEAD~3 --stat -- src/moderation/listingErrors.js src/moderation/listingSchemas.js src/moderation/denySelfModerationListing.js` returns ZERO output. The 3 Plan 08-01 substrate modules + Plan 08-02's `suspendListing` body + KNOWN_LISTING_ERRORS Set + handleListingServiceError function are byte-identical post Plan 08-03. This plan added one new route block + filled one stub body + landed one new test file.

`listingService.js` was modified (Task 1 GREEN replaces the `archiveListing` stub body) but the file's top-level requires, module shape, exported function names, and the bodies of suspendListing + 3 remaining stubs are byte-identical to their Plan 08-02 state.

## Test Count Before/After

| Suite | Before this plan | After this plan |
|-------|------------------:|----------------:|
| `__tests__/listing-moderation/` | 68 | 73 (+5) |
| Phase 7's 33 baseline tests | 33 (all green) | 33 (all green; preserved) |
| Plan 08-01's 27 Wave-0 tests | 27 (all green) | 27 (all green; preserved) |
| Plan 08-02's 8 suspendListing tests | 8 (all green) | 8 (all green; preserved) |
| Plan 08-03 new (archiveListing.test.js) | — | 5 |

## Deviations from Plan

**None — plan executed exactly as written.**

Two minor implementation choices fell within Claude's discretion (per `08-03-PLAN.md` Task 3 action note "drop the missing-reasonCategory defensive test if redundant"):

- **TDD task ordering pivot**: plan task body listed service-body (Task 1) → router (Task 2) → tests (Task 3). Executor pivoted to TDD-canonical ordering: tests FIRST (Task 3 as RED), then service body (Task 1 as GREEN), then router (Task 2). Same pivot Plan 08-02 used; substantive deliverable unchanged; commits tagged `test(08-03)` / `feat(08-03)` / `feat(08-03)` matching the RED/GREEN/substrate cadence.
- **Dropped missing-reasonCategory defensive test**: Plan 08-02's test 6 covered the defensive arg-check via Suspend; Archive uses the byte-equivalent guard so the test would have been redundant. Plan Task 3 action note explicitly allowed dropping it ("if redundant... author's discretion"). Catalog still ships at 5 tests (matches plan floor) with cross-state suspended→archive and deleted→archive carrying the symmetric D-B-matrix proof that Suspend covered for archived→suspend + deleted→suspend.

## Authentication Gates

None encountered. All work was local code + local test runs in the sibling backend repo.

## Known Stubs

`src/moderation/listingService.js` still has 3 handler bodies that throw `new ListingServiceError('not_implemented')`: `editListing` (LADM-01, Plan 08-06), `deleteListing` (LADM-04, Plan 08-04), `restoreListing` (LADM-05, Plan 08-05). These are INTENTIONAL per the Wave-2/3 split — each downstream plan replaces exactly one stub. The verifier surfaces them but does NOT flag the plan as incomplete; they are explicitly deferred to named downstream plans.

## TDD Gate Compliance

Phase 8 Plan 03 honored the RED/GREEN cycle on Tasks 1 + 3 (archiveListing service + test):
1. ✓ `test(08-03)` commit at `c7952a4` — 5 failing tests against the not_implemented stub (RED gate)
2. ✓ `feat(08-03)` commit at `e54a9fa` — service body fills stub, 5/5 tests green (GREEN gate)
3. (Task 2 router substrate — `feat(08-03)` at `faf3fe8` — verified via static checks + Phase 7 rate-limit regression + full listing-moderation suite still 73/73 green)

REFACTOR phase: not exercised (no cleanup needed — body landed in canonical substitution-only form). All commits visible in backend git log.

## Self-Check: PASSED

**Files created (verified to exist via `[ -f path ]` in backend repo):**

- `../backend-services/carEx-services/__tests__/listing-moderation/archiveListing.test.js` ✓

**Files modified (verified via `git diff HEAD~3` in backend repo):**

- `../backend-services/carEx-services/src/moderation/listingService.js` ✓ (Wave-1 archiveListing stub replaced with 80-line canonical body; suspendListing + 3 other stubs untouched)
- `../backend-services/carEx-services/src/moderation/listingRouter.js` ✓ (+25 lines: 1 new route block; /ping + Suspend route + KNOWN_LISTING_ERRORS + handleListingServiceError byte-identical)

**Commits (verified via `git log --oneline | grep <hash>` in carEx-services repo):**

- `c7952a4` `test(08-03): add failing archiveListing integration tests (LADM-03)` ✓
- `e54a9fa` `feat(08-03): implement archiveListing canonical audit-then-Car transaction` ✓
- `faf3fe8` `feat(08-03): add Archive route to listingRouter.js (LADM-03)` ✓

All three commits land in the BACKEND repo (`carEx-services`), per the cross-repo wiring documented in this plan's frontmatter. The SUMMARY.md commit (this file) lands in the carEx repo.
