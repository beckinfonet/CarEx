# Phase 9: Backend Read-time + TOCTOU Enforcement - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

**In scope (backend, sibling repo `../backend-services/carEx-services`):**

1. **LENF-01 — Read-time hide hook.** Add a `pre(/^find/)` hook on the `Car` model that filters out listings with `status !== 'active'` from every public read path (browse, search, related, listing-detail GET, etc.). Admin bypass via `setOptions({ includeAllListingStatuses: true })` mirrors v1.0's `includeAllUsers` pattern.
2. **LENF-02 — Status-aware listing-detail GET.** The single `GET /api/cars/:id` endpoint returns a status-aware response. Admin viewers receive the full Car document plus a `status` badge. Non-admin viewers receive a *thin identifying stub* — enough to recognize "this is the car I saved" without leaking moderation context.
3. **LENF-03 — Transactional cart + booking re-verification.** Adding a non-active listing to checkout (`POST /api/payments/create-payment-intent`) returns `409 listing_not_available`. A status change between create-payment-intent and `POST /api/payments/confirm-booking` aborts the booking inside the existing v1.0 Mongoose transaction with refund-first-throw-second semantics.

**Out of scope (deferred to other phases):**
- All mobile / UI work — Phase 10 (Mobile Plumbing + Admin Listing UI) and Phase 11 (Buyer-affected UX + Quality + Security Review)
- Buyer-facing banner copy (RU/EN strings) — Phase 11 (LQUAL-01) finalizes translations bound to the `bannerCopyKey` identifiers from Phase 7 D-14
- `Car.status` schema, audit collection, capability map, migration script — already landed in Phase 7 (D-07, D-10, D-14, D-15)
- Admin moderation endpoints (suspend/archive/delete/restore/edit) — already landed in Phase 8
- `ServiceOrder` pause-not-cancel integration for in-flight orders — flagged WR-03 in Phase 8 code review, deferred to a dedicated planning slice (see Deferred Ideas below)

</domain>

<decisions>
## Implementation Decisions

### Hide Hook + Admin Bypass (LENF-01) — Area 1 USER-DECIDED

- **D-01:** **Single bypass flag — `setOptions({ includeAllListingStatuses: true })`.** Mirrors v1.0 D-07's `includeAllUsers` shape. When set, the hook skips the listing-status filter entirely. Default (flag absent or false) hides every non-active listing. Grep-friendly for the Phase 11 LQUAL-03 security review.
- **D-02:** **Admin sees all four statuses through the bypass.** `active + suspended + archived + deleted` all pass through. **Required** for Phase 10's "Deleted listings" panel + Restore flow — without admin visibility of `deleted` rows, soft-deleted listings become unrecoverable from the UI. No separate `includeDeletedListings` flag — one flag, one rule.
- **D-03:** **Bypass call sites.** Every admin moderation handler from Phase 8 (`suspend/archive/delete/restore/edit`) MUST pass the flag when re-reading the target Car inside the transaction. The Phase 8 D-02 self-moderation check, the Phase 8 audit-row joins, and Phase 10's admin listings panel all pass the flag. The buyer-facing browse/search/related/recommendations endpoints do NOT pass the flag — default hide-safely applies.

### Hide Hook Structure — Claude's Discretion (Area 1 deferred)

- **D-04:** **Internal hook structure (one combined `pre(/^find/)` vs. two stacked hooks) is planner discretion.** The user-visible behavior is locked by D-01/D-02. Planner reads the existing Phase 1/3 seller-cascade hook (`Car.js` lines ~63–95 per Phase 8 notes) and picks whichever shape minimizes coupling. Constraint: whatever shape is chosen, the `includeAllListingStatuses` bypass MUST short-circuit the listing-status filter independent of whether the seller-cascade filter is also bypassed. The two filters are *orthogonal* — admin views of a `'suspended'` listing whose seller is *also* suspended must succeed when only `includeAllListingStatuses` is set.

### Listing-Detail GET Thin Payload (LENF-02) — Area 2 USER-DECIDED

