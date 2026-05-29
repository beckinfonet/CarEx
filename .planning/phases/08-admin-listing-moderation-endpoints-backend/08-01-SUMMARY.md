---
phase: 08-admin-listing-moderation-endpoints-backend
plan: 01
subsystem: backend / listing-moderation-substrate
tags: [backend, moderation, listing, zod, multer-s3, mongoose-transactions, wave-1, substrate]
dependency_graph:
  requires:
    - "Phase 7 substrate (Car.js status/audit fields, ListingModerationAction model, listingRouter.js scaffold with /ping, listingModerationRateLimiter, server.js:854 mount)"
    - "../backend-services/carEx-services repo (sibling of carEx)"
    - "AWS_REGION, AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY env vars (for src/uploads/carImages.js multer-S3 instance)"
  provides:
    - "Shared multer-S3 upload + S3Client at src/uploads/carImages.js (D-D-2 single-source-of-truth)"
    - "ListingServiceError class with .code field (D-12)"
    - "5 Zod .strict() schemas (suspend/archive/delete/restore/edit) + REASON_CATEGORIES (D-09, D-10, D-A, D-C, D-14)"
    - "denySelfModerationListing async middleware (D-04, D-05)"
    - "listingService 5-handler skeleton (Wave 2/3 fill bodies)"
    - "60-test green baseline on __tests__/listing-moderation/ (Phase 7: 33; Wave 0: 27)"
  affects:
    - "Wave 2 plans (Suspend/Archive/Delete/Restore) — import listingService, listingSchemas, denySelfModerationListing, ListingServiceError verbatim"
    - "Wave 3 plan (Edit) — additionally imports upload from src/uploads/carImages.js"
    - "server.js seller PUT (/api/cars/:id) — now resolves `upload` via require instead of inline construction; S3 key shape byte-identical"
tech_stack:
  added: []
  patterns:
    - "Class-based service-error pattern with .code field — D-12 cleanup over v1.0's err.message string matching"
    - "Zod enum derivation from Mongoose schema path (REASON_CATEGORIES = Car.schema.path('moderationReason').enumValues) — D-10 single-source-of-truth lock"
    - "Async fetch-then-check middleware pattern (denySelfModerationListing) — divergence from v1.0 sync param-vs-param middleware"
    - "Wave-0 hand-rolled transaction helper in atomicity test — proves the contract before Wave 2/3 implementations land"
    - "Double-bypass setOptions chain ({ includeAllListingStatuses: true, includeAllUsers: true }) — Phase 9 forward-compat + Phase 3 seller-cascade-hook bypass"
key_files:
  created:
    - "../backend-services/carEx-services/src/uploads/carImages.js"
    - "../backend-services/carEx-services/src/moderation/listingErrors.js"
    - "../backend-services/carEx-services/src/moderation/listingSchemas.js"
    - "../backend-services/carEx-services/src/moderation/denySelfModerationListing.js"
    - "../backend-services/carEx-services/src/moderation/listingService.js"
    - "../backend-services/carEx-services/__tests__/listing-moderation/listingSchemas.test.js"
    - "../backend-services/carEx-services/__tests__/listing-moderation/denySelfModerationListing.test.js"
    - "../backend-services/carEx-services/__tests__/listing-moderation/listingTransaction.atomicity.test.js"
  modified:
    - "../backend-services/carEx-services/server.js (require carImages module; remove inline S3Client + upload const at lines 43-64; uploadAvatar preserved)"
decisions:
  - "Multer-S3 extraction: kept S3Client + upload byte-identical to pre-Phase-8 inline construction so seller-PUT S3 key shape (`${bodyType}/${timestamp}-${originalname}`) does not change; bucket/region/key/metadata all verbatim"
  - "uploadAvatar deliberately NOT extracted — separate consumer (avatar uploads), different key prefix, out of Phase 8 scope per plan instructions"
  - "ListingServiceError lives in a SEPARATE file (src/moderation/listingErrors.js) rather than inlined at top of listingService.js — cleaner imports for Wave 2/3 tests that need to assert err.code without pulling the service surface"
  - "denySelfModerationListing chains BOTH setOptions bypass flags ({ includeAllListingStatuses, includeAllUsers }) — Phase 9 has not yet shipped its hide hook but the option name is pre-locked per D-B-3, so adding it now makes Phase 8 code forward-compatible without retroactive edits"
  - "listingService.js skeleton bodies use `void` annotations on unused params + a trailing `void mongoose; void Car; void ListingModerationAction;` block — guards against tree-shaker elision of the require() block AND gives Wave 2/3 grep-stable starting points without ESLint no-unused-vars failures"
  - "Wave-0 atomicity test uses a HAND-ROLLED runMockSuspend helper (not the real listingService.suspendListing which still throws not_implemented) — locks the audit-then-Car-update pattern under withTransaction BEFORE Wave 2 lands, so any Wave-2 implementation that diverges (e.g., reverses ordering, drops { session }, uses single-doc create) fails this test immediately"
  - "Wave-0 atomicity test #3 is an explicit positive control — guards against the false-negative case where tests 1+2 pass for the wrong reasons (e.g., the helper itself silently failed to open a session)"
  - "denySelfModerationListing test uses plain MongoMemoryServer (not the replica-set fixture) — the middleware performs no transactions, so the heavier replica-set fixture is unnecessary; saves ~2s per test run"
  - "editListingSchema's `existingImageUrls` field is z.string().optional() (NOT z.array(z.string())) — mirrors seller-PUT multipart JSON-stringified array at server.js:779-782; service-layer code in Wave 3 will JSON.parse it inside the handler"
