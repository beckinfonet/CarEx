---
status: passed
phase: 09-backend-read-time-toctou-enforcement
verified: 2026-05-29T00:00:00Z
must_haves_total: 33
must_haves_passed: 33
must_haves_failed: 0
requirements_verified: [LENF-01, LENF-02, LENF-03]
score: 33/33 must-haves verified
overrides_applied: 0
---

# Phase 09: Backend Read-time + TOCTOU Enforcement — Verification Report

**Phase Goal (ROADMAP):** Non-active listings disappear from all public reads without any denormalized flag mutation, listing-detail GET returns a status-aware thin payload to non-admin viewers, and cart-add + confirm-booking re-verify listing status inside the same transaction with refund-first-throw-second semantics.

**Verified:** 2026-05-29
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

The Phase 09 goal is fully achieved. The codebase delivers all three ROADMAP success criteria with the exact wire-format contracts the plans defined, all phase-scoped test suites are GREEN, and every key invariant from the verification request holds.

### ROADMAP Success Criteria Coverage

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Public browse/search/related-listings return 0 non-active; admin call with `includeAllListingStatuses: true` returns full set | VERIFIED | `Car.js` sibling `pre(/^find/)` hook at lines 97-121 (default `status: 'active'`, bypass on `this.getOptions().includeAllListingStatuses`, `$and`-combine preserves caller filter). 4/4 LENF-01 jest cases GREEN (`hideOnFind.listingStatus.test.js`). 11 Phase-8 admin call sites in `listingService.js` already chain the bypass. |
| 2 | Listing-detail GET on non-active returns thin payload to non-admin (status + reason-category only, no PII); admin sees full doc + badge | VERIFIED | `getCarDetailHandler` at `server.js:338-408`. Path D builds payload from EXACTLY 10 named fields (carId, status, reasonCategory, title, make, model, year, price, firstPhotoUrl, banner). Path A appends 5-field `moderationBadge` via conditional spread (Pitfall 4). 7/7 LENF-02 supertest cases GREEN. |
| 3 | Cart-add returns 409 listing_not_available; status change between cart-add and confirm-booking aborts transaction and refunds Stripe BEFORE throwing | VERIFIED | `createPaymentIntentHandler` early 409 gate at server.js:1099-1126 (bypass + narrow projection + isValidObjectId). `confirmBooking.js` step c lines 190-225: chained bypass + `if (car.status !== 'active') await refundAndThrow(...)`. Helper at `refundAndThrow.js:69-94` calls `stripe.refunds.create(..., { idempotencyKey: ... })` BEFORE throwing. 5/5 helper + 7/7 cart-gate + 6/6 confirm-booking TOCTOU cases GREEN. Phase 3 D-15 regression 7/7 GREEN. |

---

## Observable Truths

Truths are aggregated across all five plans (33 in total). Detailed evidence inline; all VERIFIED.

### Plan 09-01 — Wave 0 Substrate (LENF-03 helper substrate)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 5 RED scaffolds exist under `__tests__/listing-enforcement/` | VERIFIED | All 5 files present: refundAndThrow.helper, hideOnFind.listingStatus, listingDetailStatusAware, createPaymentIntent.gate, confirmBooking.listingTOCTOU |
| 2 | `refundAndThrow(stripe, paymentIntentId, errorBody)` helper at `src/payments/refundAndThrow.js`, refund-first-throw-second + idempotencyKey | VERIFIED | refundAndThrow.js:69-94 — `await stripe.refunds.create({...}, { idempotencyKey: \`refund-${paymentIntentId}\` })` BEFORE any throw |
| 3 | `ListingNotAvailableError` class exported from refundAndThrow.js | VERIFIED | refundAndThrow.js:30-39 (`class ListingNotAvailableError extends Error` with Object.assign body) + line 99 export |
| 4 | Helper preserves ProviderSuspendedError path for 3 v1.0 sites (D-15 no regression) | VERIFIED | refundAndThrow.js:88-93 (discriminator `if (errorBody.error === 'listing_not_available') ... else ProviderSuspendedError`). Phase 3 7/7 suite GREEN. |
| 5 | Stripe refund idempotencyKey is `refund-${paymentIntentId}` | VERIFIED | refundAndThrow.js:73-76 literal; helper unit case asserts via toHaveBeenCalledWith |
| 6 | `lookupAdminIfPresent` middleware exists at `src/security/lookupAdminIfPresent.js`, never 401/403 | VERIFIED | File exists; full body inspected — only `if (...) return next();` paths, no `res.status(401)` or `res.status(403)` calls |
| 7 | `refundAndThrow.helper.test.js` GREEN with 5 unit cases | VERIFIED | `npx jest __tests__/listing-enforcement/refundAndThrow.helper.test.js` → 5 passed |
| 8 | D-15 regression coverage map documented in 09-01-SUMMARY | VERIFIED | SUMMARY lines 144-156 — table maps each v1.0 path (buyer/provider/seller-suspended) to existing Phase 3 case; "no backfills required" decision recorded |

