# Phase 8: Admin Listing Moderation Endpoints (Backend) - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the five admin-only HTTP handlers for listing moderation atop the Phase 7 substrate. Each handler mounts on `listingRouter.js` (already mounted in `server.js` under `/api/admin/moderation/listings` behind `verifyIdToken → requireAdmin → listingModerationRateLimiter`), opens a Mongoose session, inserts one `ListingModerationAction` audit row, mutates `Car` (status field + Edit field set), and commits atomically.

**Covers:** LADM-01 (Edit), LADM-02 (Suspend), LADM-03 (Archive), LADM-04 (Soft-Delete), LADM-05 (Restore).

**Does NOT cover this phase:**
- Public read-time `pre(/^find/)` hide hook on `Car` filtering by `status !== 'active'` (Phase 9, LENF-01).
- Status-aware listing-detail GET (thin payload for non-admin viewers of non-active listings) (Phase 9, LENF-02).
- Cart `add` + checkout `confirm-booking` TOCTOU re-verification + refund-first-throw-second semantics on mid-checkout status change (Phase 9, LENF-03).
- Admin history GET (`GET /api/admin/moderation/listings/:carId/history` or per-admin / per-seller variants) — Phase 10 admin-history surface will own when/if it lands (REQUIREMENTS doesn't include a Phase 10 admin-history req; ride on existing v1.0 pattern if surfaced).
- Any mobile work, mobile-side error shape changes (Phase 10).

**Scope boundary:** Backend only — work lives in `../backend-services/carEx-services/`. No changes to the `carEx` mobile repo in Phase 8.

</domain>

<decisions>
## Implementation Decisions

The user delegated technical structure to Claude (consistent with Phase 7 D-01..D-20). Decisions below are grounded in (a) v1.0 Phase 2 precedent — this phase is the listing-domain mirror, (b) the Phase 7 substrate that ALREADY shipped, and (c) four user-decided gray areas captured below as D-A, D-B, D-C, D-D.

### Endpoint Surface (pinned by ROADMAP + REQUIREMENTS — no bikeshedding)

- **D-01:** Five endpoints, exactly as REQUIREMENTS.md LADM-01..05 names them:
  - `PATCH /api/admin/moderation/listings/:carId` — Admin Edit (LADM-01). Body: `multipart/form-data` (see D-D for image handling). Field set per D-A. Writes `fieldDiff` audit row.
  - `PATCH /api/admin/moderation/listings/:carId/suspend` — Body: `{ reasonCategory, note?: string }`. Status transition per D-B legal-transition matrix.
  - `PATCH /api/admin/moderation/listings/:carId/archive` — Body: `{ reasonCategory, note?: string }`. Status transition per D-B.
  - `PATCH /api/admin/moderation/listings/:carId/delete` — Body: `{ reasonCategory, note?: string }`. Status transition per D-B. Document NOT removed from DB.
  - `PATCH /api/admin/moderation/listings/:carId/restore` — Body: `{ note?: string }` (D-C). Status → `'active'`; new audit row appended (never edits prior rows).
- **D-02:** Success response shape: `{ ok: true, listing: { _id, status, moderatedBy, moderatedAt, lastEditedBy?, lastEditedAt? }, action: { _id, action, fromStatus, toStatus, createdAt } }`. Mirrors v1.0 D-02 — gives the admin UI enough to reconcile the row without a follow-up fetch.
- **D-03:** Error envelopes follow Phase 7 D-06: `{ error: <code>, message?: <human-readable> }`. New `error` codes registered in `KNOWN_USER_ERRORS`:
  - `listing_not_found` (404 from `Car.findById`)
  - `invalid_transition` (400 — illegal source→target per D-B)
  - `already_in_state` (400 — same-state no-op per D-B)
  - `not_moderated` (400 — Restore on already-active listing)
  - `invalid_field` (400 — unknown field in Edit body; mirrors v1.0 D-05)
  - `no_changes` (400 — Edit body produced empty fieldDiff; mirrors v1.0 D-06)
  - `invalid_payload` (400 — Zod parse failure)

### Admin Edit Field Scope (D-A — USER-DECIDED)

- **D-A:** **Broad whitelist — admin can Edit any field the seller can edit via `PUT /api/cars/:id`** (server.js:763). The admin Edit handler MUST mirror the seller PUT field set exactly, with the following explicit exclusions:
  - **NOT admin-editable (system fields):** `_id`, `sellerId`, `listingId`, `createdAt`, `updatedAt`, `listingStatus`, `status`, `moderationReason`, `moderationNote`, `moderatedBy`, `moderatedAt`, `lastEditedBy`, `lastEditedAt`, `__v`.
  - **Admin-editable (seller-parity):** all other Car schema fields — `makeId`, `modelId`, `trimLevel`, `wheelbase`, `year`, `price`, `mileage`, `fuel`, `currency`, `description`, `bodyType`, `engine`, `transmission`, `drivetrain`, `mpg`, `condition`, `knownIssues`, `exteriorColor`, `interiorColor`, `interiorMaterial`, `seats`, `doors`, `phoneNumber`, `telegramUsername`, `imageUrls` (per D-D for upload mechanics).
  - **Rationale (user):** admin needs full power to fully repair a broken/abandoned/abusive listing without seller cooperation. Narrow-whitelist precedent from v1.0 user-mod doesn't apply here — listings are user-generated content, not user-identity.
  - **`makeId`/`modelId` validation:** if admin changes either, run the same `VehicleMake.findOne` / `VehicleModel.findOne` lookup the seller PUT does (server.js:787–796) and reject 400 `invalid_make` / `invalid_model` on bad refs. `makeName`/`modelName` are re-resolved from the new IDs (denormalized) — admin cannot send them directly.
- **D-A-1:** **Zod schema for Edit:** `editListingSchema` in `src/moderation/listingSchemas.js`, `.strict()` mode so unknown top-level keys reject → 400 `invalid_field` with the unknown field names. Mirrors v1.0 D-05 / D-34. Per-field validators mirror the seller PUT's permissive validation (e.g., `price: z.coerce.number().int().nonnegative().optional()`) — the seller PUT does little server-side validation, so admin Edit doesn't introduce a stricter contract than the seller already operates under.
- **D-A-2:** **fieldDiff shape:** per-field `{ before, after }`, changed-only. Mirrors v1.0 D-04 verbatim. Submitted-but-unchanged fields are filtered out *after* whitelist validation, *before* opening the transaction. Empty diff → 400 `no_changes`.
  ```js
  fieldDiff: {
    price: { before: 12000, after: 11500 },
    description: { before: 'old text', after: 'new text' },
    imageUrls: { before: ['s3://...a', 's3://...b'], after: ['s3://...b', 's3://...c'] },
  }
  ```
  Image diff captures URL arrays only (S3 URLs as strings); the underlying file bytes are not diffed.
- **D-A-3:** **`Car.lastEditedBy` + `Car.lastEditedAt` stamped on every Edit** (LADM-01). `moderatedBy`/`moderatedAt` are NOT touched by Edit — Edit is content-correction, not a state transition. Distinction preserved: `moderatedBy` reflects the last `status` change; `lastEditedBy` reflects the last admin content edit. Both fields land via Phase 7 D-07 schema.
- **D-A-4:** Edit can be applied to a listing in ANY `status` (active, suspended, archived, deleted) — admin may correct content on a moderated listing without restoring it first. Audit row's `fromStatus` and `toStatus` are identical (= current status) since Edit does not transition state; the row's discriminator is `action: 'edit'` + populated `fieldDiff`.

### Transition Matrix (D-B — USER-DECIDED)

- **D-B:** **Open matrix.** From any `Car.status` state, the admin can move directly to any *different* non-active state or back to `active` via the corresponding action handler. Same-state action is rejected as a no-op.
  ```
  Legal transitions (rows = fromStatus, cols = action):
                  Suspend     Archive     Delete      Restore     Edit
    active        →suspended  →archived   →deleted    400         (no state change)
                                                      not_moderated
    suspended     400         →archived   →deleted    →active     (no state change)
                  already_in_state
    archived      →suspended  400         →deleted    →active     (no state change)
                              already_in_state
    deleted       →suspended  →archived   400         →active     (no state change)
                                          already_in_state
  ```
  Each transition writes one audit row. Restore is the only path back to `active`. **Rationale (user):** real moderation often escalates (`suspended → deleted` after confirmed-spam review) or reclassifies (`suspended → archived` once admin realizes it's an inactive seller, not a violation). Forcing Restore-then-redo doubles audit rows and confuses the seller-history timeline.
- **D-B-1:** **Same-state guard fires fast-path BEFORE the transaction opens.** Pattern:
  ```js
  const current = await Car.findById(req.params.carId).setOptions({ includeAllListingStatuses: true });
  if (!current) throw new ServiceError('listing_not_found');
  if (current.status === target) throw new ServiceError('already_in_state');
  // ...open session, withTransaction:
  ```
  Saves the transaction cost on no-op requests + matches v1.0 D-20 idempotency discipline.
- **D-B-2:** **No "invalid_transition" code is actually emitted in v1.1 scope.** The matrix is fully open except for same-state no-ops; D-03's registration of `invalid_transition` is forward-compatibility for a future restricted matrix (e.g., v2 super-admin tier may enforce forward-only escalation). Today, every per-action handler only needs to check same-state; the cross-action restrictions don't exist.
- **D-B-3:** **`includeAllListingStatuses: true`** bypass option name pre-locked here so Phase 9's hide-hook implementation has the same opt-out token the admin handlers use. Phase 7 didn't land the hook itself, but `Car.findById(...).setOptions({ includeAllListingStatuses: true })` is the canonical admin-read incantation for Phase 8 and onward.

### Restore Reason Policy (D-C — USER-DECIDED)

- **D-C:** **Restore body: `{ note?: string }` only — no `reasonCategory`.** Mirrors v1.0 unsuspend (Phase 2 D-21). The audit row's `reasonCategory` is `null` for Restore actions; `reasonNote` captures admin's free-text explanation if provided.
  - **Rationale (user):** the 5-value reason taxonomy (`spam`/`policy_violation`/`fraud`/`inactive_seller`/`other`) is for *why this listing should be moderated*. Restore is the inverse — *why this listing should NOT be moderated anymore* — and the taxonomy has no semantic fit. Lower friction is right; the adminUid + fromStatus + timestamp in the audit row already answer "who restored what, when."
  - **Zod schema:** `restoreListingSchema = z.object({ note: z.string().max(2000).optional() }).strict();`
- **D-C-1:** **`Car.moderationReason` and `Car.moderationNote` are CLEARED on Restore** (set to `null`) inside the transaction. Rationale: those fields describe the *current* moderation state; once the listing is `active`, they should not show stale "suspended-for-spam" copy on the listing-detail screen. The audit row preserves the historical reason; the live Car doc reflects only the current state. Matches v1.0 D-21 unsuspend semantics for `User.moderationStatus.reasonCategory`.
- **D-C-2:** **`Car.moderatedBy` and `Car.moderatedAt` ARE updated on Restore** to point at the admin who restored + the restore timestamp. The audit-row chain is the source of truth for "who suspended this last"; the live Car doc reflects only "who last changed status." Same pattern as v1.0 user-mod.

### Image Handling in Edit (D-D — USER-DECIDED)

- **D-D:** **Full parity with seller PUT — `multer` multipart + S3 upload + reorder/remove.** Admin Edit accepts `multipart/form-data` exactly like the seller PUT (server.js:763): a JSON-stringified `existingImageUrls` array (for reorder/remove of already-uploaded S3 URLs) plus binary file uploads via the existing `upload.array('images', 25)` multer middleware. New uploads land in the same S3 bucket as seller uploads; `req.files.map(f => f.location)` gives the new URLs which append to the kept-existing array (server.js:784–785 pattern).
  - **Rationale (user):** admin needs full repair power. Lighter alternatives (URL-array-only, or blocking images) would force admin to ask the seller, which defeats the "admin can fix bad-actor content" purpose.
- **D-D-1:** **Multer middleware mounted PER-ROUTE on the Edit endpoint only.** The four state-transition routes (Suspend/Archive/Delete/Restore) stay JSON-only — they don't accept multipart. Pattern:
  ```js
  router.patch('/:carId', upload.array('images', 25), denySelfModerationListing, async (req, res) => { ... });
  router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => { ... });
  ```
- **D-D-2:** **S3 client + bucket config: reuse the existing seller-PUT path.** No new S3 credentials, no new bucket, no new prefix. The multer-S3 instance already configured for the seller PUT serves the admin Edit unchanged.
- **D-D-3:** **`imageUrls` field-diff:** captured as before/after URL string arrays (per D-A-2 example). The diff does NOT include image bytes, mime types, or sizes — those are S3 concerns. Reviewers reading the audit log can fetch any historical URL from S3 if needed; the diff tells them WHICH URLs changed.
- **D-D-4:** **Orphaned S3 objects on image removal:** an admin Edit that removes images leaves the old S3 objects in the bucket (mirroring the seller PUT behavior — server.js:763–822 does NOT delete S3 objects when `existingImageUrls` drops a URL). S3 cleanup is a known existing-system property, not Phase 8's concern. Tracked under deferred items for a future S3-lifecycle / orphan-sweep job.

### Self-Moderation on Listings — Claude's Discretion

- **D-04:** **`denySelfModerationListing` middleware** — listing-specific variant of v1.0 `denySelfModeration`. Reads `req.params.carId` → `Car.findById(carId).setOptions({ includeAllListingStatuses: true }).select('sellerId')` → if `car.sellerId === req.admin.uid`, returns 400 `{ error: 'cannot_moderate_own_listing' }`. Rationale: admin moderating their own listing is a conflict-of-interest red flag — same threat model as v1.0 self-moderation, scoped to the listing's owner instead of the target user.
  - File: `src/moderation/denySelfModerationListing.js` (sibling to v1.0 `denySelfModeration.js`).
  - Applied to all 5 listing-moderation routes uniformly (Edit + 4 transitions). For Restore, the check still fires — admin shouldn't be able to restore their own listing after another admin moderated it (same conflict-of-interest).
  - **Edge case:** car not found at this middleware layer → return 404 `listing_not_found` (do not leak existence by always returning `cannot_moderate_own_listing`).
- **D-05:** Attempted self-moderation is **logged but NOT audited** (`console.warn` with adminUid + carId + sellerId + timestamp). Mirrors v1.0 D-29 — `ListingModerationAction` reflects successful state changes; rejected attempts dilute audit value.

### Transaction Strategy — Claude's Discretion

- **D-06:** **Use `session.withTransaction()`** for every mutating handler (Edit + Suspend + Archive + Delete + Restore). Mirrors v1.0 D-23/D-24. Pattern:
  ```js
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. read current Car with { session, includeAllListingStatuses: true }
      // 2. insert ListingModerationAction with { session }
      // 3. update Car fields + status + audit-stamp fields with { session }
    });
  } finally {
    session.endSession();
  }
  ```
  Audit-row insert MUST come before the Car update so the audit row's `_id` is available for any future back-link field (Phase 8 does not add `Car.lastActionId` since the per-listing history query is satisfied by the indexed `ListingModerationAction.{ listingId, createdAt: -1 }` Phase 7 D-10 index — no Phase 8 back-link needed; deferred under "tracked").
- **D-07:** **Mongoose transactions REQUIRE replica set.** v1.0 D-25 already confirmed Atlas tier (M10+ replica set). No re-verification needed — the project shipped v1.0 with transactions on this same cluster. `mongodb-memory-server` replica-set mode handles the test side (v1.0 D-39 / Phase 7 D-19).
- **D-08:** **Two-step audit-then-Car-update inside the transaction** rather than relying on bulk-write. Rationale: the Edit handler needs the `fieldDiff` computed from the *current* Car doc (read inside the transaction for atomicity) before writing the new fields; bulk-write doesn't help and adds complexity. Suspend/Archive/Delete/Restore are simpler but use the same pattern for consistency.

### Validation Schemas — Claude's Discretion

- **D-09:** **New file `src/moderation/listingSchemas.js`** (sibling to v1.0 `schemas.js`). Exports:
  - `suspendListingSchema` — `{ reasonCategory, note? }`, `.strict()`
  - `archiveListingSchema` — `{ reasonCategory, note? }`, `.strict()`
  - `deleteListingSchema` — `{ reasonCategory, note? }`, `.strict()`
  - `restoreListingSchema` — `{ note? }`, `.strict()` (per D-C)
  - `editListingSchema` — broad whitelist per D-A, `.strict()`
  - `reasonCategoryEnum` — `z.enum(['spam','policy_violation','fraud','inactive_seller','other'])` — 5-value listing taxonomy (Phase 7 D-14a). Distinct from v1.0 `schemas.js`'s 4-value enum.
- **D-10:** **Enum imports:** the Zod enums in `listingSchemas.js` MUST be derived from `Car.schema.path('status').enumValues` and the `LISTING_STATUS_POLICY` keys (Phase 7 D-14 capability map) where applicable, so Zod values cannot drift from Mongoose values. Pattern: `const reasonCategoryEnum = z.enum(REASON_CATEGORIES);` where `REASON_CATEGORIES` is a module-scope constant re-exported from `listingSchemas.js` for downstream test reuse.

### Service Module Structure — Claude's Discretion

- **D-11:** **New file `src/moderation/listingService.js`** (sibling to v1.0 `service.js`). Exports five async functions, one per handler: `editListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`. Each accepts `{ adminUid, adminEmail, carId, ...payload }` and returns `{ listing, action }` (the shape D-02 surfaces in the response).
- **D-12:** **Service-layer error class:** `class ListingServiceError extends Error { constructor(code) { super(code); this.code = code; } }`. Handlers throw `new ListingServiceError('already_in_state')` etc.; router maps `err.code` against `KNOWN_USER_ERRORS` (mirroring v1.0 router.js's `handleServiceError` pattern). Unknown errors → 500 `internal_error`.
- **D-13:** **`listingRouter.js` gains 5 new route blocks + retains the `/ping` scaffold from Phase 7.** No teardown of the `/ping` route — its rate-limit + middleware-chain test (Phase 7 `listingModerationRateLimiter.test.js` Test 1) continues passing as a regression check. Add `const { handleListingServiceError } = require('./...')` + `const service = require('./listingService')` + `const denySelfModerationListing = require('./denySelfModerationListing')` + `const schemas = require('./listingSchemas')` at top-of-file. The 4 explicit requires + 1 `express` = 5 total `require` calls (Phase 7's dependency-free property is broken here intentionally — D-01 said Phase 8 ships the handlers).

### Reason Category Required-ness — Claude's Discretion

- **D-14:** **`reasonCategory` is REQUIRED on Suspend / Archive / Delete; `note` is optional.** Pulled from REQUIREMENTS.md LADM-02/03/04 wording ("with a reason category + optional note"). Restore differs per D-C. Edit takes no reason category. Schema enforcement in `listingSchemas.js` (D-09): `reasonCategory: reasonCategoryEnum` (not `.optional()`).
- **D-15:** **`Car.moderationReason` and `Car.moderationNote` are STAMPED on every non-Edit, non-Restore handler** (Suspend/Archive/Delete) inside the transaction. The audit row preserves the historical reason; the live Car doc reflects only the current-state reason. Mirrors D-C-1's clear-on-Restore symmetry.

### Testing — Claude's Discretion

- **D-16:** **Tests live under `__tests__/listing-moderation/`** (the directory Phase 7 established). Phase 8 adds:
  - `editListing.test.js` — happy paths per field group (text-only edit, image-add, image-remove, image-reorder, mixed); narrow + broad cases; unknown-field → 400 `invalid_field`; empty-diff → 400 `no_changes`; works on suspended/archived/deleted listings (D-A-4); fieldDiff shape matches D-A-2.
  - `suspendListing.test.js` — happy path active→suspended (User → Car + audit appended in one transaction); transition active→suspended writes correct fromStatus/toStatus; same-state suspended→suspended → 400 `already_in_state`; cross-state archived→suspended OK (D-B); reason category required; self-moderation rejected (D-04).
  - `archiveListing.test.js` — happy path active→archived; cross-state suspended→archived OK; self-moderation rejected.
  - `deleteListing.test.js` — happy path active→deleted; cross-state archived→deleted OK; doc NOT removed from DB (`Car.countDocuments({ _id: carId })` still 1 after); self-moderation rejected.
  - `restoreListing.test.js` — happy paths from suspended/archived/deleted → active; not_moderated on already-active (D-03); `Car.moderationReason` cleared (D-C-1); audit row reasonCategory = null (D-C); self-moderation rejected (admin can't restore their own listing).
  - `listingTransaction.atomicity.test.js` — simulate mid-flight failure (e.g., stub `ListingModerationAction.create` to throw) → assert `Car.status` did NOT update; simulate Car update failure → assert audit row was NOT persisted. Mirrors v1.0 D-39's transaction-rollback test pattern.
  - `denySelfModerationListing.test.js` — middleware unit test: admin === sellerId → 400 `cannot_moderate_own_listing`; admin !== sellerId → next() called; car not found → 404 `listing_not_found`.
  - `listingSchemas.test.js` — Zod schemas: `.strict()` rejects unknown keys; enum values match Mongoose source-of-truth; required vs optional matches D-14 / D-C.
- **D-17:** **Tests do NOT boot `server.js`** — each builds its own minimal Express app or calls `listingService` directly. Same isolation as v1.0 D-36 / Phase 7 D-20.
- **D-18:** **`mongodb-memory-server` replica-set mode is already a devDep** (Phase 7 D-19 confirmed). No new test infra. Firebase verify mocking pattern is locked by v1.0 D-39 — Phase 8 reuses it for the few tests that exercise the full middleware chain (most service tests skip the chain and call the service directly).

### Claude's Discretion (planner/executor may choose without re-asking)

- Exact ordering of plans within Phase 8 — `gsd-planner` decides; v1.0 Phase 2's 6-plan shape (1 plan per endpoint + 1 plan for service+schemas substrate + 1 plan for self-mod + tests) is the precedent. Phase 8 likely lands in 6 plans (substrate + 5 endpoint plans + tests rolled in per-endpoint) but planner has full discretion.
- Whether `listingService.js` is a class or a module with five named exports (v1.0 service.js uses named-function exports — Phase 8 follows the same pattern unless planner sees a reason to depart).
- Whether `editListing` service computes `fieldDiff` inline or via a separate `diffCarFields(before, after)` helper. Default: inline for the first pass; extract to helper if `editListing.test.js` reveals duplication with other handlers (none expected — only Edit has fieldDiff).
- The exact format of the multer-S3 instance reuse (import from a shared module, or local require). Match how the seller PUT handles it.
- Whether to add a `Car.lastActionId` field for back-link convenience (deferred per D-06 unless planner sees a query-pattern reason — Phase 9 or Phase 10 may surface one).
- Whether `denySelfModerationListing` short-circuits the `Car.findById` to avoid double-fetching when the handler will fetch the same doc inside the transaction. Default: middleware fetches with `.select('sellerId')` only (cheap projection); the handler's transactional read is separate and authoritative. Optimization optional.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone v1.1 core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 8 REQ-IDs: LADM-01, LADM-02, LADM-03, LADM-04, LADM-05
- `.planning/ROADMAP.md` §"Phase 8: Admin Listing Moderation Endpoints (Backend)" — Goal + 4 success criteria
- `.planning/notes/listing-moderation-design.md` — Design-decided source for the four-action model, audit-trail topology, endpoint shape, buyer pause-not-cancel semantics

### Phase 7 substrate (LOCKED — Phase 8 sits atop this)
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — Phase 7 decisions D-01..D-20 all apply. Most load-bearing: D-04 (separate rate-limit bucket), D-07 (Car moderation field set), D-08 (naming-collision lock), D-09 (sibling audit collection rationale), D-10 (audit row schema), D-11 (append-only enforcement), D-14 (LISTING_STATUS_POLICY), D-14a (5-value reason taxonomy)
- `.planning/phases/07-listing-schema-security-baseline-backend/07-VERIFICATION.md` — 33/33 tests passing; the substrate Phase 8 builds on is green
- `.planning/phases/07-listing-schema-security-baseline-backend/07-PATTERNS.md` — Patterns Phase 7 established that Phase 8 must honor

### v1.0 Phase 2 precedent (Phase 8 is the listing-domain mirror)
- `.planning/phases/02-admin-moderation-endpoints-backend/02-CONTEXT.md` — Direct mirror. D-23 (transaction strategy), D-24 (transaction boundary), D-26 (self-moderation middleware), D-29 (rejected-attempts NOT audited), D-34/D-35 (Zod schemas in dedicated file with `.strict()`), D-36 (handler pattern), D-04 (per-field changed-only fieldDiff), D-05 (unknown-field 400), D-06 (no-op 400) all apply to Phase 8 with listing-domain renaming
- `.planning/phases/02-admin-moderation-endpoints-backend/02-VERIFICATION.md` — Acceptance shapes Phase 8 must hit
- `.planning/phases/03-backend-enforcement-backend/03-CONTEXT.md` §"Read-time hide hooks" — Phase 9 will follow this template; Phase 8 must not pre-empt the `Car.pre(/^find/)` listing-status filter

### Backend codebase (existing — MUST read before editing)
- `../backend-services/carEx-services/src/models/Car.js` — Already extended in Phase 7 (banner lines 1–4; `status` + audit fields lines 46–52; compound index line 55; existing `listingStatus` lifecycle field line 43 MUST NOT be confused with new `status` per D-08). Phase 8 does NOT mutate Car schema; only consumes the fields. Existing seller-cascade `pre(/^find/)` hook (lines 63–95) MUST NOT be modified — Phase 9 owns the listing-status hide hook.
- `../backend-services/carEx-services/src/models/ListingModerationAction.js` — Phase 7 sibling audit collection. Phase 8 writes rows via `ListingModerationAction.create([doc], { session })` inside `withTransaction`. 6 append-only pre-hooks (D-11) catch any handler bug that attempts to update/delete an existing row.
- `../backend-services/carEx-services/src/moderation/listingRouter.js` — Phase 7 scaffold with only `/ping` route. Phase 8 adds 5 new `router.patch(...)` blocks + 4 new requires. `/ping` route is PRESERVED for regression coverage.
- `../backend-services/carEx-services/src/moderation/listingRateLimit.js` — Phase 7 separate bucket with `listing-admin:` keyGenerator prefix (D-04). Already mounted at app level via server.js:854 — Phase 8 does NOT re-mount.
- `../backend-services/carEx-services/src/moderation/listingCapabilities.js` — Phase 7 `LISTING_STATUS_POLICY`. Phase 8 does NOT consume this (it's for Phase 9 read-time enforcement + Phase 11 banner copy); Phase 8 enums come from `Car.schema.path('status').enumValues` directly.
- `../backend-services/carEx-services/src/moderation/router.js` — v1.0 user-mod router (read for `handleServiceError` + `KNOWN_USER_ERRORS` + dispatch pattern; Phase 8 ships a SEPARATE listing router and does NOT modify this file).
- `../backend-services/carEx-services/src/moderation/service.js` — v1.0 user-mod service (read for `session.withTransaction()` pattern + audit-then-User-update sequencing; Phase 8 ships a SEPARATE `listingService.js`).
- `../backend-services/carEx-services/src/moderation/schemas.js` — v1.0 Zod schemas (read for `.strict()` + discriminatedUnion + reason/severity enum patterns; Phase 8 ships a SEPARATE `listingSchemas.js`).
- `../backend-services/carEx-services/src/moderation/denySelfModeration.js` — v1.0 user-mod self-mod middleware (read for shape; Phase 8 ships a SEPARATE `denySelfModerationListing.js` that fetches the Car instead of comparing UIDs directly).
- `../backend-services/carEx-services/server.js` — Phase 8 does NOT add new top-level routes — the listing-router mount line at server.js:854 already covers all 5 new endpoints. **Lines 763–822** are the seller `PUT /api/cars/:id` handler — Phase 8's Edit handler imports the same `multer` `upload` instance for image parity (D-D). **Lines 787–796** are the `VehicleMake.findOne` / `VehicleModel.findOne` lookup pattern Phase 8 mirrors for `makeId`/`modelId` validation (D-A).

### External references (planner/researcher lookups, if needed)
- Mongoose Sessions + Transactions: https://mongoosejs.com/docs/transactions.html
- Mongoose Schema Middleware: https://mongoosejs.com/docs/middleware.html
- Zod v3 — `.strict()` + `discriminatedUnion`: https://zod.dev/?id=strict
- Project memory: `[[backend_repo_location]]` — backend repo is at `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (sibling of `carEx`)
- Project memory: `[[backend_deploy_gotcha]]` — Railway deploys backend `main` only; "works local, fails prod" → check backend `main` vs feature branch FIRST

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already in backend, do NOT re-create)
- **`verifyIdToken` + `requireAdmin` middleware** + **`listingModerationRateLimiter`** — already in the mount chain at server.js:854. Phase 8 endpoint handlers run AFTER this chain unchanged.
- **`mongoose.startSession()` + `session.withTransaction()`** pattern — v1.0 `src/moderation/service.js` has the canonical implementation (suspend handler ~lines 50–120). Phase 8 mirrors verbatim, renamed for the listing domain.
- **`ListingModerationAction.create([doc], { session })`** — already-locked Phase 7 audit-write path. Append-only pre-hooks protect against any handler bug that tries to mutate.
- **`multer` `upload.array('images', 25)` middleware + S3 destination** — already configured for the seller `PUT /api/cars/:id`. Phase 8's Edit handler imports the same instance per D-D / D-D-2.
- **`Car.findById(id).setOptions({ includeAllListingStatuses: true })`** — Phase 8 reads always set this option so the Phase 9 hide hook (when it lands) doesn't hide moderated listings from admin handlers.
- **`KNOWN_USER_ERRORS` Set + `handleServiceError` pattern** — v1.0 `src/moderation/router.js` lines ~50–80. Phase 8 ships a parallel `handleListingServiceError` (D-12) with the listing-specific error code set (D-03).
- **`ListingServiceError` class** — D-12 new helper; small file or inline at top of `listingService.js`.
- **`VehicleMake.findOne` / `VehicleModel.findOne` validation** — server.js:787–796 in seller PUT. Phase 8 Edit reuses the same lookup + reject pattern when admin changes `makeId`/`modelId` (D-A).
- **jest + supertest + mongodb-memory-server (replica-set mode)** — Phase 7 D-19/D-20 confirmed in place. Phase 8 adds tests, not infra.

### Established Patterns (must honor)
- **All mutating moderation handlers run inside `session.withTransaction()`** — v1.0 D-23/D-24. Audit row insert THEN target-document update, both with `{ session }`. If anything throws, the whole transaction rolls back.
- **Audit row write goes through `Model.create([doc], { session })`** (array form) — Mongoose requires array form to accept options; single-doc form bypasses `{ session }`. v1.0 `service.js` documents this gotcha at top-of-file.
- **`KNOWN_USER_ERRORS` Set discriminates client-fixable 400s from internal 500s** — handler throws a stable `code` string; router translates known codes to 400 with no message-leak. Unknown errors log + 500 `internal_error`.
- **Zod schemas use `.strict()` mode** — unknown top-level keys reject at parse time → 400 `invalid_payload` with issues array, or 400 `invalid_field` for Edit's field-level whitelist (D-A-1 / v1.0 D-05).
- **Self-moderation guards are dedicated middleware** — v1.0 D-26 pattern; Phase 8 mirrors with the listing-specific variant D-04.
- **Rejected-attempt logging uses `console.warn`, NOT `ListingModerationAction`** — D-05 / v1.0 D-29.
- **Per-field `{ before, after }` changed-only diff shape** — v1.0 D-04 for `fieldDiff`. Phase 8 D-A-2 mirrors verbatim.
- **`mongoose.model('Name', schema, 'collection_name')` explicit collection naming** — Phase 7 D-10. Phase 8 adds no new models.
- **Tests do NOT boot `server.js`** — minimal Express apps or direct service calls. v1.0 D-36 / Phase 7 D-20. Phase 8 D-17.

### Integration Points
- **`server.js:854`** — `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter)` already covers all 5 new routes. Phase 8 adds NO new mount lines.
- **`listingRouter.js`** — 5 new `router.patch(...)` blocks added; `/ping` route preserved.
- **`listingService.js`** — NEW file; 5 exported async functions, one per handler.
- **`listingSchemas.js`** — NEW file; 5 Zod schemas + reason enum re-export.
- **`denySelfModerationListing.js`** — NEW file; one middleware function.
- **`Car.js` + `ListingModerationAction.js`** — CONSUMED unchanged from Phase 7. No schema mutations in Phase 8.
- **Multer `upload` instance** — IMPORTED from wherever the seller PUT imports it (likely top of `server.js`); planner confirms the actual export location during research and either re-exports or imports directly.

### Anti-Pattern Warnings
- **Do NOT bypass the transaction.** Every state-mutating handler MUST run inside `session.withTransaction()` per ROADMAP success criterion #1 ("each transitioning the `status` field and writing an append-only audit row atomically"). A non-transactional write that succeeds on Car but fails on audit row (or vice versa) is the exact failure mode the substrate is designed to prevent.
- **Do NOT bypass `denySelfModerationListing`.** The middleware is the only enforcement of "admin can't moderate their own listing" — the schema permits it because schemas don't know about admins. Skipping the middleware means a self-conflicted moderation can land cleanly.
- **Do NOT mutate `Car.listingStatus` (lifecycle field) anywhere in Phase 8.** Phase 7 D-08 / D-07 / `Car.js:1–4` banner. Moderation lives on `Car.status`. Touching `listingStatus` from an admin moderation handler is an immediate code-review red flag.
- **Do NOT extend the existing `ModerationAction` collection.** Phase 7 D-09 already rejected this; Phase 8 must not silently re-introduce it (e.g., by aliasing `ListingModerationAction = ModerationAction` for "convenience"). Use the sibling collection per Phase 7.
- **Do NOT add Phase 9's hide hook to `Car.js` from Phase 8.** Phase 8 only ADDS endpoint handlers; the `pre(/^find/)` hook that filters non-active listings out of public reads is Phase 9's job (LENF-01). Phase 8 reads always pass `.setOptions({ includeAllListingStatuses: true })` so they're already future-proof.
- **Do NOT validate fields more strictly than the seller PUT.** D-A-1: admin Edit's Zod schema mirrors the seller PUT's permissive validation. Tightening rules in admin Edit creates an asymmetry — a field the seller can submit becomes a field admin cannot fix.
- **Do NOT introduce a new S3 bucket or upload path for admin Edit.** D-D-2: reuse the seller PUT's `multer-S3` instance unchanged. A second bucket creates split-brain image-URL state.
- **Do NOT auto-cancel or auto-refund orders touching a deleted/suspended/archived listing.** This is the v1.1 anti-pattern documented in REQUIREMENTS Out of Scope (mirrors v1.0). Phase 8 only mutates Car + audit row; orders are Phase 9/Phase 11 territory.
- **Do NOT add new error codes outside `KNOWN_USER_ERRORS`.** Phase 8 registers the 7 codes in D-03; any handler throwing a new code without registering it surfaces as 500. Update D-03's set in lockstep with any new error path.
- **Do NOT respond to Edit with the full updated Car document.** D-02 success shape returns a thin Car projection — mirror the v1.0 user-mod response shape. Full Car payload bloats responses and risks leaking moderation fields to mobile clients that don't expect them.

</code_context>

<specifics>
## Specific Ideas

- **User chose Broad whitelist (D-A) explicitly** — the listing-domain mirror of v1.0's narrow broker-edit. Admin gets full-power repair; design intent is "fix a bad-actor listing without seller cooperation."
- **Open transition matrix (D-B) reflects how moderation actually works** — escalation (suspended→deleted on confirmed spam review) and reclassification (suspended→archived once admin learns the seller is just inactive) shouldn't require a Restore round-trip that pollutes the audit timeline.
- **Restore reason optional (D-C)** — symmetric with v1.0 unsuspend. The 5-reason taxonomy is for *why moderate*; Restore is the inverse and has no semantic fit. AdminUid + timestamp in the audit row are sufficient.
- **Image parity (D-D)** — admin must be able to fully fix a listing including image takedown (PII leak, illegal content) without seller cooperation. The lighter alternatives (URL-only / no-images) all required seller participation, defeating the purpose.
- **ROADMAP success criterion #1's atomicity** is satisfied by D-06's `session.withTransaction()` + D-08's audit-then-Car ordering. Tests in D-16 (`listingTransaction.atomicity.test.js`) directly exercise the rollback path on simulated mid-flight failure.
- **ROADMAP success criterion #4's `fieldDiff` for Admin Edit** is satisfied by D-A-2's changed-only per-field shape + the editListing service computing the diff inside the transaction.
- **The 5-value reason enum is shared across Suspend / Archive / Delete (Car.moderationReason + ListingModerationAction.reasonCategory)** — single source of truth per Phase 7 D-14a. Phase 11 (LQUAL-01) lands the RU+EN translations under `listingReason*` prefixed keys.
- **Phase 9's `Car.pre(/^find/)` hide hook + `includeAllListingStatuses: true` opt-out option** is pre-named here (D-B-3) so Phase 8's admin reads already use the correct token. Phase 9 lands the hook implementation without renaming.

</specifics>

<deferred>
## Deferred Ideas

**Explicitly punted to follow-up phases or milestones — do not quietly re-introduce:**

- **`Car.lastActionId` back-link field.** Phase 7 audit collection has `{ listingId, createdAt: -1 }` index that satisfies the per-listing history query; the back-link adds an extra write per transaction with no query-pattern justification yet. Add only if Phase 10 admin-history UI surfaces a need.
- **Listing-history GET endpoint** (`GET /api/admin/moderation/listings/:carId/history` etc.). REQUIREMENTS.md does not include an admin-history listing requirement for v1.1; Phase 10 admin UI will decide whether to surface one. Pattern is locked by v1.0 history endpoint (Plan 05-0a) if/when surfaced.
- **Cross-domain audit views** (user-mod + listing-mod unioned via `$or` discrimination on `targetType`). Phase 7 D-09 deferred this; Phase 8 does not pre-empt.
- **DB-user-level insert-only Atlas privilege on `listing_moderation_actions`** — Phase 7 D-11 deferred; no Phase 8 changes.
- **Hash-chain tamper-evidence on `ListingModerationAction`** — Phase 7 D-13 deferred.
- **Auto-cancel / auto-refund of orders touching a moderated listing** — REQUIREMENTS Out of Scope, mirrors v1.0 anti-pattern. Phase 9 enforces TOCTOU on cart-add + confirm-booking; in-flight already-paid orders proceed.
- **S3 object cleanup on image-removal in admin Edit** — D-D-4: mirrors the existing seller-PUT behavior (orphans live in S3). S3 lifecycle / orphan-sweep is a future operations task.
- **Per-field admin Edit audit-log diff replay UI** — Phase 7 D-10 captures the `fieldDiff` data; the admin UI to view historical diffs is a v1.2+ carry-forward (already noted in ROADMAP "Carry-forward candidates").
- **Restore-to-previous-state semantics** — Restore always returns to `'active'` (per design notes + LADM-05). Restore-to-previous-non-active-state (e.g., undo a suspended→deleted by restoring to suspended) is not in scope; admin can re-apply the prior moderation if needed.
- **Hard-delete UI / API** — REQUIREMENTS Out of Scope. Backend op only when truly required.
- **Listing-status email / push notifications to seller** — NOTF-* carry-forward. Buyer-facing banner only in v1.1.
- **Super-admin tier with restricted transition matrix** — D-B-2 forward-compat: `invalid_transition` error code is reserved for a future restricted matrix; v1.1 ships fully-open.
- **Bulk admin listings panel** (filter by status, batch actions) — REQUIREMENTS Out of Scope, v1.2+.
- **Redis-backed rate limiter for horizontal scale** — Phase 7 D-04 deferred; no Phase 8 change.
- **Migrating legacy `/api/admin/requests` / `/api/admin/users` / `/api/admin/status` to Bearer idToken** — v1.0 D-06 carry-forward; still tracked.

</deferred>

---

*Phase: 08-admin-listing-moderation-endpoints-backend*
*Context gathered: 2026-05-28*
