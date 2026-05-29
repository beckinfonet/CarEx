# Phase 8: Admin Listing Moderation Endpoints (Backend) — Research

**Researched:** 2026-05-28
**Domain:** Backend (Node/Express + Mongoose + MongoDB) — admin moderation endpoints atop Phase 7 substrate
**Confidence:** HIGH (every load-bearing code shape verified by Read on the actual backend repo at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`)

## Summary

Phase 8 is a near-mechanical mirror of v1.0 Phase 2 (user moderation), redirected at the Phase 7 listing substrate. The four user-decided gray areas (D-A broad whitelist, D-B open transition matrix, D-C Restore-without-reason, D-D multer-S3 image parity) are LOCKED and need no architectural re-exploration — only verification of the supporting code so the planner can write per-endpoint task specs with exact line refs. Every locked decision in CONTEXT.md was confirmed against backend source: the v1.0 `service.js` transaction shape, the `KNOWN_USER_ERRORS` + `handleServiceError` pattern, the `denySelfModeration` middleware shape, the `Car.status` enum, the `ListingModerationAction` field set, and the test-infra location.

The ONE non-obvious verification result the planner must absorb: **the multer `upload` instance the seller PUT uses is a module-local constant defined at `server.js:52–64`, not an exported module.** It is NOT importable via `require(...)` today. The planner must either (a) extract `upload` into a new shared module (e.g., `src/uploads/carImages.js`) so both server.js and listingRouter can import it, or (b) keep `upload` in server.js and pass it into a `createListingRouter(deps)` factory. Either decision creates a small refactor task that did NOT exist in v1.0 Phase 2 (no v1.0 handler needed multer). This is the only gap between the CONTEXT.md decisions and a clean executor task list.

**Primary recommendation:** Plan 6 plans mirroring v1.0 Phase 2 shape — (1) substrate (schemas + service module + ListingServiceError + multer upload extraction), (2) Suspend endpoint, (3) Archive endpoint, (4) Delete-soft endpoint, (5) Restore endpoint, (6) Edit endpoint (heaviest — multer wiring + fieldDiff + makeId/modelId validation). Each transition plan is small (~150 LOC + ~3 tests); the Edit plan is ~2× larger. denySelfModerationListing + transaction atomicity test get folded into the substrate plan.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Five endpoints (D-01): `PATCH /api/admin/moderation/listings/:carId` (Edit), `/:carId/suspend`, `/:carId/archive`, `/:carId/delete` (soft), `/:carId/restore`. Body shape per endpoint per CONTEXT.md D-01.

Success response shape (D-02): `{ ok: true, listing: { _id, status, moderatedBy, moderatedAt, lastEditedBy?, lastEditedAt? }, action: { _id, action, fromStatus, toStatus, createdAt } }` — thin projection, NOT full Car doc.

Error envelopes (D-03): `{ error: <code>, message?: <human-readable> }`. Seven new codes: `listing_not_found`, `invalid_transition` (forward-compat only, not emitted in v1.1), `already_in_state`, `not_moderated`, `invalid_field`, `no_changes`, `invalid_payload`. Plus the locked self-mod code `cannot_moderate_own_listing` (D-04). Plus existing `rate_limited` from Phase 7.

Broad Edit whitelist (D-A): admin may edit every field the seller PUT (`server.js:763–833`) edits, EXCLUDING: `_id, sellerId, listingId, createdAt, updatedAt, listingStatus, status, moderationReason, moderationNote, moderatedBy, moderatedAt, lastEditedBy, lastEditedAt, __v`. Permissive validators (mirrors seller PUT).

`makeId`/`modelId` re-validation via `VehicleMake.findOne` / `VehicleModel.findOne` (D-A, server.js:787–796). Reject 400 `invalid_make` / `invalid_model` on bad refs.

`fieldDiff` per-field `{ before, after }`, changed-only (D-A-2). Empty diff → 400 `no_changes`. `imageUrls` diffed as URL string arrays only.

`Car.lastEditedBy`/`lastEditedAt` stamped on Edit only; `moderatedBy`/`moderatedAt` NOT touched by Edit (D-A-3). Edit valid on listings in ANY status (D-A-4); audit row has `fromStatus === toStatus`, action='edit'.

Open transition matrix (D-B): any status → any different status via the corresponding handler. Same-state → 400 `already_in_state`. Restore on already-active → 400 `not_moderated`. Same-state guard fires BEFORE transaction opens (D-B-1) using `Car.findById(carId).setOptions({ includeAllListingStatuses: true })`.

`includeAllListingStatuses: true` (D-B-3) is the canonical admin-read option name. Phase 7 did NOT land the hide hook; the option name is forward-compatible — Phase 9 reads it. Phase 8 admin reads use it on EVERY Car query.

Restore body (D-C): `{ note?: string }` only — no `reasonCategory`. Audit row's `reasonCategory` is `null` for Restore. `Car.moderationReason` + `moderationNote` CLEARED to `null` on Restore (D-C-1). `Car.moderatedBy`/`moderatedAt` UPDATED on Restore (D-C-2).

Image handling (D-D): multer multipart + S3 upload + reorder/remove. Reuses seller-PUT `upload` instance unchanged. Multer middleware mounted PER-ROUTE on Edit only — Suspend/Archive/Delete/Restore stay JSON-only (D-D-1). Orphan S3 objects on image removal — left in bucket, mirrors seller PUT (D-D-4).

Self-moderation middleware (D-04): `denySelfModerationListing` fetches `Car.findById(carId).setOptions({ includeAllListingStatuses: true }).select('sellerId')`; if `sellerId === req.admin.uid` → 400 `cannot_moderate_own_listing`. Car-not-found → 404 `listing_not_found` (do NOT leak existence). Applied to ALL 5 routes including Restore.

Self-mod attempts: logged via `console.warn`, NOT audited (D-05).

Transaction strategy (D-06): `session.withTransaction()` on every handler. Audit-row-insert BEFORE Car-update inside the transaction. Both with `{ session }`.

Service module (D-11): new file `src/moderation/listingService.js` exports `editListing, suspendListing, archiveListing, deleteListing, restoreListing` — each accepts `{ adminUid, adminEmail, carId, ...payload }`, returns `{ listing, action }`.

Service error class (D-12): `class ListingServiceError extends Error { constructor(code) { super(code); this.code = code; } }`. Router maps `err.code` against a new `KNOWN_LISTING_ERRORS` Set + `handleListingServiceError` function (parallel to v1.0).

Schemas (D-09, D-10): new file `src/moderation/listingSchemas.js` exports `suspendListingSchema, archiveListingSchema, deleteListingSchema, restoreListingSchema, editListingSchema`. All `.strict()`. `reasonCategoryEnum = z.enum(['spam','policy_violation','fraud','inactive_seller','other'])` — 5 values, derived from `Car.schema.path('moderationReason').enumValues` (verified below). `reasonCategory` REQUIRED on Suspend/Archive/Delete; optional only on Edit (no enum) / Restore (no enum).

Tests (D-16, D-17, D-18): under `__tests__/listing-moderation/` (Phase 7 directory). Tests do NOT boot `server.js`. Replica-set fixture is `__tests__/_helpers/mongoReplSet.js` (already installed, used by Phase 7).

### Claude's Discretion

- Plan count and ordering (CONTEXT.md suggests 6 plans; planner free to merge/split).
- Whether `listingService.js` is class vs. module-with-named-exports (v1.0 uses named exports; default to that).
- Whether `editListing` computes `fieldDiff` inline or via a helper (default inline; only Edit needs diff).
- Exact form of multer `upload` reuse (import vs. factory inject — see Code Examples below).
- Whether `denySelfModerationListing` short-circuits the Car fetch when the handler will fetch the same doc (default: middleware fetches with `.select('sellerId')` only; optimization optional).
- Whether to add `Car.lastActionId` back-link field (deferred; no query-pattern justification).

### Deferred Ideas (OUT OF SCOPE)

- `Car.lastActionId` back-link field
- Listing-history GET endpoint (`GET /api/admin/moderation/listings/:carId/history`)
- Cross-domain audit views (user-mod + listing-mod unioned)
- DB-user-level insert-only Atlas privilege
- Hash-chain tamper-evidence on `ListingModerationAction`
- Auto-cancel / auto-refund of orders touching a moderated listing
- S3 object cleanup on image-removal
- Per-field admin Edit audit-log diff replay UI
- Restore-to-previous-state semantics (Restore always returns to `'active'`)
- Hard-delete UI / API
- Listing-status email / push notifications to seller
- Super-admin tier with restricted transition matrix (D-B-2 `invalid_transition` is forward-compat only)
- Bulk admin listings panel
- Redis-backed rate limiter for horizontal scale
- Migrating legacy `/api/admin/*` routes to Bearer idToken

### Project Constraints (from CLAUDE.md)

- **Tech stack (backend):** Node/Express + Mongoose + MongoDB Atlas. New routes mount under `/api/admin/moderation/listings/*` (already mounted in Phase 7). Do NOT introduce new networking, validation, or state libs.
- **Auth enforcement:** Admin-only endpoints must validate caller admin status server-side on every request — never trust mobile-side `isAdmin`. `[VERIFIED: server.js:854 mounts verifyIdToken → requireAdmin → listingModerationRateLimiter → listingModerationRouter]`
- **Data preservation:** Suspending/archiving/deleting must never destroy order/audit history. Delete-soft does NOT remove the Car document (LADM-04).
- **Order safety:** In-flight orders touching a moderated listing are paused, NOT auto-cancelled. Phase 8 does NOT touch orders at all (Phase 9 owns LENF-03).
- **i18n:** All user-facing strings RU-first with EN parity. Phase 8 is backend-only — no new strings.
- **No breaking changes** to existing auth/cart/payments flows.
- **Secrets hygiene:** No new hardcoded keys. Reuse the existing `multer-S3` instance (D-D-2).
- **GSD Workflow Enforcement** (CLAUDE.md): all file edits go through GSD planning. The planner will produce 6 PLAN.md files; the executor follows them.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LADM-01 | Admin can Edit any listing's fields via `PATCH /api/admin/moderation/listings/:carId` — change writes `lastEditedBy` + audit row with `fieldDiff` | Editable field whitelist verified against seller PUT (server.js:763–833); `Car.lastEditedBy`/`lastEditedAt` fields confirmed present (Car.js:51–52); `ListingModerationAction.fieldDiff` is Mixed-type (ListingModerationAction.js:81); multer `upload` location verified (server.js:52–64) |
| LADM-02 | Admin can Suspend via `PATCH /:carId/suspend` with reason + optional note in single Mongoose transaction; `active → suspended` | Transaction pattern verified (service.js:64–123 suspend handler — canonical shape); `Car.status` enum confirmed `['active','suspended','archived','deleted']` at runtime; `ListingModerationAction.create([doc], {session})` array-form requirement noted; D-B-3 `includeAllListingStatuses: true` confirmed forward-compatible (Phase 7 hide-hook NOT landed) |
| LADM-03 | Admin can Archive via `PATCH /:carId/archive` with reason + optional note; `active → archived`. Semantically distinct from Suspend (non-punitive) | Same transaction substrate as LADM-02; `inactive_seller` reason added to enum exactly for this case (verified in `Car.moderationReason` enum at runtime + `ListingModerationAction.reasonCategory` enum line 73) |
| LADM-04 | Admin can Soft-Delete via `PATCH /:carId/delete` with reason + optional note; status → `deleted`. Document remains in DB | Doc preservation enforced by NOT calling `.deleteOne()`/`.findOneAndDelete()` — only `Car.updateOne({_id}, {$set: {status: 'deleted', ...}})`. Tests should assert `Car.countDocuments({_id: carId})` is still 1 after the call |
| LADM-05 | Admin can Restore any non-active listing via `PATCH /:carId/restore`; status → `active`; new audit row appended (history never rewritten) | Append-only enforced by 6 pre-hooks on `ListingModerationAction` (ListingModerationAction.js:97–102) — `updateOne`/`updateMany`/`findOneAndUpdate`/`deleteOne`/`deleteMany`/`findOneAndDelete` ALL throw the shared `APPEND_ONLY_ERR`; any handler bug that tries to mutate fails closed |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP endpoint surface | API / Backend | — | Phase 8 IS backend-only by design (REQUIREMENTS.md, ROADMAP §Phase 8). Mobile lives in Phase 10. |
| Admin authentication (idToken verify) | API / Backend | — | Already in mount chain at `server.js:854` (Phase 7) — `verifyIdToken` + `requireAdmin` precede this router. Phase 8 inherits, does not re-implement. |
| Rate limiting | API / Backend | — | `listingModerationRateLimiter` already mounted at app level (Phase 7 D-04); Phase 8 inherits. |
| Schema validation | API / Backend | — | Zod schemas in `src/moderation/listingSchemas.js` — runs in handler before service call. |
| Transaction atomicity | Database / Storage (Mongoose session) | API / Backend (orchestration) | `session.withTransaction()` is a Mongoose-driver-level mechanism; the API tier orchestrates the audit-then-Car ordering. |
| Append-only audit log | Database / Storage (Mongoose pre-hooks) | API / Backend (write path) | `ListingModerationAction.js` lines 97–102 enforce at schema level. API just calls `.create([doc], {session})`. |
| Image upload to S3 | API / Backend (multer middleware) | CDN / Static (S3) | multer-S3 streams from request body to S3 bucket. Phase 8 reuses the existing `upload` instance — does NOT add new S3 paths. |
| Mobile UI / banner / Restore button | (Phase 10/11) | — | Out of scope for Phase 8 — explicitly Phase 10 (admin UI) + Phase 11 (buyer UX). |

## Standard Stack

### Core (already installed — versions verified from backend `package.json`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `express` | ^5.2.1 | HTTP router | Already in use [VERIFIED: backend package.json] |
| `mongoose` | ^9.1.5 | ORM + transactions | Already in use; supports `session.withTransaction()` natively [VERIFIED: backend package.json] |
| `zod` | ^3.25.76 | Schema validation | Already in use for v1.0 user-mod (`schemas.js`); `.strict()` mode required [VERIFIED: backend package.json + schemas.js] |
| `multer` | ^2.0.2 | Multipart parsing | Already in use at `server.js:8`; reused by Edit endpoint [VERIFIED: backend package.json] |
| `multer-s3` | ^3.0.1 | S3 upload streaming | Already in use at `server.js:9`; reused by Edit endpoint [VERIFIED: backend package.json] |
| `@aws-sdk/client-s3` | ^3.975.0 | S3 SDK | Already in use at `server.js:7`; reused [VERIFIED: backend package.json] |
| `firebase-admin` | ^13.8.0 | idToken verify | Already in mount chain via `verifyIdToken` [VERIFIED: backend package.json] |
| `express-rate-limit` | ^8.3.2 | Rate limiting | Already in use via `listingModerationRateLimiter` (Phase 7) [VERIFIED: backend package.json] |

### Test infrastructure (already installed)

| Library | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Test runner [VERIFIED: backend package.json] |
| `mongodb-memory-server` | ^10.4.3 | Replica-set in-memory Mongo for txn tests [VERIFIED: backend package.json + `__tests__/_helpers/mongoReplSet.js`] |
| `supertest` | ^7.2.2 | HTTP integration testing [VERIFIED: backend package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing seller-PUT `upload` | New multer instance | D-D-2 LOCKED — split-brain image URL state. Don't. |
| Parallel `KNOWN_LISTING_ERRORS` set | Extending v1.0 `KNOWN_USER_ERRORS` | D-12 LOCKED — parallel router keeps domain concerns clean. CONTEXT.md confirmed by code shape: v1.0 router lives in a separate file (`router.js`); Phase 8 ships `listingRouter.js` separately. |
| Mongoose schema-driven enum derivation in Zod | Hard-coded Zod enum | D-10 LOCKED — derive from `Car.schema.path('moderationReason').enumValues` so taxonomy can't drift. Verified at runtime to be exactly `['spam','policy_violation','fraud','inactive_seller','other']`. |

**Installation:** No new packages needed. All dependencies present in `backend/package.json` from Phase 7.

## Architecture Patterns

### System Architecture Diagram

```
HTTP request (admin client)
   ↓
[server.js:854 app.use mount]
   ↓
verifyIdToken (Firebase idToken → req.auth.{uid,email})
   ↓
requireAdmin (req.auth.email → AdminUser lookup → req.admin.{uid,role,email})
   ↓
listingModerationRateLimiter (15min/30 req per admin, keyed `listing-admin:<uid>`)
   ↓
listingRouter (NEW Phase 8 routes — joined to /ping scaffold from Phase 7)
   ↓
[denySelfModerationListing] (PER-ROUTE: Car.findById(carId).select('sellerId') → reject if sellerId === req.admin.uid)
   ↓
[upload.array('images', 25)]  (Edit route ONLY; multer-S3 streams images to S3)
   ↓
Handler:
   ├─ Zod schema parse (.strict()) — invalid_payload | invalid_field on failure
   ├─ Pre-transaction read (Car.findById, includeAllListingStatuses: true)
   │     ├─ Not found → 404 listing_not_found
   │     └─ Same-state? → 400 already_in_state (Suspend/Archive/Delete) or not_moderated (Restore)
   │
   └─ session.withTransaction(async () => {
        1. ListingModerationAction.create([auditDoc], { session })
        2. Car.updateOne({ _id }, { $set: { ...statusUpdate, ...auditStamp } }, { session })
        Throw → rollback both
      })
   ↓
Response shape (D-02): { ok, listing, action }
```

### Recommended Project Structure

```
backend-services/carEx-services/
├── src/
│   ├── moderation/
│   │   ├── listingRouter.js        # MODIFIED — Phase 7 /ping preserved; +5 routes
│   │   ├── listingService.js       # NEW — 5 service functions
│   │   ├── listingSchemas.js       # NEW — 5 Zod schemas + reasonCategory enum
│   │   ├── denySelfModerationListing.js  # NEW — middleware
│   │   ├── listingRateLimit.js     # UNCHANGED (Phase 7)
│   │   ├── listingCapabilities.js  # UNCHANGED (Phase 7; Phase 8 does NOT consume)
│   │   └── (v1.0 user-mod files all UNCHANGED)
│   ├── models/
│   │   ├── Car.js                  # UNCHANGED — Phase 8 only consumes
│   │   └── ListingModerationAction.js  # UNCHANGED — Phase 8 only writes via create()
│   └── uploads/
│       └── carImages.js            # NEW (optional, see Pitfall 1) — extracts `upload` from server.js
├── server.js                        # MODIFIED only IF `upload` extraction chosen
└── __tests__/
    └── listing-moderation/
        ├── editListing.test.js          # NEW
        ├── suspendListing.test.js       # NEW
        ├── archiveListing.test.js       # NEW
        ├── deleteListing.test.js        # NEW
        ├── restoreListing.test.js       # NEW
        ├── listingTransaction.atomicity.test.js  # NEW
        ├── denySelfModerationListing.test.js     # NEW
        ├── listingSchemas.test.js                # NEW
        └── (Phase 7 tests all UNCHANGED — regression check on /ping)
```

### Pattern 1: Transaction with audit-then-target-update [VERIFIED: service.js:64–123]

**What:** Open Mongoose session; inside `withTransaction`, insert audit row first (capture its `_id`), then update target doc; both with `{ session }`. Throw anywhere → both roll back.

**When to use:** Every mutating handler in Phase 8 (Edit, Suspend, Archive, Delete, Restore).

**Example (canonical shape from v1.0 service.js — adapt for Phase 8):**
```js
// [VERIFIED: src/moderation/service.js:64–123 (suspend handler)]
const session = await mongoose.startSession();
let insertedAction;
let updatedListing;
try {
  await session.withTransaction(async () => {
    // 1. Audit row FIRST. ARRAY FORM REQUIRED for { session } per Mongoose.
    const [action] = await ListingModerationAction.create([{
      listingId: carId,
      sellerUid: current.sellerId,
      adminUid,
      adminEmail,
      action: 'suspend',               // or 'archive'/'delete'/'restore'/'edit'
      fromStatus: current.status,      // pre-transition state
      toStatus: 'suspended',           // target state (= current.status for Edit)
      reasonCategory,                  // null for Restore + Edit
      reasonNote: note ?? null,
      fieldDiff: null,                 // populated only on Edit
    }], { session });
    insertedAction = action;

    // 2. Car update with status + audit-stamp fields.
    const res = await Car.updateOne(
      { _id: carId },
      { $set: {
          status: 'suspended',
          moderationReason: reasonCategory,
          moderationNote: note ?? null,
          moderatedBy: adminUid,
          moderatedAt: new Date(),
        }
      },
      { session }
    );
    if (res.matchedCount !== 1) throw new ListingServiceError('listing_not_found');
    updatedListing = await Car.findById(carId).setOptions({ includeAllListingStatuses: true }).session(session).lean();
  });
} finally {
  await session.endSession();
}
return { listing: { _id: updatedListing._id, status: updatedListing.status, moderatedBy: updatedListing.moderatedBy, moderatedAt: updatedListing.moderatedAt }, action: { _id: insertedAction._id.toString(), action: insertedAction.action, fromStatus: insertedAction.fromStatus, toStatus: insertedAction.toStatus, createdAt: insertedAction.createdAt } };
```

> **CRITICAL gotcha [VERIFIED: service.js:7–14 top-of-file comment]:** Use `ListingModerationAction.create([doc], { session })` (ARRAY form). The single-doc form `.create(doc, { session })` does NOT accept the `{ session }` option in Mongoose — the audit row would write OUTSIDE the transaction and rollback would orphan it. The v1.0 service.js comment block explicitly calls this out; the same constraint applies in Phase 8.

### Pattern 2: Router dispatch with handleServiceError [VERIFIED: router.js:59–128]

**What:** Module-scope `KNOWN_LISTING_ERRORS` Set + `handleListingServiceError(err, res, tag)` function. Handler catches → checks `err.code` (or `err.message` per v1.0 pattern) against the Set → returns 400 with `{ error: code }`; unknown errors → 500 `internal_error` + console.error.

**When to use:** Every Phase 8 route handler.

**Example (parallel to v1.0 router.js:59–128):**
```js
// [VERIFIED: src/moderation/router.js:59–84]
const KNOWN_LISTING_ERRORS = new Set([
  'listing_not_found',
  'invalid_transition',        // forward-compat only; v1.1 never emits (D-B-2)
  'already_in_state',
  'not_moderated',
  'invalid_field',
  'no_changes',
  'invalid_payload',           // emitted from Zod parse-failure branch, not service
  'cannot_moderate_own_listing', // emitted from middleware, not service
  'invalid_make',              // from VehicleMake.findOne (Edit only)
  'invalid_model',             // from VehicleModel.findOne (Edit only)
]);

function handleListingServiceError(err, res, tag) {
  // v1.0 uses err.message; Phase 8 D-12 introduces err.code via ListingServiceError class.
  // Either works; pick one and apply uniformly. Recommendation: use err.code (cleaner).
  const code = err.code || err.message;
  if (KNOWN_LISTING_ERRORS.has(code)) {
    const body = { error: code };
    if (code === 'invalid_field' && Array.isArray(err.fields)) body.fields = err.fields;
    return res.status(400).json(body);
  }
  console.error(`[listing-moderation] ${tag} error:`, err);
  return res.status(500).json({ error: 'internal_error', message: err.message });
}
```

> **Note on v1.0 divergence:** v1.0 throws `new Error('already_at_severity')` and matches on `err.message`. Phase 8 D-12 cleans this up with `class ListingServiceError extends Error { constructor(code) { super(code); this.code = code; } }`. The planner should choose ONE pattern for Phase 8 and apply it uniformly (recommendation: D-12's explicit code class — cleaner, more discriminable from generic Error). If `err.code` is used, `handleListingServiceError` should also fall back to `err.message` for any non-Service errors that happen to carry a known code (defensive).

### Pattern 3: Per-route middleware mounting (D-D-1 multer on Edit only) [VERIFIED: pattern existing at server.js:763]

**What:** Multer middleware mounts on the specific route, not router-wide. JSON-only routes skip it.

**Example:**
```js
// Edit accepts multipart/form-data
router.patch('/:carId',
  upload.array('images', 25),       // multer multipart parser → req.files + req.body
  denySelfModerationListing,
  async (req, res) => { /* ... */ }
);