### Plan 09-02 — Car.js hide hook (LENF-01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | `Car.find({})` returns zero non-active by default | VERIFIED | Hook at Car.js:104-120 sets `nextQuery.status = 'active'`; test case 1 asserts `toHaveLength(1) … status === 'active'` GREEN |
| 10 | `Car.find({}).setOptions({ includeAllListingStatuses: true })` returns all 4 statuses | VERIFIED | Short-circuit at Car.js:105 (`return`); test case 2 asserts `toHaveLength(4)` GREEN |
| 11 | Admin caller status filter + bypass returns matching non-active (Pitfall 2) | VERIFIED | $and combine at Car.js:113-117; test case 3 asserts `Car.find({status:'deleted'}).setOptions({bypass}) → 1 deleted` GREEN |
| 12 | Caller's status filter combines via `$and` shape | VERIFIED | Car.js:113-117 `nextQuery.$and = [...(currentQuery.$and || []), {status: existingClause}, {status: 'active'}]` |
| 13 | Bypass flag is per-call, never global default | VERIFIED | `grep "set(.*includeAllListingStatuses" Car.js` → 0; no `schema.set` global default present |
| 14 | Browse/related/search/detail auto-hide non-active | VERIFIED | Hook fires via `pre(/^find/)` regex — auto-applies to every `Car.find/findOne/findById/findOneAndUpdate` call. server.js audit (09-02-SUMMARY lines 99-113): 5 sites classified, 0 MISSING |
| 15 | hideOnFind.listingStatus.test.js GREEN (4 cases) | VERIFIED | `npx jest __tests__/listing-enforcement/hideOnFind.listingStatus.test.js` → 4 passed |
| 16 | server.js audit zero MISSING classifications (W-9) | VERIFIED | 09-02-SUMMARY §"server.js Car-query Audit (W-9)" — 5 hits (lines 297/315/339/701/757), 4× (a) + 1× (b), MISSING count 0 |
| 17 | D-04 sibling structure (2 stacked hooks, NOT combined) | VERIFIED | Car.js: existing seller-cascade hook at lines 63-95 (UNCHANGED), new sibling hook at lines 104-120. `grep -c "pre(/\^find/" Car.js` → 2 |

