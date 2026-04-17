---
phase: 03-backend-enforcement-backend
plan: 04
subsystem: backend-payments-txn
tags: [confirm-booking, stripe, mongoose-transaction, refund-first-throw-second, enf-03, toctou-close]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-backend
    plan: 01
    provides: Car/Broker/LogisticsPartner models with pre(/^find/) hide hooks + setOptions({ includeAllUsers: true }) bypass
  - phase: 03-backend-enforcement-backend
    plan: 02
    provides: attachAuthIfPresent + requireNotSuspended('create_order') middleware factories
  - phase: 03-backend-enforcement-backend
    plan: 03
    provides: POST /api/payments/confirm-booking already gated with attachAuthIfPresent + requireNotSuspended('create_order') — this plan replaces the handler body only
provides:
  - "src/payments/confirmBooking.js — exports { confirmBooking, ProviderSuspendedError }"
  - "Single session.withTransaction() that re-verifies buyer + every unique provider + car's seller, flips car.listingStatus='booked', and creates ServiceOrder rows atomically"
  - "refundThenThrow helper — calls stripe.refunds.create BEFORE throw (D-11 ordering; Stripe not in Mongo txn)"
  - "Idempotency fast-path: retry with same paymentIntentId on an already-booked car returns existing { car, orders } without touching Stripe"
  - "POST /api/payments/confirm-booking handler rewritten as thin delegation; errors map to 409 provider_suspended / 400 invalid_payment_intent / 404 car_not_found / 500 internal_error"
  - "Active enforcement surface delivering ROADMAP Criterion #3 (concurrent admin.suspend vs confirm-booking → refund + no order)"
