# Phase 9: Backend Read-time + TOCTOU Enforcement — Research

**Researched:** 2026-05-28
**Domain:** Mongoose `pre(/^find/)` query middleware, status-aware HTTP response shaping, transactional TOCTOU re-verification with Stripe refund ordering
**Confidence:** HIGH

## Summary

Phase 9 ships three backend changes in the sibling `carEx-services` repo: (1) a `pre(/^find/)` hide hook on `Car` that filters non-active listings out of every public read, bypassed via `setOptions({ includeAllListingStatuses: true })`; (2) a status-aware response on `GET /api/cars/:id` that returns a thin identifying stub to non-admin viewers of suspended/archived/deleted listings and the full document + `moderationBadge` to admins; (3) an early `409 listing_not_available` gate on `POST /api/payments/create-payment-intent` and a third in-transaction listing-status assertion folded into `POST /api/payments/confirm-booking`'s existing v1.0 `session.withTransaction()` step 4, paired with extraction of a shared `refundAndThrow` helper that preserves the v1.0 D-11 "refund-first-throw-second" invariant across all four failure sites (buyer / provider / seller / listing).

The substrate is fully landed: `Car.status` exists with a `{ status: 1 }` index, the bypass-flag pattern (`includeAllUsers`) is established in `Car.js`'s existing seller-cascade hook, the `LISTING_STATUS_POLICY` capability map already exports the `banner` block this phase reads, and the existing v1.0 `confirmBooking.js` already has a `refundThenThrow` function that just needs to be promoted to a shared module and extended with a fourth call site. No new libraries needed. Mongoose 9.1.5 + MongoMemoryReplSet test harness already proven for transactional code.

**Primary recommendation:** Mirror the v1.0 Phase 3 D-05..D-15 shape exactly. The hide hook is a paste of the existing `includeAllUsers` pattern with one line of additional query mutation; the listing-detail handler is a single-handler branch on `req.user?.isAdmin`; the TOCTOU work folds one new assertion into the existing 6-step transaction and renames the existing in-file `refundThenThrow` to an exported helper. The highest regression risk is the helper extraction touching v1.0 production code — the plan must include a regression-test step before adding the new assertion.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hide non-active listings from browse / search / related | API (Mongoose model layer) | — | Query middleware on `Car` model is the single grep-visible gate; per-route handlers stay unchanged (LENF-01) |
| Admin bypass via `includeAllListingStatuses: true` | API (per-call setOptions) | — | Per-call, never global default (locked anti-pattern, see D-3 in CONTEXT) |
| Status-aware listing-detail response shape | API (Express handler at `GET /api/cars/:id`) | — | Caller-identity branch lives in the route handler; both branches share the same handler so there is no admin-only sibling endpoint (D-08) |
| Listing-status check at cart-add boundary | API (`POST /api/payments/create-payment-intent` handler) | — | CarEx has no server cart; the create-payment-intent call IS the first server-authoritative cart-add surface (D-09) |
| Transactional TOCTOU re-verification on confirm-booking | API (`src/payments/confirmBooking.js` step 4 inside `session.withTransaction()`) | Database (MongoDB replica set txn) | The txn boundary is the only place that can both READ the listing under snapshot isolation AND ABORT all writes atomically |
| Stripe refund on listing-not-active mid-checkout | API (`refundAndThrow` helper called from inside txn, refund call OUTSIDE Mongo txn) | Stripe (charges + refunds) | v1.0 D-11 invariant: Stripe refund must happen BEFORE the throw that aborts the Mongo txn (otherwise: charged-no-order-no-refund on Stripe outage) |
| Banner copy (`titleKey` / `bodyKey`) source | API (read-only consumer of `LISTING_STATUS_POLICY`) | Mobile (Phase 11 binds keys to RU/EN strings) | Phase 9 just passes translation keys through; binding happens later (D-14b) |
| Admin identity detection for D-08 branch | API (read `req.user?.isAdmin === true` synchronously) | — | Anti-pattern explicitly forbidden: no DB lookup inside the public listing-detail hot path (CONTEXT §code_context) |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Single bypass flag — `setOptions({ includeAllListingStatuses: true })`.** Mirrors v1.0 D-07's `includeAllUsers` shape. When set, the hook skips the listing-status filter entirely. Default (flag absent or false) hides every non-active listing. Grep-friendly for the Phase 11 LQUAL-03 security review.

**D-02: Admin sees all four statuses through the bypass.** `active + suspended + archived + deleted` all pass through. Required for Phase 10's "Deleted listings" panel + Restore flow. No separate `includeDeletedListings` flag — one flag, one rule.

**D-03: Bypass call sites.** Every admin moderation handler from Phase 8 (`suspend/archive/delete/restore/edit`) MUST pass the flag when re-reading the target Car inside the transaction. The Phase 8 D-02 self-moderation check, the Phase 8 audit-row joins, and Phase 10's admin listings panel all pass the flag. The buyer-facing browse/search/related/recommendations endpoints do NOT pass the flag — default hide-safely applies.

**D-05: Thin payload allowed fields** (verbatim from CONTEXT):
```js
{
  carId, status, reasonCategory, title, make, model, year, price,
  firstPhotoUrl,
  banner: { titleKey, bodyKey, severity }
}
```
Explicitly NOT in the thin payload: `sellerId`, `sellerName`, `sellerPhone`, `sellerEmail`, `description`, `moderationReason`, `moderationNote`, `moderatedBy`, `moderatedAt`, `lastEditedBy`, `mileage`, `location`, `condition`, `knownIssues`, full `imageUrls` array (only index-0 is exposed).

**D-06: HTTP status code: 200 OK for all three non-active states.** Mobile branches on `body.status`. Avoids the unusual "404 with body" pattern.

**D-07: Admin viewers receive the full Car document plus a `status` badge.** Same response shape as today's `GET /api/cars/:id`, with one additional top-level field `moderationBadge: { status, reasonCategory, moderationReason, moderatedBy, moderatedAt }`. The badge is omitted for `status === 'active'` listings even when viewed by admin.

**D-08: `GET /api/cars/:id` is a single endpoint that branches on caller identity.** No new admin-only sibling endpoint. The handler bypasses the hide hook (so the lookup itself succeeds for any status), then decides response shape based on `req.user.isAdmin`. Public/anonymous viewers are treated as non-admin. Returns 404 only when `carId` doesn't exist at all.

**D-09: Cart-add check piggybacks on `POST /api/payments/create-payment-intent`.** No `POST /api/cart/validate` endpoint added. Phase 9 adds an early listing-status assertion at the top of this handler that returns `409 listing_not_available` before any Stripe API call.

**D-10: Phase 10 mobile MAY add pre-emptive client-side check** — advisory UX only; backend gate is the contract.

**D-11: 409 `listing_not_available` body shape** at both failure sites:
```js
// create-payment-intent (no Stripe charge yet)
{ error: 'listing_not_available', listingStatus, reasonCategory, banner: { titleKey, bodyKey, severity } }

// confirm-booking (Stripe was charged, refund attempted)
{ error: 'listing_not_available', listingStatus, reasonCategory, banner: { ... }, refundId, refundFailed }
```

**D-12: Listing-status check folds into v1.0 D-10 step 4 (Car refetch).** Step 4 reads with BOTH bypass flags (`includeAllUsers` + `includeAllListingStatuses`). No new step inserted, no double-fetch.

**D-13: Step 4 now checks three conditions in order:** (1) seller is active in `moderationStatus.state` (v1.0 existing); (2) seller role status is `'APPROVED'` (v1.0 existing); (3) `car.status === 'active'` (Phase 9 new). Any failure triggers the shared refund-and-throw helper (D-14).

**D-14: Extract `refundAndThrow(stripe, paymentIntentId, errorBody)` helper** used by all four failure points in confirm-booking. Stripe refund is intentionally OUTSIDE the Mongo transaction. The helper preserves v1.0's refund-first-throw-second ordering as the single invariant.

**D-15: Phase 9 refactors v1.0's 3 inline call sites + adds the new 4th call site.** Regression-test step required.

### Claude's Discretion