### Plan 09-03 — Status-aware listing-detail GET (LENF-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 18 | GET /api/cars/:id non-active returns 200 (not 404) — D-06 | VERIFIED | `getCarDetailHandler` returns 200 for all statuses; only `!car` or invalid id → 404. Test case 1 asserts `toBe(200)` for suspended GREEN |
| 19 | Non-admin thin payload has EXACTLY the 10 D-05 allowlist fields | VERIFIED | server.js:389-403 — 10 named fields (carId, status, reasonCategory, title, make, model, year, price, firstPhotoUrl, banner). Test case 1 asserts `Object.keys(res.body).sort()` exact match GREEN |
| 20 | Non-admin `reasonCategory` = car.moderationReason (enum) — B-1 lock | VERIFIED | server.js:392 `reasonCategory: car.moderationReason`. Test case 1 + case 7 both assert `expect(res.body.reasonCategory).toBe('spam')` GREEN |
| 21 | Non-admin payload NEVER contains PII (sellerId, sellerEmail, description, moderationNote, etc.) | VERIFIED | Path D builds from named fields only (no `...car` spread, Pitfall 5). Test case 2 forEach over 15 PII keys, all assert `not.toHaveProperty(...)` GREEN |
| 22 | Admin receives full doc + 5-key `moderationBadge` with locked A1 mapping | VERIFIED | server.js:356-371 builds badge `{status, reasonCategory=moderationReason, moderationReason=moderationNote, moderatedBy, moderatedAt}` + conditional spread. Test case 3 asserts `body.moderationBadge.reasonCategory === 'spam'` AND `body.moderationBadge.moderationReason === 'troll listing'` GREEN |
| 23 | Admin `moderationBadge` OMITTED when status === 'active' (Pitfall 4) | VERIFIED | server.js:371 conditional spread `...(badge ? { moderationBadge: badge } : {})`. Test case 4 asserts `not.toHaveProperty('moderationBadge')` for admin+active GREEN |
| 24 | GET on non-existent ObjectId returns 404 | VERIFIED | server.js:347 fallback. Test case 5 GREEN |
| 25 | GET on malformed id returns 404 (not 500 CastError) — Pitfall 6 | VERIFIED | server.js:341-343 `mongoose.isValidObjectId(req.params.id)` guard. Test case 6 asserts `not-a-valid-object-id → 404` GREEN |
| 26 | Non-admin active listing returns existing shape verbatim | VERIFIED | server.js:376-385 Path C spreads `car`. Backward-compat preserved (also flagged by code review as WR-04 PII concern — accepted as pre-existing v1.0 behavior, see Anti-Patterns below) |
| 27 | Authenticated non-admin treated as non-admin (W-3) | VERIFIED | Test case 7 mocks Firebase token but seeds NO AdminUser → response is thin payload, no `moderationBadge`. GREEN |
| 28 | Handler bypasses hide hook via `.setOptions({ includeAllListingStatuses: true })` | VERIFIED | server.js:345 in `Car.findById` chain |
| 29 | `lookupAdminIfPresent` required EXACTLY once at server.js scope (B-5) | VERIFIED | `grep -c "require.*security/lookupAdminIfPresent" server.js` → 1 |

### Plan 09-04 — Cart-add gate + error-mapping wire-up (LENF-03 part A)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 30 | POST /api/payments/create-payment-intent with non-active carId returns 409 + D-11 body | VERIFIED | server.js:1118-1124 returns `{error: 'listing_not_available', listingStatus, reasonCategory, banner}`. Test case 1 GREEN |
| 31 | `stripe.paymentIntents.create` NOT called when listing non-active | VERIFIED | Gate at server.js:1099-1126 short-circuits with `return` before Stripe call. Test case 2 asserts `not.toHaveBeenCalled()` GREEN |
| 32 | Gate reads Car with `.setOptions({ includeAllListingStatuses: true })` | VERIFIED | server.js:1113-1115 chain; case 4 (test.each 3 statuses) all GREEN |
| 33 | Active listings proceed unchanged (backward-compatible) | VERIFIED | Test case 3 asserts `clientSecret` returned for active GREEN |
| 34 | All 3 non-active statuses (suspended/archived/deleted) return 409 with correct banner | VERIFIED | Test case 4 `test.each(['suspended','archived','deleted'])` — 3 executions each GREEN, banner equals `LISTING_STATUS_POLICY[status].banner` |
| 35 | server.js confirm-booking maps `ListingNotAvailableError` ABOVE `ProviderSuspendedError` (Pitfall 10) | VERIFIED | `awk '/err instanceof (ListingNotAvailableError\|ProviderSuspendedError)/'` → LENF arm precedes Provider arm |
| 36 | Malformed carId returns 404 not 500 (Pitfall 6 / S-5) | VERIFIED | server.js:1109-1111 `mongoose.isValidObjectId(carId)` guard. Test case 5 GREEN |
| 37 | `ListingNotAvailableError` imported from canonical `./src/payments/refundAndThrow` (W-7) | VERIFIED | `grep -c "require('./src/payments/refundAndThrow')" server.js` → 1; no confirmBooking re-export usage |
| 38 | createPaymentIntent.gate.test.js GREEN | VERIFIED | `npx jest __tests__/listing-enforcement/createPaymentIntent.gate.test.js` → 7 passed (5 source cases, case d parameterized over 3 statuses) |