// Transition routes accept JSON only
router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => { /* ... */ });
router.patch('/:carId/archive', denySelfModerationListing, async (req, res) => { /* ... */ });
router.patch('/:carId/delete',  denySelfModerationListing, async (req, res) => { /* ... */ });
router.patch('/:carId/restore', denySelfModerationListing, async (req, res) => { /* ... */ });
```

### Pattern 4: Zod schemas, `.strict()` everywhere [VERIFIED: schemas.js:1–95]

**What:** Every schema chains `.strict()` so unknown top-level keys reject with `unrecognized_keys` issue → router converts to 400 `invalid_field`. Per-field validators are permissive (mirror seller PUT looseness for Edit per D-A-1).

**Example (Phase 8 schema shape):**
```js
// src/moderation/listingSchemas.js (NEW)
const { z } = require('zod');
const Car = require('../models/Car');

// Derive enums from Mongoose source of truth (D-10).
const reasonCategoryEnum = z.enum(Car.schema.path('moderationReason').enumValues);
// VERIFIED at runtime: ['spam','policy_violation','fraud','inactive_seller','other']

const noteField = z.string().max(2000).optional();

const suspendListingSchema = z.object({
  reasonCategory: reasonCategoryEnum,
  note: noteField,
}).strict();

const archiveListingSchema = z.object({
  reasonCategory: reasonCategoryEnum,
  note: noteField,
}).strict();

