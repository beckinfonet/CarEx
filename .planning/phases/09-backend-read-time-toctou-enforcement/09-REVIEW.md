---
status: issues-found
phase: 09-backend-read-time-toctou-enforcement
reviewed: 2026-05-29T07:27:03Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - ../backend-services/carEx-services/src/models/Car.js
  - ../backend-services/carEx-services/src/security/lookupAdminIfPresent.js
  - ../backend-services/carEx-services/src/payments/refundAndThrow.js
  - ../backend-services/carEx-services/src/payments/confirmBooking.js
  - ../backend-services/carEx-services/server.js
  - ../backend-services/carEx-services/__tests__/listing-enforcement/refundAndThrow.helper.test.js
  - ../backend-services/carEx-services/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js
  - ../backend-services/carEx-services/__tests__/listing-enforcement/listingDetailStatusAware.test.js
  - ../backend-services/carEx-services/__tests__/listing-enforcement/createPaymentIntent.gate.test.js
  - ../backend-services/carEx-services/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js
findings_critical: 0
findings_warning: 5
findings_info: 7
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
---

# Phase 09: Code Review Report

**Reviewed:** 2026-05-29T07:27:03Z
**Depth:** standard
**Files Reviewed:** 10 (5 source + 5 tests)
**Status:** issues-found

## Summary

The phase delivers the four high-leverage security invariants on spec:

1. **D-05 thin-payload allowlist (PII minimization)** — `getCarDetailHandler` (server.js:387-403) builds the non-admin thin payload from EXACTLY 10 named fields (`carId, status, reasonCategory, title, make, model, year, price, firstPhotoUrl, banner`). The `car` document is NOT spread into the Path D branch — sellerId/sellerEmail/sellerPhone/sellerName/description/moderationNote/moderationReason/moderatedBy/moderatedAt/lastEditedBy/lastEditedAt/bookedByUid/stripePaymentIntentId/phoneNumber/telegramUsername/mileage/location/condition/knownIssues are all blocked. No PII leak in the thin payload path.
2. **TOCTOU re-verification inside `session.withTransaction`** — `confirmBooking.js` step c (lines 190-225) chains BOTH bypass flags (`includeAllUsers: true, includeAllListingStatuses: true`) and `.session(session)` on the Car refetch. The new `car.status === 'active'` assertion is the THIRD ordered check after the v1.0 seller checks and runs BEFORE `car.listingStatus = 'booked'` (line 227). On failure it routes through `refundAndThrow` with the `listing_not_available` discriminator.
3. **Refund-first-throw-second + idempotencyKey** — `refundAndThrow.js` (lines 69-94) `await`s `stripe.refunds.create({ payment_intent }, { idempotencyKey: \`refund-${paymentIntentId}\` })` BEFORE any throw escapes. `idempotencyKey` is correctly passed as the SECOND positional argument (Stripe SDK convention). All four call sites in `confirmBooking.js` share this helper, so all four are idempotency-protected; the v1.0 latent double-refund window is closed.
4. **Error-mapping order (Pitfall 10)** — `server.js` confirm-booking catch (lines 1175-1192) checks `ListingNotAvailableError` BEFORE `ProviderSuspendedError`. CastError guards via `mongoose.isValidObjectId` are in place on both `getCarDetailHandler` (server.js:341) and `createPaymentIntentHandler` (server.js:1110). `ListingNotAvailableError` is imported from the canonical defining module `./src/payments/refundAndThrow` at server.js:36 — no re-export drift, class identity preserved across the throw boundary.

**lookupAdminIfPresent** (src/security/lookupAdminIfPresent.js) correctly NEVER returns 401/403 — even on AdminUser DB error, it logs and falls through to `next()` without setting `req.admin`. The hide hook (Car.js:104-120) correctly short-circuits on the `includeAllListingStatuses` bypass and combines the caller's `status` filter via `$and` so admin queries for `status: 'deleted'` work with the bypass flag set.