### Plan 09-05 — Confirm-booking TOCTOU re-verify (LENF-03 part B)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 39 | Listing flipped non-active mid-checkout aborts transaction with 409 listing_not_available | VERIFIED | confirmBooking.js:217-224 assertion; route maps to 409 via server.js error map. Test case a GREEN; route-level case f also GREEN |
| 40 | Step 4 Car refetch chains BOTH bypass flags | VERIFIED | confirmBooking.js:190-192 `.setOptions({ includeAllUsers: true, includeAllListingStatuses: true }).session(session)` |
| 41 | Step 4 checks 3 conditions in order: seller.moderationStatus → seller.sellerStatus → car.status === 'active' (D-13) | VERIFIED | confirmBooking.js:197-225 — seller checks at 202-210, listing check at 217-224 (AFTER seller checks, BEFORE `car.listingStatus = 'booked'` at line 227) |
| 42 | Refund-first-throw-second invariant (D-14) | VERIFIED | refundAndThrow.js:73-93 — Stripe call is awaited then exception is thrown. Test case b uses invocationCallOrder tracking GREEN |
| 43 | idempotencyKey `refund-${paymentIntentId}` passed | VERIFIED | refundAndThrow.js:75. Test case d asserts `calls[0][1] === { idempotencyKey: 'refund-pi_...' }` GREEN |
| 44 | Phase 3 7-case D-15 regression preserved | VERIFIED | `npx jest __tests__/enforcement/confirmBooking.transaction.test.js` → 7 passed |
| 45 | Concurrent admin.suspend + buyer.confirm race produces exactly one outcome (Pitfall 9, W-5 (a)) | VERIFIED | Test case e Promise.allSettled over 5 iterations — admin always wins (JS event-loop), buyer rejected with ListingNotAvailableError, exactly 1 refund. GREEN |
| 46 | server.js error-mapping branch exercised end-to-end via route supertest | VERIFIED | Test case f: thin Express app + full chain throw → catch → 409 D-11 body. GREEN |
| 47 | confirmBooking.js imports `ListingNotAvailableError` from canonical `./refundAndThrow` (W-7) | VERIFIED | `grep -c "require('./refundAndThrow')" confirmBooking.js` → 1; destructure includes `ListingNotAvailableError` |
| 48 | End-of-Plan-05 `refundAndThrow(` call-count in confirmBooking.js is EXACTLY 4 (B-3) | VERIFIED | `grep -cE "await refundAndThrow\(\|^[[:space:]]*refundAndThrow\(" confirmBooking.js` → 4 |
| 49 | confirmBooking.listingTOCTOU.test.js GREEN (6 cases) | VERIFIED | `npx jest __tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` → 6 passed |

**Total: 49 detailed truths, all VERIFIED.** (33 must-haves headline; sub-truths grouped per plan above for thoroughness.)

---

## Key Invariant Verification (Verification Request §key_invariants_to_verify)

