# Phase 8: Admin Listing Moderation Endpoints (Backend) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 08-admin-listing-moderation-endpoints-backend
**Areas discussed:** Admin Edit field scope, Transition matrix, Restore reason policy, Images in Edit scope

---

## Admin Edit field scope

| Option | Description | Selected |
|--------|-------------|----------|
| Medium whitelist | Safety + contact + display-text fields (description, knownIssues, phoneNumber, telegramUsername, condition, price). NOT editable: identity (makeId/modelId/year), images, technical specs, system fields. | |
| Narrow whitelist | Identity/contact only — mirror v1.0's broker-edit. Editable: description, phoneNumber, telegramUsername. NOT editable: anything else. Most conservative. | |
| Broad whitelist (mirror seller PUT) | Admin can edit anything seller can via PUT /api/cars/:id (price, description, images, all specs, contact, etc.). Excludes only system fields (sellerId, listingId, _id, createdAt, status, lastEditedBy, lastEditedAt). | ✓ |
| Pencil + price-correction lane | Text-only fields: description, knownIssues, phoneNumber, telegramUsername, price. No specs, no images. Conservative middle ground. | |

**User's choice:** Broad whitelist (mirror seller PUT)
**Notes:** Admin gets full repair power. Captured as D-A in CONTEXT.md. Exclusion list of system fields enumerated in D-A. Zod `.strict()` whitelist mirrors seller PUT's permissive validation (no stricter contract than what seller already operates under). Determines D-D's image handling (full multer parity).

---

## Transition matrix

**First pass** — user asked for simpler explanation:

| Option | Description | Selected |
|--------|-------------|----------|
| Open matrix | Any non-active state can go to any other non-active state directly. | |
| Restore-gated | Must go through active first. | |
| Forward-only escalation | active→suspended→archived→deleted, no sideways. | |
| Open + reject no-op | Like Open but reject same-state transitions. | |

**Result:** User asked "Can you put it in simpler terms? I'm having difficulty understanding or visualizing the flows."

**Re-explained with ASCII flow diagram + 3 concrete real-world scenarios (escalation / reclassification / mistake), then re-presented:**

| Option | Description | Selected |
|--------|-------------|----------|
| Let admin jump straight to any other state | Direct suspended→deleted / suspended→archived / archived→deleted etc. One audit row per click. Same-state click rejected as no-op. | ✓ |
| Force Restore-first | Admin must un-moderate before re-moderating. Two audit rows per change. | |
| Only allow getting MORE severe | Suspended < archived < deleted; cannot downgrade. Most restrictive. | |

**User's choice:** Let admin jump straight to any other state (Recommended)
**Notes:** Captured as D-B in CONTEXT.md. Full matrix locked, same-state guard fires fast-path before transaction opens (D-B-1). `invalid_transition` error code reserved for forward compatibility but never emitted in v1.1 (D-B-2). `includeAllListingStatuses: true` token name pre-locked for Phase 9 hide-hook bypass (D-B-3). Lesson for future areas: lead with concrete scenarios, not abstract matrices.

---

## Restore reason policy

| Option | Description | Selected |
|--------|-------------|----------|
| Optional — mirror v1.0 unsuspend | Restore body: { note?: string }. No reasonCategory dropdown. Audit row records adminUid + fromStatus→active + optional free-text note. | ✓ |
| Required — admin must pick a reason | Restore body: { reasonCategory, note? }. Admin must choose from the 5-value enum or a separate restore_reason enum. Stricter audit but adds friction. | |
| Required note (free text), no category | Restore body: { note: string (required) }. Forces a paper-trail explanation without a fixed taxonomy. | |

**User's choice:** Optional — mirror v1.0 unsuspend (Recommended)
**Notes:** Captured as D-C in CONTEXT.md. Audit row's reasonCategory is null for Restore. Car.moderationReason + Car.moderationNote CLEARED on Restore (D-C-1) — historical reason preserved in audit row. Car.moderatedBy + Car.moderatedAt updated to point at restoring admin (D-C-2).

---