No CRITICAL findings. Five WARNINGS surface real correctness or robustness gaps; seven INFO items document carryover/design notes. Review-relevant findings center on:

- A latent **replay regression** in the `confirmBooking.js` idempotency fast-path (line 92) when the listing has since been moderated.
- **W-4 null-Car fall-through** in the cart-add gate — known, accepted, but unmitigated.
- **PII spread on the Path C non-admin active-listing response** — pre-existing v1.0 behavior, not introduced by Phase 9, but the review must surface it since Phase 9's PII-minimization goal applies inconsistently.
- A **fail-open admin-detection** path on DB hiccup — moderators silently see the thin payload during AdminUser DB outages.

## Warnings

### WR-01: Idempotency fast-path in confirmBooking.js does not bypass `includeAllListingStatuses` — replay after moderation triggers spurious refund + error

**File:** `../backend-services/carEx-services/src/payments/confirmBooking.js:92-97`
**Issue:**
```js
const existingCar = await Car.findById(carId).setOptions({ includeAllUsers: true }).lean();
if (existingCar && existingCar.stripePaymentIntentId === paymentIntentId) {
  // fast-path: return existing car + orders
}
```
The fast-path lookup chains only `includeAllUsers: true` — NOT `includeAllListingStatuses: true`. If a buyer successfully books a listing (car.status === 'active') and an admin later flips the listing to `suspended`/`archived`/`deleted`, a buyer who retries `confirmBooking` with the same `paymentIntentId` will hit the Plan-09-02 hide hook → `existingCar` returns `null` → fast-path is skipped → the code enters the transaction → step c re-fetches Car with BOTH bypass flags → detects `status !== 'active'` → calls `refundAndThrow`. The buyer thought their booking succeeded (orders exist in the DB) and is now told their listing is unavailable, with a (Stripe-idempotency-deduped) refund attempt logged. The buyer's ServiceOrders are NOT returned to them despite existing.

This breaks the documented idempotency contract for the post-moderation replay scenario (mobile retry storm + admin action interleaving).

**Fix:** Add the listing-status bypass to the fast-path lookup so it can find a previously-booked listing regardless of subsequent moderation status:
```js
const existingCar = await Car.findById(carId)
  .setOptions({ includeAllUsers: true, includeAllListingStatuses: true })
  .lean();
```
The fast-path semantics are "if THIS paymentIntent already booked this car, return idempotent success" — moderation status of the listing AFTER the booking should not affect idempotency replay.

---

### WR-02: `createPaymentIntent` cart-add gate falls through to Stripe when `Car.findById` returns null (W-4 disposition is accept-with-charge)

**File:** `../backend-services/carEx-services/server.js:1109-1126`
**Issue:**
```js
if (carId) {
  if (!mongoose.isValidObjectId(carId)) {
    return res.status(404).json({ error: 'car_not_found' });
  }
  const car = await Car.findById(carId)
    .setOptions({ includeAllListingStatuses: true })
    .select('status moderationReason')
    .lean();
  if (car && car.status !== 'active') {
    // 409 listing_not_available
  }
  // FALLS THROUGH to stripe.paymentIntents.create when car === null
}
```
When `carId` is a syntactically valid ObjectId but no Car document exists (Phase 8 is soft-delete-only, so the only paths to null are: (a) genuinely never-existed ID, or (b) an attacker fabricating an ID), the gate does NOT short-circuit. It falls through to the Stripe call, the buyer is charged, and the existing `car_not_found` check in `confirmBooking` then fires at the confirm-booking step — but there is no automatic refund of the create-payment-intent charge in this code path. The plan acknowledges this (W-4 / T-09-04-06 disposition: accept; defer hardening to Phase 11), but the behavior remains an open charge-but-no-order/no-refund window an attacker can deliberately trigger by sending a random ObjectId.

