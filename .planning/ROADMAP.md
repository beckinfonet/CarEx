# Roadmap: CarEx

## Milestones

- ✅ **v1.0 — Admin Moderation** — Phases 1-6 (shipped 2026-04-30) — see [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- 🟡 **v1.1 — Admin Listing Moderation** — Phases 7-11 (in planning, started 2026-05-28) — see [.planning/REQUIREMENTS.md](REQUIREMENTS.md) + [.planning/notes/listing-moderation-design.md](notes/listing-moderation-design.md)

## Phases

<details>
<summary>✅ v1.0 Admin Moderation (Phases 1-6) — SHIPPED 2026-04-30</summary>

- [x] Phase 1: Schema + Security Baseline (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 2: Admin Moderation Endpoints (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 3: Backend Enforcement (Backend) — 6/6 plans — completed 2026-04-17
- [x] Phase 4: Mobile Plumbing (Mobile) — 7/7 plans — completed 2026-04-18, real-device UAT 2026-04-30
- [x] Phase 5: Admin Moderation UI (Mobile + cross-repo) — 14/14 plans — completed 2026-04-18 (backend SUMMARYs retroactively bookkept 2026-04-30)
- [x] Phase 6: Affected-User UX + Security Review (Both) — 10/12 plans (06-0a + 06-0b deferred per QUAL-02) — security review APPROVED 2026-04-19

</details>

### 🟡 v1.1 Admin Listing Moderation (Phases 7-11) — IN PLANNING

- [ ] **Phase 7: Listing Schema + Security Baseline (Backend)** — Listing `status` field + audit collection + admin auth + rate limiting for listing moderation routes
- [ ] **Phase 8: Admin Listing Moderation Endpoints (Backend)** — Five listing moderation endpoints (edit / suspend / archive / delete-soft / restore) each writing an audit row atomically
- [ ] **Phase 9: Backend Read-time + TOCTOU Enforcement** — `pre(/^find/)` hide hooks on listings + status-aware listing-detail GET + cart-add + confirm-booking re-verification
- [ ] **Phase 10: Mobile Plumbing + Admin Listing UI** — Five `ModerationService` methods + admin-only Moderate badge + bottom-sheet actions on `CarDetailsScreen` + Restore flow + admin Deleted-listings view (10/10 plans executed 2026-05-29; 2 gap-closure plans 10-11 + 10-12 added 2026-05-29 to close CR-01 + CR-04, see `10-VERIFICATION.md`)
- [ ] **Phase 11: Buyer-affected UX + Quality + Security Review** — Severity-aware banner on listing detail + cart banner + RU/EN parity + jest coverage + `LIST-SECURITY.md` merge-gate review

### 📋 Next Milestone (after v1.1)

Use `/gsd-new-milestone` to start the next milestone cycle (questioning → research → requirements → roadmap).

#### Carry-forward candidates (documented in `.planning/milestones/v1.0-REQUIREMENTS.md` v2 section + v1.1 REQUIREMENTS.md v2 section)

- DEBT-01..04 — AuthService split, typed User, expanded test coverage, error handling
- REL-01, REL-03 — Stripe live key, env-config cleanup
- MOD2-01..06 — Extended moderation (CSV export, IP/device fingerprint, bulk select, super-admin tier, etc.)
- NOTF-01..03 — Email + push + in-app appeal ticket system
- LIST-02 — Automated listing-flagging queue (paired with LIST-01)
- QUAL-02 — 10k-user backend load test (deferred from v1.0)
- UX: UserStatusBanner visibility cramped by navbar avatar + logo (captured during Phase 04 UAT 2026-04-30)
- v1.1 carry-forward: bulk admin listings panel + hard-delete UI affordance + listing edit-history diff replay UI

## Phase Details

### Phase 7: Listing Schema + Security Baseline (Backend)
**Goal**: Backend can verify admin callers cryptographically on every listing-moderation route and has the listing schema + audit collection required to store status, audit entries, and admin-edit attribution
**Depends on**: v1.0 Phase 1 (reuses `firebase-admin.verifyIdToken()` + `requireAdmin` + `ModerationAction` audit pattern)
**Requirements**: LSEC-01, LSEC-02, LSEC-03, LDATA-01, LDATA-02, LDATA-03, LDATA-04
**Success Criteria** (what must be TRUE):
  1. Every existing listing in the DB has `status: 'active'` after the migration runs and the pre-migration count equals the post-migration count
  2. A request to any `/api/admin/moderation/listings/*` route without a valid Firebase ID token returns `401`; with a valid token but non-admin role returns `403`
  3. The 31st listing-moderation action by the same admin within 15 minutes is rejected with `429`
  4. Direct attempts to update or delete a row in the listing audit collection are rejected at the application layer (Mongoose pre-hook error), not silently allowed
**Plans**: 6 plans
Plans:
- [x] 07-01-PLAN.md — Extend `Car` schema with `status` + audit fields + `{sellerId,status}` index; D-08 naming-collision lock (LDATA-01, LDATA-02)
- [x] 07-02-PLAN.md — Create `ListingModerationAction` sibling audit collection with 6 append-only pre-hooks (LDATA-03)
- [x] 07-03-PLAN.md — Create `LISTING_STATUS_POLICY` capability map + `resolveBlockedBuyerActions` resolver with schema-equality lock (LDATA-01 foundation for Phase 9/11)
- [x] 07-04-PLAN.md — Create `listingModerationRateLimiter` with `listing-admin:` keyGenerator prefix (D-04 separate bucket) (LSEC-03 mechanism)
- [x] 07-05-PLAN.md — Land `listingRouter` `/ping` scaffold + `server.js` mount line + middleware test + rate-limit test with D-04 separate-bucket proof (LSEC-01, LSEC-02, LSEC-03)
- [x] 07-06-PLAN.md — Land `migrate-listing-moderation.js` script + extend `ensureBaseline.js` with Car.status check + migration test (LDATA-04)

### Phase 8: Admin Listing Moderation Endpoints (Backend)
**Goal**: Admins can Edit, Suspend, Archive, Soft-Delete, and Restore any listing via rate-limited HTTP endpoints, each transitioning the `status` field and writing an append-only audit row atomically
**Depends on**: Phase 7
**Requirements**: LADM-01, LADM-02, LADM-03, LADM-04, LADM-05
**Success Criteria** (what must be TRUE):
  1. Suspending an `active` listing updates its `status` to `suspended` AND writes one audit row inside a single Mongoose transaction; failure of either step rolls both back
  2. Archive and Delete-soft transition `status` to `archived` and `deleted` respectively, each capturing the reason category + optional note, with the listing document still present in the DB after delete-soft
  3. Restoring any non-active listing flips `status` back to `active` and appends a new audit row — the original transition rows are never edited or removed
  4. Admin Edit updates the listing fields, stamps `lastEditedBy`, and writes an audit row containing the `fieldDiff` of changed fields
**Plans**: 6 plans
Plans:
- [x] 08-01-PLAN.md — Substrate: extract multer-S3 upload + listingSchemas + listingErrors + denySelfModerationListing + listingService skeleton + 3 Wave-0 tests (LADM-01..05 substrate)
- [x] 08-02-PLAN.md — Suspend endpoint: PATCH /:carId/suspend + KNOWN_LISTING_ERRORS + handleListingServiceError + suspendListing.test.js (LADM-02)
- [x] 08-03-PLAN.md — Archive endpoint: PATCH /:carId/archive + archiveListing.test.js (LADM-03)
- [x] 08-04-PLAN.md — Delete-soft endpoint: PATCH /:carId/delete with soft-delete invariant (LADM-04)
- [x] 08-05-PLAN.md — Restore endpoint: PATCH /:carId/restore with clear-on-restore + not_moderated distinct code (LADM-05)
- [x] 08-06-PLAN.md — Edit endpoint: PATCH /:carId multipart + fieldDiff + makeId/modelId validation + D-A-3 stamp distinction (LADM-01)

### Phase 9: Backend Read-time + TOCTOU Enforcement
**Goal**: Non-active listings disappear from all public reads without any denormalized flag mutation, listing-detail GET returns a status-aware thin payload to non-admin viewers, and cart-add + confirm-booking re-verify listing status inside the same transaction with refund-first-throw-second semantics
**Depends on**: Phase 8
**Requirements**: LENF-01, LENF-02, LENF-03
**Success Criteria** (what must be TRUE):
  1. Public browse, search, and related-listings endpoints return zero non-active listings; an admin call with `includeAllListingStatuses: true` returns the full set
  2. Listing-detail GET for a `suspended`/`archived`/`deleted` listing returns a thin payload (status + reason category only, no seller PII or moderation notes) to non-admin viewers; admin viewers receive the full document plus status badge
  3. Adding a non-active listing to the cart returns `409 listing_not_available`; a status change between cart-add and `confirm-booking` aborts the booking inside the transaction and refunds the Stripe charge before throwing
**Plans**: 5 plans
Plans:
- [x] 09-01-PLAN.md — Wave 0 prerequisites: 5 RED jest scaffolds + refundAndThrow helper + ListingNotAvailableError + lookupAdminIfPresent middleware (LENF-03 helper substrate)
- [x] 09-02-PLAN.md — LENF-01 pre(/^find/) hide hook on Car + includeAllListingStatuses bypass + 4 GREEN integration cases
- [x] 09-03-PLAN.md — LENF-02 status-aware GET /api/cars/:id (D-05 thin payload / D-07 admin badge / D-08 single endpoint) + 6 GREEN supertest cases
- [x] 09-04-PLAN.md — LENF-03 part A: create-payment-intent early 409 gate + ListingNotAvailableError route-error-map branch + 5 GREEN supertest cases
- [x] 09-05-PLAN.md — LENF-03 part B: confirm-booking step-4 transactional TOCTOU + refund-first-throw-second + 6 GREEN integration cases + Phase 3 regression

### Phase 10: Mobile Plumbing + Admin Listing UI
**Goal**: Admins can moderate listings inline on `CarDetailsScreen` via a bottom-sheet of four visually-distinct actions, Restore non-active listings from the same surface, and find soft-deleted listings in an admin-only Deleted view — all via five new `ModerationService` methods that bypass the existing 403 user-suspension interceptor
**Depends on**: Phase 9
**Requirements**: LMOB-01, LMOB-02, LUI-01, LUI-02, LUI-03, LUI-04
**Success Criteria** (what must be TRUE):
  1. An admin viewing any listing sees a "Moderate" badge; tapping it opens a bottom sheet showing four action rows (Edit pencil-neutral, Suspend orange-warning, Archive gray-neutral, Delete red-destructive with confirmation) plus a status banner reflecting current state
  2. Tapping any action submits the right `ModerationService` call (`adminEditListing` / `suspendListing` / `archiveListing` / `deleteListing`) and the on-screen status banner updates without an app restart
  3. When the same admin re-opens the bottom sheet on a non-active listing, the four actions are replaced by a single Restore button with the current reason category surfaced; tapping Restore calls `restoreListing` and the listing returns to default browse
  4. Soft-deleted listings appear in an admin-only "Deleted listings" filter view with a per-row Recover action; default buyer browse hides them entirely
  5. A `409 listing_not_available` response surfaces as a UI banner on `CarDetailsScreen` (or cart) without triggering the user-suspension 403 interceptor or logging the admin out
**UI hint**: yes
**Plans**: 12 plans (10 initial + 2 gap-closure)
Plans:
**Wave 1**
- [x] 10-01-PLAN.md — ListingModerationError sibling class + Wave-0 tests (LMOB-01, LMOB-02 substrate)
- [x] 10-02-PLAN.md — buildListingTitle pure helper + sentinel-match util (LUI-02 Pitfall 6 substrate)
- [x] 10-03-PLAN.md — Cross-repo backend: GET /api/admin/moderation/listings + Zod schema + service + tests (LUI-04 backend)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 10-04-PLAN.md — Extend ModerationService with 5 listing writes + searchListings read + anti-pattern guards (LMOB-01)
- [x] 10-05-PLAN.md — LMOB-02 interceptor non-regression tests + CarDetailsScreen axios.get → apiClient.get migration (LMOB-02, LUI-01)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 10-06-PLAN.md — ListingModerationBottomSheet (4 actions for active / Restore + chip for non-active) (LUI-01, LUI-02, LUI-03)
- [x] 10-07-PLAN.md — ListingModerationReasonModal + ListingRestoreModal + TypedConfirmationModal keyboardType prop (LUI-02, LUI-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 10-08-PLAN.md — CarDetailsScreen wiring: badge + status banner + error banner + optimistic-flip + Delete escalation (LUI-01, LUI-02, LUI-03, LMOB-02)
- [x] 10-09-PLAN.md — SellCarScreen adminEdit route flag: 4+ gate bypasses + endpoint swap to ModerationService.adminEditListing (LUI-02)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 10-10-PLAN.md — AdminModerationScreen Users|Listings tabs + Listings panel + per-row Recover (LUI-04)
- [ ] 10-11-PLAN.md — Gap closure CR-01: TypedConfirmationModal bodyKey/hintKey/placeholderKey override props + listing-delete RU+EN strings + CarDetailsScreen mount swap (LUI-02)
- [ ] 10-12-PLAN.md — Gap closure CR-04: always-fetch-when-isAdmin gate change + regression test for carData-prefilled admin entry (LUI-01, LUI-03)

### Phase 11: Buyer-affected UX + Quality + Security Review
**Goal**: Non-admin buyers see a severity-aware banner explaining any non-active listing they encounter (detail screen + cart), already-paid orders proceed normally, all new strings ship with RU/EN parity enforced by jest, every LIST-* requirement is test-covered, and a `LIST-SECURITY.md` review clears the merge-gate
**Depends on**: Phase 10
**Requirements**: LBUY-01, LBUY-02, LBUY-03, LBUY-04, LQUAL-01, LQUAL-02, LQUAL-03
**Success Criteria** (what must be TRUE):
  1. A non-admin viewing a `suspended`/`archived`/`deleted` listing detail sees a non-dismissable banner with the status + reason category; the tone is severity-aware (neutral archived, warning suspended, destructive-but-recoverable deleted)
  2. A cart containing a non-active listing renders an in-row banner and disables the checkout button without auto-clearing the cart
  3. An already-paid order touching a now-non-active listing remains in its current order status; no auto-cancel or auto-refund occurs, but admins retain the existing manual cancel tool
  4. The jest literal scanner (extended from v1.0 06-09) finds zero new untranslated strings and the RU/EN key-set diff is empty for all v1.1 additions
  5. `LIST-SECURITY.md` ships with status `APPROVED`, all five verdicts (auth / authz / audit / TOCTOU / deferred-verification disposition) marked PASS, before tagging v1.1
**UI hint**: yes
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Schema + Security Baseline | v1.0 | 6/6 | Complete | 2026-04-17 |
| 2. Admin Moderation Endpoints | v1.0 | 6/6 | Complete | 2026-04-17 |
| 3. Backend Enforcement | v1.0 | 6/6 | Complete | 2026-04-17 |
| 4. Mobile Plumbing | v1.0 | 7/7 | Complete | 2026-04-18 |
| 5. Admin Moderation UI | v1.0 | 14/14 | Complete | 2026-04-18 |
| 6. Affected-User UX + Security Review | v1.0 | 10/12 (2 deferred) | Complete | 2026-04-30 |
| 7. Listing Schema + Security Baseline | v1.1 | 0/6 | Planned | - |
| 8. Admin Listing Moderation Endpoints | v1.1 | 0/? | Not started | - |
| 9. Backend Read-time + TOCTOU Enforcement | v1.1 | 0/? | Not started | - |
| 10. Mobile Plumbing + Admin Listing UI | v1.1 | 10/12 (gap closure pending) | Gaps found (CR-01, CR-04); 2 gap plans added | - |
| 11. Buyer-affected UX + Quality + Security Review | v1.1 | 0/? | Not started | - |