| # | Invariant | Expected | Observed | Status |
|---|-----------|----------|----------|--------|
| 1 | `grep -c "refundAndThrow(" confirmBooking.js` (B-3) | EXACTLY 4 (3 v1.0 + 1 LENF-03) | 4 | PASS |
| 2 | server.js: canonical require of refundAndThrow (W-7) | 1 | 1 | PASS |
| 2 | confirmBooking.js: canonical require of refundAndThrow (W-7) | 1 | 1 | PASS |
| 3 | server.js require lookupAdminIfPresent (B-5) | 1 | 1 | PASS |
| 4 | Car.js `pre(/^find/` hook count | 2 | 2 | PASS |
| 5 | server.js: ListingNotAvailableError instanceof BEFORE ProviderSuspendedError (Pitfall 10) | LENF first | LENF first (confirmed via awk head -2) | PASS |
| 6 | server.js GET /api/cars/:id non-admin Path D — EXACTLY 10 allowed keys, no `...car` spread | 10 keys, no spread | 10 keys (carId, status, reasonCategory, title, make, model, year, price, firstPhotoUrl, banner), no spread | PASS |
| 7 | mongoose.isValidObjectId guards in GET /api/cars/:id + POST /create-payment-intent | 2 | `grep -c "mongoose.isValidObjectId" server.js` → 2 | PASS |
| 8 | confirmBooking.js step 4 chained bypass `.setOptions({ includeAllUsers: true, includeAllListingStatuses: true }).session(session)` | present once | confirmBooking.js:190-192 (exact chain) | PASS |
| 9 | `__tests__/enforcement/confirmBooking.transaction.test.js` 7-case suite GREEN (D-15) | 7 passed | 7 passed | PASS |

All 9 key invariants hold.

---

## Required Artifacts Verification

### Source modules (created/modified in `../backend-services/carEx-services/`)

| Artifact | Exists | Substantive | Wired | Data Flows | Status |
|----------|--------|-------------|-------|------------|--------|
| `src/payments/refundAndThrow.js` (helper + ListingNotAvailableError + ProviderSuspendedError) | YES | YES (refundAndThrow async function with try/catch + discriminator) | YES (required by server.js, confirmBooking.js, 2 test files) | YES (live in 4 confirmBooking call sites + 1 server.js instanceof) | VERIFIED |
| `src/security/lookupAdminIfPresent.js` | YES | YES (AdminUser.findOne lowercase lookup, fail-safe to non-admin) | YES (server.js requires + mounts on GET /api/cars/:id) | YES (sets req.admin for downstream branching) | VERIFIED |
| `src/models/Car.js` (sibling `pre(/^find/)` hook) | YES (modified, +25 lines at 97-121) | YES (short-circuit + $and-combine + setQuery) | YES (auto-fires on every Car.find/findOne/findById/findOneAndUpdate) | YES (Plan 02 4 tests + Phase 8 11 admin call sites verified live consumers) | VERIFIED |
| `src/payments/confirmBooking.js` (step 4 listing assertion + chained bypass) | YES (modified, +34 lines) | YES (assertion routed through refundAndThrow with listing_not_available errorBody) | YES (called by POST /api/payments/confirm-booking) | YES (Plan 05 6 GREEN tests exercise the path) | VERIFIED |
| `server.js` (GET /api/cars/:id handler + POST /create-payment-intent gate + confirm-booking error-map branch) | YES (modified, +133 lines) | YES (4-path response branch + 409 gate + new instanceof arm) | YES (mounted on 3 routes) | YES (Plans 03 7, 04 7, 05 1 route-level case all GREEN) | VERIFIED |

### Test scaffolds (created/filled in Plans 01-05)

| Test file | Exists | Cases | Status |
|-----------|--------|-------|--------|
| `__tests__/listing-enforcement/refundAndThrow.helper.test.js` | YES | 5 passed | VERIFIED |
| `__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` | YES | 4 passed | VERIFIED |
| `__tests__/listing-enforcement/listingDetailStatusAware.test.js` | YES | 7 passed | VERIFIED |
| `__tests__/listing-enforcement/createPaymentIntent.gate.test.js` | YES | 7 passed (5 source × 1 + test.each × 3 over statuses) | VERIFIED |
| `__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` | YES | 6 passed | VERIFIED |

**Total: 29 Phase-09 GREEN tests + 7 Phase-3 D-15 regression GREEN = 36/36 across 6 suites.**

---

## Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `Car.js` new hook | `this.getOptions().includeAllListingStatuses` short-circuit | `if (this.getOptions().includeAllListingStatuses) return;` at Car.js:105 | WIRED |
| `Car.js` new hook | `$and` shape combining caller status filter | Car.js:113-117 setQuery with $and array | WIRED |
| `refundAndThrow.js` | `stripe.refunds.create` + idempotencyKey | refundAndThrow.js:73-77 (second arg `{ idempotencyKey: \`refund-${paymentIntentId}\` }`) | WIRED |
| `refundAndThrow.js` | `ListingNotAvailableError` vs `ProviderSuspendedError` discriminator | refundAndThrow.js:88-93 `if (errorBody.error === 'listing_not_available')` | WIRED |
| `lookupAdminIfPresent.js` | `AdminUser.findOne({ email: req.auth.email.toLowerCase() })` | lookupAdminIfPresent.js:26 | WIRED |
| `server.js` GET /api/cars/:id | `attachAuthIfPresent`, `lookupAdminIfPresent` middleware chain | server.js:410 `app.get('/api/cars/:id', attachAuthIfPresent, lookupAdminIfPresent, getCarDetailHandler);` | WIRED |
| `server.js` GET /api/cars/:id | `setOptions({ includeAllListingStatuses: true })` bypass on Car.findById | server.js:344-346 chain | WIRED |
| `server.js` GET /api/cars/:id | `mongoose.isValidObjectId` guard at top of handler | server.js:341 | WIRED |
| `server.js` POST /create-payment-intent | Car.findById bypass + narrow projection + isValidObjectId | server.js:1109-1126 | WIRED |
| `server.js` confirm-booking catch | `if (err instanceof ListingNotAvailableError)` ABOVE Provider arm | server.js error-map (LENF before Provider per awk) | WIRED |
| `confirmBooking.js` step c | Plan 02 hide hook + seller-cascade hook bypass | `.setOptions({ includeAllUsers: true, includeAllListingStatuses: true }).session(session)` at line 191 | WIRED |
| `confirmBooking.js` step c assertion | `refundAndThrow(stripe, paymentIntentId, { error: 'listing_not_available', ... })` | confirmBooking.js:219-224 | WIRED |
| `confirmBooking.js` (require) | Canonical `./refundAndThrow` (W-7) | confirmBooking.js destructure import | WIRED |
| Production handler `getCarDetailHandler` | LENF-02 supertest (W-6) | listingDetailStatusAware.test.js requires `server.js` named export, mounts thin Express app | WIRED |
| Production handler `createPaymentIntentHandler` | LENF-03 cart-add supertest (W-6) | createPaymentIntent.gate.test.js requires named export, mounts thin Express app | WIRED |

All key links wired and exercised end-to-end via the GREEN test suites.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LENF-01 | 09-02 | Public listing reads filter to `status: 'active'` via Mongoose `pre(/^find/)` hide hooks; admin opts in via `setOptions({ includeAllListingStatuses: true })` | SATISFIED | Car.js sibling hook at lines 97-121; hideOnFind.listingStatus.test.js 4/4 GREEN; 11 Phase-8 admin sites + 5 server.js sites audited zero-MISSING |
| LENF-02 | 09-03 | Listing-detail GET returns status-aware response: admin sees full doc + badge; non-admin sees thin payload (status + reasonCategory only, no seller PII) | SATISFIED | getCarDetailHandler server.js:338-408; 7/7 GREEN supertest cases verifying 10-field allowlist + 5-field admin badge + W-3 authenticated-non-admin + Pitfalls 4/5/6 |
| LENF-03 | 09-01 + 09-04 + 09-05 | Cart-add + confirm-booking re-verify listing status inside transaction; reject with `409 listing_not_available`; refund-first-throw-second on mid-checkout flip | SATISFIED | Helper at refundAndThrow.js; cart-add gate at server.js:1099-1126; confirm-booking step c assertion at confirmBooking.js:217-224; route mapping at server.js error-map; idempotencyKey + Phase 3 D-15 regression preserved. 5 + 7 + 6 = 18 GREEN cases + Pitfall 9 race + W-7 class-identity + B-3 call-count == 4 |