- **D-05:** **Identifying-stub payload shape for non-admin viewers of non-active listings.** Exact allowed fields:
  ```js
  {
    carId,
    status,                    // 'suspended' | 'archived' | 'deleted'
    reasonCategory,            // 5-value taxonomy from Phase 7 D-14a
    title,                     // year + make + model concatenation, same as today's CarCard
    make,
    model,
    year,
    price,                     // asking price (the publicly-listed number)
    firstPhotoUrl,             // index-0 from imageUrls, or null if listing had no photos
    banner: {                  // copied verbatim from LISTING_STATUS_POLICY[status].banner (Phase 7 D-14)
      titleKey,
      bodyKey,
      severity                 // 'warning' | 'neutral' | 'destructive'
    }
  }
  ```
  Fields explicitly **NOT** in the thin payload: `sellerId`, `sellerName`, `sellerPhone`, `sellerEmail`, `description`, `moderationReason`, `moderatedBy`, `moderatedAt`, `lastEditedBy`, `mileage`, `location`, `condition`, `knownIssues`, full `imageUrls` array (only index-0 is exposed). The buyer sees the *facts they could already see when the listing was active* plus the banner — nothing about why it was moderated or who acted.
- **D-06:** **HTTP status code: 200 OK for all three non-active states.** Mobile branches on `body.status`. Matches the v1.0 pattern where suspended-user responses also returned 200 with a status field. Avoids the unusual "404 with body" pattern (some HTTP clients drop the body on 4xx).
- **D-07:** **Admin viewers receive the full Car document plus a `status` badge.** Concretely: same response shape as today's `GET /api/cars/:id`, with one additional top-level field `moderationBadge: { status, reasonCategory, moderationReason, moderatedBy, moderatedAt }`. The badge is omitted for `status === 'active'` listings even when viewed by admin (no unnecessary UI clutter).
- **D-08:** **`GET /api/cars/:id` is a single endpoint that branches on caller identity.** No new admin-only sibling endpoint. The handler bypasses the hide hook (so the lookup itself succeeds for any status), then decides response shape based on `req.user.isAdmin`. Public/anonymous viewers are treated as non-admin. Returns 404 only when `carId` doesn't exist at all.

### Cart-Add Gate (LENF-03 cart-add half) — Area 3 USER-DECIDED

- **D-09:** **Cart-add check piggybacks on `POST /api/payments/create-payment-intent`.** CarEx's cart is client-side only (`src/context/CartContext.tsx` — no server cart endpoint), so the authoritative server-side gate fires when the buyer presses "Pay" and the mobile app requests a PaymentIntent. Phase 9 adds an early listing-status assertion at the top of this handler that returns `409 listing_not_available` before any Stripe API call. **Divergence from ROADMAP literal wording:** ROADMAP success #3 says "Adding a non-active listing to the cart returns 409" — this is interpreted as "the first server interaction that follows cart-add" given CarEx's local-cart architecture. No `POST /api/cart/validate` endpoint is added in Phase 9.
- **D-10:** **Phase 10 mobile MAY add a pre-emptive client-side check** by re-fetching the listing-detail response before showing the Pay button. That is *advisory UX* — the authoritative 409 still fires at create-payment-intent. Decision is captured here so Phase 10 planners know the boundary: client-side check is optional polish; backend gate is contract.

### Error Body Shape (LENF-03 both halves) — Area 3 USER-DECIDED

- **D-11:** **409 `listing_not_available` body shape** at both failure sites:
  ```js
  // create-payment-intent (no Stripe charge yet)
  {
    error: 'listing_not_available',
    listingStatus,         // 'suspended' | 'archived' | 'deleted'
    reasonCategory,
    banner: { titleKey, bodyKey, severity }   // copied from LISTING_STATUS_POLICY[status].banner
  }

  // confirm-booking (Stripe was charged, refund attempted)
  {
    error: 'listing_not_available',
    listingStatus,
    reasonCategory,
    banner: { ... },
    refundId,              // present if stripe.refunds.create succeeded
    refundFailed           // boolean, true if Stripe refund call itself threw
  }
  ```
  Mirrors v1.0 D-15 patterns (`provider_suspended` body shape) so Phase 11's mobile error handler can use a single parsing path for all three TOCTOU error codes (`account_suspended`, `provider_suspended`, `listing_not_available`).

### Confirm-Booking TOCTOU Step Placement — Area 4 USER-DECIDED