**Fix:** Add an explicit null-car short-circuit before the Stripe call (defense-in-depth; matches the existing `car_not_found` 404 returned downstream):
```js
if (carId) {
  if (!mongoose.isValidObjectId(carId)) {
    return res.status(404).json({ error: 'car_not_found' });
  }
  const car = await Car.findById(carId)
    .setOptions({ includeAllListingStatuses: true })
    .select('status moderationReason')
    .lean();
  if (!car) {
    return res.status(404).json({ error: 'car_not_found' });
  }
  if (car.status !== 'active') {
    // 409 listing_not_available
  }
}
```
If the Phase 11 hardening pass requires the fall-through for backward compatibility, leave the fix off and explicitly document the threat in 09-VERIFICATION.md. The Plan-04 SUMMARY already records this; the source itself should carry a comment marker so the next maintainer doesn't accidentally "fix" the fall-through and break the v1.0 contract for legitimate use cases.

---

### WR-03: `lookupAdminIfPresent` fail-open on AdminUser DB error silently degrades admin viewers to non-admin thin payload

**File:** `../backend-services/carEx-services/src/security/lookupAdminIfPresent.js:25-33`
**Issue:**
```js
try {
  const admin = await AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean();
  if (admin) {
    req.admin = { uid: req.auth.uid, role: admin.role, email: admin.email };
  }
} catch (err) {
  console.error('[lookupAdminIfPresent]', err);
}
return next();
```
On a transient MongoDB error (replica-set election, slow query, brief connection drop), the catch swallows the error and `req.admin` is not set. The downstream `getCarDetailHandler` then treats the admin as non-admin and returns the D-05 thin payload to a real moderator. This is a UX/observability bug, not a security one — but a moderator who is investigating a suspended listing during a brief DB hiccup will see exactly the buyer-facing view and may not realize their admin context didn't attach. They could also accidentally proceed as a buyer (cart-add, etc.) without realizing they're operating in non-admin mode.

The fail-safe direction is correct (NEVER 401/403 a non-admin); the concern is observability + the admin's awareness that their privileged context was lost.

**Fix:** Either (a) propagate the error with a soft signal:
```js
} catch (err) {
  console.error('[lookupAdminIfPresent]', err);
  req.adminLookupFailed = true;  // soft signal for downstream handlers
}
```
or (b) emit a structured log/metric (not just `console.error`) so ops can detect the failure mode in production. Phase 11 LIST-SECURITY review can decide whether to harden further. The current `console.error` is below the bar for an admin-context degradation event.

---

### WR-04: Non-admin Path C (active listing) spreads full `car` document — leaks `bookedByUid`, `stripePaymentIntentId`, `moderationNote`, `moderatedBy`, `moderatedAt`, `phoneNumber`, `telegramUsername`, `lastEditedBy/At`