All 3 ROADMAP requirement IDs SATISFIED. No ORPHANED IDs found in REQUIREMENTS.md for Phase 9.

---

## Behavioral Spot-Checks

Phase-scoped jest test suites are the behavioral spot-checks (executed live during this verification).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 09 listing-enforcement suites GREEN | `npx jest __tests__/listing-enforcement/` | 5 suites / 29 passed / 0 failed | PASS |
| Phase 3 D-15 regression preserved | `npx jest __tests__/enforcement/confirmBooking.transaction.test.js` | 7 passed | PASS |
| Combined Phase 09 + Phase 3 regression | `npx jest __tests__/listing-enforcement/ __tests__/enforcement/confirmBooking.transaction.test.js` | 6 suites / 36 passed / 0 failed | PASS |
| B-3 call-count check | `grep -cE "await refundAndThrow\(\|^[[:space:]]*refundAndThrow\(" src/payments/confirmBooking.js` | 4 | PASS |
| W-7 canonical require server.js | `grep -c "require('./src/payments/refundAndThrow')" server.js` | 1 | PASS |
| W-7 canonical require confirmBooking.js | `grep -c "require('./refundAndThrow')" src/payments/confirmBooking.js` | 1 | PASS |
| Hide-hook count | `grep -c "pre(/^find/" src/models/Car.js` | 2 | PASS |
| Pitfall 10 ordering | `awk '/err instanceof (ListingNotAvailableError\|ProviderSuspendedError)/' server.js \| head -2` | ListingNotAvailableError appears first | PASS |

---

## Pre-existing Failures (NOT Phase 09 Regressions)

Per the verification request, the following pre-existing failure was acknowledged in advance and verified by reproduction:

- `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` — 2 failures. Both expect `POST /api/orders → 201`; the route was deprecated in Phase 3 and now returns 410. The verifier independently ran this suite (`npx jest __tests__/moderation/ServiceOrder.providerSnapshot.test.js`) and reproduced the same failures (lines 117 and 154, `Expected 201 / Received 410`). 09-05-SUMMARY also independently confirmed pre-existence by reverting Plan 09-05 changes locally and reproducing the same failures.

These failures are NOT Phase 09 regressions and do NOT block this verification.

---

## Anti-Pattern Scan

Phase 09 source files scanned for stubs, debt markers, and unreferenced TODOs.

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `src/payments/refundAndThrow.js` | None found | — | Clean. No TODO/FIXME/XXX/TBD. |
| `src/security/lookupAdminIfPresent.js` | None found | — | Clean. |
| `src/models/Car.js` (new hook) | None found in new hook block | — | Clean. |
| `src/payments/confirmBooking.js` (step c additions) | None found in new lines | — | Clean. |
| `server.js` (Phase 09 additions) | None found in new code | — | Clean. New comments reference plan IDs (D-05, D-08, D-11, Pitfall 6, etc.) but no unreferenced debt markers. |
| All 5 `__tests__/listing-enforcement/` files | None found | — | Clean. Tests are structured assertions, no `test.todo` placeholders remain. |

**No BLOCKER anti-patterns found.** Code review (09-REVIEW.md) flagged 5 WARNINGS (WR-01..WR-05) and 7 INFO items — all are non-blocking quality/hardening observations, not Phase 09 regression bugs. The 0 CRITICAL count in the review aligns with this verification's finding.

### Code Review Findings Carry-Through

These warnings from 09-REVIEW.md are acknowledged but do NOT block goal achievement (they are forward-pointers / hardening candidates):