- Internal hide-hook structure (one combined `pre(/^find/)` vs. two stacked hooks). D-04: planner reads the existing Phase 1/3 seller-cascade hook and picks whichever shape minimizes coupling. Constraint: whatever shape, the `includeAllListingStatuses` bypass MUST short-circuit the listing-status filter independent of whether the seller-cascade filter is also bypassed.
- Module location for the shared `refundAndThrow` helper — likely `src/payments/refundAndThrow.js` or merged into the existing confirm-booking module.
- Whether to write a `ListingModerationAction` audit row when a confirm-booking refund fires due to listing-not-active. Default: no new audit row at refund time.
- Test file organization — group under `__tests__/listing-enforcement/` or stack into `__tests__/payments/`/`__tests__/enforcement/`.
- Error-class naming (`ListingNotAvailableError` extending v1.0's `ProviderSuspendedError` base class, vs. plain object thrown).
- Status-aware listing-detail GET — whether response-shape branching lives inline or extracts to a `buildListingDetailResponse(car, isAdmin)` helper.

### Deferred Ideas (OUT OF SCOPE)

- **WR-03 carry-over from Phase 8 code review — `ServiceOrder` pause-not-cancel.** Phase 9 ALSO does not implement this. Carve out a Phase 9.5 / Phase 11 task that scans existing `ServiceOrders` on every admin moderation action, flips `services[].status` to `'blocked'`, and surfaces this in buyer's order history.
- Listing-status email/push notification to seller (NOTF-01..03 deferred).
- Automated flagging queue (LIST-02 — v2).
- Bulk admin listings panel (v1.2+).
- OpenGraph / share-card metadata for thin-payload listings.
- `Car.findById` performance load test (revival of QUAL-02 deferred load test if regression surfaces).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LENF-01 | Public listing read endpoints (browse, search, related-listings) filter to `status: 'active'` via Mongoose `pre(/^find/)` hide hooks; admin opts in via `setOptions({ includeAllListingStatuses: true })` | §Mongoose Query Middleware Pattern; §Existing `Car.js` hook structure; §Index already exists (`{ status: 1 }` at Car.js:46) |
| LENF-02 | Listing-detail GET returns status-aware response: admin sees full document + badge; non-admin sees thin payload with status + reason category only | §Status-Aware Response Shaping; §`req.user.isAdmin` source (see "Admin Identity Detection" subsection); §`LISTING_STATUS_POLICY` capability map already exports `banner` block |
| LENF-03 | Cart-add and confirm-booking re-verify listing status inside same Mongoose transaction; reject with `409 listing_not_available`; refund-first-throw-second on mid-checkout status change | §v1.0 `confirmBooking.js` already has the 6-step transaction + `refundThenThrow`; Phase 9 extends step 4 + extracts the helper |

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are load-bearing for Phase 9:

- **No new state-mgmt or networking libs.** Phase 9 has no mobile work, so this only affects the helper-extraction decision. Stay on existing Mongoose + Stripe + axios.
- **No new hardcoded keys.** No env/secret introduction.
- **Auth enforcement (server-side).** Admin detection at `GET /api/cars/:id` MUST NOT trust a mobile-side `isAdmin` claim. Use the same `req.auth.email` → `AdminUser.findOne` lookup the existing `requireAdmin` middleware uses, but in a read-only branch that does NOT 403 non-admin (they still get the thin payload).
- **Data preservation.** Phase 9 only READS `car.status`; it never mutates. Thin payload + 409 + refund flow do not touch the listing document.
- **Order safety: in-flight orders pause, not cancel.** Phase 9 does NOT implement this for listings (WR-03 deferred). Plan must surface this gap explicitly in 09-VERIFICATION.md.
- **i18n RU/EN parity.** Phase 9 emits translation KEYS (`titleKey` / `bodyKey`) — Phase 11 binds the strings. No RU/EN work in Phase 9 itself.

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mongoose` | ^9.1.5 [VERIFIED: backend package.json] | ODM + query middleware (`pre(/^find/)`) + transactions (`session.withTransaction()`) | Already in use; the `pre(/^find/)` hook pattern is established in `Car.js:63-95` for the seller-cascade hook |
| `stripe` | ^20.4.1 [VERIFIED: backend package.json] | `stripe.paymentIntents.retrieve`, `stripe.refunds.create` | Already used 3× in `confirmBooking.js:43`; Phase 9 wraps the existing call in a helper |
| `express` | ^5.2.1 [VERIFIED: backend package.json] | Route handlers | Existing |
| `zod` | ^3.25.76 [VERIFIED: backend package.json] | Body validation (not strictly needed for Phase 9 but available for the 409 body builder) | Existing |
| `mongodb-memory-server` | ^10.4.3 [VERIFIED: backend package.json devDeps] | `MongoMemoryReplSet` for transaction tests | Already used by Phase 3 `confirmBooking.transaction.test.js`; Phase 9 tests reuse |
| `jest` | ^29.7.0 [VERIFIED: backend package.json devDeps] | Test runner | Existing |
| `supertest` | ^7.2.2 [VERIFIED: backend package.json devDeps] | HTTP integration tests for `GET /api/cars/:id` + `POST /api/payments/*` | Existing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pre(/^find/)` query middleware | Mongoose discriminators | Discriminators force a schema redesign and break `Car` everywhere it's read; existing v1.0 hook pattern is grep-visible and matches the bypass-flag convention. NOT CHOSEN |
| `pre(/^find/)` query middleware | Default scope via `Schema.query` plugin | Equivalent in behavior but no precedent in this codebase; one-off pattern would confuse Phase 11 security review. NOT CHOSEN |
| Repository wrapper (e.g., `CarRepository.findActive`) | Wrapping every read | Loses the "hook applies even to ad-hoc reads" property; would let a future plan accidentally call `Car.findById` directly and bypass the filter. NOT CHOSEN — locked by D-01 to use the hook pattern |
| Partial index `{ status: 1 } where status === 'active'` | Add partial filter to existing index | Phase 7 D-07 already shipped `{ status: 1 }` as a plain index. The hide hook adds `status: { $in: ['active'] }` (or similar) to queries; with the plain `{ status: 1 }` index Mongo can serve the equality scan in O(log n). A partial index would shrink index size further but is a Phase 11 perf optimization, not a Phase 9 correctness concern. NOT CHOSEN for Phase 9. |
| `ListingNotAvailableError extends ProviderSuspendedError` | Subclass | Phase 9 prefers a `ListingServiceError` style or a sibling subclass of `ProviderSuspendedError` for grep-visibility; planner's discretion. Either works. |

**Installation:** None — all dependencies present.

**Version verification:**
```bash
cd ../backend-services/carEx-services && npm view mongoose version  # → 9.x latest [VERIFIED: package.json declares ^9.1.5]
```
[CITED: backend-services/carEx-services/package.json] confirms mongoose 9.1.5, stripe 20.4.1, jest 29.7.0, mongodb-memory-server 10.4.3.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MOBILE (Phase 9 read-only consumer)                   │
│                                                                             │
│  CarDetailsScreen                                                           │
│    └─ AuthService.confirmBooking(piId, carId, buyerUid)  ────┐              │
│  AuthService.createPaymentIntent(currency, carId, buyerUid)  │              │
│                                                              │              │
└─────────────────────────────────────────────────────────────│──────────────┘
                                                              │
                                          HTTPS POST          │
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│            carEx-services BACKEND  (Node/Express + Mongoose)                │
│                                                                             │
│  ┌──────────────────────────┐   ┌──────────────────────────────────────┐   │
│  │ GET /api/cars/:id        │   │ POST /api/payments/create-payment-   │   │
│  │ (status-aware response)  │   │      intent                          │   │
│  │  ├─ findById             │   │  (LENF-03 cart-add gate)             │   │
│  │  │   .setOptions(        │   │   ├─ adminCheck()  [skipped here]   │   │
│  │  │     includeAll...)    │   │   ├─ Car.findById                    │   │
│  │  ├─ isAdmin?             │   │   │    (HIDDEN by hide hook unless   │   │
│  │  │   YES → full + badge  │   │   │    car is active — that IS the   │   │
│  │  │   NO  → thin payload  │   │   │    gate; alternative: explicit   │   │
│  │  │       (D-05 fields)   │   │   │    findById with bypass + then  │   │
│  │  └─ res.json(...)        │   │   │    status check — see D-09 note) │   │
│  └──────────────────────────┘   │   ├─ if car.status !== 'active'      │   │
│                                 │   │     → 409 listing_not_available  │   │
│  ┌──────────────────────────┐   │   ├─ stripe.paymentIntents.create()  │   │
│  │ GET /api/cars (browse)   │   │   └─ res.json({ clientSecret, ... }) │   │
│  │ GET /api/cars            │   └──────────────────────────────────────┘   │
│  │     ?sellerId=...        │                                              │
│  │  └─ Car.find(filter)     │   ┌──────────────────────────────────────┐   │
│  │     [hide hook applies   │   │ POST /api/payments/confirm-booking   │   │
│  │      AUTOMATICALLY       │   │  (LENF-03 transactional re-verify)   │   │
│  │      → status='active'   │   │   └─ confirmBooking(stripe,...)      │   │
│  │      only]               │   │       └─ session.withTransaction:    │   │
│  └──────────────────────────┘   │           ├─ buyer re-check          │   │
│                                 │           ├─ provider re-check       │   │
│         ┌───────────────────────┤           ├─ STEP 4: Car refetch     │   │
│         │  Mongoose hide hook   │           │   .setOptions(            │   │
│         │  pre(/^find/) on Car  │           │     includeAllUsers: true,│   │
│         │   if !includeAll...   │           │     includeAllListing-    │   │
│         │     filter status:    │           │     Statuses: true)       │   │
│         │     'active'          │           │  ├─ seller.state active?  │   │
│         │  (LENF-01)            │           │  ├─ seller APPROVED?      │   │
│         └───────────────────────┤           │  └─ car.status='active'?  │   │
│                                 │           │       (D-13 NEW)          │   │
│                                 │           │       → refundAndThrow()  │   │
│                                 │           │           ├─ stripe.      │   │
│                                 │           │           │   refunds.    │   │
│                                 │           │           │   create()    │   │
│                                 │           │           │   (D-14)      │   │
│                                 │           │           ├─ build body   │   │
│                                 │           │           │   { error,    │   │
│                                 │           │           │     refundId, │   │
│                                 │           │           │     refundF.. │   │
│                                 │           │           │     banner }  │   │
│                                 │           │           └─ throw        │   │
│                                 │           │              (aborts txn) │   │
│                                 │           └─ commit                   │   │
│                                 └──────────────────────────────────────┘   │
│                                                                             │
│         ┌──────────────────────────────────────────────────────┐            │
│         │  Stripe API (OUTSIDE Mongo txn — D-11 invariant)     │            │
│         │   - refunds.create (idempotent retries safe via ID)  │            │
│         │   - paymentIntents.retrieve                          │            │
│         └──────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
backend-services/carEx-services/
├── server.js                                    # mounts routes; Phase 9 modifies:
│                                                #   - GET /api/cars/:id (D-08)
│                                                #   - POST /api/payments/create-payment-intent (D-09)
│                                                #   - POST /api/payments/confirm-booking (uses refactored service)
├── src/
│   ├── models/
│   │   └── Car.js                               # Phase 9 ADDS listing-status hide hook (D-01/D-04)
│   ├── payments/
│   │   ├── confirmBooking.js                    # Phase 9 EXTENDS step 4 (D-12/D-13)
│   │   └── refundAndThrow.js                    # Phase 9 NEW helper (D-14) — planner discretion
│   ├── moderation/
│   │   └── listingCapabilities.js               # Phase 9 read-only consumer (banner block)
│   └── security/
│       └── requireAdmin.js                      # Phase 9 may use OR add a read-only sibling
│                                                #   (decision point — see "Admin Identity Detection")
└── __tests__/
    └── listing-enforcement/                     # Phase 9 NEW dir (planner discretion: could go in payments/)
        ├── hideOnFind.listingStatus.test.js     # LENF-01
        ├── listingDetailStatusAware.test.js     # LENF-02
        ├── createPaymentIntent.gate.test.js     # LENF-03 cart-add half
        ├── confirmBooking.listingTOCTOU.test.js # LENF-03 confirm-booking half
        └── refundAndThrow.helper.test.js        # D-14 helper unit tests
```

### Pattern 1: Hide Hook with Bypass Flag (LENF-01)

**What:** A Mongoose `pre(/^find/)` query middleware that mutates `this.getQuery()` to filter out non-active listings, short-circuited by a per-call option.

**When to use:** Any time you want to enforce a default filter at the model layer that admin call sites can opt out of explicitly.

**Example (verified pattern from existing `Car.js:63-95`):**
```js
// Phase 9 NEW hook — add to Car.js after the existing seller-cascade hook.
// Source: mirrors the existing pattern at Car.js:63-95.
carSchema.pre(/^find/, function (next) {
  if (this.getOptions().includeAllListingStatuses) {
    return next();
  }
  const currentQuery = this.getQuery();
  const existingStatusClause = currentQuery.status;
  const nextQuery = { ...currentQuery };
  if (existingStatusClause === undefined) {
    nextQuery.status = 'active';
  } else {
    // Caller already filtered on status (e.g., admin endpoint querying status='deleted').
    // Preserve their filter AND apply hide-active via $and so neither clobbers the other.
    delete nextQuery.status;
    nextQuery.$and = [
      ...(currentQuery.$and || []),
      { status: existingStatusClause },
      { status: 'active' },
    ];
  }
  this.setQuery(nextQuery);
  next();
});
```

**Sources:**
- [VERIFIED: backend-services/carEx-services/src/models/Car.js:63-95] — existing seller-cascade hook pattern, byte-for-byte the shape to copy
- [CITED: https://mongoosejs.com/docs/middleware.html#query-middleware] — `pre(/^find/)` regex matches `find`, `findOne`, `findById`, `findOneAndUpdate`, etc.

### Pattern 2: Status-Aware Response Shaping (LENF-02)

**What:** Single `GET /api/cars/:id` handler that fetches with the bypass flag, then branches the response shape based on caller identity.

**When to use:** When admins and non-admins should see different projections of the same underlying record without leaking PII or moderation context.

**Example (verified pattern from existing `Car.findById` at server.js:313-328 + D-05/D-07 fields):**
```js
// Phase 9 MODIFIED GET /api/cars/:id (server.js).
// Source: shape extends server.js:313-328 with D-05 thin payload + D-07 admin badge.
const { LISTING_STATUS_POLICY } = require('./src/moderation/listingCapabilities');

app.get('/api/cars/:id', async (req, res) => {
  try {
    // Bypass the hide hook so the lookup succeeds for ANY status (D-08).
    const car = await Car.findById(req.params.id)
      .setOptions({ includeAllListingStatuses: true })
      .lean();
    if (!car) return res.status(404).json({ message: 'Car not found' });

    // Admin detection — read-only, sync. See "Admin Identity Detection" subsection
    // below for the recommended source. NEVER trust a client-supplied isAdmin claim.
    const isAdmin = await isAdminCaller(req);  // pseudo — see Pattern 5

    if (isAdmin) {
      // Full document + badge (D-07). Badge omitted for active listings.
      const moderationBadge = car.status === 'active' ? undefined : {
        status: car.status,
        reasonCategory: car.moderationReason,  // see naming note below
        moderationReason: car.moderationNote,  // CONTEXT D-07 lists 5 fields; verify against schema
        moderatedBy: car.moderatedBy,
        moderatedAt: car.moderatedAt,
      };
      return res.json({
        ...car,
        id: car._id.toString(),
        make: car.makeName || car.make || '',
        model: car.modelName || car.model || '',
        listingStatus: car.listingStatus || 'active',
        ...(moderationBadge ? { moderationBadge } : {}),
      });
    }

    if (car.status === 'active') {
      // Non-admin viewing an active listing — return the existing shape verbatim.
      return res.json({
        ...car,
        id: car._id.toString(),
        make: car.makeName || car.make || '',
        model: car.modelName || car.model || '',
        listingStatus: car.listingStatus || 'active',
      });
    }

    // Non-admin viewing a non-active listing — D-05 thin payload only.
    const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
    const firstPhotoUrl = Array.isArray(car.imageUrls) && car.imageUrls.length > 0
      ? car.imageUrls[0] : null;
    return res.json({
      carId: car._id.toString(),
      status: car.status,
      reasonCategory: car.moderationReason,
      title: `${car.year || ''} ${car.makeName || car.make || ''} ${car.modelName || car.model || ''}`.trim(),
      make: car.makeName || car.make || '',
      model: car.modelName || car.model || '',
      year: car.year,
      price: car.price,
      firstPhotoUrl,
      banner,
    });
  } catch (error) {
    console.error('Fetch car error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

**Naming caveat (HIGH confidence):** the `Car` schema uses `moderationReason` for the 5-value reason category enum [VERIFIED: `Car.js:47`: `moderationReason: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other'], ... }`] and `moderationNote` for the free-text admin note [VERIFIED: `Car.js:48`]. The plan needs to reconcile this with CONTEXT D-05's `reasonCategory` payload field and D-07's `moderationReason` badge field — the THIN payload's `reasonCategory` and the ADMIN badge's `reasonCategory` both come from `car.moderationReason`. The free-text `car.moderationNote` is the admin badge's note field (D-07 calls it `moderationReason` but means the free-text — verify with planner before final response shape locks).

**Sources:**
- [VERIFIED: backend-services/carEx-services/server.js:313-328] — existing handler shape
- [VERIFIED: backend-services/carEx-services/src/moderation/listingCapabilities.js:7-36] — LISTING_STATUS_POLICY banner block
- [VERIFIED: backend-services/carEx-services/src/models/Car.js:46-52] — schema field names

### Pattern 3: Early 409 Gate at Create-Payment-Intent (LENF-03 cart-add half)

**What:** Synchronous listing-status assertion at the top of `POST /api/payments/create-payment-intent`, BEFORE any Stripe API call.

**When to use:** When a server endpoint represents the first authoritative gate after a stale client-side cart, and you need to fail closed without spending external API quota.

**Example:**
```js
// Phase 9 MODIFIED POST /api/payments/create-payment-intent (server.js).
// Source: extends server.js:1018-1042 with an early listing-status gate (D-09).
const { LISTING_STATUS_POLICY } = require('./src/moderation/listingCapabilities');

app.post('/api/payments/create-payment-intent', attachAuthIfPresent, requireNotSuspended('create_order'), async (req, res) => {
  try {
    const { currency = 'kgs', carId, buyerUid } = req.body;
    if (!buyerUid) return res.status(400).json({ message: 'buyerUid required' });

    // Phase 9 LENF-03 cart-add gate — fires BEFORE any Stripe API call (no charge yet).
    if (carId) {
      const car = await Car.findById(carId)
        .setOptions({ includeAllListingStatuses: true })
        .select('status moderationReason')
        .lean();
      if (car && car.status !== 'active') {
        const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
        return res.status(409).json({
          error: 'listing_not_available',
          listingStatus: car.status,
          reasonCategory: car.moderationReason,
          banner,
        });
      }
      // Defensively: if findById returned null (carId points to a now-missing doc), keep the
      // existing path through and let downstream catch handle it; OR return 404. Planner picks.
    }

    const amount = currency === 'usd' ? BOOKING_FEE_USD : BOOKING_FEE_KGS;
    // ... rest of handler unchanged ...
  } catch (error) {
    console.error('Create PaymentIntent error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

**Sources:**
- [VERIFIED: backend-services/carEx-services/server.js:1018-1042] — existing handler

### Pattern 4: Transactional TOCTOU Re-verify + Refund-First-Throw-Second (LENF-03 confirm-booking half)

**What:** Inside the existing `session.withTransaction()` step 4, add a third assertion on `car.status === 'active'` and route any failure through a shared `refundAndThrow` helper that calls `stripe.refunds.create` BEFORE the throw that aborts the Mongo transaction.

**When to use:** Whenever a stale client-side decision needs to be re-validated against database state INSIDE the same transaction that will perform the financial commit.

**Example (extending existing `confirmBooking.js:189-207`):**
```js
// Phase 9 EXTENDS confirmBooking.js step c (seller re-check + car flip).
// Source: existing file at backend-services/carEx-services/src/payments/confirmBooking.js:189-207.

// ---- c. Seller re-check + listing re-check + car flip --------------------
const car = await Car.findById(carId)
  .setOptions({ includeAllUsers: true, includeAllListingStatuses: true })  // BOTH flags (D-12)
  .session(session);
if (!car) {
  throw new Error('car_not_found');
}

const sellerUser = await User.findOne({ firebaseUid: car.sellerId })
  .setOptions({ includeAllUsers: true })
  .session(session)
  .lean();

// D-13 ordered checks:
// (1) seller moderationStatus.state === 'active'
// (2) seller.sellerStatus === 'APPROVED'
// (3) NEW: car.status === 'active'
if (!sellerUser || sellerUser.moderationStatus?.state !== 'active' || sellerUser.sellerStatus !== 'APPROVED') {
  await refundAndThrow(stripe, paymentIntentId, {
    error: 'provider_suspended',
    providerUid: car.sellerId,
  });
}

// NEW (D-13 condition 3 + D-14):
if (car.status !== 'active') {
  const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
  await refundAndThrow(stripe, paymentIntentId, {
    error: 'listing_not_available',
    listingStatus: car.status,
    reasonCategory: car.moderationReason,
    banner,
  });
}

car.listingStatus = 'booked';
// ... rest unchanged ...
```

**Refund helper (Phase 9 NEW, refactored from the existing `refundThenThrow` at `confirmBooking.js:40-56`):**
```js
// src/payments/refundAndThrow.js (planner discretion on location)
//
// Source: refactored from confirmBooking.js:40-56. Preserves v1.0 D-11 invariant:
// refund-first, throw-second. Stripe call lives OUTSIDE the Mongo transaction by
// caller contract (the helper itself does not start a session); calling code is
// responsible for ensuring the await happens INSIDE the txn callback so the
// thrown error aborts the surrounding session.withTransaction().

class ListingNotAvailableError extends Error {
  constructor(body) {
    super(body.error);
    this.name = 'ListingNotAvailableError';
    Object.assign(this, body);
  }
}

async function refundAndThrow(stripe, paymentIntentId, errorBody) {
  let refundId = null;
  let refundFailed = false;
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      // RECOMMENDATION (planner discretion): use a stable idempotency key so a
      // withTransaction retry does not double-refund. Stripe accepts an
      // idempotencyKey via the second argument:
      //   { idempotencyKey: `refund-${paymentIntentId}` }
      // See [CITED: https://docs.stripe.com/api/idempotent_requests]
    }, { idempotencyKey: `refund-${paymentIntentId}` });
    refundId = refund.id;
  } catch (err) {
    refundFailed = true;
    console.error('[refundAndThrow] Stripe refund failed:', err);
  }
  const enrichedBody = { ...errorBody, refundId, refundFailed };
  // Choose the throw shape — extending ProviderSuspendedError keeps the existing
  // `err instanceof ProviderSuspendedError` checks in the route handler working
  // for the 3 v1.0 call sites; the new listing-not-available case can be a
  // sibling subclass. Or use a discriminated body.error field.
  if (errorBody.error === 'listing_not_available') {
    throw new ListingNotAvailableError(enrichedBody);
  }
  const err = new ProviderSuspendedError(errorBody.error);
  Object.assign(err, enrichedBody);
  throw err;
}
```

**Route mapping in server.js handler (Phase 9 EXTENDED):**
```js
// server.js:1049-1082 currently maps ProviderSuspendedError → 409 provider_suspended.
// Phase 9 adds a sibling branch for ListingNotAvailableError → 409 listing_not_available.
} catch (err) {
  if (err instanceof ListingNotAvailableError) {
    return res.status(409).json({
      error: 'listing_not_available',
      listingStatus: err.listingStatus,
      reasonCategory: err.reasonCategory,
      banner: err.banner,
      refundId: err.refundId,
      refundFailed: err.refundFailed,
    });
  }
  if (err instanceof ProviderSuspendedError) {
    return res.status(409).json({ error: 'provider_suspended', providerUid: err.providerUid, refundId: err.refundId, refundFailed: err.refundFailed });
  }
  // ... existing branches for invalid_payment_intent, car_not_found, 500 ...
}
```

**Sources:**
- [VERIFIED: backend-services/carEx-services/src/payments/confirmBooking.js:40-56,189-207] — existing helper + step 4
- [VERIFIED: backend-services/carEx-services/server.js:1049-1082] — existing route error mapping
- [CITED: https://docs.stripe.com/api/idempotent_requests] — Stripe Idempotency-Key header for safe retries
- [CITED: https://mongoosejs.com/docs/transactions.html#withTransaction] — `session.withTransaction()` auto-retries on transient errors (MongoServerError with `TransientTransactionError` label), so the refund call inside the callback MUST be idempotent

### Pattern 5: Admin Identity Detection (D-08 critical)

**What:** Synchronous read of caller's admin status during the listing-detail GET, WITHOUT 403'ing non-admin and WITHOUT a DB lookup in the hot path.

**Decision point:** The existing `requireAdmin` middleware at `src/security/requireAdmin.js:10-20` does TWO things — reads `req.auth.email`, looks up the `AdminUser` doc, then either attaches `req.admin` or 403s. Phase 9's listing-detail handler needs the FIRST half (the lookup) WITHOUT the SECOND (the 403). Three options for the planner:

| Option | Shape | Tradeoff |
|--------|-------|----------|
| **A. Split `requireAdmin` into `lookupAdminIfPresent` + `requireAdmin`** | Read-only mounted on `GET /api/cars/:id` via `attachAuthIfPresent` + a new sibling that sets `req.admin` if found but always calls `next()` | Clean separation; one new middleware file; reusable elsewhere |
| **B. Inline DB lookup in the listing-detail handler** | `const isAdmin = req.auth?.email ? !!(await AdminUser.findOne({ email: req.auth.email.toLowerCase() })) : false;` | Simple, but adds a DB call on every public listing view (HOT PATH) — CONTEXT §code_context anti-pattern: "no DB lookup, no async work — that path executes on every public listing view and must stay fast" |
| **C. Use Firebase custom claims** | Set `claims.admin = true` at AdminUser creation; read via `req.auth.claims.admin` synchronously | Requires Phase 7 / Phase 2 to have already stamped claims — VERIFY before recommending |

**RECOMMENDED:** Option A. Extract `lookupAdminIfPresent` from `requireAdmin`:
```js
// src/security/lookupAdminIfPresent.js (Phase 9 NEW)
const AdminUser = require('../models/AdminUser');

async function lookupAdminIfPresent(req, res, next) {
  if (!req.auth || !req.auth.email) return next();
  try {
    const admin = await AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean();
    if (admin) {
      req.admin = { uid: req.auth.uid, role: admin.role, email: admin.email };
    }
  } catch (err) {
    console.error('[lookupAdminIfPresent]', err);
  }
  return next();
}
module.exports = { lookupAdminIfPresent };
```

Then mount on `GET /api/cars/:id`:
```js
app.get('/api/cars/:id', attachAuthIfPresent, lookupAdminIfPresent, async (req, res) => {
  const isAdmin = !!req.admin;
  // ...
});
```

**Caveat:** This DOES add a DB lookup, but only on `GET /api/cars/:id` (not on browse). The CONTEXT anti-pattern warning was about avoiding lookups in browse-list paths. A single `AdminUser.findOne({ email }).lean()` on `GET /api/cars/:id` is acceptable; the AdminUser collection is tiny (<100 docs) and `email` is unique-indexed. **Confirm with planner** before locking — if the perf concern is sharp, fall back to Option C (claims-based) and have Phase 7/2 backfill claims.

[CITED: backend-services/carEx-services/src/security/requireAdmin.js:10-20] — existing implementation to split

### Anti-Patterns to Avoid

- **Mutating `car.status` from a buyer-facing handler.** Only admin endpoints (Phase 8) write to `status`. Phase 9 only READS the field. The buyer-facing hide+thin-payload path must never write.
- **Throwing before refunding inside `confirmBooking` step 4.** The whole point of D-14's helper is to enforce the v1.0 D-11 invariant. Reviewers will check every `throw` inside the transaction has a preceding `stripe.refunds.create` call site.
- **Bypassing the hide hook with a global default option.** The bypass MUST be per-call. Adding `Car.schema.set('toJSON', { ... includeAllListingStatuses: true ... })` or `Car.schema.pre('find', function () { this.setOptions({ includeAllListingStatuses: true }); })` defeats Phase 9's purpose.
- **404'ing deep-link viewers** — non-admin viewers of `suspended/archived/deleted` listings get 200 + thin payload (D-06), NOT 404. 404 is reserved for "carId doesn't exist at all."
- **Adding "just one more field" to the thin payload.** Only D-05's allowlist. The Phase 11 LQUAL-03 security review will diff this against `car` and fail on any field outside the allowlist.
- **Request-context-leaking admin check inside the listing-detail handler.** Caller-identity detection must be a plain boolean read (the Option A `req.admin` read); no per-request side effects, no global state writes.
- **Double-refund on transaction retry.** Mongoose's `session.withTransaction()` auto-retries on transient errors. Without an idempotency key on the Stripe refund call, a transient txn error after refund could trigger a SECOND refund call on retry. Use `idempotencyKey: \`refund-${paymentIntentId}\`` on every `stripe.refunds.create` call.
- **`car_not_found` raised for soft-deleted listings inside confirm-booking.** Step 4's bypass-flag read guarantees the lookup succeeds even when `status === 'deleted'`; the 409 path then fires. A null car genuinely means the doc was never written or was hard-deleted (outside Phase 9's scope).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Filter non-active listings from every public read | Per-handler `Car.find({ status: 'active', ... })` everywhere | One `pre(/^find/)` hook on the Car model with bypass flag | Misses ad-hoc `findById`, breaks under code-search audits, one new endpoint = one missed filter site |
| Refund-first-throw-second ordering | New ad-hoc try/catch at every failure site | Shared `refundAndThrow` helper (D-14) | v1.0 already proved this works (3 sites); adding a 4th without the helper triples regression risk |
| Idempotent refunds across txn retries | UUID-per-attempt | Stripe `idempotencyKey` parameter | Stripe handles dedup server-side; never use a random key |
| Admin-bypass for the listing-detail GET | A separate `/api/admin/cars/:id` endpoint | Single endpoint with caller-identity branch (D-08) | New admin-only endpoint adds a 5-line surface that mobile and web both have to teach; bonus: mobile uses one URL forever |
| Banner copy lookup | Hardcoded strings in the handler | Read from `LISTING_STATUS_POLICY[status].banner` | Phase 11 will swap RU/EN copy via translation keys; hardcoding breaks the indirection |
| Reason-category taxonomy | New 5-string enum here | Existing `car.moderationReason` field (Phase 7 D-14a) | Schema already enforces the 5 valid values; passthrough only |
| Transaction harness for tests | New helpers | Reuse `__tests__/_helpers/mongoReplSet.js` | Phase 3 already proved this works for transactional tests |

**Key insight:** Phase 9 is mostly *plumbing* — every behavior it implements has a near-identical v1.0 precedent. The high-value research output is identifying the precedents and the exact divergences, NOT inventing patterns. The dominant risk is regression in the helper extraction (D-15 explicitly calls this out).

## Runtime State Inventory

This is a code/config-only phase (no data migration, no service rename, no string replacement across infrastructure). The five categories:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 9 does not rename any field. `Car.status` exists and is populated. | None |
| Live service config | None — no new external integrations | None |
| OS-registered state | None — no scheduled tasks, services, or systemd units | None |
| Secrets/env vars | None — no new keys or env vars. Stripe keys already in env. | None |
| Build artifacts | None — no compiled binaries, no installed packages with embedded names | None |

**Nothing found in any category:** Verified by reading CONTEXT.md (`<deferred>` confirms no migration work), REQUIREMENTS.md (LENF-01..03 are read-time and HTTP-time enforcement, no schema writes), and Phase 7 SUMMARY (schema + migration already landed).

## Common Pitfalls

### Pitfall 1: Hide hook fires inside the confirm-booking transaction and hides the in-flight listing

**What goes wrong:** When `confirmBooking.js` step 4 calls `Car.findById(carId).session(session)` and the listing has been suspended mid-checkout, the hide hook (LENF-01) filters it out, the lookup returns `null`, and the existing v1.0 code throws `'car_not_found'` (404) instead of the Phase 9 `listing_not_available` (409) with refund.

**Why it happens:** The hide hook applies to EVERY find query unless explicitly bypassed.

**How to avoid:** D-12 already pins the fix — step 4's `Car.findById` MUST chain BOTH bypass flags: `.setOptions({ includeAllUsers: true, includeAllListingStatuses: true })`. The plan's task on step 4 must include this exact line; the test for the listing-suspended-mid-checkout case will fail without it.

**Warning signs:** Test case "seller suspended mid-checkout" still passes (it predates this hook), but new test "listing suspended mid-checkout" returns 404 not 409.

### Pitfall 2: Hide hook clobbers caller's `status` filter when admin queries by status

**What goes wrong:** Phase 10's admin "Deleted listings" panel calls `Car.find({ status: 'deleted' }).setOptions({ includeAllListingStatuses: true })`. The bypass works — but if someone forgets the bypass and calls `Car.find({ status: 'deleted' })` directly, a naive hide-hook implementation overwrites the caller's filter with `status: 'active'`, returning ZERO results silently.

**Why it happens:** Pattern 1's example shows the exact mitigation: detect existing `currentQuery.status` and combine via `$and`. The existing seller-cascade hook had this exact bug originally and fixed it (CR-01 fix at `Car.js:79-93`).

**How to avoid:** Use the `$and` combination pattern from the existing hook. The test "admin queries `status='deleted'` WITHOUT bypass returns empty (not the deleted listings)" should be part of LENF-01 coverage.

**Warning signs:** Admin sees an empty Deleted-listings panel even after multiple successful Delete actions.

### Pitfall 3: `session.withTransaction` retries call `refundAndThrow` twice → double refund

**What goes wrong:** A transient MongoDB error inside the txn callback triggers `withTransaction` auto-retry. If `refundAndThrow` already issued a refund on attempt 1, attempt 2 issues a SECOND refund. The buyer gets charged once but refunded twice.

**Why it happens:** [CITED: https://mongoosejs.com/docs/transactions.html#withTransaction] — `withTransaction` retries on transient errors automatically.

**How to avoid:** Pass `idempotencyKey: \`refund-${paymentIntentId}\`` to `stripe.refunds.create`. Stripe deduplicates on the server side and returns the SAME refund object on the second call. The v1.0 inline `refundThenThrow` at `confirmBooking.js:40-56` does NOT use an idempotency key — this is a latent bug Phase 9 should fix while extracting the helper.

**Warning signs:** Stripe dashboard shows duplicate refunds for the same payment intent.

### Pitfall 4: Admin viewer of an `active` listing sees a `moderationBadge: undefined` JSON key

**What goes wrong:** D-07 says "badge omitted for `status === 'active'`". If you do `res.json({ ...car, moderationBadge })` with `moderationBadge = undefined`, JavaScript `JSON.stringify` drops the key — fine. But if you do `res.json({ ...car, moderationBadge: { status: car.status, ... } })` unconditionally, the badge always appears.

**How to avoid:** Use conditional spread: `...(car.status !== 'active' ? { moderationBadge: {...} } : {})`. The test "admin viewing an active listing sees no `moderationBadge` key" should assert `expect(body).not.toHaveProperty('moderationBadge')`.

### Pitfall 5: Thin payload leaks `imageUrls` array via spread

**What goes wrong:** Reflex pattern is `res.json({ ...thinFields, ...car })`. The spread of `car` then re-adds all the fields D-05 explicitly excludes.

**How to avoid:** Build the thin payload from named fields ONLY, never spread `car` into it. The test "non-admin response for suspended listing contains EXACTLY the D-05 allowlist" should `expect(Object.keys(body).sort())` against the locked list.

**Warning signs:** Phase 11 security review fails on PII leak; mobile-side code is reading `body.sellerEmail` and getting a value.

### Pitfall 6: `mongoose.isValidObjectId` not called before `Car.findById(req.params.id)`

**What goes wrong:** Malformed carId surfaces as Mongoose CastError → 500 instead of 404 (existing bug, see Phase 8 review CR-03/WR-05).

**How to avoid:** Guard at the top of the handler: `if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Car not found' });`. Apply to BOTH the modified `GET /api/cars/:id` (D-08) AND the modified `POST /api/payments/create-payment-intent` (D-09).

### Pitfall 7: `_skipModerationInterceptor` axios flag NOT set on mobile-side 409 handler

**What goes wrong:** The mobile axios interceptor at `src/services/http/client.ts:98-126` watches for 403 + `error: 'account_suspended'` and triggers `moderationRefreshListener`. A 409 listing_not_available is NOT a 403, so it's NOT intercepted — good. BUT: a future Phase 10 plan might add a SECOND interceptor that watches for 409s and recurses. The 409 handler MUST stay clean.

**How to avoid:** Phase 9 does NOT modify mobile code. Document in 09-VERIFICATION.md that the existing 403 interceptor was checked and does not affect 409 listing_not_available; Phase 10's mobile handler should handle 409 directly without invoking the moderation refresh listener.

### Pitfall 8: `firstPhotoUrl` computed from a populated S3 URL that was deleted at moderation time

**What goes wrong:** D-05 says "verbatim the same URL the buyer would have seen when the listing was active." If admin's Delete action ALSO deletes S3 objects, that URL 404s on CDN.

**How to avoid:** Phase 8 LADM-04 is SOFT-delete — S3 objects are NOT touched (verified by reading Phase 8 listingService.js:613-728 — no S3 calls). So `firstPhotoUrl` remains valid. Document this in 09-VERIFICATION.md so a future Phase that adds hard-delete knows the contract.

### Pitfall 9: Race — two simultaneous `confirmBooking` calls on the same listing both pass the in-txn read

**What goes wrong:** Two buyers fire `confirmBooking` in the same millisecond. Both transactions read `car.status === 'active'` under snapshot isolation. Both proceed to flip `car.listingStatus = 'booked'`. One write wins, the other's `withTransaction` may or may not detect the conflict.

**Why it happens:** MongoDB's default `readConcern: 'snapshot'` inside `withTransaction` provides snapshot isolation — both reads see the same pre-write state. The write conflict surfaces only at commit time, where one transaction's `WriteConflict` error triggers `withTransaction` retry. On retry, the second reader sees the now-`booked` listing and either succeeds or detects the conflict via the existing v1.0 logic.

**How to avoid:** This is the SAME race v1.0 already handles for buyer/provider/seller — verified by the existing test `confirmBooking.transaction.test.js` case 6 ("Concurrent admin.suspend + confirm (D-13 race)"). Phase 9's listing-status check rides on the same machinery. The plan should add ONE new test case to the existing file: "Concurrent admin.suspendListing + confirm — exactly one outcome (refund-abort OR booking-then-suspend), never both."

**Warning signs:** Test case fails with both transactions completing successfully.

### Pitfall 10: Forgetting to update `KNOWN_LISTING_ERRORS` or the route-level error mapping in `server.js`

**What goes wrong:** The new `ListingNotAvailableError` thrown from `confirmBooking.js` doesn't match `err instanceof ProviderSuspendedError` in `server.js:1061`. The fallthrough goes to `500 internal_error` instead of `409 listing_not_available`.

**How to avoid:** The plan's confirm-booking task MUST include "add `err instanceof ListingNotAvailableError` branch to server.js:1049-1082 BEFORE the ProviderSuspendedError branch." Test: "POST confirm-booking on suspended listing returns 409 listing_not_available with refundId."

## Code Examples

### Example 1: Mongoose `pre(/^find/)` hook with bypass flag (verified pattern)

```js
// Source: backend-services/carEx-services/src/models/Car.js:63-95 (existing seller-cascade hook).
// Phase 9 ADDS a sibling hook with the same shape for listing status.
carSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { sellerStatus: { $ne: 'APPROVED' } },
    ],
  });
  const currentQuery = this.getQuery();
  const existingClause = currentQuery.sellerId;
  const nextQuery = { ...currentQuery };
  if (existingClause === undefined) {
    nextQuery.sellerId = { $nin: hiddenUids };
  } else {
    delete nextQuery.sellerId;
    nextQuery.$and = [
      ...(currentQuery.$and || []),
      { sellerId: existingClause },
      { sellerId: { $nin: hiddenUids } },
    ];
  }
  this.setQuery(nextQuery);
});
```

### Example 2: `session.withTransaction()` shape (verified pattern)

```js
// Source: backend-services/carEx-services/src/payments/confirmBooking.js:124-286.
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // All read+write operations chain .session(session)
    // Refund call (if needed) lives INSIDE the callback but OUTSIDE the Mongo write path
    // Throwing inside the callback aborts the transaction
  });
} finally {
  await session.endSession();
}
```

### Example 3: Stripe refund with idempotency (Phase 9 enhancement)

```js
// Source: extends backend-services/carEx-services/src/payments/confirmBooking.js:43.
// [CITED: https://docs.stripe.com/api/refunds/create]
const refund = await stripe.refunds.create(
  { payment_intent: paymentIntentId },
  { idempotencyKey: `refund-${paymentIntentId}` }
);
```

### Example 4: `MongoMemoryReplSet` test fixture (existing, reuse verbatim)

```js
// Source: backend-services/carEx-services/__tests__/_helpers/mongoReplSet.js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });
```

### Example 5: Stripe mock for confirm-booking tests (existing, reuse verbatim)

```js
// Source: backend-services/carEx-services/__tests__/enforcement/confirmBooking.transaction.test.js:26-36
jest.mock('stripe', () => {
  const paymentIntentsRetrieveMock = jest.fn();
  const refundsCreateMock = jest.fn();
  const stripeFactory = () => ({
    paymentIntents: { retrieve: paymentIntentsRetrieveMock },
    refunds: { create: refundsCreateMock },
  });
  stripeFactory.__paymentIntentsRetrieveMock = paymentIntentsRetrieveMock;
  stripeFactory.__refundsCreateMock = refundsCreateMock;
  return stripeFactory;
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-handler `Car.find({ status: 'active' })` everywhere | `pre(/^find/)` hook with bypass flag | v1.0 Phase 3 (2026-04-17) — established the seller-cascade hook pattern | Phase 9 mirrors this shape for listing status; no per-handler filter sprinkling |
| `Car.deleteOne({ _id })` for moderation | Soft-delete via `status: 'deleted'` | v1.1 Phase 7 (LDATA-01) | Phase 9 reads the `status` field; never removes documents |
| Inline `refundThenThrow` at each call site in confirm-booking | Extracted shared helper used by 4 sites | v1.1 Phase 9 (this phase, D-14) | Three v1.0 sites refactor; one new site added |
| Stripe refund without idempotency key | `idempotencyKey: \`refund-${piId}\`` | v1.1 Phase 9 (recommended Phase 9 enhancement on top of D-14 helper extraction) | Closes the txn-retry double-refund window [CITED: https://docs.stripe.com/api/idempotent_requests] |
| 410 Gone on `POST /api/orders` | All order creation absorbed into `confirm-booking` txn | v1.0 Phase 3 (server.js:1092-1097) | Phase 9 only touches `confirm-booking`; the deprecated 410 stub remains as-is |

**Deprecated/outdated in Phase 9 context:**
- v1.0's inline `refundThenThrow` at `confirmBooking.js:40-56` — Phase 9 D-14 promotes this to a shared module. The inline function is removed once the new helper is in place.

## Assumptions Log

Every claim in this research is either VERIFIED (against the codebase, package.json, or CONTEXT.md) or CITED (to Mongoose / Stripe / MongoDB docs). The following items are tagged ASSUMED because they require user/planner confirmation:

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-07 admin badge field naming (`reasonCategory` vs `moderationReason`) — the schema uses `moderationReason` for the enum and `moderationNote` for free-text; CONTEXT D-07 lists `reasonCategory` AND `moderationReason` as separate badge fields. Likely means: `reasonCategory = car.moderationReason` (the enum), `moderationReason = car.moderationNote` (the free-text). Planner should confirm or rename. | §Pattern 2 | Wrong field shipped to mobile → admin sees `null` or wrong value in badge |
| A2 | Option A (split `requireAdmin` into a read-only sibling) is the right admin-detection mechanism for D-08, vs Option C (Firebase custom claims). Custom claims would be faster but require backfill that may not exist. | §Pattern 5 | If claims exist, Option A adds unneeded DB call per listing detail view |
| A3 | Phase 9 should add `idempotencyKey` to the existing 3 v1.0 refund call sites (not just the new one) as part of the helper extraction. The existing inline `refundThenThrow` does NOT use one. Adding it touches v1.0 production code. | §Pitfall 3, §Code Example 3 | Existing latent double-refund window stays open if not fixed; but adding it is a behavior change v1.0 didn't ship |
| A4 | `GET /api/cars` browse and the (non-existent) `GET /api/cars/search` / `GET /api/cars/related` endpoints — research found ONLY `GET /api/cars` and `GET /api/cars/:id` exist; the CONTEXT and REQUIREMENTS mention "browse, search, related-listings" but there are no separate routes. The hide hook auto-applies to whatever future `Car.find` calls exist. | §System Architecture Diagram | If Phase 10/11 adds search/related endpoints, the hide hook covers them automatically — but the LENF-01 success criteria test must use the routes that DO exist |
| A5 | The mobile axios 403 interceptor does NOT need modification for 409 `listing_not_available` because the interceptor matches on status 403 + `error: 'account_suspended'`. Status 409 with `error: 'listing_not_available'` does not match. Confirmed by reading `client.ts:98-126`. | §Pitfall 7 | If a future interceptor adds 409 handling, the test "409 listing_not_available bypasses moderation refresh listener" is needed |
| A6 | `firstPhotoUrl` (D-05) — S3 URLs remain valid for soft-deleted listings because LADM-04 does NOT touch S3. Verified by reading `listingService.js:611-728` — no S3 calls. Future hard-delete (out of scope) would invalidate this assumption. | §Pitfall 8 | If a hard-delete is added later without revisiting this contract, mobile shows broken images |

**If this table is empty:** N/A — six items above.

## Open Questions

1. **D-07 badge field names — `reasonCategory` vs `moderationReason` vs `moderationNote`**
   - What we know: Car schema has `moderationReason` (enum) + `moderationNote` (free text); CONTEXT D-05 thin payload uses `reasonCategory` (= `car.moderationReason`); CONTEXT D-07 admin badge lists BOTH `reasonCategory` AND `moderationReason` as fields.
   - What's unclear: Does D-07's `moderationReason` mean the free-text note (`car.moderationNote`), or the enum (`car.moderationReason`)? The latter would be a duplicate of `reasonCategory`.
   - Recommendation: Planner should ask user OR document the mapping in the PLAN.md as a discoverable decision — likely `reasonCategory = car.moderationReason` (enum), `moderationReason = car.moderationNote` (free-text note shown to admin only).

2. **Idempotency key on existing v1.0 refund call sites**
   - What we know: v1.0 `refundThenThrow` does NOT use an idempotency key; `withTransaction` auto-retries on transient errors; Stripe accepts idempotency keys.
   - What's unclear: Is adding the key to the 3 existing call sites (as part of the D-14 extraction) within Phase 9 scope, or a separate hardening PR?
   - Recommendation: Include in Phase 9 since the helper refactor touches the same code; document in 09-VERIFICATION.md as a "while we were here" hardening.

3. **WR-03 (ServiceOrder pause-not-cancel) deferral**
   - What we know: CLAUDE.md says in-flight orders touching a suspended listing should pause; Phase 8 review WR-03 deferred this; CONTEXT §deferred reaffirms Phase 9 does NOT implement it.
   - What's unclear: Where does this work land? Phase 9.5? Phase 11? A separate sub-phase?
   - Recommendation: Plan-checker should ensure 09-VERIFICATION.md explicitly notes the gap so it doesn't get lost. The phase 11 LIST-SECURITY.md security review will likely flag it.

4. **Admin detection performance on listing-detail GET**
   - What we know: CONTEXT anti-pattern forbids DB lookup in the hot path; Option A adds one `AdminUser.findOne({ email }).lean()` per GET.
   - What's unclear: Is the AdminUser collection small enough that one indexed lookup is acceptable? (Estimate: <100 admins, email-indexed → <1ms.)
   - Recommendation: Accept the lookup for Phase 9; flag in 09-VERIFICATION.md so Phase 11 perf review can measure. Custom claims migration is its own project.

## Environment Availability

The phase ships backend code only. External-dependency probes are run-time checks against the carEx-services backend environment, not the mobile dev machine. Listing here for completeness:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 20 | Backend runtime | (verify on Railway prod) | varies | — |
| MongoDB Atlas (replica set) | `session.withTransaction` | YES (Railway prod-bound) | (Mongo 5+) | mongodb-memory-server replica set for tests |
| Stripe SDK (`stripe@^20.4.1`) | Refund + payment-intent calls | YES [VERIFIED: backend package.json] | 20.4.1 | None (Stripe is the contract) |
| Mongoose (`mongoose@^9.1.5`) | Query middleware + transactions | YES [VERIFIED: backend package.json] | 9.1.5 | None |
| `mongodb-memory-server@^10.4.3` | Test transaction harness | YES [VERIFIED: backend package.json devDeps] | 10.4.3 | None |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | jest 29.7.0 [VERIFIED: backend-services/carEx-services/package.json] |
| Config file | `package.json` jest block (testEnvironment: node, testMatch: `**/__tests__/**/*.test.js`, testTimeout: 30000) |
| Quick run command | `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ -x` |
| Full suite command | `cd ../backend-services/carEx-services && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LENF-01 | Hide hook filters non-active listings from `Car.find` by default | integration (MongoMemoryReplSet + Mongoose) | `npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js -x` | Wave 0 (new file) |
| LENF-01 | `setOptions({ includeAllListingStatuses: true })` returns all four statuses | integration | (same file as above) | Wave 0 |
| LENF-01 | Admin querying `Car.find({ status: 'deleted' }).setOptions(includeAllListingStatuses: true)` returns deleted listings (combined-filter $and shape works) | integration | (same file) | Wave 0 |
| LENF-01 | `GET /api/cars` returns zero non-active listings (route-level check via supertest) | integration (HTTP) | `npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js -x` | Wave 0 |
| LENF-02 | Non-admin GET `/api/cars/:id` on suspended listing returns 200 + thin payload with EXACTLY the D-05 allowlist of fields | integration (HTTP via supertest) | `npx jest __tests__/listing-enforcement/listingDetailStatusAware.test.js -x` | Wave 0 (new file) |
| LENF-02 | Non-admin GET on suspended listing has NO sellerEmail, NO moderationNote, NO description (assert NOT toHaveProperty for each) | integration | (same file) | Wave 0 |
| LENF-02 | Admin GET on suspended listing returns full document + `moderationBadge` with all 5 D-07 fields | integration | (same file) | Wave 0 |
| LENF-02 | Admin GET on active listing returns full document WITHOUT `moderationBadge` key (D-07 hide-when-active) | integration | (same file) | Wave 0 |
| LENF-02 | GET on non-existent carId returns 404 (not 200 + thin payload — preserve existing semantics) | integration | (same file) | Wave 0 |
| LENF-02 | GET on malformed carId returns 404 (not 500 CastError) | integration | (same file) | Wave 0 |
| LENF-03 (cart-add) | POST `/api/payments/create-payment-intent` with carId of a `suspended` listing returns 409 + D-11 body shape with `listingStatus` + `reasonCategory` + `banner` | integration (HTTP + Stripe mock) | `npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js -x` | Wave 0 (new file) |
| LENF-03 (cart-add) | `stripe.paymentIntents.create` is NOT called when carId is suspended (assert mock not invoked) | integration | (same file) | Wave 0 |
| LENF-03 (cart-add) | POST create-payment-intent with carId of an `active` listing proceeds normally + returns `clientSecret` | integration | (same file) | Wave 0 |
| LENF-03 (cart-add) | All three non-active statuses (suspended/archived/deleted) all return 409 with the correct banner block | integration | (same file) | Wave 0 |
| LENF-03 (confirm-booking) | Listing flipped to `suspended` between create-payment-intent and confirm-booking: confirm-booking returns 409 + D-11 body shape with `refundId` set, no orders created, car NOT flipped to `booked` | integration (txn) | `npx jest __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js -x` | Wave 0 (new file) |
| LENF-03 (confirm-booking) | Stripe refund is called BEFORE the throw (assert mock call ordering via jest fn.mock.invocationCallOrder) | integration | (same file) | Wave 0 |
| LENF-03 (confirm-booking) | Refund failure: `stripe.refunds.create` throws → response body has `refundFailed: true`, `refundId: null` | integration | (same file) | Wave 0 |
| LENF-03 (confirm-booking) | `withTransaction` retry does NOT issue a second refund (assert `idempotencyKey` argument was passed) | integration | (same file) | Wave 0 |
| LENF-03 (regression) | All existing v1.0 `confirmBooking.transaction.test.js` cases (1-7) still pass after helper extraction | integration | `npx jest __tests__/enforcement/confirmBooking.transaction.test.js` | Existing |
| LENF-03 (D-14 helper) | `refundAndThrow` calls `stripe.refunds.create` then throws; throws preserve `errorBody.error`, attach `refundId` + `refundFailed` | unit | `npx jest __tests__/listing-enforcement/refundAndThrow.helper.test.js -x` | Wave 0 (new file) |
| LENF-03 (race) | Concurrent admin.suspendListing + buyer confirm-booking — exactly one outcome (refund-abort OR booking-then-suspend), never both succeed | integration (txn race) | `npx jest __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js -x` | Wave 0 (new file) |
| LENF-03 (route) | `server.js` confirm-booking handler maps `ListingNotAvailableError` to `409 listing_not_available` with the D-11 body | integration (HTTP) | `npx jest __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js -x` | Wave 0 (new file) |

### Sampling Rate

- **Per task commit:** `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ -x` (quick: ~3-5s)
- **Per wave merge:** `cd ../backend-services/carEx-services && npx jest __tests__/listing-enforcement/ __tests__/enforcement/ __tests__/listing-moderation/` (medium: ~10-15s; covers regression on Phase 3 + Phase 8 alongside Phase 9)
- **Phase gate:** `cd ../backend-services/carEx-services && npm test` (full suite green before `/gsd-verify-work`)

### Wave 0 Gaps

- [ ] `__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` — covers LENF-01 (4 cases above)
- [ ] `__tests__/listing-enforcement/listingDetailStatusAware.test.js` — covers LENF-02 (6 cases)
- [ ] `__tests__/listing-enforcement/createPaymentIntent.gate.test.js` — covers LENF-03 cart-add half (4 cases)
- [ ] `__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` — covers LENF-03 confirm-booking half (4 cases + race + route)
- [ ] `__tests__/listing-enforcement/refundAndThrow.helper.test.js` — unit tests for the extracted helper
- [ ] Framework install: NONE — jest, mongodb-memory-server, supertest all installed [VERIFIED]
- [ ] Test fixture: REUSE `__tests__/_helpers/mongoReplSet.js` [VERIFIED: exists]

The planner may alternatively place these in `__tests__/enforcement/` next to the existing `confirmBooking.transaction.test.js` (Claude's Discretion per CONTEXT). The directory name is non-load-bearing; the contents are.

## Security Domain

`security_enforcement` is not explicitly disabled in `.planning/config.json` — applying defaults. The CodeOwners-equivalent for security in this project is the Phase 11 LQUAL-03 `LIST-SECURITY.md` review, which will revisit every Phase 9 code path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | Existing `verifyIdToken` (admin path) + `attachAuthIfPresent` (listing-detail GET). No changes — reuse [VERIFIED: backend-services/carEx-services/src/security/] |
| V3 Session Management | partial | Firebase ID tokens (existing). Phase 9 does not handle sessions directly. |
| V4 Access Control | YES | Admin bypass on hide hook + admin-only badge on listing-detail GET both enforce server-side (CLAUDE.md mandate "never trust mobile-side isAdmin") |
| V5 Input Validation | YES | `mongoose.isValidObjectId(req.params.id)` guard on every modified route; zod schemas for body if needed (none of Phase 9's modified routes accept new body fields — pre-existing zod cover suffices) |
| V6 Cryptography | NO | No new crypto. Existing Stripe HMAC via SDK; existing Firebase token verification via SDK |
| V7 Error Handling | YES | New error codes (`listing_not_available`, possibly `ListingNotAvailableError` class) added to known set; unknown errors surface as 500 with generic message (do not leak Mongoose CastError text) |
| V8 Data Protection | YES | Thin payload (D-05) is the PII-minimization control. Allowlist-only fields; spread of full `car` doc forbidden in non-admin branch |
| V11 Business Logic | YES | TOCTOU re-verification is THE control here — listing status can change between cart-add and confirm-booking; the transactional re-check is the defense |
| V12 Files & Resources | partial | `firstPhotoUrl` exposed in thin payload — already a public URL when listing was active, no escalation |

### Known Threat Patterns for Node/Express + Mongoose + Stripe

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale listing-status read between cart-add and pay | T (Tampering with time-of-check) | Transactional re-verify under snapshot isolation (LENF-03) |
| Double refund on transaction retry | R (Repudiation) | Stripe `idempotencyKey` parameter ([CITED: docs.stripe.com/api/idempotent_requests]) |
| Charged-no-order, no-refund on Stripe outage during refund | T+I (Tampering + Information disclosure of charge state) | Refund-first-throw-second invariant (D-11) + `refundFailed: true` in body for ops reconciliation |
| Buyer enumerates seller PII via listing-detail GET on suspended listing | I (Information disclosure) | Thin payload allowlist (D-05) — assertion: `expect(body).not.toHaveProperty('sellerEmail')` |
| Admin enumerates restricted state without bypass flag | I + E (Elevation of privilege) | Bypass is per-call, grep-visible — Phase 11 review verifies no global default |
| Bypass-flag injection via query string into admin endpoint | E (Elevation of privilege) | `req.user.isAdmin` derived server-side from AdminUser DB lookup, NOT client-supplied |
| Mongoose CastError on malformed carId leaks internals | I | `mongoose.isValidObjectId` guard at handler top → 404 not 500 (Phase 8 review WR-05 fix pattern) |
| Hide hook causes admin Restore flow to fail silently (admin can't see deleted listings to restore) | D (DoS via misconfiguration) | D-02 explicitly: admin sees all four statuses via single bypass flag |
| 409 listing_not_available triggers mobile moderation refresh interceptor → unintended logout cascade | D (DoS) | Mobile interceptor matches on 403 + account_suspended only [VERIFIED: client.ts:98-126]; 409 is untouched |

## Sources

### Primary (HIGH confidence)

- [VERIFIED: backend-services/carEx-services/src/models/Car.js] — existing schema + seller-cascade hook pattern (the exact shape Phase 9 mirrors)
- [VERIFIED: backend-services/carEx-services/src/payments/confirmBooking.js] — existing 6-step transaction + `refundThenThrow` (the function Phase 9 promotes to a shared module)
- [VERIFIED: backend-services/carEx-services/src/moderation/listingCapabilities.js] — `LISTING_STATUS_POLICY` capability map with `banner` block (consumed by D-05 thin payload + D-11 409 body)
- [VERIFIED: backend-services/carEx-services/src/security/requireAdmin.js + attachAuthIfPresent.js + verifyIdToken.js] — existing auth middleware to extend / split
- [VERIFIED: backend-services/carEx-services/src/moderation/listingService.js] — Phase 8 transaction patterns + `setOptions({ includeAllListingStatuses: true, includeAllUsers: true })` chaining
- [VERIFIED: backend-services/carEx-services/server.js:293-356, 1018-1097] — existing GET /api/cars, GET /api/cars/:id, POST create-payment-intent, POST confirm-booking handlers
- [VERIFIED: backend-services/carEx-services/__tests__/_helpers/mongoReplSet.js] — proven test fixture
- [VERIFIED: backend-services/carEx-services/__tests__/enforcement/confirmBooking.transaction.test.js] — existing 7-case suite the regression task re-runs
- [VERIFIED: backend-services/carEx-services/package.json] — dependency versions
- [VERIFIED: .planning/phases/09-backend-read-time-toctou-enforcement/09-CONTEXT.md] — all D-01..D-15 user decisions
- [VERIFIED: .planning/phases/08-admin-listing-moderation-endpoints-backend/08-REVIEW.md] — Phase 8 WR-03 deferral, WR-02 TOCTOU pattern reference

### Secondary (MEDIUM confidence — official docs)

- [CITED: https://mongoosejs.com/docs/middleware.html#query-middleware] — `pre(/^find/)` regex matches `find`, `findOne`, `findOneAndUpdate`, `findOneAndDelete`
- [CITED: https://mongoosejs.com/docs/transactions.html#withTransaction] — auto-retry on transient transaction errors
- [CITED: https://docs.stripe.com/api/refunds/create] — refund call signature, request body shape
- [CITED: https://docs.stripe.com/api/idempotent_requests] — `idempotencyKey` parameter semantics (safe-retry contract)

### Tertiary (LOW confidence) — N/A

No tertiary sources used. All claims either codebase-verified or backed by official Mongoose/Stripe documentation.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dependency verified in `backend-services/carEx-services/package.json`
- Architecture: HIGH — the three patterns are direct mirrors of v1.0 Phase 3 patterns already in production; the hide hook is a paste of an existing function in `Car.js`
- Pitfalls: HIGH on 1-6, 9 (verified against existing code); MEDIUM on 7-8 (depend on mobile-side interceptor assumptions and S3 lifecycle, both verified by reading source but not exercised in tests yet)
- Validation Architecture: HIGH — test infrastructure (jest, MongoMemoryReplSet, supertest, Stripe mock pattern) all proven in existing tests

**Research date:** 2026-05-28
**Valid until:** 2026-06-27 (30 days — stable codebase, no fast-moving external dependencies)

---

*Phase: 09-backend-read-time-toctou-enforcement*
*Research completed: 2026-05-28*