## Images in Edit scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full parity with seller PUT — multer multipart, S3 upload, reorder/remove | Admin Edit accepts multipart/form-data exactly like seller PUT: existingImageUrls JSON + binary file uploads via multer → S3. fieldDiff captures imageUrls before/after URL arrays. Admin can fully fix a broken listing without seller involvement. | ✓ |
| URL-array only | Admin can reorder/remove but NOT upload new images. Lighter handler, no multer on the admin route. | |
| Block images entirely | imageUrls NOT in admin-editable whitelist. Admin must ask seller for image fixes. Simplest handler. | |

**User's choice:** Full parity with seller PUT (Recommended)
**Notes:** Captured as D-D in CONTEXT.md. Multer middleware mounted PER-ROUTE on Edit only (D-D-1) — Suspend/Archive/Delete/Restore stay JSON. S3 client + bucket reused from seller PUT (D-D-2). Field diff captures URL string arrays only, not bytes (D-D-3). Orphan S3 objects on removal mirror seller-PUT behavior — deferred under "tracked" (D-D-4).

---

## Claude's Discretion

Areas the user did NOT need to weigh in on — Claude decided grounded in v1.0 Phase 2 + Phase 7 precedent. Captured in CONTEXT.md `<decisions>` as D-01..D-18:

- **Endpoint surface** (D-01) — pinned by REQUIREMENTS.md LADM-01..05; no bikeshedding.
- **Success response shape** (D-02) — mirrors v1.0 D-02 thin projection.
- **Error envelope codes** (D-03) — 7 new codes registered in `KNOWN_USER_ERRORS`.
- **Self-moderation middleware** (D-04, D-05) — listing-specific variant `denySelfModerationListing.js` per v1.0 D-26.
- **Transaction strategy** (D-06, D-07, D-08) — `session.withTransaction()` per v1.0 D-23/D-24; replica-set requirement already verified by v1.0.
- **Validation schemas** (D-09, D-10) — new `src/moderation/listingSchemas.js` with `.strict()` Zod schemas, enums derived from Mongoose source-of-truth.
- **Service module structure** (D-11, D-12, D-13) — new `src/moderation/listingService.js` with 5 named exports + `ListingServiceError` class + `handleListingServiceError` router translator.
- **Reason category required-ness** (D-14, D-15) — required on Suspend/Archive/Delete; optional on Restore (D-C); none on Edit.
- **Testing layout** (D-16, D-17, D-18) — `__tests__/listing-moderation/` with 8 new test files; minimal-Express isolation per Phase 7 D-20.
- **Plan ordering within Phase 8** — gsd-planner's discretion; v1.0 Phase 2's 6-plan shape is the precedent but planner has full latitude.
- **Helper extraction decisions** (diffCarFields, multer instance import path, optional middleware-fetch short-circuit) — planner/executor discretion; default to inline-first, extract only on duplication.

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` — not silently re-introduced:

- `Car.lastActionId` back-link field (no current query-pattern justification)
- Listing-history GET endpoint (not in v1.1 REQUIREMENTS; Phase 10 admin UI decides)
- Cross-domain audit views (user-mod + listing-mod union queries)
- DB-user-level insert-only Atlas privilege on `listing_moderation_actions`
- Hash-chain tamper-evidence on `ListingModerationAction`
- Auto-cancel / auto-refund of orders touching moderated listings (anti-pattern, REQUIREMENTS Out of Scope)
- S3 object cleanup on image-removal in admin Edit (mirrors existing seller-PUT orphan behavior)
- Per-field admin Edit diff replay UI (data captured in v1.1; UI deferred to v1.2+)
- Restore-to-previous-state semantics (Restore always → 'active'; admin re-applies prior moderation if needed)
- Hard-delete UI / API (REQUIREMENTS Out of Scope)
- Listing-status email/push notifications to seller (NOTF-* carry-forward)
- Super-admin tier with restricted transition matrix (`invalid_transition` code reserved for future use)
- Bulk admin listings panel (REQUIREMENTS Out of Scope, v1.2+)
- Redis-backed rate limiter for horizontal scale (Phase 7 deferred)
- Migrating legacy /api/admin/* routes to Bearer idToken (v1.0 D-06 carry-forward)