| Finding | File | Disposition |
|---------|------|-------------|
| WR-01 | confirmBooking.js:92-97 (idempotency fast-path missing `includeAllListingStatuses` bypass) | Forward-pointer — post-moderation replay edge case. Phase 11 LIST-SECURITY review candidate. Does NOT regress LENF-01/02/03 scenarios. |
| WR-02 | server.js cart-add gate null-Car fall-through (W-4) | Already accepted in plan + 09-04-SUMMARY + threat model T-09-04-06. Forward-pointer to Phase 11. |
| WR-03 | lookupAdminIfPresent fail-open on DB error | Documented behaviour; fail-safe direction is correct (never 401/403). Phase 11 may add observability. |
| WR-04 | Path C (active listing) spreads full `car` doc | Pre-existing v1.0 PII bleed, NOT introduced by Phase 9. Phase 9 only hardens Path D (non-active). Phase 11 LIST-SECURITY candidate. |
| WR-05 | Generic 500 leaks `error.message` | Pre-existing v1.0 pattern. Minor — out of Phase 09 scope. Phase 11 may mask. |
| IN-01..07 | Various (perf, naming, response shape inconsistencies) | All explicitly out-of-scope or accepted; no Phase 09 contract violations. |

---

## Deferred Items

Items not yet met but explicitly addressed in later milestone phases (per Step 9b filter):

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Mobile UI to surface 409 listing_not_available banner without triggering 403 interceptor | Phase 10 | ROADMAP Phase 10 success criterion #5: "A `409 listing_not_available` response surfaces as a UI banner on `CarDetailsScreen` (or cart) without triggering the user-suspension 403 interceptor or logging the admin out." |
| 2 | Severity-aware banner copy + RU/EN parity for non-active listing thin payload | Phase 11 | ROADMAP Phase 11 success criteria: "buyers see a severity-aware banner explaining any non-active listing they encounter (detail screen + cart) … all new strings ship with RU/EN parity enforced by jest" |
| 3 | LIST-SECURITY merge-gate review (catches WR-01..05 follow-ups, null-Car hardening, Path C PII tightening) | Phase 11 | ROADMAP Phase 11 success criteria: "every LIST-* requirement is test-covered, and a `LIST-SECURITY.md` review clears the merge-gate" |
| 4 | ServiceOrder pause-not-cancel (WR-03 from Plan 05 forward pointer; covers in-flight orders touching a suspended provider) | Phase 11 (LIST-SECURITY review) | 09-05-SUMMARY §"Forward Pointers" item 1; PROJECT.md constraint "in-flight orders touching a suspended provider are *paused*, not auto-cancelled" |

These deferred items are informational — they do not require closure plans within Phase 09.

---

## Human Verification Required

None for goal achievement. The phase is a pure backend contract change; all behavior is verifiable by jest test suites which are GREEN.

Phase 10 + 11 will own the mobile UI verification (visual banners, RU/EN parity, real-time error handling). That is appropriate scope for those phases, not a gap in Phase 09.

---

## Gaps Summary

**None.** All 33 must-haves verified; all 9 key invariants hold; all 36 phase-scoped test cases GREEN (29 Phase 09 + 7 Phase 3 D-15 regression); no BLOCKER anti-patterns; pre-existing ServiceOrder failures acknowledged and confirmed not to be Phase 09 regressions.

---

## Verification Conclusion

**Phase 09 (Backend Read-time + TOCTOU Enforcement) goal is ACHIEVED.**

The codebase delivers the three ROADMAP success criteria — non-active listings hidden from all public reads via the Car.js sibling `pre(/^find/)` hook with the per-call `includeAllListingStatuses` bypass; status-aware GET /api/cars/:id branching on `!!req.admin` with the locked D-05 thin-payload allowlist for non-admin viewers and the 5-field `moderationBadge` for admin viewers; cart-add 409 gate firing BEFORE any Stripe call; and confirm-booking step c re-verifying listing status inside the same Mongoose transaction with refund-first-throw-second semantics via the shared idempotencyKey-protected helper.

Class identity for `ListingNotAvailableError` is preserved across the throw → catch boundary via the canonical W-7 require path. Pitfall 10 sibling ordering for the error-mapping arms is correct (LENF before Provider). The B-3 invariant closes at exactly 4 `refundAndThrow(` invocations in confirmBooking.js. The Phase 3 D-15 regression suite stays 7/7 GREEN.

All three requirement IDs (LENF-01, LENF-02, LENF-03) are SATISFIED. Phase 09 is feature-complete.

---

_Verified: 2026-05-29_
_Verifier: Claude (gsd-verifier)_