**File:** `../backend-services/carEx-services/server.js:378-384`
**Issue:**
```js
if (isActive) {
  return res.json({
    ...car,                                           // FULL doc spread
    id: car._id.toString(),
    make: car.makeName || car.make || '',
    model: car.modelName || car.model || '',
    listingStatus: car.listingStatus || 'active',
  });
}
```
For non-admin viewers of an ACTIVE listing, the handler spreads the entire `car` document, exposing `bookedByUid` (buyer's Firebase UID if the car is in a half-booked state), `stripePaymentIntentId`, `moderationNote`, `moderationReason`, `moderatedBy`, `moderatedAt`, `lastEditedBy`, `lastEditedAt`, `phoneNumber`, `telegramUsername`, `mileage`, `description`, `knownIssues`, `condition`, etc. The plan calls out this is "preserve the existing pre-Phase-9 response shape byte-for-byte" — verbatim from server.js:307-314 of the pre-Phase-9 baseline.

This is a pre-existing v1.0 PII bleed, NOT introduced by Phase 9. Phase 9's PII-minimization invariant (D-05) applies only to the non-active branch. However, the asymmetry is now sharp: Phase 9 hardens the suspended/archived/deleted view to an explicit 10-field allowlist while leaving the active-listing view leaking. From a defense-in-depth standpoint, an attacker who wants seller PII just views an active listing. The thin-payload protection only helps for moderated listings.

**Fix:** Out of Phase 9 scope per CONTEXT — but the review must surface it. Either (a) defer to Phase 11 LIST-SECURITY review with an explicit ADR carving out the active-listing PII surface, or (b) tighten Path C to a parallel allowlist (likely a Phase 11 task because it's a public-API breaking change). At minimum, leave a `// FIXME(LIST-SECURITY)` comment at line 378 so the next reviewer sees the asymmetry on-grep.

Suggested minimal action for Phase 9: open a Phase 11 backlog item titled "Tighten Path C active-listing response to allowlist parity with D-05" and link from `09-VERIFICATION.md`.

---

### WR-05: Generic 500 error handler in `getCarDetailHandler` leaks `error.message` to the client

**File:** `../backend-services/carEx-services/server.js:404-407`
**Issue:**
```js
} catch (error) {
  console.error('Fetch car error:', error);
  return res.status(500).json({ message: error.message });
}
```
Pitfall 6 (CastError → 404) is covered by the `mongoose.isValidObjectId` guard at line 341. However, ANY other unhandled error (DB connection drop, Mongoose internal validation, programmer error in the new conditional spread) surfaces as a 500 with `error.message` in the body. Mongoose error messages frequently contain schema field names, collection names, query shapes, or even partial document data. This is below the V7 (error-handling) bar for a customer-facing endpoint.

This is a pre-existing v1.0 pattern (matches server.js:316-318 browse handler), but the Phase 9 changes ADD new failure modes (the bypass-flag chain, the new branching logic, the LISTING_STATUS_POLICY lookup) that could surface novel error shapes.

**Fix:** Mask the 500 response body and rely on `console.error` for internal observability:
```js
} catch (error) {
  console.error('Fetch car error:', error);
  return res.status(500).json({ error: 'internal_error' });
}
```
Apply the same fix to `createPaymentIntentHandler` (server.js:1143-1146) — current `res.status(500).json({ message: error.message })` has the same leak.

---

## Info

### IN-01: Hide hook performs `User.distinct` lookup on EVERY `Car.find()` query

**File:** `../backend-services/carEx-services/src/models/Car.js:63-95`
**Issue:** The pre-existing Phase 3 seller-cascade hook (UNCHANGED in Phase 9) issues `User.distinct('firebaseUid', { ... })` on every `Car.find()` query that does not pass the `includeAllUsers` bypass. The new Phase 9 sibling hook (lines 104-120) does NOT add a DB call (good — direct query mutation only), but the seller-cascade hook's DB call is still in the critical path for every public listing read. As listing volume grows, this is O(N_users) per query. Out of scope per Phase 9 — flagged as a known performance hotspot for QUAL-02 / Phase 11 perf review.
**Fix:** Phase 11 perf review candidate. Materializing the suspended-seller UID list at the User model layer (or a partial index on `status: 'active'`) would eliminate the per-query distinct lookup.

---

### IN-02: `seedFourStatusListings` test helper seeds 0 cars per status when run repeatedly without cleanup

**File:** `../backend-services/carEx-services/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js:46-99`
**Issue:** The test correctly uses `Car.collection.insertMany` to bypass save validators AND the hide hooks. Each call seeds 4 fresh cars. The `beforeEach` at line 31-40 uses `Car.deleteMany({}).setOptions({ includeAllUsers: true, includeAllListingStatuses: true })` to clear. This is correct.
**Fix:** None needed — flagged because the same cleanup pattern is repeated in `confirmBooking.listingTOCTOU.test.js` race case (e) inside the iteration loop at line 359-365. The repeated cleanup-inside-iteration is slow but correct. Consider hoisting to `beforeEach` if the suite becomes flaky.

---

### IN-03: Race case (e) in `confirmBooking.listingTOCTOU.test.js` is described as "flush timing flakiness" but is in fact deterministic

**File:** `../backend-services/carEx-services/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js:353-355,357`
**Issue:** The case comment (line 353-355) says "5 iterations to flush timing flakiness — each iteration MUST produce the same outcome." The plan (W-5 option a) acknowledges the race is deterministic (JS single-threaded event loop guarantees admin always wins). If the outcome is deterministic, 5 iterations does not test flakiness — it tests the same thing 5 times. The case is correct in what it asserts, but the rationale is mismatched with the actual semantics.
**Fix:** Reframe the comment: "5 iterations to detect non-determinism if the underlying scheduling assumption changes" — same iteration count, accurate description. Out of phase code, doesn't affect correctness.

---

### IN-04: Bypass flag `includeAllListingStatuses` is a generic JS option name with no namespacing

**File:** `../backend-services/carEx-services/src/models/Car.js:105`
**Issue:** The bypass flag name `includeAllListingStatuses` is grep-friendly (good) but uses a generic top-level key on Mongoose query options. A future plugin or middleware that accidentally chains `setOptions({ includeAllListingStatuses: true })` on a non-Car model (e.g., on a `ServiceOrder.find()`) is silently a no-op rather than a typo error. Out-of-scope hardening: not all bypass flags need namespacing, but the convention is now established (matches v1.0 `includeAllUsers`).
**Fix:** None for Phase 9. Future audit candidate.

---

### IN-05: `lookupAdminIfPresent` performs an indexed DB lookup on every `GET /api/cars/:id` request

**File:** `../backend-services/carEx-services/src/security/lookupAdminIfPresent.js:26`
**Issue:** The RESEARCH §Pattern 5 caveat acknowledges this is acceptable because AdminUser is a small collection (<100 docs) with an indexed `email` field. The lookup is ~1ms in production. Pre-existing tradeoff vs Firebase custom claims; documented in plan.
**Fix:** None for Phase 9. Phase 11 perf review may revisit.

---

### IN-06: Admin Path A response spreads full `car` document including `null`-valued fields and legacy `lastEditedBy/At`, duplicating data shown in `moderationBadge`

**File:** `../backend-services/carEx-services/server.js:365-372`
**Issue:** The admin Path A response includes both the full `...car` spread (which already contains `moderationReason`, `moderationNote`, `moderatedBy`, `moderatedAt`, `lastEditedBy`, `lastEditedAt`) AND the `moderationBadge` object (which re-projects 5 of those fields under different names). The badge's `reasonCategory` and the doc's `moderationReason` carry the same enum value; the badge's `moderationReason` and the doc's `moderationNote` carry the same free-text. This is intentional per D-07 (admin sees full doc + badge) but is redundant and confusing for clients parsing the response.
**Fix:** Out of scope per D-07; mobile/web client is the consumer and will read `moderationBadge.*` paths exclusively. Documented for Phase 10 mobile planner.

---

### IN-07: `createPaymentIntent` gate returns inconsistent 404 body shape — `{ error: 'car_not_found' }` vs detail handler's `{ message: 'Car not found' }`

**File:** `../backend-services/carEx-services/server.js:1111` vs `server.js:342,347`
**Issue:** `createPaymentIntentHandler` returns `{ error: 'car_not_found' }` for both malformed-id and (potential, with WR-02 fix) missing-doc. `getCarDetailHandler` returns `{ message: 'Car not found' }`. Two different 404 body shapes for the same logical condition. Mobile must branch on the route to parse the 404 correctly.
**Fix:** Pick one shape and apply it consistently. The `{ error: '<code>' }` form is the convention used by confirm-booking error mapping (lines 1175-1204) and matches the new Phase 9 error vocabulary (`listing_not_available`, `provider_suspended`). The detail-handler's `{ message: 'Car not found' }` predates Phase 9 and is preserved by `getCarDetailHandler` for backward compatibility (test case (e) at listingDetailStatusAware.test.js:275 asserts this exact string). Document the asymmetry as a Phase 11 cleanup candidate or accept it as pre-existing.

---

_Reviewed: 2026-05-29T07:27:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