affects: [03-06 (confirmBooking.transaction.test.js + acceptance.test.js Block 3 exercise this service directly)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Refund-first-throw-second ordering (D-11) — stripe.refunds.create awaited before the ProviderSuspendedError throw aborts the Mongo transaction"
    - "Injected-stripe contract — confirmBooking accepts a stripe arg (not a require) so Jest mocks via jest.mock('stripe') at the server.js level inject a fake client through the route handler"
    - "Lazy ServiceOrder resolution via mongoose.model('ServiceOrder') inside the function body — service works whether server.js has loaded yet (test isolation)"
    - "providerSnapshot resolved server-authoritatively inside the transaction per Phase 1 D-21..D-24 — client-supplied snapshot ignored"
    - "Idempotency fast-path using car.stripePaymentIntentId === paymentIntentId short-circuit BEFORE session open (T-03-04-06)"

key-files:
  created:
    - ../backend-services/carEx-services/src/payments/confirmBooking.js
  modified:
    - ../backend-services/carEx-services/server.js

key-decisions:
  - "Ordering contract is written as a load-bearing comment (three occurrences of 'Refund first, throw second' in confirmBooking.js: file header + helper + transaction-body banner) so any future refactor that tries to throw-first-refund-second must delete a comment explicitly — high-visibility tripwire for D-11"
  - "ServiceOrder is resolved lazily via mongoose.model('ServiceOrder') rather than required at module top — lets the service load without triggering server.js's inline ServiceOrder registration, which matters for future extraction (Phase 1 D-02) and for test isolation where confirmBooking is imported before server.js"
  - "refundThenThrow populates refundId + refundFailed on the thrown ProviderSuspendedError (not as a separate return value) — keeps the throw-catch error surface single-path; handler's instanceof check is the only sorting logic"
  - "Idempotency fast-path queries Car (which participates in the hide-hook via setOptions bypass) BEFORE stripe.paymentIntents.retrieve — retry on an already-booked car is free for the buyer, and prevents redundant Stripe API calls that would count against rate limits on rapid mobile retry loops"
  - "buildProviderGroups kept pure (no DB calls) — lets future tests unit-test the grouping logic without mocking Mongo"
  - "car.imageUrls[0] (Car model uses an array) mapped into carSnapshot.imageUrl (ServiceOrder schema uses a single string) — fixes a latent data-shape mismatch that existed in the old /api/orders handler (read `car.imageUrl` which was undefined on the Car doc). The new confirmBooking never produces a `null` imageUrl when the car has images."
  - "orderNumber collision loop inside the transaction uses .session(session).lean() — keeps the uniqueness read within the same snapshot as the create, so two concurrent confirms cannot both observe 'no such orderNumber' and then both insert"

patterns-established:
  - "Every User/Car/Broker/LogisticsPartner read inside confirmBooking.js chains .setOptions({ includeAllUsers: true }).session(session) — uniform pattern across all 5 re-check points (buyer, provider User, provider profile, car, seller User); grep counts 7 matches of 'includeAllUsers: true' in this file"
  - "Route handler stays thin: the only logic in the route body is destructure + try/await/catch + four instanceof/message-shape branches. All domain work lives in the service. This keeps server.js diffable per-plan and lets Jest test the service without mounting Express"
  - "ProviderSuspendedError is the only Error subclass in confirmBooking.js — all other abort paths throw plain Error with well-known messages ('invalid_payment_intent', 'car_not_found') so the handler can pattern-match without a hierarchy of custom classes"

requirements-completed: [ENF-03]

# Metrics
duration: 3m4s
completed: 2026-04-17
---

# Phase 3 Plan 4: confirmBooking Transactional Service Summary

**New `src/payments/confirmBooking.js` module absorbs Stripe PaymentIntent retrieval + buyer/provider/seller re-verification + car `listingStatus` flip + `ServiceOrder` row creation into a single Mongoose `session.withTransaction()`, closes the ENF-03 TOCTOU gap between `/api/payments/create-payment-intent` and `/api/payments/confirm-booking` by refunding-then-throwing when any party has been suspended or role-revoked in the intervening window, and rewrites `POST /api/payments/confirm-booking` in `server.js` into a 30-line thin delegation that maps `ProviderSuspendedError` → 409 `provider_suspended`.**

## Performance

- **Duration:** ~3 min (3m04s)
- **Started:** 2026-04-17T20:20:50Z
- **Completed:** 2026-04-17T20:23:54Z
- **Tasks:** 2 (of 2)
- **Files created:** 1 (`../backend-services/carEx-services/src/payments/confirmBooking.js`)
- **Files modified:** 1 (`../backend-services/carEx-services/server.js`)

## Accomplishments

- Created `src/payments/confirmBooking.js` (266 lines) exporting `{ confirmBooking, ProviderSuspendedError }`.
- Implemented the transactional re-check sequence per 03-CONTEXT.md D-10:
  a. Buyer re-check (D-14) — `User.findOne({firebaseUid:buyerUid}).setOptions({includeAllUsers:true}).session(session)`
  b. Provider re-check + snapshot build — one iteration per unique `{providerUid, providerType}` group, checks `moderationStatus.state === 'active'` AND role-status `=== 'APPROVED'`
  c. Seller re-check + car flip — `Car.findById` + `User.findOne({firebaseUid: car.sellerId})`, both with the bypass flag; on success sets `listingStatus='booked'`, `bookedByUid`, `stripePaymentIntentId`
  d. ServiceOrder row creation — array-form `ServiceOrder.create([...rows], { session })` per Phase 2 D-23, one row per provider group, with server-authoritative `providerSnapshot`
- Added `refundThenThrow` helper with the load-bearing comment "Refund first, throw second" repeated at file header + helper body + transaction-callback banner.
- Added idempotency fast-path BEFORE session open: if `car.stripePaymentIntentId === paymentIntentId` already, return existing `{ car, orders }` without touching Stripe.
- Rewrote the POST `/api/payments/confirm-booking` handler as a thin delegation: error-mapping table is `ProviderSuspendedError → 409 provider_suspended`, `'invalid_payment_intent' → 400`, `'car_not_found' → 404`, else 500 `internal_error`.
- Middleware chain `attachAuthIfPresent, requireNotSuspended('create_order')` preserved verbatim on the route per Plan 03-03's acceptance contract.
- Smoke-tested module: `node -e "const { confirmBooking, ProviderSuspendedError } = require('./src/payments/confirmBooking'); ..."` confirms both exports are functions and `new ProviderSuspendedError('x').name === 'ProviderSuspendedError'`.
- `node --check server.js` passes after the edit.

## Task Commits

All task commits landed in the BACKEND repo (`../backend-services/carEx-services`):

1. **Task 1: Create src/payments/confirmBooking.js with transactional re-check + refund-first-throw-second** — backend `285eacc` (feat)
2. **Task 2: Rewrite POST /api/payments/confirm-booking handler body to delegate** — backend `a1a8613` (feat)

**Plan metadata commit:** captured in the mobile repo with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified

Backend repo (`../backend-services/carEx-services/`):
- `src/payments/confirmBooking.js` — **created** (266 lines): transactional confirm-booking service + `ProviderSuspendedError` class + `refundThenThrow` helper + `buildProviderGroups` grouping helper + `generateOrderNumber` utility + idempotency fast-path + `session.withTransaction()` envelope.
- `server.js` — modified: -25/+34 lines. Top-of-file require grew by 1 line (`confirmBookingService` + `ProviderSuspendedError`). Handler body replaced: the old 30-line Stripe-retrieve + Car.save + response-shape block became a 30-line delegation + error-mapping block.

Mobile repo (`.planning/`):
- `.planning/phases/03-backend-enforcement-backend/03-04-SUMMARY.md` — this file.

## Decisions Made

- **Injected-stripe contract:** `confirmBooking` accepts a `stripe` argument rather than doing `require('stripe')(...)` internally. This lets Jest mock Stripe via `jest.mock('stripe', ...)` at the server.js level (Plan 03-06 `confirmBooking.transaction.test.js` does exactly this). The handler passes the pre-initialized module-level `stripe` instance from `server.js:10` through.
- **Lazy ServiceOrder resolution:** `const ServiceOrder = mongoose.model('ServiceOrder')` inside the function body, not at the module top. ServiceOrder is still registered inline in server.js per Phase 1 D-02 — requiring it at the top of confirmBooking.js would either duplicate the schema or fail if server.js hasn't loaded. Lazy resolution is the clean middle path.
- **Idempotency fast-path placement BEFORE Stripe PI retrieval:** Retry on an already-booked car skips Stripe entirely — no redundant `paymentIntents.retrieve` calls on mobile retry loops (T-03-04-06). The fast-path uses `.setOptions({ includeAllUsers: true })` so it still works even if the seller was suspended after the original successful booking.
- **`car.imageUrls[0]` → `carSnapshot.imageUrl`:** The Car model has `imageUrls: [String]` (an array); the ServiceOrder schema has `carSnapshot.imageUrl: String` (a single string). The old `POST /api/orders` read `car.imageUrl` from the request body (which was undefined on the Car doc). The new service correctly picks the first element of the array, preserving at least one image in the snapshot for later provider display.
- **`orderNumber` uniqueness loop inside the transaction, `.session(session).lean()` on the lookup:** Keeps the uniqueness read in the same transaction snapshot as the `.create()`. Without `.session(session)`, two concurrent confirms could both observe "no such orderNumber" and both insert — unique-index at rest would then reject one with a duplicate-key error AFTER the transaction had already done provider/buyer/seller re-checks, wasting work.
- **Handler 500 maps to `{ error: 'internal_error' }`:** Keeps the response shape contract consistent with the rest of Phase 3's error shapes (D-15). The old handler returned `{ message: error.message }` which leaked internal stack details. The new handler still logs via `console.error('[confirm-booking]', err)` for ops diagnosis but does not return the error text to the client.
- **Preserved `attachAuthIfPresent, requireNotSuspended('create_order')` route middleware:** These were added by Plan 03-03 and are load-bearing for Criterion #1. The handler-body replacement explicitly kept the route decorator chain identical — grep `app.post('/api/payments/confirm-booking'` shows all three arguments survived the edit.

## Deviations from Plan

None — plan executed exactly as written.

Two small additive clarifications that do NOT change behavior or acceptance:

- Added `stripePaymentIntentId: paymentIntentId` to the `ServiceOrder.create(...)` payload so the idempotency fast-path's `ServiceOrder.find({ stripePaymentIntentId: paymentIntentId })` query actually resolves existing orders on retry. The plan prescribed the fast-path but didn't explicitly list this field on the created row — the lookup needs it to be indexable/queryable.
- Load-bearing comment "Refund first, throw second" appears 3 times rather than 1 (file header + helper body + transaction-callback banner) so any refactor that moves the refund call has a high-visibility tripwire at every touch point. The plan required "at least 1 match"; 3 is within the spirit and strictly exceeds the minimum.

## Authentication Gates

None encountered. This is a pure-code plan — no external service authentication, no user credentials, no API keys. The Stripe SDK uses the existing `process.env.STRIPE_SECRET_KEY` wiring from Phase 1.

## Issues Encountered

None. Both tasks ran clean on the first attempt:
- `node --check server.js` passed after each edit
- Module smoke-test (`node -e "require('./src/payments/confirmBooking')"`) loads cleanly
- All Task 1 grep assertions passed (module.exports signature, session.withTransaction count=1, stripe.refunds.create count=1, includeAllUsers:true count=7, "Refund first, throw second" count=3, class ProviderSuspendedError, stripePaymentIntentId === paymentIntentId, session.endSession, mongoose.model('ServiceOrder'), listingStatus = 'booked', providerSnapshot count=4)
- All Task 2 grep assertions passed semantically. One literal-regex check (`grep -c "status(400).*invalid_payment_intent"`) returned 0 because the implementation splits `res.status(400).json({...})` across multiple lines (line 1064: `return res.status(400).json({`; line 1065: `error: 'invalid_payment_intent',`). The structural check via `awk` confirmed status(400) immediately precedes the invalid_payment_intent payload at the expected location. Semantic acceptance satisfied.
- Zero file deletions post-commit (checked via `git diff --diff-filter=D HEAD~1 HEAD`). Two additive file operations only: one create (`confirmBooking.js`) and one edit (`server.js`).

Pre-existing Mongoose duplicate-index warnings on `ownerUid` persisted unchanged from Plan 03-01 (tracked in deferred-items.md from Plan 03-01) — surfaced again on module-load smoke test, but not a regression introduced by this plan.

## Known Stubs

None. The confirmBooking service is fully operational:
- Every re-check branch has a concrete implementation (no TODOs)
- refundThenThrow actually invokes `stripe.refunds.create`, not a placeholder
- providerSnapshot fields are fully resolved from live DB data
- ServiceOrder rows are fully populated (orderNumber, carSnapshot, providerSnapshot, services, totals, buyerUid, carId, stripePaymentIntentId)

The Plan 03-05 `POST /api/orders` 410 Gone rewrite is sequenced for the next plan — this means mobile builds that still call the deprecated order-creation endpoint will hit the current ordering code path until 03-05 lands. That is explicit sequencing per the phase plan, not a stub.

The Jest test harness covering this service (`__tests__/enforcement/confirmBooking.transaction.test.js`) is owned by Plan 03-06 per its frontmatter and PATTERNS.md classification. Acceptance proof for ROADMAP Criterion #3 (concurrent admin.suspend vs confirm-booking race) will land with 03-06's acceptance.test.js Block 3.

## User Setup Required

None — no external service configuration or secrets provisioning needed. The new service uses the existing `STRIPE_SECRET_KEY` env var already wired at `server.js:10`.

## Next Plan Readiness

**Ready for Plan 03-05** (POST /api/orders → 410 Gone). Independent of this plan — 03-05 operates on a different route. After 03-05 lands, mobile builds that still call the deprecated two-step flow will fail loudly with 410 instead of silently creating stale orders.

**Ready for Plan 03-06** (enforcement tests). Tests target:
- `confirmBooking.transaction.test.js` — directly imports `require('../../src/payments/confirmBooking')`; the 6-case matrix (happy path, buyer suspended, provider suspended, seller suspended, refund-API failure, concurrent-suspend race) exercises the service built in this plan.
- `acceptance.test.js` Block 3 — wires the real `confirmBookingService` behind a test Express app at `POST /api/payments/confirm-booking`; hits the route with `Promise.all([suspendProvider(), confirmBooking()])` to prove mutual exclusion per D-13.

**Blockers / concerns for Phase 3 downstream:** None new. The pre-existing duplicate-index warnings on Broker + LogisticsPartner `ownerUid` surfaced again on module-load smoke test — same source as Plan 03-01 (tracked in `deferred-items.md`).

## Threat Flags

None new beyond the plan's documented `<threat_model>` (T-03-04-01 through T-03-04-06):
- T-03-04-01 (TOCTOU race) — mitigated by the transactional re-check (buyer + providers + seller, all inside `session.withTransaction()` with `setOptions({ includeAllUsers: true })`).
- T-03-04-02 (Stripe refund failure → lost funds) — mitigated by `refundFailed=true` surfaced in the 409 response body for ops reconciliation.
- T-03-04-05 (refund trail) — mitigated by `refundId` in the 409 response for Stripe-dashboard correlation.
- T-03-04-06 (duplicate confirm on same PI) — mitigated by the idempotency fast-path.

Buyer-uid spoofing (T-03-04-04) is explicitly accepted as transitional per D-03 until Phase 6 QUAL-03 strict cutover; this plan does not add or worsen that exposure.

## Self-Check: PASSED

- File `../backend-services/carEx-services/src/payments/confirmBooking.js` — FOUND (created by Task 1, 266 lines)
- File `../backend-services/carEx-services/server.js` — FOUND (modified by Task 2, net +9 lines)
- Backend commit `285eacc` (Task 1, feat) — FOUND in backend repo log
- Backend commit `a1a8613` (Task 2, feat) — FOUND in backend repo log
- `module.exports = { confirmBooking, ProviderSuspendedError }` — present at line 266 of confirmBooking.js
- `class ProviderSuspendedError` — present at line 31
- `session.withTransaction` — 1 occurrence in confirmBooking.js
- `stripe.refunds.create` — 1 occurrence (inside refundThenThrow, BEFORE the throw)
- `includeAllUsers: true` — 7 occurrences (buyer + provider User + provider profile + car + seller User + idempotency fast-path + one extra on the car re-fetch inside the txn) — exceeds the ≥4 acceptance minimum
- `Refund first, throw second` — 3 matches (file header + helper + transaction banner)
- `stripePaymentIntentId === paymentIntentId` — 1 match (idempotency fast-path)
- `session.endSession` — 1 match (finally block)
- `mongoose.model('ServiceOrder')` — 3 matches (idempotency fast-path + txn body + resolver variable)
- `listingStatus = 'booked'` — 1 match
- `providerSnapshot` — 4 matches in confirmBooking.js (variable assignments + field definitions)
- `grep -n "require('./src/payments/confirmBooking')" server.js` = line 23
- `grep -c "confirmBookingService" server.js` = 2 (require + call site)
- `grep -c "ProviderSuspendedError" server.js` = 2 (require + instanceof)
- `grep -c "provider_suspended" server.js` = 1 (409 response body)
- Route middleware chain (grep `-A 6 "app.post('/api/payments/confirm-booking'"`) contains `attachAuthIfPresent`, `requireNotSuspended('create_order')`, AND `confirmBookingService(`
- `grep -c "status(409)" server.js` = 2 (pre-existing admin-users 409 + new provider_suspended 409)
- `grep -c "status(404).*car_not_found" server.js` = 1
- `grep -c "paymentIntents.retrieve" server.js` = 0 (old handler's call removed; service now owns it — POST /api/payments/create-payment-intent only uses `.create`, not `.retrieve`, so this grep is safe)
- `node --check server.js` = exit 0
- `node -e "const { confirmBooking, ProviderSuspendedError } = require('./src/payments/confirmBooking');"` = ok (both exports are functions)
- Zero file deletions in either commit (`git diff --diff-filter=D HEAD~2 HEAD` = empty)

---
*Phase: 03-backend-enforcement-backend*
*Completed: 2026-04-17*