- **D-12:** **Listing-status check folds into v1.0 D-10 step 4 (Car refetch).** Step 4 already does `Car.findById(carId, ..., { includeAllListingStatuses: true })` — wait, v1.0 used `includeAllUsers`. Phase 9 step 4 reads the Car with BOTH bypass flags so the suspended-seller AND suspended-listing cases are both detected and either can trigger the refund-then-throw path. The new assertion lives next to the existing seller-active assertion in the same step. No new step inserted, no double-fetch.
- **D-13:** **Step 4 now checks three conditions in order:** (1) seller is active in `moderationStatus.state` (v1.0 existing); (2) seller role status is `'APPROVED'` (v1.0 existing); (3) `car.status === 'active'` (Phase 9 new). Any failure triggers the shared refund-and-throw helper (D-14).

### Shared Refund Helper — Area 4 USER-DECIDED

- **D-14:** **Extract `refundAndThrow(stripe, paymentIntentId, errorBody)` helper** used by all four failure points in confirm-booking:
  1. Buyer-suspended (v1.0 step 2)
  2. Provider-suspended (v1.0 step 3)
  3. Seller-not-active (v1.0 step 4 existing assertion)
  4. **Listing-not-active (Phase 9 step 4 new assertion)**

  Helper contract: call `stripe.refunds.create({ payment_intent: paymentIntentId })`; on success, set `refundId` on `errorBody`; on failure, set `refundFailed: true` and log; then throw a typed error whose payload IS `errorBody`. The transaction sees the throw and rolls back the Mongo writes. Stripe refund is intentionally **OUTSIDE** the Mongo transaction (v1.0 D-11 rationale: Mongo transaction abort guarantees we never have orders without a refund attempt, but a Stripe outage during refund still leaves a charged-no-order state that ops reconciles via `refundFailed: true` flagging). The helper preserves v1.0's refund-first-throw-second ordering as the single invariant.
- **D-15:** **Phase 9 refactors v1.0's 3 inline call sites + adds the new 4th call site.** This touches v1.0 production code that already has Phase 6 SECURITY review approval — Phase 9 plans MUST include a regression-test step that re-runs the existing Phase 3 confirm-booking test suite to catch any helper-extraction mistakes. Regression risk is the price for the consolidation benefit (Phase 11 LQUAL-03 review reads one refund codepath, not four).

### Claude's Discretion (planner / executor may choose without re-asking)

