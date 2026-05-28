---
phase: 8
slug: admin-listing-moderation-endpoints-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-28
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

> Filled in by the planner once PLAN.md files exist. Each task in PLAN.md must list an automated verify command OR a Wave 0 dependency that lands the test stub.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-XX-YY | XX | N | LADM-0X | — / T-08-NN | {behavior} | unit / integration | `npx jest __tests__/listing-moderation/<file>.test.js` | ⬜ W0 | ⬜ pending |

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (8 test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 40s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