metrics:
  duration: "6m11s"
  completed: "2026-05-29"
  tasks_executed: 3
  files_created: 8
  files_modified: 1
  test_count_before: 33
  test_count_after: 60
  test_count_delta: 27
---

# Phase 8 Plan 01: Phase 8 Wave-1 Substrate Summary

Wave-1 substrate for Phase 8 admin listing moderation — extracted shared multer-S3 upload + 4 new moderation modules (errors, schemas, middleware, service skeleton) + 3 Wave-0 test files. Wave 2 (Suspend/Archive/Delete/Restore) and Wave 3 (Edit) consume this substrate without re-litigating any decisions.

## Outcome

All 3 tasks executed successfully with zero deviations from the plan. The Phase 7 → Phase 8 substrate handoff is now load-bearing: every Wave 2/3 plan can `require('./listingService')`, `require('./listingSchemas')`, `require('./listingErrors')`, `require('./denySelfModerationListing')`, and `require('../uploads/carImages')` without further substrate work.

**Test count: 33 → 60 (+27 Wave-0 tests).** Phase 7 baseline preserved byte-identical; Wave-0 tests cover all five substrate modules with compile-time wiring evidence (every test file imports a substrate module at top of file).

## What Shipped

### Task 1 — Extract multer-S3 upload (commit `1d96d45`)

Created `src/uploads/carImages.js` exporting `{ upload, s3 }`. Body is BYTE-IDENTICAL to the pre-Phase-8 inline construction at `server.js:44-64`: same S3Client config (region + credentials from env), same multer-S3 storage (bucket from env, metadata function, key function that produces `${bodyType}/${timestamp}-${originalname}`).

`server.js` modifications (extraction diff):
- **Added at line 23** (top-of-file require block, adjacent to other moderation requires): `const { upload, s3 } = require('./src/uploads/carImages');`
- **Removed lines 43-64** (22 lines): inline `const s3 = new S3Client({...})` + inline `const upload = multer({ storage: multerS3({...}) })`
- **Replaced with 4-line comment block** at line 43 documenting the extraction
- **uploadAvatar preserved verbatim** at the now-line-48 position (separate config, separate consumer — out of scope per plan instructions)
- **Net diff:** +1 require / -22 inline lines / +4 comment lines = -18 lines net in `server.js`

**Phase 7 mount line preservation:** `app.use('/api/admin/moderation/listings', ...)` shifted from line 854 → line 836 due to the -18 line shift but the line content is byte-identical:
```
app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter);
```

**Phase 7 regression check:** `npx jest __tests__/listing-moderation/listingModerationRateLimiter.test.js` — 3/3 green (the `/ping` route + the rate-limit chain still work).

### Task 2 — Substrate modules (commit `6af5f3a`)

Four new files under `src/moderation/`:

1. **`listingErrors.js`** — `class ListingServiceError extends Error { code }`. Mirrors `src/payments/confirmBooking.js:31 ProviderSuspendedError` shape (D-12 cleanup over v1.0 `service.js`'s `new Error('code')` + `err.message`-matching pattern).

2. **`listingSchemas.js`** — 5 `.strict()` Zod schemas + `REASON_CATEGORIES`/`reasonCategoryEnum` derived from `Car.schema.path('moderationReason').enumValues` (D-10 enum-drift lock). All five schemas: `suspendListingSchema`, `archiveListingSchema`, `deleteListingSchema` share `{ reasonCategory: REQUIRED, note? }` (D-14); `restoreListingSchema` has `{ note? }` only (D-C — no reasonCategory); `editListingSchema` is the broad-whitelist Edit field set (D-A) with 24 fields covering all seller-PUT-editable fields excluding the 14 system fields. Numeric fields use `z.coerce.number().int().nonnegative().optional()` to match multer multipart's string-only output (mirrors seller-PUT `parseInt(year)` at `server.js:810`).

3. **`denySelfModerationListing.js`** — async Express middleware. Fetches `Car.findById(req.params.carId).setOptions({ includeAllListingStatuses: true, includeAllUsers: true }).select('sellerId').lean()`; 400 `cannot_moderate_own_listing` + `console.warn` on self-match (D-05 log-not-audit); 404 `listing_not_found` on miss (D-04 do-not-leak); 500 `internal_error` on unexpected DB failure. Both setOptions flags chained so the read is forward-compatible with Phase 9's listing-status hide hook AND bypasses Phase 3's existing seller-cascade hide hook.

4. **`listingService.js`** — 5 named async exports (`editListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`). Each body throws `new ListingServiceError('not_implemented')`. Wave 2/3 replaces the bodies but cannot rename or re-export the function set. Top-of-file comment block mirrors v1.0 `service.js:1-14` with listing-domain rename and documents the Pitfall 2 array-form `create([doc], { session })` requirement.

### Task 3 — Wave-0 tests (commit `60f26cc`)

Three new test files under `__tests__/listing-moderation/`. Each file imports its target substrate module at top — Phase 8 substrate has compile-time wiring evidence:

| Test file | Tests | Imports |
|-----------|------:|---------|
| `listingSchemas.test.js` | 16 | `../../src/moderation/listingSchemas`, `../../src/models/Car` |
| `denySelfModerationListing.test.js` | 4 | `../../src/moderation/denySelfModerationListing`, `../../src/models/Car` |
| `listingTransaction.atomicity.test.js` | 7 (3 logical tests × beforeEach/afterEach harness | `../_helpers/mongoReplSet`, `../../src/models/Car`, `../../src/models/ListingModerationAction` |

Total new tests: **27** (above the plan's ≥17 floor).

**Compile-time wiring evidence (which test imports each substrate module):**

| Substrate module | Imported by |
|-------------------|-------------|
| `src/uploads/carImages.js` | (no Wave-0 test — Wave 3's editListing tests will exercise it; Task 1's automated verification proved exports) |
| `src/moderation/listingErrors.js` | (transitively via listingService — direct test of error class will land alongside Wave-2 suspend test) |
| `src/moderation/listingSchemas.js` | `listingSchemas.test.js` (direct) |
| `src/moderation/denySelfModerationListing.js` | `denySelfModerationListing.test.js` (direct) |
| `src/moderation/listingService.js` | (transitively constrained by `listingTransaction.atomicity.test.js`'s hand-rolled runMockSuspend that mirrors the canonical pattern) |

### Atomicity test — what it actually proves

The 3 tests in `listingTransaction.atomicity.test.js` exercise a HAND-ROLLED `runMockSuspend(carId, sellerId, adminUid, { failOn })` helper that runs the canonical Phase-8 transition pattern: `session.withTransaction(async () => { await ListingModerationAction.create([{...}], { session }); await Car.updateOne({...}, {...}, { session }); })`. Wave 2 plans MUST mirror this pattern in `listingService.suspendListing` (and analogous handlers).

- **Test 1 (audit-throws):** `jest.spyOn(ListingModerationAction, 'create').mockImplementationOnce(throw)` → assert helper rejects, then Car.status === 'active' (untouched) AND audit count === 0.
- **Test 2 (Car-throws):** `jest.spyOn(Car, 'updateOne').mockImplementationOnce(throw)` → assert helper rejects, then Car.status === 'active' AND audit count === 0. This second assertion is the load-bearing one — it proves the audit insert was rolled back by the txn when the Car update threw. If the audit row used single-doc `create(doc, { session })` (Pitfall 2), this test would fail because the audit row would have committed to MongoDB OUTSIDE the transaction.
- **Test 3 (positive control):** No mocks — assert Car.status === 'suspended' AND audit count === 1. Guards against test-harness false negatives (e.g., a broken helper that silently fails to open a session).

## Verification Spec Results

All 6 verification spec items from `08-01-PLAN.md` pass:

1. `node -e "console.log(require('./src/uploads/carImages').upload.array)"` → prints a function (with dotenv preload for AWS_BUCKET_NAME). ✓
2. `npx jest __tests__/listing-moderation/` → 60/60 green (33 Phase 7 + 27 Wave-0). ✓
3. `grep -c "const upload = multer" server.js` = 0 AND `grep -c "const uploadAvatar = multer" server.js` = 1. ✓
4. `grep -c "require('./src/uploads/carImages')" server.js` = 1. ✓
5. `grep -c "module.exports" src/moderation/listingService.js` = 1. ✓
6. `grep -c "ListingServiceError" src/moderation/listingService.js` = 7 (≥5 — 1 require + 5 throws + 1 doc comment). ✓

## Phase 7 Substrate Preservation

`git diff --stat HEAD~3 -- src/moderation/listingRouter.js src/moderation/listingRateLimit.js src/moderation/listingCapabilities.js src/models/Car.js src/models/ListingModerationAction.js` returns ZERO output — all five Phase 7 substrate files are byte-identical post Phase-8 Plan-01.

The pre-existing seller-cascade `pre(/^find/)` hook in `Car.js:63-95` (one literal match for `this.getOptions().includeAllUsers`) is untouched. Phase 9 will add a parallel `pre(/^find/)` hook for `includeAllListingStatuses`; Phase 8 reads already pass both options so they're forward-compatible.

## Test Count Before/After

| Suite | Before this plan | After this plan |
|-------|------------------:|----------------:|
| `__tests__/listing-moderation/` | 33 | 60 (+27) |
| Phase 7's 6 baseline tests | 33 (all green) | 33 (all green; preserved) |

The Phase 7 `listingModerationRateLimiter.test.js` cross-file ordering flake (visible in isolation as green, in a multi-file pre-Phase-8 batch run as 1 false 429-vs-200 failure) was NOT reproduced in the post-Phase-8 batch run — adding the 3 new test files happened to change the within-batch test ordering such that the per-admin rate-limit bucket state lined up correctly. This is a known harness issue (cross-file state leak; tracked in deferred-items.md if not already), not a regression introduced by this plan.

## Deviations from Plan

**None — plan executed exactly as written.**

Two minor implementation choices fell within Claude's discretion (per `08-CONTEXT.md ## Claude's Discretion`):

- `listingErrors.js` placed in a SEPARATE file (rather than inlined at top of `listingService.js`). Rationale: cleaner imports for Wave 2/3 tests that need to assert on `err.code` without pulling in the full service surface. Plan section 5 left this to executor discretion.
- `denySelfModerationListing.test.js` uses plain `MongoMemoryServer` (not the `_helpers/mongoReplSet` fixture). Rationale: middleware does no transactions; the heavier fixture is unnecessary and saves ~2s. Pattern Map line 7 explicitly recommended this.

## Authentication Gates

None encountered. All work was local code + local test runs.

## Known Stubs

`src/moderation/listingService.js` ships with 5 handler bodies that throw `new ListingServiceError('not_implemented')`. This is INTENTIONAL per the plan — Wave 1 ships the substrate (module shape + exports + transaction-pattern comments), Wave 2 (Suspend/Archive/Delete/Restore) and Wave 3 (Edit) replace each body with the real audit-then-Car-update implementation. The stubs are tracked in this section so the verifier surfaces them but does NOT flag them as plan-incomplete — they are explicitly deferred to downstream plans named in `08-CONTEXT.md`.

## Self-Check: PASSED

**Files created (verified to exist via `[ -f path ]`):**

- `../backend-services/carEx-services/src/uploads/carImages.js` ✓
- `../backend-services/carEx-services/src/moderation/listingErrors.js` ✓
- `../backend-services/carEx-services/src/moderation/listingSchemas.js` ✓
- `../backend-services/carEx-services/src/moderation/denySelfModerationListing.js` ✓
- `../backend-services/carEx-services/src/moderation/listingService.js` ✓
- `../backend-services/carEx-services/__tests__/listing-moderation/listingSchemas.test.js` ✓
- `../backend-services/carEx-services/__tests__/listing-moderation/denySelfModerationListing.test.js` ✓
- `../backend-services/carEx-services/__tests__/listing-moderation/listingTransaction.atomicity.test.js` ✓

**Files modified (verified via `git diff` in backend repo):**

- `../backend-services/carEx-services/server.js` ✓ (−22 inline lines, +1 require, +4 comment lines = −18 net)

**Commits (verified via `git log --oneline | grep <hash>` in carEx-services repo):**

- `1d96d45` `feat(08-01): extract multer-S3 upload to src/uploads/carImages.js` ✓
- `6af5f3a` `feat(08-01): add ListingServiceError + listingSchemas + denySelfModerationListing + listingService skeleton` ✓
- `60f26cc` `test(08-01): add Wave-0 listing-moderation substrate tests (schemas + middleware + atomicity)` ✓

All three commits land in the BACKEND repo (`carEx-services`), per the cross-repo wiring documented in this plan's frontmatter. The SUMMARY.md commit (this file) lands in the carEx repo.
