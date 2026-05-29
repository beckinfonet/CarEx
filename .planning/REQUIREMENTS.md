# Requirements: CarEx — Milestone v1.1 (Admin Listing Moderation)

**Defined:** 2026-05-28
**Core Value:** Admins can take precise, visibly-distinguished moderation actions on car listings — Edit, Suspend, Archive, Delete-soft — extending v1.0's user-moderation model to the listing domain, with full audit trail and buyer-side pause-not-cancel behavior.

**Design reference:** [.planning/notes/listing-moderation-design.md](notes/listing-moderation-design.md) (from `/gsd-explore` 2026-05-28)

## v1 Requirements

Requirements for milestone v1.1. Each maps to exactly one roadmap phase.

### Security

- [ ] **LSEC-01**: Backend verifies caller's Firebase ID token on every listing moderation endpoint via `firebase-admin.verifyIdToken()` (reuses the v1.0 SEC-01 pattern)
- [ ] **LSEC-02**: All `/api/admin/moderation/listings/*` endpoints enforce admin-only access server-side via `requireAdmin` middleware; mobile `isAdmin` is never trusted for authorization
- [ ] **LSEC-03**: Listing moderation endpoints are rate-limited at 30 actions / 15 min / admin (returns `429` on excess), matching v1.0 user-moderation policy

### Data Model

- [ ] **LDATA-01**: `Listing.status` field added to schema with values `'active' | 'suspended' | 'archived' | 'deleted'`; default `'active'`; indexed for read-time filtering
- [ ] **LDATA-02**: Listing schema gains audit fields `moderationReason`, `moderatedBy` (admin Firebase UID), `moderatedAt`, `lastEditedBy` (admin Firebase UID when Edit was used)
- [ ] **LDATA-03**: Listing moderation actions are recorded append-only in a `ListingModerationAction` collection (or the existing `ModerationAction` collection extended to accept listing-target rows) with `{ listingId, fromStatus, toStatus, adminUid, reasonCategory, reasonNote, timestamp }` and application-layer pre-hooks rejecting updates/deletes
- [ ] **LDATA-04**: Schema migration backfills all existing listings with `status: 'active'` and verifies post-migration listing count matches pre-migration count

### Admin Actions

- [ ] **LADM-01**: Admin can Edit any listing's fields via `PATCH /api/admin/moderation/listings/:carId` and the change writes `lastEditedBy` + an audit row with `fieldDiff`
- [x] **LADM-02**: Admin can Suspend a listing (`PATCH /api/admin/moderation/listings/:carId/suspend`) with a reason category + optional note, in a single Mongoose transaction; status transitions `active → suspended`
- [x] **LADM-03**: Admin can Archive a listing (`PATCH /api/admin/moderation/listings/:carId/archive`) with a reason category + optional note; status transitions `active → archived`. Archive is semantically distinct from Suspend (non-punitive, for inactive sellers)
- [x] **LADM-04**: Admin can Soft-Delete a listing (`PATCH /api/admin/moderation/listings/:carId/delete`) with a reason category + optional note; status transitions to `deleted`. Does NOT remove the document from the database
- [ ] **LADM-05**: Admin can Restore any non-active listing (`PATCH /api/admin/moderation/listings/:carId/restore`) back to `status: 'active'`; a new audit row is appended (history is never edited or rewritten)

### Backend Enforcement

- [ ] **LENF-01**: Public listing read endpoints (browse, search, related-listings) filter to `status: 'active'` via Mongoose `pre(/^find/)` hide hooks; admin opts in to seeing non-active listings via `setOptions({ includeAllListingStatuses: true })`
- [ ] **LENF-02**: Listing-detail GET returns a status-aware response for non-active listings: admin sees full document + status badge; non-admin sees a thin payload with `status` + reason-category only (no seller PII), enabling the buyer-facing banner without leaking moderation notes
- [ ] **LENF-03**: Cart `add` and checkout `confirm-booking` re-verify listing status inside the same Mongoose transaction and reject non-active listings with a typed error (`409 listing_not_available`); refund-first-throw-second semantics on mid-checkout status change

### Admin UI (Mobile)

- [ ] **LUI-01**: `CarDetailsScreen` shows an admin-only "Moderate" badge for admin users; tapping it opens a bottom sheet with four action rows (Edit / Suspend / Archive / Delete) plus a status banner reflecting current state
- [ ] **LUI-02**: The four action buttons in the bottom sheet are visually distinct: Edit (neutral, pencil icon), Suspend (warning orange), Archive (neutral gray), Delete (destructive red with confirmation dialog)
- [ ] **LUI-03**: When a listing is already in a non-active state, the bottom sheet replaces the four actions with a single Restore button + the current reason category surfaced for context
- [ ] **LUI-04**: Soft-deleted listings are surfaced in an admin-only "Deleted listings" filter view (within the admin moderation surface) with a Recover action per row; default browse hides them entirely

### Mobile Architecture

- [ ] **LMOB-01**: All listing moderation HTTP calls live in `src/services/moderation/ModerationService.ts` (the v1.0 module) — not glued onto `AuthService.ts`. Five new methods: `adminEditListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`
- [ ] **LMOB-02**: Listing-moderation 409/403 response handling: the existing apiClient 403 interceptor is NOT triggered for listing-moderation responses (this is listing state, not user state); errors surface as UI banners on `CarDetailsScreen` / cart

### Buyer-affected UX