- Internal hide-hook structure (one combined hook vs. two stacked hooks) per D-04 above.
- Module location for the shared `refundAndThrow` helper — likely `src/payments/refundAndThrow.js` or merged into the existing confirm-booking module; planner decides.
- Whether to write a `ListingModerationAction`-style audit row when a confirm-booking refund fires due to listing-not-active (v1.0 did NOT audit user-suspension refunds — the suspension itself was already audited at the admin action; same logic applies to listing moderation). Default: no new audit row at refund time; the listing moderation row from Phase 8 already explains why the listing is non-active.
- Test file organization — group tests under `__tests__/listing-enforcement/` (mirroring Phase 8's `__tests__/listing-moderation/` layout) or stack into `__tests__/payments/` near existing v1.0 confirm-booking tests; planner picks.
- Error-class naming (e.g., `ListingNotAvailableError` extending v1.0's `ProviderSuspendedError` base class, vs. plain object thrown) — planner picks to match v1.0 conventions.
- Status-aware listing-detail GET — whether the response-shape branching lives inline in the existing `GET /api/cars/:id` handler or extracts to a `buildListingDetailResponse(car, isAdmin)` helper. Either is fine.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project planning
- `.planning/PROJECT.md` — Milestone v1.1 core value, constraints, order-preservation rule ("in-flight orders pause, not cancel"), auth enforcement rule (server-side only)
- `.planning/REQUIREMENTS.md` — LENF-01, LENF-02, LENF-03 full text; cross-reference for what passes vs. fails ROADMAP success criteria
- `.planning/ROADMAP.md` §Phase 9 — Goal + success criteria 1/2/3 (the three pass-fail conditions for verification)
- `.planning/notes/listing-moderation-design.md` — Milestone-level design exploration. §"Buyer/cart impact" pins the pause-not-cancel rule that Phase 9 implements

### Phase 7 substrate (LOCKED — Phase 9 consumes this)
- `.planning/phases/07-listing-schema-security-baseline-backend/07-CONTEXT.md` — All D-01..D-20 apply. Most load-bearing for Phase 9:
  - **D-07** — `Car.status` field + index `{ status: 1 }` that Phase 9 read-hook depends on for query performance
  - **D-14** — `LISTING_STATUS_POLICY` capability map (`src/moderation/listingCapabilities.js`); Phase 9 thin payload (D-05) and 409 body (D-11) BOTH copy `banner` block from this map
  - **D-14a** — 5-value `reasonCategory` taxonomy used in thin payload + 409 body
  - **D-14b** — `banner.titleKey/bodyKey` are translation key identifiers; Phase 11 binds RU/EN copy to them. Phase 9 just passes the keys through verbatim

### Phase 8 substrate (LOCKED — Phase 9 sits atop this)
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-CONTEXT.md` — Admin endpoints that PRODUCE the non-active states Phase 9 enforces. D-A through D-D (admin Edit field scope, transition matrix, restore reason policy, image handling) are upstream context only; Phase 9 doesn't touch them.
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-REVIEW.md` — Phase 8 code review. **WR-03 (ServiceOrder pause-not-cancel)** is explicitly deferred from Phase 9 — captured in Deferred Ideas below
- `.planning/phases/08-admin-listing-moderation-endpoints-backend/08-REVIEW-FIX.md` — Records that WR-03 was skipped, WR-02 TOCTOU fix in admin handlers should be cross-referenced to verify Phase 9's hook bypass calls match the post-fix flow

### v1.0 Phase 3 — THE direct template (LOCKED, IN PRODUCTION)
- `.planning/phases/03-backend-enforcement-backend/03-CONTEXT.md` — v1.0 backend enforcement. Phase 9 is the listing-domain mirror. Most load-bearing:
  - **D-05/D-06/D-07** — Seller-cascade `pre(/^find/)` hook structure + `includeAllUsers` bypass pattern. Phase 9 D-01/D-04 mirror this shape for `includeAllListingStatuses`
  - **D-08/D-09** — Hook registration in model file; `findById`/`findOne` both pick up the hook. Phase 9 follows same conventions
  - **D-10** — 6-step `session.withTransaction` shape in confirm-booking. Phase 9 D-12/D-13 fold a new assertion into step 4
  - **D-11** — Refund-first-throw-second invariant + Stripe outside Mongo transaction. Phase 9 D-14 extracts this into a helper but preserves the invariant exactly
  - **D-14** — Buyer + provider both rechecked inside the transaction (closes both TOCTOU directions). Phase 9 adds the third direction (listing)
  - **D-15** — Error body shape patterns (`409 { error, ... }`). Phase 9 D-11 follows the same shape conventions
- `.planning/phases/03-backend-enforcement-backend/03-VERIFICATION.md` — what "done" looked like for v1.0 Phase 3. Phase 9 verification mirrors with substitutions

### v1.0 Phase 6 — SECURITY review precedent
- `.planning/phases/06-affected-user-ux-security-review/06-SECURITY.md` — 5-verdict shape (auth, authz, audit, TOCTOU, deferred-verification). Phase 11 LQUAL-03 will produce a `LIST-SECURITY.md` of the same shape covering Phase 9. Knowing the structure now lets Phase 9 plans pre-emptively organize evidence

### Backend codebase (existing — MUST read before editing)
- `../backend-services/carEx-services/src/models/Car.js` — Currently has:
  - The v1.0 seller-cascade `pre(/^find/)` hook (per Phase 8 CONTEXT notes, lines ~63–95 of the post-Phase-7 version)
  - `status` field + audit fields landed in Phase 7 (lines ~46–52)
  - `{ status: 1 }` index landed in Phase 7
  - Existing `listingStatus` lifecycle field (line ~43) — **MUST NOT** be confused with the new moderation `status` field per Phase 7 D-08 naming-collision lock
  Phase 9 EXTENDS this file with the new listing-status hide hook + bypass.
- `../backend-services/carEx-services/server.js` — Existing routes Phase 9 touches:
  - `GET /api/cars` (browse) and `GET /api/cars/search` — confirm hook auto-applies (no per-route work needed)
  - `GET /api/cars/:id` (listing detail) — Phase 9 D-08 modifies the handler to bypass the hook and branch response shape on `req.user.isAdmin`
  - `GET /api/cars/related/...` (related listings) — confirm hook auto-applies
  - `POST /api/payments/create-payment-intent` — Phase 9 D-09 adds the early listing-status assertion
  - `POST /api/payments/confirm-booking` — Phase 9 D-12/D-13/D-14/D-15 modifies the 6-step transaction
- `../backend-services/carEx-services/src/moderation/listingCapabilities.js` — Phase 7 D-14 LISTING_STATUS_POLICY. Phase 9 thin payload + 409 body both read `.banner` from this map
- `../backend-services/carEx-services/src/security/requireAdmin.js` (or wherever the Phase 7 LSEC-02 admin-check middleware lives) — Phase 9 D-08 listing-detail handler needs to know whether caller is admin without 403'ing non-admin (public + non-admin authenticated viewers BOTH get the thin payload). The bypass needs a *read-only* admin check, not the existing *gate-and-403* one. Planner may need to extract or split the check
- `../backend-services/carEx-services/__tests__/payments/` (or wherever v1.0 confirm-booking tests live) — Phase 9 D-15 regression-tests these existing suites after extracting the shared `refundAndThrow` helper

### External docs
- Mongoose query middleware (`pre(/^find/)`): https://mongoosejs.com/docs/middleware.html#query-middleware
- Mongoose Sessions + Transactions: https://mongoosejs.com/docs/transactions.html (re-read for Phase 9 helper extraction)
- Stripe Refunds API: https://docs.stripe.com/api/refunds (re-confirm refund call signature when extracting helper)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (already in backend, do NOT re-create)
- **`pre(/^find/)` seller-cascade hook in `Car.js`** — established Phase 1/3 pattern. Phase 9 either extends it (combined hook per D-04 option A) or adds a sibling hook with the same shape. Either way, follow the existing function structure exactly
- **`User.distinct('firebaseUid', { 'moderationStatus.state': { $ne: 'active' } })` pattern** — stateless per-query resolution from v1.0 D-05. Phase 9's listing-status filter does NOT need this (the filter is direct on `Car.status`, no join), but the *bypass-flag-skip* pattern (`if (this.getOptions().includeAllListingStatuses) return next()`) is copy-paste-able
- **`session.withTransaction()` block in v1.0 confirm-booking** — Phase 9 modifies step 4 in-place. Do NOT restructure the 6-step shape
- **`stripe.refunds.create({ payment_intent: piId })` call signature** — already used 3x in confirm-booking. Phase 9 D-14 helper wraps this
- **`LISTING_STATUS_POLICY` capability map from Phase 7 D-14** — single source of truth for `banner.titleKey/bodyKey/severity`. Phase 9 reads `LISTING_STATUS_POLICY[car.status].banner` into the thin payload AND the 409 body
- **5-value `reasonCategory` taxonomy from Phase 7 D-14a** — Phase 9 just reads `car.reasonCategory` and passes through; no taxonomy work needed

### Established Patterns (must honor)
- **Hook bypass is per-query, not global.** Every admin handler reads with `setOptions({ includeAllListingStatuses: true })` explicitly. Phase 9 does NOT introduce a request-context-based bypass (no async hooks, no middleware-injected default option). Grep-friendly for Phase 11 LQUAL-03
- **Refund-first-throw-second is invariant.** v1.0 D-11. Phase 9 D-14 helper enforces this in one place; helper MUST NOT be called in the throw-first-refund-second order anywhere
- **`200 OK + status in body` is the existing CarEx pattern** for status-aware responses (v1.0 `account_suspended` returned 200 with body). Phase 9 D-06 follows
- **PII minimization in non-admin responses** — v1.0 thin payloads withheld seller PII. Phase 9 D-05 thin payload follows: NO `sellerName/Phone/Email`, NO `moderationReason` free-text, NO `moderatedBy`. Buyer-visible fields only

### Integration Points
- **`Car.js`** — model file gets the new hide hook (D-01/D-04). Co-located with existing hook
- **`server.js` `GET /api/cars/:id` handler** — modified to bypass hook + branch response by `req.user.isAdmin` (D-08)
- **`server.js` `POST /api/payments/create-payment-intent` handler** — early listing-status assertion at top (D-09)
- **`server.js` `POST /api/payments/confirm-booking` handler** — step 4 extended (D-12/D-13); 3 existing refund call sites refactored to use new helper + 1 new call site added (D-14/D-15)
- **`src/payments/refundAndThrow.js`** (likely path) — new helper module (D-14)
- **`src/moderation/listingCapabilities.js`** — read-only consumer of `LISTING_STATUS_POLICY[status].banner` from D-05/D-11

### Anti-Pattern Warnings
- **Do NOT mutate `car.status` from a buyer-facing handler.** Only admin endpoints (Phase 8) write to `status`. Phase 9 only READS the field. The buyer-facing hide+thin-payload path must never write
- **Do NOT throw before refunding inside confirm-booking step 4.** The whole point of D-14's helper is to enforce the v1.0 D-11 invariant. Reviewers will check every `throw` inside the transaction has a preceding `stripe.refunds.create` call site (via the helper)
- **Do NOT bypass the hide hook with a global default option.** The bypass MUST be per-call. Adding `Car.schema.set('toJSON', { ... includeAllListingStatuses: true ... })` or similar global config would defeat Phase 9's purpose and is explicitly forbidden
- **Do NOT 404 deep-link viewers** — non-admin viewers of `suspended/archived/deleted` listings get 200 + thin payload (D-06), NOT 404. 404 is reserved for "carId doesn't exist at all"
- **Do NOT include `description`, `mileage`, `location`, `condition`, full `imageUrls` in the thin payload.** Only the explicit allowlist from D-05. Adding "just one more field" creep is a recurring failure mode in similar systems
- **Do NOT write a request-context-leaking admin check inside the listing-detail handler.** Caller-identity detection must be a plain `req.user?.isAdmin === true` boolean read; no DB lookup, no async work — that path executes on every public listing view and must stay fast

</code_context>

<specifics>
## Specific Ideas

- Thin payload `firstPhotoUrl` field uses `imageUrls[0]` if present, else `null`. Do not fetch from S3 or compute alternate thumbnails — verbatim the same URL the buyer would have seen when the listing was active
- The `moderationBadge` admin-side field (D-07) is omitted entirely for `status === 'active'` listings. Mobile renders no badge unless field is present. This keeps the admin's view of normal listings indistinguishable from a non-admin's full view
- Phase 9 verification should include a *manual* test: an admin viewing the deleted-listings panel (Phase 10 doesn't exist yet, but `GET /api/admin/moderation/listings?status=deleted` from Phase 8 D-N exists). The list response should be non-empty after admin deletes a listing — this is the contract Phase 10 will rely on
- The `refundAndThrow` helper extraction (D-15) is the highest regression risk in Phase 9. Plan should include a dedicated "regression test pass" task that runs the EXISTING v1.0 Phase 3 confirm-booking suite verbatim and asserts zero new failures BEFORE adding the Phase 9 listing-status assertion

</specifics>

<deferred>
## Deferred Ideas

- **WR-03 carry-over from Phase 8 code review — ServiceOrder pause-not-cancel.** PROJECT.md constraint says "in-flight orders touching a suspended listing should be paused (`services[].status = 'blocked'`), not auto-cancelled." Phase 8 admin handlers do NOT touch ServiceOrder (intentionally deferred per code review). Phase 9 ALSO does not implement this — its scope is read-time + TOCTOU enforcement, not ServiceOrder state management. **Action:** Add a sub-phase or carve out a Phase 9.5 / Phase 11 task that scans existing ServiceOrders on every admin moderation action, flips `services[].status` to `'blocked'`, and surfaces this in the buyer's order history. Cross-references: `08-REVIEW.md` WR-03, `08-REVIEW-FIX.md` skipped section, PROJECT.md constraint #4
- **Listing-status email/push notification to seller** — when admin suspends/archives/deletes, notify the seller. Defers to NOTF-01..03 milestone (v2 carry-forward from PROJECT.md)
- **Automated flagging queue (LIST-02)** — 3 buyer reports → auto-suspend. v2 carry-forward
- **Bulk admin listings panel** — filter by status, batch actions. Deferred to v1.1 carry-forward (already listed in ROADMAP)
- **OpenGraph / share-card metadata for thin-payload listings** — when a banned listing's URL is shared on RU social, the OG card shows... what? Not a Phase 9 backend concern (web fronting handles this at `www.carexmarket.com`), but worth a Phase 11 LQUAL note
- **`Car.findById` performance** — the hide hook adds a `status` filter to every read. The `{ status: 1 }` index from Phase 7 D-07 should make this O(1). If load testing surfaces a regression, the QUAL-02 deferred load test (PROJECT.md) might need to be revived

</deferred>

---

*Phase: 09-backend-read-time-toctou-enforcement*
*Context gathered: 2026-05-28*