const deleteListingSchema = z.object({
  reasonCategory: reasonCategoryEnum,
  note: noteField,
}).strict();

const restoreListingSchema = z.object({
  note: noteField,  // D-C — no reasonCategory
}).strict();

// Edit: broad whitelist per D-A. Permissive types. `z.coerce.*` because multipart
// form fields arrive as strings and the seller PUT does its own parseInt() (server.js:810–812).
const editListingSchema = z.object({
  makeId: z.string().optional(),
  modelId: z.string().optional(),
  trimLevel: z.string().optional(),
  wheelbase: z.string().optional(),
  year: z.coerce.number().int().nonnegative().optional(),
  price: z.coerce.number().int().nonnegative().optional(),
  mileage: z.coerce.number().int().nonnegative().optional(),
  fuel: z.string().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  bodyType: z.string().optional(),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  drivetrain: z.string().optional(),
  mpg: z.string().optional(),
  condition: z.string().optional(),
  knownIssues: z.union([z.string(), z.array(z.string())]).optional(),
  exteriorColor: z.string().optional(),
  interiorColor: z.string().optional(),
  interiorMaterial: z.string().optional(),
  seats: z.coerce.number().int().nonnegative().optional(),
  doors: z.coerce.number().int().nonnegative().optional(),
  phoneNumber: z.string().optional(),
  telegramUsername: z.string().optional(),
  // imageUrls/existingImageUrls handled separately (multipart JSON-string field)
  existingImageUrls: z.string().optional(),  // JSON-stringified array per seller-PUT shape
}).strict();

