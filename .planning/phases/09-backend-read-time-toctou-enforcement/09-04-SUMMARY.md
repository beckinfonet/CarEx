---
phase: 09-backend-read-time-toctou-enforcement
plan: 04
subsystem: payments
tags: [stripe, mongoose, listing-status, toctou-mitigation, error-mapping, jest, supertest, gate]

# Dependency graph
requires:
  - phase: 07-listing-moderation-schema-data-foundation
    provides: LISTING_STATUS_POLICY[status].banner block (D-14) consumed by the gate body for the D-11 409 response
  - phase: 09-plan-01
    provides: src/payments/refundAndThrow.js — CANONICAL source for ListingNotAvailableError (W-7); createPaymentIntent.gate.test.js Wave 0 RED scaffold with 4 test.todo entries (this plan turns them GREEN + adds 1 hardening case → 5 source cases / 7 actual executions via test.each)
  - phase: 09-plan-02
    provides: Car.js pre(/^find/) listing-status hide hook — the gate MUST chain setOptions({ includeAllListingStatuses: true }) to read non-active listings (Pitfall 1 variant mitigation)
  - phase: 09-plan-03
    provides: server.js scope ownership of `require('./src/security/lookupAdminIfPresent')` (line 20) and `require('./src/moderation/listingCapabilities')` (line 23) — B-5 fail-fast pre-flight requirement; Plan 04 verifies both are present BEFORE landing its mutations and consumes LISTING_STATUS_POLICY for the gate's banner lookup
provides:
  - early 409 listing_not_available gate at the top of POST /api/payments/create-payment-intent — fires BEFORE any Stripe API call for non-active listings (D-09)
  - createPaymentIntentHandler named export from server.js — W-6 pattern so the LENF-03 test mounts the production function directly
  - `if (err instanceof ListingNotAvailableError)` branch wired into the confirm-booking error-mapping ABOVE the existing ProviderSuspendedError branch (Pitfall 10 — sibling order) — DORMANT until Plan 09-05 lands the in-transaction throw, but the route layer is ready
  - ListingNotAvailableError require at server.js scope sourced from the CANONICAL `./src/payments/refundAndThrow` (W-7) — class identity preserved across server.js + Plan 05's confirmBooking.js throw site
  - GREEN createPaymentIntent.gate.test.js — 5 source cases / 7 actual test executions (test.each expands case (d) across suspended/archived/deleted) covering LENF-03 cart-add half
  - ROADMAP Criterion #3 cart-add half satisfied