- [ ] **LBUY-01**: `CarDetailsScreen` viewed by a non-admin shows a non-dismissable banner with status + reason category for any non-active listing (severity-aware tone, mirroring v1.0 `UserStatusBanner` patterns)
- [ ] **LBUY-02**: Cart containing a non-active listing renders a banner on the cart row + disables the checkout button; cart is NOT auto-cleared (buyer must see what happened)
- [ ] **LBUY-03**: Already-paid in-flight orders touching a non-active listing proceed normally; admin can manually cancel via existing order tools (LIST-01 does NOT auto-cancel or auto-refund)
- [ ] **LBUY-04**: Banner copy follows v1.0 severity-aware tone — neutral for archived, warning for suspended, destructive-but-recoverable language for deleted (when visible)

### Quality

- [ ] **LQUAL-01**: All new user-facing strings (4 reason categories × multilingual + button labels + status enum labels + buyer banner copy) added to `src/constants/translations.ts` under both RU + EN; jest literal scanner enforces parity (extends the v1.0 06-09 scanner)
- [ ] **LQUAL-02**: Each LIST-* requirement is covered by at least one jest unit/integration test (backend) or screen/snapshot test (mobile); coverage report tagged per requirement
- [ ] **LQUAL-03**: Pre-merge security review (`LIST-SECURITY.md`) covers the same 5 verdicts as v1.0 06-SECURITY.md (auth, authz, audit, TOCTOU, deferred-verification disposition); merge-gate cleared before tagging v1.1

## v2 Requirements (deferred)

Tracked but not in v1.1 roadmap. Re-evaluate at v1.2 milestone.

- **LIST-02** — Automated content flagging queue (auto-suspend after N buyer reports, ML/heuristic pre-screening)
- **MOD2-01..06** — Extended moderation primitives (CSV export, IP/device fingerprint, bulk select, super-admin tier, admin handoff comments, saved filters)
- **NOTF-01..03** — Email + push + in-app appeal ticket system (would notify seller when listing moderated)
- **DEBT-01..04** — AuthService split, typed User, expanded test coverage, error-handling standardization
- **REL-01, REL-03** — Stripe live key swap, env-config cleanup
- **UX** — UserStatusBanner overlap with navbar avatar + logo + screen title (Phase 04 UAT 2026-04-30 finding)

## Out of Scope

Explicitly excluded from v1.1. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Hard-delete UI button | Design decision: soft-delete is recoverable, hard-delete reserved for spam/illegal. Backend op only when needed; surfacing a UI button invites accidents |
| Bulk admin listings panel (filter by status, batch actions) | v1 placement is inline on `CarDetails` — confirm the pattern works before building a dedicated panel; defer to v1.2+ |
| Automated listing-flagging queue | Tracked as LIST-02, paired with LIST-01 but separate scope; defer to v1.2+ |
| Auto-cancel / auto-refund of in-flight orders on listing moderation | Anti-pattern (same rationale as v1.0). Orders pause; admin manually cancels if needed |
| Seller notifications on moderation | Tracked under NOTF-* (deferred to v1.2+); in v1.1, seller sees status on their own listing view |
| Listing edit-history audit (per-field diff replay UI) | LADM-01 stores `fieldDiff` in the audit row, but a UI to *view* historical diffs is deferred. Backend data captured so this is purely future UI work |
| Shadow-archive (admin hides listing without status field update) | Anti-feature. Status field is the single source of truth; ad-hoc hiding contradicts read-time filter design |

## Traceability

Updated by `gsd-roadmapper` during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LSEC-01 | Phase 7 | Pending |
| LSEC-02 | Phase 7 | Pending |
| LSEC-03 | Phase 7 | Pending |
| LDATA-01 | Phase 7 | Pending |
| LDATA-02 | Phase 7 | Pending |
| LDATA-03 | Phase 7 | Pending |
| LDATA-04 | Phase 7 | Pending |
| LADM-01 | Phase 8 | Pending |
| LADM-02 | Phase 8 | Complete |
| LADM-03 | Phase 8 | Complete |
| LADM-04 | Phase 8 | Complete |
| LADM-05 | Phase 8 | Pending |
| LENF-01 | Phase 9 | Pending |
| LENF-02 | Phase 9 | Pending |
| LENF-03 | Phase 9 | Pending |
| LUI-01 | Phase 10 | Pending |
| LUI-02 | Phase 10 | Pending |
| LUI-03 | Phase 10 | Pending |
| LUI-04 | Phase 10 | Pending |
| LMOB-01 | Phase 10 | Pending |
| LMOB-02 | Phase 10 | Pending |
| LBUY-01 | Phase 11 | Pending |
| LBUY-02 | Phase 11 | Pending |
| LBUY-03 | Phase 11 | Pending |
| LBUY-04 | Phase 11 | Pending |
| LQUAL-01 | Phase 11 | Pending |
| LQUAL-02 | Phase 11 | Pending |
| LQUAL-03 | Phase 11 | Pending |

**Coverage:**
- v1.1 requirements: 28 total
- Mapped to phases: 28 ✓
- Unmapped: 0

**Phase totals:**
- Phase 7: 7 requirements (LSEC-01..03, LDATA-01..04)
- Phase 8: 5 requirements (LADM-01..05)
- Phase 9: 3 requirements (LENF-01..03)
- Phase 10: 6 requirements (LUI-01..04, LMOB-01..02)
- Phase 11: 7 requirements (LBUY-01..04, LQUAL-01..03)

---
*Requirements defined: 2026-05-28*
*Last updated: 2026-05-28 — traceability mapped to v1.1 roadmap by gsd-roadmapper*
