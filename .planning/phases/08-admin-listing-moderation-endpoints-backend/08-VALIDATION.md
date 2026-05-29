---
phase: 8
slug: admin-listing-moderation-endpoints-backend
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
approved: 2026-05-28
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Backend-only phase — all work lives in `../backend-services/carEx-services/`.
> See `08-RESEARCH.md` "## Validation Architecture" section for the source spec.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.7.0 + supertest 7.2.2 + mongodb-memory-server 10.4.3 (replica-set mode) |
| **Config file** | `../backend-services/carEx-services/jest.config.js` |
| **Quick run command** | `cd ../backend-services/carEx-services && npx jest __tests__/listing-moderation/<file>.test.js` |
| **Full suite command** | `cd ../backend-services/carEx-services && npm test -- __tests__/listing-moderation/` |
| **Estimated runtime** | ~25–40 seconds (replica-set boot dominates; Phase 7 baseline ~20s for 33 tests) |

---

## Sampling Rate

- **After every task commit:** Run quick (single-file) command for the test file added/modified in that task.
- **After every plan wave:** Run `npm test -- __tests__/listing-moderation/` (Phase 7's 33 + Phase 8's new tests, all green).
- **Before `/gsd-verify-work`:** Full suite must be green; Phase 7's `/ping` route + rate-limit + middleware-chain tests MUST remain unchanged.
- **Max feedback latency:** ~40 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | LADM-01..05 (substrate) | T-08-07 | Extracted multer-S3 upload importable by both seller PUT and admin Edit | source assert | `node -e "require('./src/uploads/carImages').upload.array"` | ⬜ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | LADM-01..05 (substrate) | T-08-03, T-08-05 | listingErrors + listingSchemas + denySelfModerationListing + listingService skeleton in place | source assert | `node -e "require('./src/moderation/listingService')"` | ⬜ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | LADM-01..05 (substrate) | T-08-01, T-08-02, T-08-03 | Wave-0 tests green (schemas, denySelfMod, atomicity) | integration | `npx jest __tests__/listing-moderation/listingSchemas.test.js __tests__/listing-moderation/denySelfModerationListing.test.js __tests__/listing-moderation/listingTransaction.atomicity.test.js` | ⬜ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | LADM-02 | T-08-02 | suspendListing fills canonical session.withTransaction audit-then-Car pattern | source assert | `node -e "/session.withTransaction/.test(...) && /ListingModerationAction.create\\(\\[/.test(...)"` | ⬜ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | LADM-02 | T-08-01 | KNOWN_LISTING_ERRORS + handleListingServiceError + PATCH /:carId/suspend route with denySelfModerationListing middleware | source assert + Phase 7 ping regression | `node -e "..." && npx jest __tests__/listing-moderation/listingModerationRateLimiter.test.js` | ⬜ W0 | ⬜ pending |
| 08-02-03 | 02 | 2 | LADM-02 | T-08-01, T-08-02 | suspendListing.test.js — happy + cross-state + same-state-reject + reason-required + self-mod | integration | `npx jest __tests__/listing-moderation/suspendListing.test.js` | ⬜ W0 | ⬜ pending |
| 08-03-01 | 03 | 3 | LADM-03 | T-08-02 | archiveListing mirror of suspendListing with target='archived' + action='archive' | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-03-02 | 03 | 3 | LADM-03 | T-08-01 | PATCH /:carId/archive route with denySelfModerationListing middleware, JSON-only (no multer) | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-03-03 | 03 | 3 | LADM-03 | T-08-01, T-08-02 | archiveListing.test.js — happy + cross-state + same-state + self-mod | integration | `npx jest __tests__/listing-moderation/archiveListing.test.js` | ⬜ W0 | ⬜ pending |
| 08-04-01 | 04 | 4 | LADM-04 | T-08-02 | deleteListing soft-delete pattern: status flip only, NO Car.deleteOne / .deleteMany / findOneAndDelete | source assert (negative grep) | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-04-02 | 04 | 4 | LADM-04 | T-08-01 | PATCH /:carId/delete route with denySelfModerationListing middleware, JSON-only | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-04-03 | 04 | 4 | LADM-04 | T-08-02 | deleteListing.test.js — happy + Car.countDocuments==1 invariant + cross-state + same-state | integration | `npx jest __tests__/listing-moderation/deleteListing.test.js` | ⬜ W0 | ⬜ pending |
| 08-05-01 | 05 | 5 | LADM-05 | T-08-02 | restoreListing clear-on-restore + not_moderated + moderatedBy update | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-05-02 | 05 | 5 | LADM-05 | T-08-01 | PATCH /:carId/restore route, reasonCategory absent (D-C), JSON-only (no multer) | source assert (regex + Phase 7 ping regression) | `node -e "..." && npx jest __tests__/listing-moderation/listingModerationRateLimiter.test.js` | ⬜ W0 | ⬜ pending |
| 08-05-03 | 05 | 5 | LADM-05 | T-08-02, T-08-05 | restoreListing.test.js — 3 starting states + not_moderated + field-clear + original-row history preserved | integration | `npx jest __tests__/listing-moderation/restoreListing.test.js` | ⬜ W0 | ⬜ pending |
| 08-06-01 | 06 | 6 | LADM-01 | T-08-03, T-08-04 | editListing fieldDiff + image merge + makeId/modelId lazy validation + lastEditedBy stamp + no moderatedBy mutation | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-06-02 | 06 | 6 | LADM-01 | T-08-01, T-08-03 | PATCH /:carId route with upload.array('images', 25) BEFORE denySelfModerationListing; Zod unknown-key → 400 invalid_field | source assert | `node -e "..."` | ⬜ W0 | ⬜ pending |
| 08-06-03 | 06 | 6 | LADM-01 | T-08-02, T-08-03, T-08-04 | editListing.test.js — fieldDiff shape + image cases + unknown-field + no-changes + works on any status + makeId/modelId bad refs + D-A-3 stamp distinction | integration | `npx jest __tests__/listing-moderation/editListing.test.js` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test stubs Phase 8 must create before Wave 1 implementation begins. Each maps to a planned test from `08-RESEARCH.md` Validation Architecture:

- [ ] `__tests__/listing-moderation/listingSchemas.test.js` — Zod `.strict()` enforcement + enum derivation from `Car.schema.path('status').enumValues` + reasonCategory enum (LADM-01..05)
- [ ] `__tests__/listing-moderation/denySelfModerationListing.test.js` — middleware unit: admin === sellerId → 400 `cannot_moderate_own_listing`; admin !== sellerId → next(); car not found → 404 `listing_not_found`
- [ ] `__tests__/listing-moderation/listingTransaction.atomicity.test.js` — simulate mid-flight failure (stub `ListingModerationAction.create` to throw) → assert `Car.status` did NOT update; simulate `Car.updateOne` failure → assert audit row NOT persisted (success criterion #1)
- [ ] `__tests__/listing-moderation/suspendListing.test.js` — happy path active→suspended (transition + audit appended in one transaction); same-state → 400 `already_in_state`; cross-state archived→suspended OK (D-B); reasonCategory required; self-moderation rejected (D-04)
- [ ] `__tests__/listing-moderation/archiveListing.test.js` — happy path active→archived; cross-state suspended→archived OK; self-moderation rejected (success criterion #2)
- [ ] `__tests__/listing-moderation/deleteListing.test.js` — happy path active→deleted; cross-state archived→deleted OK; `Car.countDocuments({ _id: carId })` still 1 after delete-soft (success criterion #2 — document still present); self-moderation rejected
- [ ] `__tests__/listing-moderation/restoreListing.test.js` — happy paths from suspended/archived/deleted → active; not_moderated on already-active; `Car.moderationReason` cleared (D-C-1); audit row `reasonCategory: null`; self-moderation rejected (admin can't restore their own listing) (success criterion #3)
- [ ] `__tests__/listing-moderation/editListing.test.js` — fieldDiff shape per D-A-2; happy paths per field group (text-only, image-add, image-remove, image-reorder, mixed); unknown-field → 400 `invalid_field`; empty-diff → 400 `no_changes`; works on suspended/archived/deleted listings (D-A-4); `makeId`/`modelId` validation via lazy `mongoose.model('VehicleMake').findOne` (D-A); `lastEditedBy`/`lastEditedAt` stamped, `moderatedBy`/`moderatedAt` NOT touched (D-A-3) (success criterion #4)

**Test fixture (existing — DO NOT re-create):** `__tests__/_helpers/mongoReplSet.js` provides the replica-set start/stop hooks. Phase 8 tests import unchanged from this helper.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| S3 multer upload of a real image file via admin Edit | LADM-01 | mongodb-memory-server can't simulate S3 binary upload; multer-S3 hits the live bucket | After Phase 8 lands, run a manual `curl -X PATCH` against staging with `-F "images=@file.jpg"` + `-F "existingImageUrls=[]"` and confirm the returned `listing.imageUrls[]` contains the new S3 URL and the audit row's `fieldDiff.imageUrls.after` matches |
| Production Mongoose replica-set transaction rollback behavior | success criterion #1 | mongodb-memory-server's replica set is simulated; production Atlas M10+ behavior is the real contract | After deployment, run a smoke suspend in production and confirm a successful 200 → DB inspector shows both `Car.status='suspended'` AND one new `ListingModerationAction` row with matching `createdAt` |

---

## Validation Sign-Off

- [x] All 18 tasks have `<automated>` verify (verified by gsd-plan-checker against plans 08-01..06)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (100% verified per gsd-plan-checker Dimension 8c)
- [x] Wave 0 covers all MISSING references (8 test files; 3 land in 08-01, 5 land per-endpoint in 08-02..06)
- [x] No watch-mode flags (per-task verify uses single-file `npx jest <file>`; no `--watch`)
- [x] Feedback latency < 40s (per-task ~1-3s; full suite ~25-40s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-28 (gsd-plan-checker Dimension 8a/b/c/d/e all PASS)