affects:
  - phase 09-plan-05 (confirmBooking step 4 will throw ListingNotAvailableError from inside the transaction — the route-layer mapping is already live, Plan 05 only needs the in-txn assertion + its scaffold's GREEN transition)
  - mobile app (any client that sends a stale cart through POST /api/payments/create-payment-intent now receives 409 listing_not_available — future mobile work will need to handle this response code; out of Phase 9 scope)
  - phase 11 LIST-SECURITY (W-4 null-Car fall-through forward-pointer; T-09-04-06 disposition)

# Tech tracking
tech-stack:
  added: []  # no new deps
  patterns:
    - "early-gate-before-Stripe-call: bypass-flag-chained Car.findById with narrow projection runs BEFORE any external API call so a failure short-circuits without a side effect (D-09 / Pattern 3)"
    - "named-export handler (W-6): inline async route handler extracted to top-level named async function + appended to module.exports so tests mount the production function directly (mirrors getCarDetailHandler in Plan 03)"
    - "sibling-class-order in instanceof catch-chain (Pitfall 10): ListingNotAvailableError and ProviderSuspendedError are SIBLINGS not parent/child, so each needs its own arm; canonical order locks the LENF arm first so a future subclass refactor still routes correctly"
    - "canonical require for shared error class (W-7): require error class from its DEFINING module, never via a re-export — preserves JS class identity for instanceof across the require graph"
    - "stub orthogonal middleware in tests: requireNotSuspended is omitted from the test mount because it checks the buyer's user.moderationStatus which is orthogonal to the listing-status branch under test (PATTERNS §9)"

key-files:
  created: []
  modified:
    - ../backend-services/carEx-services/server.js  # +49/-3 lines: new ListingNotAvailableError require (W-7 canonical); createPaymentIntentHandler extracted from inline route body + early 409 gate inserted between buyerUid guard and amount calc; ListingNotAvailableError error-mapping branch inserted ABOVE ProviderSuspendedError; module.exports gains createPaymentIntentHandler
    - ../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js  # 4 test.todo → 5 source GREEN cases / 7 actual executions; +151/-29 lines

key-decisions:
  - "B-5 pre-flight passed: `grep -c \"require.*moderation/listingCapabilities\" server.js` returned 1 AND `grep -c \"require.*security/lookupAdminIfPresent\" server.js` returned 1 BEFORE landing gate code. Both require lines are owned by Plan 03 (server.js lines 20 + 23). Plan 04 consumes LISTING_STATUS_POLICY for the gate's banner field; does NOT add duplicate requires."
  - "W-7 canonical-require disposition: ListingNotAvailableError imported from `./src/payments/refundAndThrow` (NOT via a confirmBooking re-export chain). `grep -c \"ListingNotAvailableError.*require.*payments/confirmBooking\\|confirmBooking.*ListingNotAvailableError\" server.js` returns 0 — there is no re-export usage. Plan 05 MUST follow the same rule (confirmBooking.js imports from `./refundAndThrow`, its neighbor module) so both server.js's instanceof and confirmBooking.js's `throw new` reference the same canonical class object."
  - "W-4 null-Car disposition (T-09-04-06): the gate's `if (car && car.status !== 'active')` falls through to Stripe when `Car.findById` returns null (genuine non-existent carId). v1.0 contract preserved — Stripe accepts the intent (Stripe doesn't validate carId), confirm-booking's existing `car_not_found` 404 catches it downstream before any orders are written. Refund of the Stripe charge in this null-car scenario is NOT automatic in v1.0. Forward-pointer to Phase 11 LIST-SECURITY review for hardening (gate null-Car at the create-payment-intent layer); Phase 9 preserves v1.0 contract. The verification document MUST record this for the Phase 11 hardening pass."
  - "W-6 named-export pattern: created `createPaymentIntentHandler` as a top-level async function and exported it from `module.exports = { app, getCarDetailHandler, createPaymentIntentHandler };` so the LENF-03 test mounts the production handler directly. Mirrors Plan 03's getCarDetailHandler extraction. Production/test divergence impossible by construction. The route mount becomes a single-line `app.post('/api/payments/create-payment-intent', attachAuthIfPresent, requireNotSuspended('create_order'), createPaymentIntentHandler);` — same middleware chain, same handler."
  - "Pitfall 10 sibling ordering: new `if (err instanceof ListingNotAvailableError)` branch placed IMMEDIATELY ABOVE `if (err instanceof ProviderSuspendedError)` in the confirm-booking catch. Both classes are direct subclasses of Error (sibling, not parent/child) so order is purely for human-review clarity, but the plan called for the LENF arm to land first as the documented invariant. `awk '/err instanceof (ListingNotAvailableError|ProviderSuspendedError)/' server.js | head -2` confirms the order."
  - "Test harness stubs `requireNotSuspended('create_order')`: the production middleware checks the buyer's user.moderationStatus.state which is orthogonal to LENF-03's listing-status branch. Stubbing it out of the test mount keeps the harness decoupled from the buyer's moderation state and isolates the gate's behaviour as the target under test (PATTERNS §9 advice)."

patterns-established:
  - "Pattern: gate-before-external-call. When a server-authoritative re-check is added near an outbound call to a third-party API (Stripe in this case), insert the gate IMMEDIATELY before the API call so a failure short-circuits without triggering a side effect. Apply the bypass flag on the gate's Mongoose read so the read itself doesn't get hidden by orthogonal pre(/^find/) hooks (Pitfall 1 variant — covered by the existing Phase 9 D-04 stacked-orthogonal pattern)."
  - "Pattern: sibling-class instanceof ordering matters. When multiple error classes inherit directly from Error (no parent/child relationship), each needs its own `if (err instanceof X)` arm. Canonical ordering convention: most-specific to least-specific; in Phase 9, ListingNotAvailableError before ProviderSuspendedError documents the LENF arm as the new specific failure mode."

requirements-completed:
  - LENF-03  # cart-add half (Plan 04). Confirm-booking half lands in Plan 05; LENF-03 only fully complete after BOTH plans ship.
# NB: Marking LENF-03 here is partial — the requirement spans cart-add (this
# plan) + confirm-booking (Plan 05). Plan 05's SUMMARY will re-confirm.

# Metrics
duration: ~15 min
completed: 2026-05-29
---

# Phase 9 Plan 04: LENF-03 Cart-Add 409 Gate + Confirm-Booking Error-Mapping Branch Summary

**Inserted an early 409 `listing_not_available` gate at the top of `POST /api/payments/create-payment-intent` — non-active listings short-circuit BEFORE any Stripe API call, all three non-active statuses (suspended/archived/deleted) return the correct D-11 banner from `LISTING_STATUS_POLICY`, and `mongoose.isValidObjectId` guards malformed carIds with a 404. Also wired `ListingNotAvailableError` (imported from the canonical `./src/payments/refundAndThrow` per W-7, never via re-export) into the `confirm-booking` error-mapping handler ABOVE the existing `ProviderSuspendedError` branch (Pitfall 10 — sibling order). Branch is dormant until Plan 09-05 lands the in-transaction throw. 5 source cases / 7 actual executions GREEN in `createPaymentIntent.gate.test.js`; Plan 02 (4/4) + Plan 03 (7/7) + Phase 3 confirm-booking (7/7) regressions preserved; full `__tests__/listing-enforcement/` + `__tests__/listing-moderation/` 19 suites pass with 122 passed + 6 expected todos (Plan 09-05 scaffold).**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 (executed sequentially per the plan TDD ordering — server.js mutations first, then GREEN tests)
- **Files modified:** 2 (server.js +49/-3; createPaymentIntent.gate.test.js 4 todos → 5 source cases / 7 executions)
- **Commits:** 2 atomic backend commits on `carEx-services/main`

## Pre-flight Require Checks (B-5)

Per Plan 04's B-5 fail-fast requirement: BEFORE landing any mutation to `server.js`, the two Plan 03-owned requires were verified present:

```
$ cd ../backend-services/carEx-services
$ grep -c "require.*moderation/listingCapabilities" server.js
1
$ grep -c "require.*security/lookupAdminIfPresent" server.js
1
```

Both return ≥ 1 — pre-flight PASS. Plan 04 proceeded to add the gate code.

Exact source lines (from the verified file state):
- Line 20: `const { lookupAdminIfPresent } = require('./src/security/lookupAdminIfPresent');`
- Line 23: `const { LISTING_STATUS_POLICY } = require('./src/moderation/listingCapabilities');`

Both owned by Plan 03 — Plan 04 does NOT duplicate either require.

## Mutation Locations in server.js

After this plan's edits:

| Block | Lines (post-edit, approx) | Notes |
|-------|---------------------------|-------|
| New `ListingNotAvailableError` require (W-7 canonical source) | ~29 | `const { ListingNotAvailableError } = require('./src/payments/refundAndThrow');` immediately after the existing `ProviderSuspendedError` require — uses the canonical defining module, not a re-export |
| `createPaymentIntentHandler` named async function | ~1092-1141 | Extracted from former inline route body; gate block lives between the `buyerUid` 400 guard and the Stripe call |
| Phase 9 LENF-03 cart-add gate | ~1099-1114 | Anchored by `// Phase 9 LENF-03 cart-add gate (D-09)` comment (1 occurrence); `mongoose.isValidObjectId(carId)` guard → 404; `Car.findById(carId).setOptions({ includeAllListingStatuses: true }).select('status moderationReason').lean()` → 409 with D-11 body when `car.status !== 'active'` |
| Route mount (single line) | ~1144 | `app.post('/api/payments/create-payment-intent', attachAuthIfPresent, requireNotSuspended('create_order'), createPaymentIntentHandler);` — same middleware chain as before, just the handler is named now |
| `ListingNotAvailableError` error-mapping branch | ~1155-1166 | Anchored by `// Phase 9 LENF-03 — ListingNotAvailableError branch (Pitfall 10 ...)` comment; placed IMMEDIATELY ABOVE the existing `if (err instanceof ProviderSuspendedError)` arm |
| `module.exports` | ~1336 | `module.exports = { app, getCarDetailHandler, createPaymentIntentHandler };` — gains the new named export so the LENF-03 test can mount the production handler directly |

## W-7 Canonical Require Path

The W-7 invariant: `ListingNotAvailableError` MUST be imported from `./src/payments/refundAndThrow` — the canonical defining module. NOT via `require('./src/payments/confirmBooking').ListingNotAvailableError` (re-export chain). Class identity in JavaScript depends on referential equality of the class object across the require graph; importing via re-export risks identity mismatch under Node's module cache when circular requires are present (and `confirmBooking.js` already has a `confirmBooking ↔ refundAndThrow` two-module relationship from Plan 01).

Acceptance evidence:

```
$ grep -E "require\(['\"]\./src/payments/refundAndThrow['\"]\)" server.js
const { ListingNotAvailableError } = require('./src/payments/refundAndThrow');

$ grep -c "ListingNotAvailableError.*require.*payments/confirmBooking\|confirmBooking.*ListingNotAvailableError" server.js
0
```

Zero hits on the re-export form — the require path is canonical.

**Plan 05 forward note:** When Plan 09-05 lands the in-transaction throw inside `src/payments/confirmBooking.js` step 4, it MUST import `ListingNotAvailableError` from `./refundAndThrow` (its own neighbor module), NOT from `./refundAndThrow` via a self-re-export. The two consumers (server.js + confirmBooking.js) then both resolve to the same canonical module path → the cached class object is identity-equal → `instanceof` works at the route layer. Plan 05's acceptance MUST grep-lock this require path.

## W-4 Null-Car Fall-Through Disposition (T-09-04-06)

The gate uses `if (car && car.status !== 'active')`. When `Car.findById(carId)` returns `null` after the bypass-flag read (i.e. the carId is a syntactically valid ObjectId but no doc exists in the DB — Phase 8 is soft-delete-only, so even `deleted` listings still have docs with `status: 'deleted'`), the gate FALLS THROUGH to the existing Stripe call. This is INTENTIONAL v1.0 contract preservation:

- Stripe accepts the intent (Stripe doesn't validate the carId in metadata)
- The buyer then hits POST `/api/payments/confirm-booking`, where the existing `car_not_found` 404 check fires before any orders are written
- Refund of the Stripe charge in this null-car path is NOT automatic in v1.0 — buyer would dispute via Stripe directly OR ops would refund manually

**Threat model entry T-09-04-06** records this disposition explicitly as `accept` AND attaches a forward-pointer to **Phase 11 LIST-SECURITY** for hardening review. The Phase 11 trade-off: changing the failure surface from `confirm-booking-404` to `create-payment-intent-404` affects existing client error handling, but eliminates the Stripe-charge-on-nonexistent-carId path. Phase 9 preserves v1.0 contract; Phase 11 owns the hardening decision.

**Forward pointer for 09-VERIFICATION.md:** the verification document MUST flag this as a known v1.0-inherited behaviour for the Phase 11 hardening pass. Phase 9 Plan 04 does NOT change the fall-through behaviour.

## A1 Banner Mapping Locked (B-1)

The gate sources the 409 body's `banner` field from `LISTING_STATUS_POLICY[car.status]?.banner ?? null`. This is the SAME capability map consumed by Plan 03's status-aware detail handler (LENF-02) for non-admin thin-payload viewers. Consistency across the two read paths is locked by single-source-of-truth import — any future banner-copy change in `listingCapabilities.js` flows through to BOTH the LENF-02 thin payload AND the LENF-03 409 body simultaneously.

The test case (d) `test.each(['suspended','archived','deleted'])` asserts `expect(res.body.banner).toEqual(LISTING_STATUS_POLICY[status].banner)` for each status — three separate executions, each comparing against the live capability map (NOT a hardcoded literal). Any future regression where the gate hardcodes a banner literal would trip this assertion immediately.

## Acceptance Grep Receipts (Task 1)

```
$ cd ../backend-services/carEx-services
$ node --check server.js && echo OK
OK
$ grep -c "listing_not_available" server.js
2   # 1 gate response + 1 error-mapping response (>=2 required)
$ grep -c "ListingNotAvailableError" server.js
4   # 1 require + 1 instanceof + 1 comment in the require docblock + 1 comment in the LENF arm
$ grep -c "err instanceof ListingNotAvailableError" server.js
1   # exactly one error-mapping branch (==1)
$ awk '/err instanceof (ListingNotAvailableError|ProviderSuspendedError)/' server.js | head -2
    if (err instanceof ListingNotAvailableError) {
    if (err instanceof ProviderSuspendedError) {
# ↑ LENF arm precedes Provider arm — Pitfall 10 order locked
$ grep -E "require\(['\"]\./src/payments/refundAndThrow['\"]\)" server.js
const { ListingNotAvailableError } = require('./src/payments/refundAndThrow');
# ↑ W-7 canonical require path
$ grep -A 12 "Phase 9 LENF-03 cart-add gate" server.js | grep -c "setOptions({ includeAllListingStatuses: true })"
1   # bypass flag (Pitfall 1 variant mitigation)
$ grep -A 12 "Phase 9 LENF-03 cart-add gate" server.js | grep -c "\\.select('status moderationReason')"
1   # narrow projection (T-09-04-03 mitigation)
$ grep -A 12 "Phase 9 LENF-03 cart-add gate" server.js | grep -c "mongoose.isValidObjectId(carId)"
1   # Pitfall 6 guard
$ grep -c "stripe.paymentIntents.create" server.js
1   # unchanged from baseline (Stripe call neither moved nor duplicated)
$ grep -c "requireNotSuspended('create_order')" server.js
2   # 2 existing routes still chain it (create-payment-intent + confirm-booking)
$ grep -c "lookupAdminIfPresent" server.js
3   # Plan 03 baseline preserved (require + mount on GET /api/cars/:id)
```

All Task 1 acceptance criteria PASS.

## Acceptance Grep Receipts (Task 2)

```
$ cd ../backend-services/carEx-services
$ npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js
PASS __tests__/listing-enforcement/createPaymentIntent.gate.test.js
  LENF-03 cart-add gate at POST /api/payments/create-payment-intent (Plan 09-04 contract)
    ✓ POST create-payment-intent with suspended carId returns 409 + D-11 body { error: listing_not_available, listingStatus, reasonCategory, banner } (398 ms)
    ✓ stripe.paymentIntents.create is NOT called when listing is non-active (expect(__paymentIntentsCreateMock).not.toHaveBeenCalled()) (9 ms)
    ✓ POST create-payment-intent with active carId proceeds and returns clientSecret (103 ms)
    ✓ non-active status "suspended" returns 409 with banner === LISTING_STATUS_POLICY[status].banner (77 ms)
    ✓ non-active status "archived" returns 409 with banner === LISTING_STATUS_POLICY[status].banner (7 ms)
    ✓ non-active status "deleted" returns 409 with banner === LISTING_STATUS_POLICY[status].banner (7 ms)
    ✓ malformed carId (e.g. "not-an-object-id") returns 404 not 500 CastError (Pitfall 6 / Shared Pattern S-5) (4 ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total

$ grep -c "LISTING_STATUS_POLICY" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
4   # 1 require + 3 banner-equality assertions (>=1 required)
$ grep -cE "test.each\(\[.*suspended|it.each\(\[.*suspended" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
1   # parameterized 3-status case
$ grep -c "not.toHaveBeenCalled" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
4   # cases (b)/(d)×3/(e) all assert no Stripe call on non-active or malformed
$ grep -cE "not-an-object-id|car_not_found.*404|toBe\(404\)" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
3   # malformed-id case (e) has 3 grep hits (>=2)
$ grep -c "jest.mock('stripe'" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
1   # Stripe mock factory mount
$ grep -c "Car.collection.insertOne" __tests__/listing-enforcement/createPaymentIntent.gate.test.js
2   # Shared Pattern S-9 direct seed (1 in seedCar helper + 1 in jest factory line — actually 2 distinct call sites would mean a duplicate, here it's just the seedCar helper, but grep counts the literal substring; the second match is in the docstring describing the pattern)
```

All Task 2 acceptance criteria PASS.

## Test Receipts

```
$ npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js
  ✓ 7 passed, 0 failed, 0 todo

$ npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js   # Plan 02 LENF-01 regression
  ✓ 4 passed, 0 failed, 0 todo

$ npx jest __tests__/listing-enforcement/listingDetailStatusAware.test.js   # Plan 03 LENF-02 regression
  ✓ 7 passed, 0 failed, 0 todo

$ npx jest __tests__/enforcement/confirmBooking.transaction.test.js          # Phase 3 confirm-booking regression
  ✓ 7 passed, 0 failed, 0 todo

$ npx jest __tests__/listing-enforcement/ __tests__/listing-moderation/      # full Phase 8/9 directory
Test Suites: 19 passed, 19 total
Tests:       6 todo, 122 passed, 128 total
# 6 todo = Plan 09-05's confirmBooking.listingTOCTOU.test.js scaffold (expected — Wave 0 RED entries that Plan 05 turns GREEN)
```

## Task Commits

Each task was committed atomically on the BACKEND repo (`carEx-services/main`):

1. **Task 1: LENF-03 cart-add 409 gate + ListingNotAvailableError error-mapping** — `e06de59` (feat)
   - server.js +49/-3; new W-7 canonical require; `createPaymentIntentHandler` extracted; gate block with bypass + narrow projection + isValidObjectId guard inserted between buyerUid check and Stripe call; LENF arm placed above ProviderSuspendedError arm; `createPaymentIntentHandler` added to `module.exports`
2. **Task 2: GREEN createPaymentIntent.gate.test.js — 5 source cases / 7 executions** — `009b250` (test)
   - createPaymentIntent.gate.test.js +151/-29; 4 test.todo → 5 source GREEN cases (cases a/b/c/d/e); test.each over (d) yields 3 executions × suspended/archived/deleted; banner equality locked against LISTING_STATUS_POLICY require; PRODUCTION createPaymentIntentHandler mounted via W-6 named export; Stripe mock factory (Shared Pattern S-7); Car.collection.insertOne seed (Shared Pattern S-9)

**Plan metadata commit (carEx repo):** committed alongside this SUMMARY.md.

## Files Created/Modified

### Modified (backend repo)

- `../backend-services/carEx-services/server.js`
  - **+1 require** for `ListingNotAvailableError` from canonical `./src/payments/refundAndThrow` (W-7) placed immediately after the existing `ProviderSuspendedError` re-export require (line ~29)
  - **Extracted** the inline `app.post('/api/payments/create-payment-intent', ..., async (req, res) => { ... })` body into a top-level `async function createPaymentIntentHandler(req, res) { ... }` (W-6 pattern)
  - **+1 gate block** between the `buyerUid` 400 guard and the `amount` calc, anchored by `// Phase 9 LENF-03 cart-add gate (D-09)` comment — uses `mongoose.isValidObjectId(carId)` for the 404 path and `Car.findById(carId).setOptions({ includeAllListingStatuses: true }).select('status moderationReason').lean()` for the 409 path
  - **+1 error-mapping arm** in the `confirm-booking` catch, placed IMMEDIATELY ABOVE the existing `if (err instanceof ProviderSuspendedError)` arm (Pitfall 10), anchored by `// Phase 9 LENF-03 — ListingNotAvailableError branch (Pitfall 10 ...)` comment
  - **module.exports** gains `createPaymentIntentHandler` key

- `../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js`
  - **4 `test.todo` entries → 5 source GREEN cases** (cases a/b/c/d/e); case (d) is parameterized via `test.each(['suspended','archived','deleted'])` yielding 3 executions, so the actual test count is 7
  - **Mounts the PRODUCTION** `createPaymentIntentHandler` from `server.js` (W-6)
  - **Stubs `requireNotSuspended`** out of the test chain (orthogonal to LENF-03's listing-status branch; PATTERNS §9)
  - **Seeds Car via `Car.collection.insertOne`** (Shared Pattern S-9) — bypasses both save validators AND the pre(/^find/) hide hook during seeding
  - **Seeds an active seller** via `User.create` (`sellerStatus: 'APPROVED'`, `moderationStatus.state: 'active'`) so the Phase 3 seller-cascade hide hook never short-circuits the gate's findById — only the new listing-status branch is exercised

## Decisions Made

See `key-decisions` in frontmatter above. Highlights:

- **B-5 pre-flight passed** before any mutation: both Plan-03-owned requires (`moderation/listingCapabilities`, `security/lookupAdminIfPresent`) present at exactly 1 occurrence each. Plan 04 consumes the LISTING_STATUS_POLICY symbol but does NOT add a duplicate require.
- **W-7 canonical require enforced**: `ListingNotAvailableError` imported from `./src/payments/refundAndThrow` (the defining module), not via a `./src/payments/confirmBooking` re-export. Plan 05 must follow the same rule when it lands the in-transaction throw.
- **W-4 null-Car disposition documented**: T-09-04-06 accept-with-forward-pointer-to-Phase-11. v1.0 contract preserved; the gate falls through to Stripe when `Car.findById` returns null.
- **W-6 named-export pattern**: `createPaymentIntentHandler` extracted to a top-level async function so the LENF-03 test mounts the production handler directly. Mirrors Plan 03's `getCarDetailHandler` extraction.
- **Pitfall 10 ordering locked**: LENF arm placed above ProviderSuspendedError arm; `awk '/err instanceof (ListingNotAvailableError|ProviderSuspendedError)/' server.js | head -2` confirms the order. Both classes are direct Error subclasses (sibling) so strict ordering is not load-bearing for correctness today, but matches the plan's documented invariant and protects against a future subclass refactor.

## Server.js Untouched-Surface Audit

The plan called for `requireNotSuspended` middleware, the Stripe-call body, the `confirmBooking.js` step 4 code, and the existing `lookupAdminIfPresent` mounts to remain unchanged.

Receipts:

| Untouched item | Grep | Result |
|----------------|------|--------|
| `requireNotSuspended('create_order')` on create-payment-intent + confirm-booking | `grep -c "requireNotSuspended('create_order')" server.js` | 2 (unchanged from baseline) |
| `stripe.paymentIntents.create` call (single occurrence) | `grep -c "stripe.paymentIntents.create" server.js` | 1 (neither moved nor duplicated) |
| `lookupAdminIfPresent` (require + mount on GET /api/cars/:id) | `grep -c "lookupAdminIfPresent" server.js` | 3 (Plan 03 baseline preserved) |
| `confirmBooking.js` step 4 (not in server.js — separate file) | `git diff --stat ../backend-services/carEx-services/src/payments/confirmBooking.js` | empty (untouched) |

## Forward Dependencies (Plan 09-05 consumes this plan)

| Consumer | How it depends on Plan 04 |
|----------|---------------------------|
| Plan 09-05 (`src/payments/confirmBooking.js` step 4 — 3rd in-txn listing-status assertion) | Plan 05 imports `ListingNotAvailableError` from `./refundAndThrow` (its neighbor module = the canonical source) and throws it via `refundAndThrow(stripe, paymentIntentId, { error: 'listing_not_available', listingStatus, reasonCategory, banner })`. The route-layer `instanceof ListingNotAvailableError` branch is already live in server.js (Plan 04), so Plan 05 only needs to land the in-txn assertion + flip its scaffold (`confirmBooking.listingTOCTOU.test.js`) GREEN. The `await refundAndThrow(` call-count invariant goes from 3 to 4 (B-3 closes at end of Plan 09-05). |

**Plan 05 acceptance MUST verify W-7:** `grep -cE "require\\(['\\\"]\\./refundAndThrow['\\\"]\\).*ListingNotAvailableError" ../backend-services/carEx-services/src/payments/confirmBooking.js` returns ≥ 1 AND `grep -c "require.*payments/confirmBooking.*ListingNotAvailableError" ../backend-services/carEx-services/src/payments/confirmBooking.js` returns 0 (the latter would be a self-re-export, an obvious bug).

## Deviations from Plan

### Auto-fixed Issues

None. The plan executed exactly as written — both mutations landed verbatim against the PATTERNS §3 / §4 templates, both acceptance grep gates passed on first run, and the test suite was GREEN on first execution (no RED → fix cycle needed because the gate code was already in place when the tests ran, per the TDD ordering specified by the plan: server.js edits before test fills).

### Noted Caveats (NOT source deviations)

**1. [Server-boot console.error during jest]** Same documented caveat as Plan 03 SUMMARY.md item #2. `server.js` calls `mongoose.connect(process.env.MONGODB_URI)` at module load. When the LENF-03 test file requires `server.js` to get the named `createPaymentIntentHandler` export, the connect attempt fires before the test's `beforeAll` can override the URI — producing benign `MongoDB connection error: MongoParseError: Invalid port (zero) with hostname` console output. The test then disconnects mongoose and reconnects to `MongoMemoryServer` in `beforeAll`, and all 7 executions pass. Output noise only, not a failure. Plan 04 inherits this caveat without changing the underlying connect-at-module-load behaviour (out of scope; would be a Phase 10 maintenance change).

### Auth Gates

None.

---

**Total deviations:** 0 source deviations + 1 inherited documented caveat (server-boot mongoose.connect noise — same as Plan 03).
**Impact on plan:** Zero functional deviations from the LENF-03 cart-add contract. All Task 1 + Task 2 acceptance criteria satisfied as written. ROADMAP Criterion #3 cart-add half delivered.

## Issues Encountered

None. The TDD ordering specified by Plan 04 (server.js mutations first because the test file requires the production handler via `createPaymentIntentHandler` named export → no compile error possible before the handler exists, but the test mount would fail without it) ran without iteration. The B-5 pre-flight, the W-7 canonical require, the Pitfall 10 sibling ordering, and the bypass-flag + narrow projection + isValidObjectId guard composition all landed on the first edit pass.

## User Setup Required

None — no external service configuration required. This plan ships backend handler + test changes only. No env vars, no migrations, no DB index changes.

## Self-Check

Per the execute-plan self_check protocol, verifying all claimed artifacts exist and commits are on the backend repo:

**Backend files (modified):**

```
$ test -f ../backend-services/carEx-services/server.js && echo FOUND
FOUND
$ test -f ../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js && echo FOUND
FOUND
```

**Backend commits (on `carEx-services/main`):**

```
$ git -C ../backend-services/carEx-services log --oneline -3
009b250 test(09-04): GREEN createPaymentIntent.gate.test.js — 7 LENF-03 cart-add cases
e06de59 feat(09-04): add LENF-03 cart-add 409 gate + ListingNotAvailableError error-mapping (LENF-03 part A)
784cab6 test(09-03): GREEN listingDetailStatusAware (LENF-02 — 7 cases)
```

Both `e06de59` and `009b250` present and reachable from `main`.

**Test execution (backend):**

```
$ npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js
  ✓ 7 passed, 0 failed, 0 todo

$ npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js
  ✓ 4 passed, 0 failed, 0 todo   # Plan 02 LENF-01 regression preserved

$ npx jest __tests__/listing-enforcement/listingDetailStatusAware.test.js
  ✓ 7 passed, 0 failed, 0 todo   # Plan 03 LENF-02 regression preserved

$ npx jest __tests__/enforcement/confirmBooking.transaction.test.js
  ✓ 7 passed, 0 failed, 0 todo   # Phase 3 confirm-booking regression preserved

$ npx jest __tests__/listing-enforcement/ __tests__/listing-moderation/
  ✓ 19 suites passed, 122 passed, 6 todo (expected — Plan 09-05 scaffold)
```

## Self-Check: PASSED

All claimed artifacts exist on disk; both claimed commits exist on the backend repo `main` branch; the LENF-03 cart-add jest suite is 7/7 GREEN; Plan 02 LENF-01 (4/4), Plan 03 LENF-02 (7/7), and Phase 3 confirm-booking (7/7) regressions preserved; full Phase 8/9 directory pass: 19 suites / 122 GREEN / 6 expected-todo (Plan 09-05 scaffold).

---
*Phase: 09-backend-read-time-toctou-enforcement*
*Plan: 04*
*Completed: 2026-05-29*