module.exports = {
  reasonCategoryEnum,
  suspendListingSchema, archiveListingSchema, deleteListingSchema, restoreListingSchema, editListingSchema,
};
```

### Pattern 5: denySelfModerationListing middleware [VERIFIED: shape based on denySelfModeration.js:14–33]

**What:** Pre-handler middleware fetches Car.sellerId for comparison. Differs from v1.0 (UID comparison via param) because the listing's owner isn't in `req.params`.

**Example:**
```js
// src/moderation/denySelfModerationListing.js (NEW)
const Car = require('../models/Car');

async function denySelfModerationListing(req, res, next) {
  const carId = req.params && req.params.carId;
  const adminUid = req.admin && req.admin.uid;
  if (!carId || !adminUid) return next();  // defensive — upstream guarantees both

  try {
    // D-04: setOptions({ includeAllListingStatuses: true }) — forward-compat for Phase 9 hide hook.
    // Today the option is a no-op; Phase 9's pre(/^find/) reads it. We MUST emit it now so
    // Phase 9 lands cleanly without retroactively touching this middleware.
    const car = await Car.findById(carId)
      .setOptions({ includeAllListingStatuses: true })
      .select('sellerId')
      .lean();

    if (!car) {
      // D-04: do NOT leak existence — return listing_not_found, not cannot_moderate_own_listing.
      return res.status(404).json({ error: 'listing_not_found' });
    }
    if (car.sellerId === adminUid) {
      // D-05: log-only, NOT audited.
      console.warn(`[listing-moderation] denied self-moderation attempt by ${adminUid} on listing ${carId} (sellerId=${car.sellerId}) at ${new Date().toISOString()}`);
      return res.status(400).json({ error: 'cannot_moderate_own_listing' });
    }
    return next();
  } catch (err) {
    console.error('[denySelfModerationListing] error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

module.exports = { denySelfModerationListing };
```

### Anti-Patterns to Avoid

- **Single-doc form for ModerationAction.create.** [VERIFIED: service.js top-of-file comment lines 7–14] — `ListingModerationAction.create(doc, { session })` silently ignores `{ session }`; must use `[doc]` array form.
- **Mutating `Car.listingStatus`.** [VERIFIED: Car.js banner lines 1–4] — `listingStatus` is the seller lifecycle field (`'active'|'booked'|'sold'`); `status` is the moderation field. Phase 7 D-08 explicitly locked these as distinct. Touching `listingStatus` in a moderation handler is a code-review red flag.
- **Bypassing `setOptions({ includeAllListingStatuses: true })` on admin reads.** Phase 9 will land a `Car.pre(/^find/)` hide hook reading this option. Phase 8 reads MUST emit it now so Phase 9 doesn't have to retrofit.
- **Extending v1.0 `KNOWN_USER_ERRORS`.** Ship a parallel `KNOWN_LISTING_ERRORS` per D-12. Cross-domain error codes pollute both routers.
- **Auto-cancel / refund of orders.** Phase 8 mutates Car + audit row ONLY. Orders are Phase 9 territory (LENF-03).
- **Full Car payload in response.** D-02 returns a thin `{ _id, status, moderatedBy, moderatedAt, lastEditedBy?, lastEditedAt? }`. Full doc bloats responses and risks leaking moderation fields to clients.
- **Adding `Car.lastActionId` back-link.** Deferred — no query-pattern justification. Phase 9/10 may surface one.
- **Modifying Phase 7's `/ping` route.** The route's middleware-chain test (Phase 7 `listingModerationRateLimiter.test.js`) is a regression check. The `/ping` route must PRESERVE byte-identical shape.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart parsing | Custom request-body parsing | `multer` (already installed) | Seller PUT already uses it; reuse the same `upload` instance per D-D-2 |
| S3 upload | Custom S3 SDK calls | `multer-s3` (already installed) | Same bucket, same prefix scheme — split-brain risk if you fork |
| Schema validation | If/else checks per field | `zod` with `.strict()` + `.discriminatedUnion()` | v1.0 pattern; planner needs zero new infra |
| Transaction atomicity | Manual try-catch + rollback | Mongoose `session.withTransaction()` | Automatic retry on transient errors; clean rollback semantics |
| Append-only audit enforcement | Don't trust handler discipline | The 6 pre-hooks on `ListingModerationAction` (Phase 7 D-11) | Application-layer defense-in-depth; any handler bug fails closed |
| Error envelope shape | Custom { ok: false, ... } | Mirror v1.0 `{ error: code, message? }` | Mobile already handles this shape |
| `Car.status` enum derivation | Hard-code in Zod | `Car.schema.path('status').enumValues` (or `moderationReason` for reason enum) | Source-of-truth lock; D-10 |

**Key insight:** Phase 8 is a *connection* phase, not an *invention* phase. The Phase 7 substrate (Car schema, ListingModerationAction model, capabilities map, rate limiter, router scaffold) + v1.0 patterns (service-then-router structure, KNOWN_*_ERRORS set, `denySelfModeration`, Zod schemas) cover ~95% of what Phase 8 needs. The ONLY new architectural surface is the multer `upload` reuse decision (Pitfall 1 below).

## Runtime State Inventory

Phase 8 is a backend code-addition phase — no rename, no migration, no string replacement. The runtime state inventory categories are not load-bearing here, but for completeness:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 8 adds collections to Phase 7 substrate. ListingModerationAction collection already created by Phase 7 D-19 (`ensureBaseline.js` + migration script ran). | None |
| Live service config | None — Railway env vars unchanged. S3 bucket unchanged. Firebase keys unchanged. | None |
| OS-registered state | None — no new processes, no new cron, no new systemd. | None |
| Secrets / env vars | None — reuses `process.env.AWS_*`, `process.env.MONGODB_URI`, etc. already in use. | None |
| Build artifacts | None — no compile step in backend (pure Node). | None |

**Nothing found in any category** — Phase 8 is pure code addition atop Phase 7 substrate.

## Common Pitfalls

### Pitfall 1: The multer `upload` instance is NOT importable [HIGHEST-PRIORITY for planner]

**What goes wrong:** CONTEXT.md D-D-2 says "reuse the existing seller-PUT path" but the planner needs to tell the executor where to `require(...)` it from. The Edit endpoint cannot directly write `const { upload } = require('../../server')` — `server.js` is the app entry point (calls `app.listen()` at the bottom + creates the Express app + connects to Mongo). Requiring server.js from a router module creates a circular dep and would boot Mongo + Stripe + S3 on every test that imports the router.

**Verified evidence:** [VERIFIED: server.js:52–64] — `const upload = multer({ storage: multerS3({ ... }) })` is a module-local const at the top of server.js. It is **never exported**. There is NO `module.exports` line in server.js.

**Resolution paths (planner chooses one):**

1. **Extract** `upload` into `src/uploads/carImages.js` (recommended):
   ```js
   // src/uploads/carImages.js (NEW)
   const { S3Client } = require('@aws-sdk/client-s3');
   const multer = require('multer');
   const multerS3 = require('multer-s3');
   const s3 = new S3Client({ /* same config as server.js:44–50 */ });
   const upload = multer({ storage: multerS3({ /* same config as server.js:52–64 */ }) });
   module.exports = { upload, s3 };
   ```
   Then `server.js` `require`s it instead of inlining; `listingRouter.js` `require`s the same module. ONE module owns the configuration; both consumers get an identical instance.

2. **Factory inject** `upload` into `listingRouter`:
   ```js
   // listingRouter.js exports a factory
   module.exports = function createListingRouter({ upload }) {
     const router = express.Router();
     router.get('/ping', ...);
     router.patch('/:carId', upload.array('images', 25), denySelfModerationListing, async (req, res) => { ... });
     return router;
   };
   // server.js
   const listingModerationRouter = require('./src/moderation/listingRouter')({ upload });
   ```
   This is the v1.0-style "no top-level cross-module side effects" pattern. Phase 7 `listingRouter.js` is currently a default-exported `router` — switching to a factory breaks the Phase 7 test `listingModerationRateLimiter.test.js:50` (`const listingRouter = require('../../src/moderation/listingRouter');`). Phase 8 would have to update that import too.

**Recommendation:** Option 1 (extract). Cleaner, doesn't touch Phase 7 tests, avoids API-shape regression on `listingRouter`. The extraction is ~15 lines of code; Phase 7 tests stay green.

**Warning sign:** Plan that says "import upload from server.js" — won't work.

### Pitfall 2: Mongoose `.create([doc], { session })` array-form requirement

**What goes wrong:** `ListingModerationAction.create(doc, { session })` writes the audit row OUTSIDE the transaction. Rollback orphans it. Test passes (audit row visible), but if the Car update later fails, audit log corrupts.

**Why it happens:** Mongoose's `.create()` overload resolution treats the second arg as a doc when the first is not an array. Only the array form `.create([doc], options)` triggers the options-aware path.

**Evidence:** [VERIFIED: service.js:7–14 top-of-file comment in v1.0] — the comment is explicit; the v1.0 author hit this bug.

**How to avoid:** ALL audit writes use `await ListingModerationAction.create([{...}], { session })`. Code-review for any single-doc form.

**Warning sign:** Grep for `ListingModerationAction.create(` not followed by `[` → fails.

### Pitfall 3: `listingStatus` vs `status` collision [VERIFIED: Car.js banner lines 1–4]

**What goes wrong:** Both fields default to `'active'`; both have `enum` constraints; both look like "status." A handler that writes `car.listingStatus = 'suspended'` corrupts the seller lifecycle field, breaks the booking flow, and doesn't actually mark the listing as moderated.

**Why it happens:** Naming collision is a Phase 7 D-08 known gotcha. The schema file has a 4-line banner at the top warning about it.

**How to avoid:** Phase 8 handlers write ONLY to `Car.status`. Add a code-review check: grep for `listingStatus` in any new Phase 8 file → MUST be 0. The Phase 7 banner says so explicitly.

**Warning sign:** Any `$set: { listingStatus: ... }` in a Phase 8 handler.

### Pitfall 4: The `/ping` regression check [VERIFIED: listingRouter.js:25–27 + Phase 7 D-19 test]

**What goes wrong:** Phase 8 refactors `listingRouter.js` and accidentally removes or modifies the `/ping` route. The Phase 7 rate-limit test breaks (Test 3 in `listingModerationRateLimiter.test.js`) because it hits `/api/admin/moderation/listings/ping`.

**Why it happens:** Phase 7 explicitly noted (`07-PATTERNS.md` §2 + 07-CONTEXT.md D-01) that the router is dependency-free. Phase 8 ADDS dependencies (service, schemas, middleware). The risk is wholesale rewrite of the file.

**How to avoid:** Phase 8 KEEPS the `/ping` route byte-identical. Add 5 new `router.patch(...)` blocks BELOW the existing `/ping` route. The Phase 7 test continues to assert on `/ping` and serves as the middleware-chain regression check.

**Warning sign:** Phase 8 PLAN that deletes or modifies the `/ping` route.

### Pitfall 5: `Car.findById` and Phase 9 hide hook forward-compat

**What goes wrong:** Phase 8 admin reads use plain `Car.findById(carId)`. When Phase 9 lands the `pre(/^find/)` hide hook filtering `status !== 'active'`, Phase 8's reads silently start returning `null` for any suspended/archived/deleted listing — breaking Restore, breaking same-state guards, breaking the self-mod middleware on already-moderated listings.

**Why it happens:** D-B-3 + D-04 pre-lock the option name `includeAllListingStatuses: true`. Phase 7 did NOT land the hook; the option is a no-op TODAY. But Phase 9 reads it.

**How to avoid:** EVERY `Car.findById(...)` in Phase 8 chains `.setOptions({ includeAllListingStatuses: true })`. Including the middleware fetch. Code-review check: grep all `Car.findById` calls in Phase 8 files → all must include the option.

**Warning sign:** `Car.findById(carId)` without `setOptions`.

### Pitfall 6: Transactions REQUIRE replica-set Mongo [VERIFIED: __tests__/_helpers/mongoReplSet.js:5–6]

**What goes wrong:** A new Phase 8 test that uses `MongoMemoryServer.create()` instead of the replica-set fixture will fail with "Transaction numbers are only allowed on a replica set member or mongos" the moment it hits `session.withTransaction()`.

**How to avoid:** All Phase 8 service tests use `const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet')` (path verified). The middleware test (`denySelfModerationListing.test.js`) and schema test (`listingSchemas.test.js`) do NOT open transactions and can use plain `MongoMemoryServer`.

**Warning sign:** A txn-using test file that imports `MongoMemoryServer` directly instead of the helper.

### Pitfall 7: VehicleMake/VehicleModel are defined IN server.js, not in `src/models/` [VERIFIED: server.js:80–100]

**What goes wrong:** Phase 8 Edit handler runs `VehicleMake.findOne(...)` when admin changes `makeId`. The planner assumes `require('../models/VehicleMake')` — but VehicleMake is `mongoose.model('VehicleMake', vehicleMakeSchema, 'vehicle_makes')` declared inline in server.js at line 99.

**Resolution:** Phase 8 Edit handler must resolve the model via `mongoose.model('VehicleMake')` lazily inside the service function (like v1.0 `getProfileModel(role)` in service.js:312–320 — same pattern). This works because server.js registers the models at boot; tests register loose-schema variants under the canonical name.

**Recommendation in Phase 8 service:**
```js
function getVehicleModels() {
  return {
    VehicleMake: mongoose.model('VehicleMake'),
    VehicleModel: mongoose.model('VehicleModel'),
  };
}
```
Tests then register loose-schema variants per the editProfile.test.js:19–26 pattern.

**Warning sign:** Plan that says `const VehicleMake = require('../models/VehicleMake')` — file doesn't exist.

### Pitfall 8: Edit can apply to a listing in ANY status (D-A-4) — middleware ordering

**What goes wrong:** `denySelfModerationListing` runs BEFORE the handler. For Edit on a `deleted` listing, the middleware's `Car.findById(carId).select('sellerId')` (with `includeAllListingStatuses: true`) returns the doc. So the check works.

**But** if a future change adds `.where({ status: 'active' })` to the middleware fetch (a "helpful" optimization), Edit on non-active listings breaks. The Phase 9 hide hook is the same risk surface.

**How to avoid:** The middleware fetch MUST be unfiltered by status (only `setOptions({ includeAllListingStatuses: true })` for forward-compat with the future hide hook). Add a code comment + test asserting Edit works on suspended/archived/deleted listings (D-16 already lists this in the test catalog).

**Warning sign:** Middleware fetch adds a `.where(...)` clause filtering status.

### Pitfall 9: Status-transition order: read state → check guard → enter txn → audit → update [VERIFIED: D-B-1 + service.js:51–60 v1.0 pattern]

**What goes wrong:** Same-state guard inside the transaction wastes a transaction commit on a 400. The transaction is also more expensive than a single read.

**How to avoid:** Pre-transaction read does the same-state check (D-B-1 explicitly says "fast-path BEFORE the transaction opens"). Pattern:
```js
const current = await Car.findById(carId)
  .setOptions({ includeAllListingStatuses: true })
  .session(null)   // explicit — outside txn
  .lean();
if (!current) throw new ListingServiceError('listing_not_found');
if (current.status === target) throw new ListingServiceError('already_in_state');
// Now open transaction:
const session = await mongoose.startSession();
// ...
```

**Verification note:** v1.0 service.js:51–60 does the same pre-read. The pattern is canonical.

### Pitfall 10: Restore on already-active listing — different code than same-state

**What goes wrong:** Restore on a listing that's already `'active'` should throw `not_moderated`, NOT `already_in_state` (D-03). These are distinct codes; the planner might collapse them.

**Why it happens:** Same-state guard on Suspend/Archive/Delete checks `current.status === target`. Restore's "target" is `'active'`, so the check would naturally throw `already_in_state` — but that's the wrong code per D-03.

**How to avoid:** Restore handler has its own pre-read check:
```js
if (current.status === 'active') throw new ListingServiceError('not_moderated');
```
NOT the same-state guard the other handlers use.

**Warning sign:** Restore handler uses same `already_in_state` check as transition handlers.

## Code Examples

Verified patterns from backend source:

### Example 1: Mounting + middleware chain [VERIFIED: server.js:854]

```js
// server.js:854 — DO NOT MODIFY (Phase 7 mount)
app.use(
  '/api/admin/moderation/listings',
  verifyIdToken,
  requireAdmin,
  listingModerationRateLimiter,
  listingModerationRouter
);
```

### Example 2: Phase 7 listingRouter scaffold [VERIFIED: listingRouter.js:1–29]

```js
// src/moderation/listingRouter.js — Phase 7 current state
const express = require('express');
const router = express.Router();

// PRESERVE BYTE-IDENTICAL — Phase 7 regression check
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
```

### Example 3: Phase 8 listingRouter ADDITIONS (proposed shape, not LOCKED)

```js
// src/moderation/listingRouter.js — after Phase 8
const express = require('express');
const service = require('./listingService');
const schemas = require('./listingSchemas');
const { denySelfModerationListing } = require('./denySelfModerationListing');
const { upload } = require('../uploads/carImages');  // see Pitfall 1

const router = express.Router();

const KNOWN_LISTING_ERRORS = new Set([
  'listing_not_found', 'invalid_transition', 'already_in_state', 'not_moderated',
  'invalid_field', 'no_changes', 'invalid_make', 'invalid_model',
]);

function handleListingServiceError(err, res, tag) {
  const code = err.code || err.message;
  if (KNOWN_LISTING_ERRORS.has(code)) {
    const body = { error: code };
    if (code === 'invalid_field' && Array.isArray(err.fields)) body.fields = err.fields;
    return res.status(400).json(body);
  }
  console.error(`[listing-moderation] ${tag} error:`, err);
  return res.status(500).json({ error: 'internal_error', message: err.message });
}

// Phase 7 scaffold — PRESERVED
router.get('/ping', (req, res) => { res.json({ ok: true }); });

// Phase 8 — 5 new routes

// LADM-02 Suspend
router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => {
  const parsed = schemas.suspendListingSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  try {
    const result = await service.suspendListing({
      adminUid: req.admin.uid, adminEmail: req.admin.email,
      carId: req.params.carId,
      reasonCategory: parsed.data.reasonCategory, note: parsed.data.note,
    });
    return res.json({ ok: true, listing: result.listing, action: result.action });
  } catch (err) { return handleListingServiceError(err, res, 'suspend'); }
});

// LADM-03 Archive, LADM-04 Delete, LADM-05 Restore: same shape

// LADM-01 Edit — multer on this route ONLY
router.patch('/:carId', upload.array('images', 25), denySelfModerationListing, async (req, res) => {
  const parsed = schemas.editListingSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const unknownIssue = parsed.error.issues.find(i => i.code === 'unrecognized_keys');
    if (unknownIssue) return res.status(400).json({ error: 'invalid_field', fields: unknownIssue.keys || [] });
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await service.editListing({
      adminUid: req.admin.uid, adminEmail: req.admin.email,
      carId: req.params.carId,
      fields: parsed.data,
      uploadedFiles: req.files || [],
    });
    return res.json({ ok: true, listing: result.listing, action: result.action });
  } catch (err) { return handleListingServiceError(err, res, 'editListing'); }
});

module.exports = router;
```

### Example 4: ListingModerationAction shape [VERIFIED: ListingModerationAction.js:38–83]

Fields the Phase 8 audit-write MUST populate:

| Field | Required | Type | Phase 8 source |
|-------|----------|------|----------------|
| `listingId` | yes | String | `req.params.carId` |
| `sellerUid` | yes | String | `current.sellerId` (from pre-txn read) |
| `adminUid` | yes | String | `req.admin.uid` |
| `adminEmail` | yes | String | `req.admin.email` |
| `action` | yes | enum: `'suspend'\|'archive'\|'delete'\|'restore'\|'edit'` | per-handler literal |
| `fromStatus` | yes | enum: `'active'\|'suspended'\|'archived'\|'deleted'` | `current.status` |
| `toStatus` | yes | enum: same | target status; `current.status` for Edit (D-A-4) |
| `reasonCategory` | optional, default null | enum: 5-value | `req.body.reasonCategory` for Suspend/Archive/Delete; `null` for Restore + Edit |
| `reasonNote` | optional, default null | String, max 2000 | `req.body.note` |
| `fieldDiff` | optional, default null | Mixed | Edit only; computed inside txn |
| `createdAt` | yes | Date, default Date.now | auto |

### Example 5: VehicleMake/Model lazy resolution [VERIFIED: server.js:99–100 + v1.0 getProfileModel pattern at service.js:312–320]

```js
// Inside listingService.js
const mongoose = require('mongoose');

function getVehicleModels() {
  // Lazy — server.js registers these at boot. In tests, register loose-schema
  // variants under canonical name BEFORE require()ing listingService.
  return {
    VehicleMake: mongoose.model('VehicleMake'),
    VehicleModel: mongoose.model('VehicleModel'),
  };
}

async function validateMakeModel(makeId, modelId) {
  const { VehicleMake, VehicleModel } = getVehicleModels();
  if (makeId) {
    const makeDoc = await VehicleMake.findOne({ _id: makeId, isActive: true });
    if (!makeDoc) throw new ListingServiceError('invalid_make');
    if (modelId) {
      const modelDoc = await VehicleModel.findOne({ _id: modelId, makeId, isActive: true });
      if (!modelDoc) throw new ListingServiceError('invalid_model');
      return { makeName: makeDoc.name, modelName: modelDoc.name };
    }
    return { makeName: makeDoc.name };
  }
  return null;
}
```

### Example 6: Edit handler image diff (key insight) [VERIFIED: server.js:778–785 seller-PUT shape]

```js
// Phase 8 editListing service — image diff
const newUrls = uploadedFiles ? uploadedFiles.map(f => f.location) : [];
let beforeImages = current.imageUrls || [];
let afterImages = beforeImages;  // default: no change
if (fields.existingImageUrls !== undefined) {
  try {
    afterImages = JSON.parse(fields.existingImageUrls);  // admin's kept-from-existing list
  } catch (_e) { /* treat as no change */ }
}
afterImages = [...afterImages, ...newUrls];  // append uploaded

if (JSON.stringify(beforeImages) !== JSON.stringify(afterImages)) {
  fieldDiff.imageUrls = { before: beforeImages, after: afterImages };
  changeSet.imageUrls = afterImages;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Throwing `new Error('code')` in service, matching on `err.message` in router (v1.0 pattern) | `class ListingServiceError extends Error { code }` (Phase 8 D-12) | Phase 8 introduces | Cleaner error discrimination; planner should commit to one pattern (recommended: D-12's class). |
| Mounting `moderationRateLimiter` via `router.use()` inside `router.js` (v1.0) | Mounting `listingModerationRateLimiter` at app level in `server.js:854` (Phase 7 D-04) | Phase 7 | Different from v1.0 because Phase 7 D-01 wanted dependency-free `listingRouter`. Phase 8 does NOT change this. |
| `req.body.callerUid` in legacy /api/admin/* routes (pre-v1.0) | `verifyIdToken` + `requireAdmin` populating `req.admin.{uid,email}` | v1.0 Phase 1 | Phase 8 fully inherits the cryptographic auth model. Never read `req.body.callerUid` or `req.body.adminUid` — those are out-of-band. |
| 4-value reason taxonomy (`spam, policy_violation, fraud, other`) in v1.0 user-mod schemas.js:11 | 5-value taxonomy (adds `inactive_seller`) in Phase 7 ListingModerationAction + Car.moderationReason | Phase 7 | Listing-domain only. Do NOT touch v1.0 schemas.js. Phase 8 ships its own listingSchemas.js with the 5-value enum. |

**Deprecated/outdated:**
- v1.0 callerUid-in-body legacy admin routes (server.js:848 comment) — out of scope for Phase 8.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Planner will choose Pitfall 1 Option 1 (extract `upload` to `src/uploads/carImages.js`) over Option 2 (factory inject) | Pitfall 1 | Low — both options work; Option 2 just requires updating Phase 7 test imports. The recommendation should be explicitly confirmed in 08-DISCUSSION or at plan time. |
| A2 | `Car.schema.path('moderationReason').enumValues` is the right source for `reasonCategoryEnum` in Zod | Pattern 4 | None — runtime-verified the enum is exactly the 5 values D-09 lists. |
| A3 | The `listingStatus` (lifecycle) field stays untouched throughout Phase 8 | Pitfall 3 | None — D-08 + Car.js banner + LADM specs all forbid touching it. |
| A4 | v1.0 `service.js` returns plain objects (not Mongoose docs) — Phase 8 should do the same | D-02 | None — `.lean()` chain verified on v1.0 reads. |

All other claims in this research are tagged `[VERIFIED: ...]` against actual backend source files read this session.

## Open Questions (RESOLVED)

> All three questions resolved by the planner during the Phase 8 planning pass (2026-05-28). The planner's resolutions are noted inline per question. See PLAN files 08-01..08-06 for the landed implementation choices.

1. **Pitfall 1 resolution (multer upload sharing)** — **RESOLVED:** Extract to `src/uploads/carImages.js` (Option 1).
   - What we know: server.js:52–64 declares `upload` as a module-local const; not exported.
   - What's unclear: which resolution path the planner picks (extract vs. factory).
   - Recommendation: **Extract to `src/uploads/carImages.js`** (Pitfall 1 Option 1). It's cleaner, doesn't touch Phase 7 tests, and matches the "single source of truth" discipline Phase 7 used for `listingCapabilities.js`. The substrate plan (proposed Plan 08-01) should include the extraction; the Edit plan (proposed 08-06) then `require`s it.
   - **Landed in:** Plan 08-01 Task 1 (`src/uploads/carImages.js` shipped; `server.js` modified to `require` it; `uploadAvatar` preserved unchanged).

2. **Error class vs. error message pattern** — **RESOLVED:** Adopt D-12's `ListingServiceError extends Error { code }`.
   - What we know: v1.0 uses `new Error('already_at_severity')` + `err.message` matching (router.js:72). Phase 8 D-12 introduces `class ListingServiceError extends Error { code }`.
   - What's unclear: whether the planner wants Phase 8 to be a clean break or to stay symmetric with v1.0.
   - Recommendation: **Commit to D-12's `ListingServiceError` class.** It's cleaner, more discriminable (a generic `Error('listing_not_found')` from a downstream dep would also match `KNOWN_LISTING_ERRORS` — `.code` discriminates). Document in the substrate plan; reference v1.0 service.js as the "prior art we're improving on." The Phase 8 router's `handleListingServiceError` reads `err.code` (with `err.message` fallback for defensive compat).
   - **Landed in:** Plan 08-01 substrate (`src/moderation/listingErrors.js` ships the class); Plans 08-02..06 throw `new ListingServiceError(code)`; `handleListingServiceError` reads `err.code` first with `err.message` fallback.

3. **Whether to emit `invalid_transition` at all in v1.1** — **RESOLVED:** Include in `KNOWN_LISTING_ERRORS` as forward-compat marker; never thrown in v1.1.
   - What we know: D-B-2 explicitly says `invalid_transition` is forward-compat only and the v1.1 matrix is fully open.
   - What's unclear: should the code even be in `KNOWN_LISTING_ERRORS` if it's never thrown?
   - Recommendation: **Include it in the Set, document the forward-compat intent inline.** If a future super-admin tier (D-B-2) adds the code, the router already routes it correctly. Cost = 1 line.
   - **Landed in:** Plan 08-02 (router substrate gains `KNOWN_LISTING_ERRORS` set including `invalid_transition` with inline `// forward-compat for D-B-2 super-admin tier` comment).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | >=20 (CLAUDE.md) | — |
| MongoDB Atlas (replica-set) | Transactions in production | ✓ | Same cluster as v1.0 Phase 2 (D-25 already confirmed M10+) | — |
| `mongodb-memory-server` (replica-set mode) | Test transactions | ✓ | 10.4.3 (`__tests__/_helpers/mongoReplSet.js`) | — |
| `jest` | Test runner | ✓ | 29.7.0 | — |
| `supertest` | HTTP integration tests | ✓ | 7.2.2 | — |
| `multer` + `multer-s3` + `@aws-sdk/client-s3` | Edit endpoint image handling | ✓ | server.js uses them | — |
| S3 bucket | Image upload destination | ✓ | `process.env.AWS_BUCKET_NAME` (same as seller PUT) | — |
| Firebase Identity Toolkit | idToken verification | ✓ | `firebase-admin` mounted | — |

**No missing dependencies.** Phase 8 ships zero new infra; all deps confirmed present at the backend repo.

## Validation Architecture

> Nyquist validation enabled (no `workflow.nyquist_validation: false` override).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 29.7.0 + supertest 7.2.2 + mongodb-memory-server 10.4.3 (replica-set mode) |
| Config file | `backend/package.json` jest block (lines 11–16): `testEnvironment: 'node'`, `testTimeout: 30000`, `testMatch: ['**/__tests__/**/*.test.js']` |
| Quick run command | `npx jest __tests__/listing-moderation/<file>.test.js` |
| Full suite command | `cd backend && npx jest __tests__/listing-moderation/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LADM-01 | Edit endpoint applies broad whitelist, computes fieldDiff, stamps lastEditedBy, writes audit row | integration | `npx jest __tests__/listing-moderation/editListing.test.js` | ❌ Wave 0 |
| LADM-02 | Suspend transitions active→suspended in single transaction (audit + Car update atomic) | integration | `npx jest __tests__/listing-moderation/suspendListing.test.js` | ❌ Wave 0 |
| LADM-03 | Archive transitions to archived with reason, semantically distinct from Suspend | integration | `npx jest __tests__/listing-moderation/archiveListing.test.js` | ❌ Wave 0 |
| LADM-04 | Delete-soft transitions to deleted with reason; Car doc still in DB after | integration | `npx jest __tests__/listing-moderation/deleteListing.test.js` | ❌ Wave 0 |
| LADM-05 | Restore flips any non-active to active; new audit row appended; original rows untouched | integration | `npx jest __tests__/listing-moderation/restoreListing.test.js` | ❌ Wave 0 |
| (cross-cutting) | Transaction rollback on simulated mid-flight failure | integration | `npx jest __tests__/listing-moderation/listingTransaction.atomicity.test.js` | ❌ Wave 0 |
| (cross-cutting) | denySelfModerationListing rejects self-mod, 404s missing car, calls next on non-self | unit | `npx jest __tests__/listing-moderation/denySelfModerationListing.test.js` | ❌ Wave 0 |
| (cross-cutting) | Zod schemas .strict, enums match Mongoose source-of-truth, required-ness per D-14/D-C | unit | `npx jest __tests__/listing-moderation/listingSchemas.test.js` | ❌ Wave 0 |
| (regression) | Phase 7 `/ping` rate-limit + middleware-chain test still green | integration | `npx jest __tests__/listing-moderation/listingModerationRateLimiter.test.js` | ✅ Phase 7 |
| (regression) | Phase 7 `Car.status-field` + `ListingModerationAction.append-only` + `listingCapabilities` + `requireAdmin.listing.middleware` + `migrate-listing-moderation` | various | `npx jest __tests__/listing-moderation/` | ✅ Phase 7 (5 files) |

### Sampling Rate

- **Per task commit:** `npx jest __tests__/listing-moderation/<changed-file>.test.js` (~1–3s)
- **Per wave merge:** `cd backend && npx jest __tests__/listing-moderation/` (full Phase 7+8 suite)
- **Phase gate:** Full suite green before `/gsd-verify-work` (33 Phase 7 tests must stay green; Phase 8 target ~50+ new tests across 8 files)

### Wave 0 Gaps

- [ ] `__tests__/listing-moderation/editListing.test.js` — covers LADM-01
- [ ] `__tests__/listing-moderation/suspendListing.test.js` — covers LADM-02 (txn atomicity primary case)
- [ ] `__tests__/listing-moderation/archiveListing.test.js` — covers LADM-03
- [ ] `__tests__/listing-moderation/deleteListing.test.js` — covers LADM-04 (assert Car still in DB after)
- [ ] `__tests__/listing-moderation/restoreListing.test.js` — covers LADM-05 (assert no audit-row edits)
- [ ] `__tests__/listing-moderation/listingTransaction.atomicity.test.js` — rollback evidence on simulated failures
- [ ] `__tests__/listing-moderation/denySelfModerationListing.test.js` — middleware unit
- [ ] `__tests__/listing-moderation/listingSchemas.test.js` — Zod .strict + enum derivation
- (No framework install needed — Phase 7 already wired jest + mongodb-memory-server + supertest + replica-set helper)

## Security Domain

> `security_enforcement` enabled (no explicit `false` override).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `verifyIdToken` (Firebase admin SDK) at server.js:854 — Phase 7 LSEC-01 — VERIFIED in mount chain |
| V3 Session Management | yes | Firebase idToken lifecycle (mobile-side refresh) — established v1.0 Plan 05-12; Phase 8 inherits |
| V4 Access Control | yes | `requireAdmin` (server-side AdminUser lookup) at server.js:854 — Phase 7 LSEC-02 — VERIFIED |
| V5 Input Validation | yes | Zod `.strict()` schemas in `src/moderation/listingSchemas.js` — Phase 8 ships this |
| V6 Cryptography | no | No new crypto — relies on Firebase + HTTPS (Railway). Hash-chain audit deferred per D-13 of Phase 7. |
| V11 Business Logic | yes | Self-mod prevention (`denySelfModerationListing`); transaction atomicity (`session.withTransaction()`); same-state idempotency (D-B-1) |
| V13 API & Web Service | yes | Per-route Zod parse; thin response payload (D-02 does NOT leak full Car doc); `KNOWN_LISTING_ERRORS` discriminates client-fixable 400s from internal 500s |

### Known Threat Patterns for Phase 8

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin self-moderates own listing (conflict of interest) | Elevation of Privilege | `denySelfModerationListing` middleware on ALL 5 routes (D-04) |
| Audit row leaks to disk without Car update succeeding (or vice versa) | Tampering / Repudiation | `session.withTransaction()` atomicity (D-06) + Phase 7 6 pre-hooks blocking any audit-row edit/delete |
| Unknown-field admin Edit bypasses whitelist | Tampering | Zod `.strict()` rejects unknown top-level keys → 400 `invalid_field` (D-A-1) |
| TOCTOU between same-state guard and transaction | Tampering | Same-state guard is a fast-path optimization; transaction read inside `withTransaction` is authoritative. v1.0 Phase 2 pattern. |
| Self-moderation attempt logged in audit log | Repudiation | D-05: self-mod attempts use `console.warn`, NOT audit. Audit log reserved for SUCCESSFUL state changes. |
| Admin Edit changes `sellerId` to hijack listing | Elevation of Privilege | D-A excludes `sellerId` from whitelist; Zod `.strict()` enforces. |
| Admin Edit changes `status` to bypass transition matrix | Elevation of Privilege | D-A excludes `status` + all moderation fields from whitelist. |
| Rate-limit bypass via IP rotation | Spoofing | Limiter keyed on `req.admin.uid`, not IP (Phase 7 D-04 + listingRateLimit.js:47–53 verified) |
| Image upload to wrong S3 path / bucket | Tampering | D-D-2 reuses existing `upload` instance — no new S3 client config |
| Audit row missing fields (sellerUid, adminEmail) | Repudiation | Schema-level `required: true` on `listingId`, `sellerUid`, `adminUid`, `adminEmail`, `action`, `fromStatus`, `toStatus`, `createdAt` (verified at ListingModerationAction.js:41–82) |

## Sources

### Primary (HIGH confidence)

- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/service.js` — v1.0 transaction pattern (lines 64–123 suspend, 161–207 unsuspend, 247–293 revokeRole, 322–408 deleteProviderProfile, 438–530 editProfile)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/router.js` — v1.0 router pattern (lines 47–53 mount + rate-limit; 59–84 KNOWN_USER_ERRORS + handleServiceError; 95–212 handlers; 220–260 history GET as Phase 5 add-on)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/schemas.js` — v1.0 Zod patterns (lines 11 reasonCategoryEnum 4-value; 19–33 dispatch discriminatedUnion; 36–38 unsuspend; 41–45 deleteProfile; 52–78 editProfile)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/denySelfModeration.js` — v1.0 middleware shape (lines 14–33: UID comparison via `req.params.targetUid` + `req.admin.uid`)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/Car.js` — Phase 7 substrate (lines 1–4 D-08 banner; 43 `listingStatus` enum; 46 `status` enum + index; 47–52 audit fields; 55 compound index; 63–95 seller-cascade pre(/^find/) hook — PRESERVED, do not touch)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/ListingModerationAction.js` — Phase 7 substrate (lines 41–82 11 fields; 86–91 3 indexes; 96–102 6 append-only pre-hooks; line 107 explicit collection name `listing_moderation_actions`)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/listingRouter.js` — Phase 7 scaffold (29 lines; only `express` require; only `/ping` route — preserve byte-identical)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/listingRateLimit.js` — Phase 7 rate limiter (lines 36–65 factory; `listing-admin:` prefix on all 3 key tiers)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/listingCapabilities.js` — Phase 7 capability map (NOT consumed by Phase 8 — for Phase 9 / 11 only)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js` — Mount chain (line 22–24 requires; line 52–64 multer `upload` definition; line 99–100 VehicleMake/VehicleModel inline; line 763–845 seller PUT handler with multer + S3 + makeId/modelId validation pattern; line 853–854 mounts)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/requireAdmin.js` — Sets `req.admin = { uid, role, email }` after AdminUser lookup
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/_helpers/mongoReplSet.js` — Replica-set test fixture for transactions (used by Phase 7 + v1.0 Phase 2)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/suspend.test.js` — Canonical test shape for service-layer integration tests
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/denySelfModeration.test.js` — Canonical middleware unit test pattern
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/editProfile.test.js` — Canonical fieldDiff test pattern (lines 50–79 broker single-field change)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/listing-moderation/listingModerationRateLimiter.test.js` — Phase 7 LSEC-03 test (`/ping` route is hit; modifying /ping breaks this test)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package.json` — All dependency versions verified
- `.planning/phases/07-listing-schema-security-baseline-backend/07-VERIFICATION.md` — Phase 7 GREEN status confirmed; 33/33 tests passing
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — Phase 7 decisions D-01..D-20
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-CONTEXT.md` — All locked decisions D-01..D-18 + D-A/B/C/D

### Secondary (MEDIUM confidence)

- Mongoose Sessions + Transactions: https://mongoosejs.com/docs/transactions.html — cited from CONTEXT.md canonical references; transaction array-form gotcha verified against v1.0 service.js comment
- Zod v3 `.strict()`: https://zod.dev/?id=strict — cited from CONTEXT.md canonical references; pattern in use across v1.0 schemas.js

### Tertiary (LOW confidence)

- None. All architectural claims verified against actual source code in this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified from `backend/package.json` 
- Architecture: HIGH — every code shape verified by Read on actual backend repo
- Pitfalls: HIGH — Pitfall 1 (multer extraction) is the most material discovery; verified server.js:52–64 has no export
- Patterns: HIGH — every example traces to a Read'd file with line numbers
- Test strategy: HIGH — file paths + framework versions + helper fixture all verified

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (30 days — backend stack is stable; Phase 7 substrate is locked; Phase 8 plans should consume this before then)

---

## RESEARCH COMPLETE

Phase 8 research is complete. Five gray-area decisions in CONTEXT.md (D-A/B/C/D + D-12) are LOCKED and verified against backend source. The one material discovery is Pitfall 1: the multer `upload` instance lives as a module-local const in `server.js:52–64` with no export — Phase 8 will need to extract it to `src/uploads/carImages.js` (recommended) or refactor `listingRouter.js` to a factory (would break the Phase 7 import in `listingModerationRateLimiter.test.js`). The v1.0 transaction pattern, KNOWN_USER_ERRORS shape, denySelfModeration middleware shape, and `mongodb-memory-server` replica-set test fixture all verified line-by-line. Phase 7 substrate (Car.status enum, ListingModerationAction field set, listingRouter `/ping` scaffold) is GREEN — runtime confirmed `Car.schema.path('status').enumValues = ['active','suspended','archived','deleted']` and `Car.schema.path('moderationReason').enumValues = ['spam','policy_violation','fraud','inactive_seller','other']`. Planner can proceed with 6-plan structure (substrate + Suspend + Archive + Delete + Restore + Edit, with denySelfModerationListing + atomicity test folded into substrate).
