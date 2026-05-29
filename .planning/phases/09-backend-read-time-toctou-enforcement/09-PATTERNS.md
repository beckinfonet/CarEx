# Phase 9: Backend Read-time + TOCTOU Enforcement — Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 13 (8 backend code + 5 backend tests, plus 3 mobile MODIFY)
**Analogs found:** 13 / 13 (all CREATE files have a real codebase precedent)

> **Split-repo note.** All backend analogs live in the sibling repo
> `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (referred to as
> `BACKEND_REPO` below). Mobile analogs live in this repo at
> `/Users/beckmaldinVL/development/mobileApps/carEx` (`MOBILE_REPO`).
> Every code excerpt in this file was extracted directly from a verified read of the cited file.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `BACKEND_REPO/src/models/Car.js` (MODIFY) | model — Mongoose query middleware | read-time filter | self — existing seller-cascade `pre(/^find/)` at `Car.js:63-95` | exact (same file, sibling hook) |
| `BACKEND_REPO/server.js` GET `/api/cars/:id` (MODIFY) | controller — Express handler | request-response, status-aware projection | existing handler at `server.js:313-328` | exact (same handler, extend in place) |
| `BACKEND_REPO/server.js` POST `/api/payments/create-payment-intent` (MODIFY) | controller — Express handler | request-response, early gate | existing handler at `server.js:1018-1042` | exact (same handler) |
| `BACKEND_REPO/server.js` POST `/api/payments/confirm-booking` error mapping (MODIFY) | controller — error mapper | request-response | existing error mapping at `server.js:1061-1077` | exact |
| `BACKEND_REPO/src/payments/confirmBooking.js` step 4 (MODIFY) | service — transactional re-verify | event-driven inside `session.withTransaction()` | existing step c at `confirmBooking.js:189-207` (seller re-check) | exact (extend in place) |
| `BACKEND_REPO/src/payments/refundAndThrow.js` (CREATE) | utility — shared helper | event-driven (Stripe + throw) | inline `refundThenThrow` at `confirmBooking.js:38-56` being extracted | exact (function being lifted) |
| `BACKEND_REPO/src/payments/listingNotAvailableError.js` (CREATE) — or co-locate with helper | error class | n/a | `ListingServiceError` at `listingErrors.js:17-23` + `ProviderSuspendedError` at `confirmBooking.js:31-36` | exact (twin precedents) |
| `BACKEND_REPO/src/security/lookupAdminIfPresent.js` (CREATE) | middleware — read-only sibling | request-context attach | existing `requireAdmin` at `requireAdmin.js:10-20` — split it | exact (extract first half) |
| `BACKEND_REPO/__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` (CREATE) | test — integration (Mongoose) | DB read-time | `__tests__/enforcement/hideOnFind.test.js:1-99` | exact (direct sibling) |
| `BACKEND_REPO/__tests__/listing-enforcement/listingDetailStatusAware.test.js` (CREATE) | test — integration (HTTP supertest) | HTTP request-response | `__tests__/listing-moderation/requireAdmin.listing.middleware.test.js:1-90` (supertest harness) + `__tests__/enforcement/hideOnFind.test.js` (Car seeding) | role-match (no existing GET `/api/cars/:id` supertest, but harness pattern verified) |
| `BACKEND_REPO/__tests__/listing-enforcement/createPaymentIntent.gate.test.js` (CREATE) | test — integration (HTTP + Stripe mock) | HTTP request-response | `__tests__/enforcement/confirmBooking.transaction.test.js:26-36` (Stripe mock) + supertest harness above | role-match (Stripe mock pattern is exact; HTTP wrapping is new) |
| `BACKEND_REPO/__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` (CREATE) | test — integration (txn) | event-driven txn | `__tests__/enforcement/confirmBooking.transaction.test.js` (the verified 7-case suite) | exact (direct template — copy fixtures + Stripe mock + seedHappyPath) |
| `BACKEND_REPO/__tests__/listing-enforcement/refundAndThrow.helper.test.js` (CREATE) | test — unit | function-scoped | `__tests__/listing-moderation/listingCapabilities.test.js:1-60` (small unit-style test with MongoMemoryServer optional) | role-match (closest unit-test pattern; no pure-function-only test file exists yet) |
| `MOBILE_REPO/src/services/AuthService.ts` (MODIFY) | service — axios call site error handling | request-response error parsing | existing `signUp` / `signIn` error pattern at `AuthService.ts:14-25, 27-38` and the existing `confirmBooking` shape at `AuthService.ts:392-404` | exact (same file, same idiom) |
| `MOBILE_REPO/src/services/http/client.ts` (VERIFY — no edits expected) | service — global axios interceptor | request-response | existing 403 interceptor at `client.ts:98-126` | exact (verify-only; no change) |
| `MOBILE_REPO/src/constants/translations.ts` (MODIFY) | constants — i18n strings | static read | existing moderation-banner block at `translations.ts:505-516` (Phase 6 affected-user UX) | exact (same file, same block) |

---

## Pattern Assignments

### 1. `src/models/Car.js` (MODIFY) — model, read-time hide hook

**Analog:** `BACKEND_REPO/src/models/Car.js:63-95` (the existing seller-cascade `pre(/^find/)` hook)

**Imports pattern** (lines 5–6 — already present, no new imports needed):
```js
const mongoose = require('mongoose');
```

**Bypass-flag short-circuit + `$and` combine pattern — copy verbatim shape** (lines 63–95):
```js
carSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { sellerStatus: { $ne: 'APPROVED' } },
    ],
  });
  // CR-01 fix: preserve the caller's filter on the join key (sellerId) by
  // AND-ing the $nin hide clause with any existing sellerId condition.
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

**What to copy:** Outer `carSchema.pre(/^find/, ...)` registration shape; the `if (this.getOptions().XXX) return;` short-circuit; the `currentQuery` / `existingClause` / `$and` combine idiom (Pitfall 2 in RESEARCH.md — admin filter on `status: 'deleted'` must not be clobbered by the hook's default `status: 'active'`).

**What to adapt:**
- Replace `includeAllUsers` → `includeAllListingStatuses`
- Drop the `User.distinct(...)` join — the listing filter is a direct field on `Car.status`, no cross-model lookup needed
- Replace `sellerId` join key with `status`; replace `{ $nin: hiddenUids }` with `'active'` (or `{ $eq: 'active' }`)
- Use a synchronous `function (next) { ... next(); }` shape (no `await`) since no DB call is needed — matches RESEARCH.md §Pattern 1 example

**Anti-pattern guard (mirrored from CR-01 fix that lives in this same file):** existing tests already cover the `$and`-combine pattern for `sellerId`. Phase 9 must mirror it for `status`.

---

### 2. `server.js` GET `/api/cars/:id` (MODIFY) — controller, status-aware projection (LENF-02)

**Analog:** `BACKEND_REPO/server.js:313-328` (current handler — minimal, no auth, no branching)

**Existing handler shape** (lines 313–328):
```js
app.get('/api/cars/:id', async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).lean();
    if (!car) return res.status(404).json({ message: 'Car not found' });
    res.json({
      ...car,
      id: car._id.toString(),
      make: car.makeName || car.make || '',
      model: car.modelName || car.model || '',
      listingStatus: car.listingStatus || 'active',
    });
  } catch (error) {
    console.error('Fetch car error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

**What to copy:**
- Outer `app.get('/api/cars/:id', ...)` registration
- Same `try/catch` → 500 fallback shape
- Same final spread+map for `id` / `make` / `model` / `listingStatus` (admin branch keeps this verbatim)

**What to adapt (5 changes):**
1. Add `mongoose.isValidObjectId(req.params.id)` guard at top → 404 not 500 (Pitfall 6 in RESEARCH.md; precedent: Phase 8 review WR-05 fix)
2. Add `attachAuthIfPresent, lookupAdminIfPresent` middleware chain (new sibling middleware — see Pattern Assignment §8 below)
3. Chain `.setOptions({ includeAllListingStatuses: true })` on `Car.findById` (D-08 — handler bypasses hook to allow lookup of any status)
4. Branch on `!!req.admin` for the response shape:
   - Admin + `car.status !== 'active'`: existing spread + add `moderationBadge: { status, reasonCategory: car.moderationReason, moderationReason: car.moderationNote, moderatedBy, moderatedAt }` (D-07; note A1 from RESEARCH.md Open Questions §1 on field naming)
   - Admin + `car.status === 'active'`: existing spread, NO `moderationBadge` key (Pitfall 4 — use conditional spread `...(badge ? { moderationBadge: badge } : {})`)
   - Non-admin + `car.status === 'active'`: existing spread verbatim
   - Non-admin + `car.status !== 'active'`: thin payload from D-05 allowlist ONLY (never spread `car`)
5. Import `LISTING_STATUS_POLICY` from `src/moderation/listingCapabilities` at top of `server.js`

**Thin-payload field allowlist (D-05, LOCKED):**
```js
{
  carId: car._id.toString(),
  status: car.status,
  reasonCategory: car.moderationReason,
  title: `${car.year || ''} ${car.makeName || car.make || ''} ${car.modelName || car.model || ''}`.trim(),
  make: car.makeName || car.make || '',
  model: car.modelName || car.model || '',
  year: car.year,
  price: car.price,
  firstPhotoUrl: Array.isArray(car.imageUrls) && car.imageUrls.length > 0 ? car.imageUrls[0] : null,
  banner: LISTING_STATUS_POLICY[car.status]?.banner ?? null,
}
```
Never spread `car` into this object (Pitfall 5 — would re-add the excluded fields).

---

### 3. `server.js` POST `/api/payments/create-payment-intent` (MODIFY) — controller, early 409 gate (LENF-03 cart-add)

**Analog:** `BACKEND_REPO/server.js:1018-1042` (current handler)

**Existing handler** (lines 1018–1042):
```js
app.post('/api/payments/create-payment-intent', attachAuthIfPresent, requireNotSuspended('create_order'), async (req, res) => {
  try {
    const { currency = 'kgs', carId, buyerUid } = req.body;
    if (!buyerUid) return res.status(400).json({ message: 'buyerUid required' });

    const amount = currency === 'usd' ? BOOKING_FEE_USD : BOOKING_FEE_KGS;
    const stripeCurrency = currency === 'usd' ? 'usd' : 'kgs';

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: stripeCurrency,
      metadata: { carId: carId || '', buyerUid },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: stripeCurrency,
    });
  } catch (error) {
    console.error('Create PaymentIntent error:', error);
    res.status(500).json({ message: error.message });
  }
});
```

**What to copy:**
- Outer route signature including `attachAuthIfPresent, requireNotSuspended('create_order')` middleware chain — leave as-is
- The `try/catch` wrapper and 500 fallback
- All existing Stripe call and response shaping

**What to adapt:**
Insert a new pre-Stripe block IMMEDIATELY AFTER the `buyerUid` guard and BEFORE `const amount = ...`:
```js
// Phase 9 LENF-03 cart-add gate (D-09) — fires BEFORE any Stripe API call.
if (carId) {
  if (!mongoose.isValidObjectId(carId)) {
    return res.status(404).json({ error: 'car_not_found' });
  }
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
}
```

**Imports to add at top of `server.js`** (if not already present after LENF-02): `mongoose`, `LISTING_STATUS_POLICY`.

**Critical:** `.select('status moderationReason')` keeps the read narrow. Bypass flag is REQUIRED — without it the hide hook returns `null` for any non-active listing and the gate would silently fall through to the Stripe call (Pitfall 1 variant).

---

### 4. `server.js` POST `/api/payments/confirm-booking` error mapping (MODIFY) — controller

**Analog:** `BACKEND_REPO/server.js:1049-1082` (current handler — thin delegation + error map)

**Existing error mapping** (lines 1061–1077):
```js
if (err instanceof ProviderSuspendedError) {
  return res.status(409).json({
    error: 'provider_suspended',
    providerUid: err.providerUid,
    refundId: err.refundId,
    refundFailed: err.refundFailed,
  });
}
if (err && (err.code === 'invalid_payment_intent' || err.message === 'invalid_payment_intent')) {
  return res.status(400).json({
    error: 'invalid_payment_intent',
    message: 'PaymentIntent is not succeeded',
  });
}
if (err && err.message === 'car_not_found') {
  return res.status(404).json({ error: 'car_not_found' });
}
```

**What to copy:** The exact `if (err instanceof XError)` branch pattern.

**What to adapt:** Add a NEW branch ABOVE the `ProviderSuspendedError` check (Pitfall 10 — order matters if the class extends `ProviderSuspendedError`):
```js
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
```

**Import to add at top of `server.js`:** `const { ListingNotAvailableError } = require('./src/payments/refundAndThrow');` (or whichever module exports it — see Pattern Assignment §7).

---

### 5. `src/payments/confirmBooking.js` step 4 (MODIFY) — service, transactional re-verify (LENF-03 confirm-booking)

**Analog:** `BACKEND_REPO/src/payments/confirmBooking.js:189-207` (the existing step c — seller re-check + car flip)

**Existing step c** (lines 189–207):
```js
// ---- c. Seller re-check + car flip ---------------------------------
const car = await Car.findById(carId)
  .setOptions({ includeAllUsers: true })
  .session(session);
if (!car) {
  throw new Error('car_not_found');
}

const sellerUser = await User.findOne({ firebaseUid: car.sellerId })
  .setOptions({ includeAllUsers: true })
  .session(session)
  .lean();
if (
  !sellerUser ||
  sellerUser.moderationStatus?.state !== 'active' ||
  sellerUser.sellerStatus !== 'APPROVED'
) {
  await refundThenThrow(stripe, paymentIntentId, 'provider_suspended', car.sellerId);
}

car.listingStatus = 'booked';
```

**Existing inline refund helper at `confirmBooking.js:40-56` (the function being extracted):**
```js
async function refundThenThrow(stripe, paymentIntentId, errorCode, providerUid) {
  let refundId = null;
  let refundFailed = false;
  try {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    refundId = refund.id;
  } catch (err) {
    refundFailed = true;
    console.error('[confirmBooking] Stripe refund failed:', err);
  }
  const err = new ProviderSuspendedError(errorCode);
  err.providerUid = providerUid;
  err.refundId = refundId;
  err.refundFailed = refundFailed;
  throw err;
}
```

**What to copy:**
- Two-step structure: `Car.findById(carId).setOptions(...).session(session)` then conditional re-check then `refund*` helper call
- `await` on the helper (required so the `throw` aborts the txn)
- `car.listingStatus = 'booked'` mutation pattern at end

**What to adapt — three changes (D-12 / D-13 / D-14):**
1. Chain BOTH bypass flags on the Car lookup (Pitfall 1):
   ```js
   const car = await Car.findById(carId)
     .setOptions({ includeAllUsers: true, includeAllListingStatuses: true })
     .session(session);
   ```
2. Add the NEW assertion BELOW the existing seller-not-active check, BEFORE `car.listingStatus = 'booked'`:
   ```js
   if (car.status !== 'active') {
     const banner = LISTING_STATUS_POLICY[car.status]?.banner ?? null;
     await refundAndThrow(stripe, paymentIntentId, {
       error: 'listing_not_available',
       listingStatus: car.status,
       reasonCategory: car.moderationReason,
       banner,
     });
   }
   ```
3. Refactor the 3 existing call sites of `refundThenThrow` to use the new helper signature (D-15):
   - `refundThenThrow(stripe, paymentIntentId, 'provider_suspended', buyerUid)` → `refundAndThrow(stripe, paymentIntentId, { error: 'provider_suspended', providerUid: buyerUid })`
   - same pattern for the 2 other sites at lines 152 and 167
4. Remove the inline `refundThenThrow` function definition (lines 38–56) once all call sites are migrated.
5. Add `require` for the new helper + `LISTING_STATUS_POLICY` at top of file:
   ```js
   const { refundAndThrow, ListingNotAvailableError } = require('./refundAndThrow');
   const { LISTING_STATUS_POLICY } = require('../moderation/listingCapabilities');
   ```

**Regression risk callout (D-15):** the existing `__tests__/enforcement/confirmBooking.transaction.test.js` (7 cases) MUST be re-run after the refactor — these tests exercise the 3 v1.0 refund call sites that are now going through the new helper.

---

### 6. `src/payments/refundAndThrow.js` (CREATE) — utility, shared helper (D-14)

**Analog:** the existing inline `refundThenThrow` at `BACKEND_REPO/src/payments/confirmBooking.js:38-56` (function being lifted out). See full excerpt under §5 above.

**What to copy:**
- The `let refundId = null; let refundFailed = false;` accumulator pattern
- The `try { await stripe.refunds.create(...) } catch { refundFailed = true; console.error(...) }` ordering (refund-first-throw-second per D-11)
- The error-instance construction with property attachment (`err.refundId`, `err.refundFailed`)

**What to adapt:**
- Change signature from `(stripe, paymentIntentId, errorCode, providerUid)` to `(stripe, paymentIntentId, errorBody)` per D-14 — caller passes the full body shape
- Add Stripe idempotency key (RESEARCH.md Pitfall 3 + Open Question A3): `{ idempotencyKey: \`refund-${paymentIntentId}\` }` as the second argument to `stripe.refunds.create`
- Discriminate by `errorBody.error`:
  - `'listing_not_available'` → throw a new `ListingNotAvailableError`
  - any other code → throw a `ProviderSuspendedError` (preserves v1.0 contract for the 3 existing call sites)
- Export BOTH the helper and the new error class so `server.js` error mapping (Pattern §4) can `instanceof`-check

**Minimal target shape:**
```js
const { ProviderSuspendedError } = require('./confirmBooking');  // or move both classes here

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
    const refund = await stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-${paymentIntentId}` }
    );
    refundId = refund.id;
  } catch (err) {
    refundFailed = true;
    console.error('[refundAndThrow] Stripe refund failed:', err);
  }
  const enriched = { ...errorBody, refundId, refundFailed };
  if (errorBody.error === 'listing_not_available') {
    throw new ListingNotAvailableError(enriched);
  }
  const err = new ProviderSuspendedError(errorBody.error);
  Object.assign(err, enriched);
  throw err;
}

module.exports = { refundAndThrow, ListingNotAvailableError };
```

**Module-location call-out (Claude's Discretion per CONTEXT D-14 alternates):** circular-require risk between `refundAndThrow.js` and `confirmBooking.js` if both try to require each other for `ProviderSuspendedError`. Two safe options for the planner:
- **Option A:** Move `ProviderSuspendedError` class definition into `refundAndThrow.js`, re-export it from `confirmBooking.js` for backward compat
- **Option B:** Create a third file `src/payments/errors.js` that owns both error classes; both `refundAndThrow.js` and `confirmBooking.js` require from it

---

### 7. `ListingNotAvailableError` class (CREATE or co-locate)

**Twin analogs:**
- `BACKEND_REPO/src/payments/confirmBooking.js:31-36` — `ProviderSuspendedError`:
  ```js
  class ProviderSuspendedError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ProviderSuspendedError';
    }
  }
  ```
- `BACKEND_REPO/src/moderation/listingErrors.js:17-23` — `ListingServiceError`:
  ```js
  class ListingServiceError extends Error {
    constructor(code) {
      super(code);
      this.name = 'ListingServiceError';
      this.code = code;
    }
  }
  ```

**What to copy:** Either pattern is acceptable. `ProviderSuspendedError` is the closer analog (used inside `confirmBooking.js` already; `instanceof` checked in `server.js:1061`). Phase 9 should extend the same idiom — see body of helper in §6 above.

**What to adapt:** Accept a body object (not just a string) so all six fields (`error, listingStatus, reasonCategory, banner, refundId, refundFailed`) attach in one shot. The CONTEXT D-11 body shape is the contract.

---

### 8. `src/security/lookupAdminIfPresent.js` (CREATE) — middleware, read-only admin attach (D-08)

**Analog:** `BACKEND_REPO/src/security/requireAdmin.js:10-20` (split this into two)

**Existing `requireAdmin`** (lines 10–20 — full file content):
```js
async function requireAdmin(req, res, next) {
  if (!req.auth || !req.auth.email) {
    return res.status(403).json({ error: 'unauthorized', message: 'Admin access required' });
  }
  const admin = await AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean();
  if (!admin) {
    return res.status(403).json({ error: 'unauthorized', message: 'Admin access required' });
  }
  req.admin = { uid: req.auth.uid, role: admin.role, email: admin.email };
  return next();
}
```

**Existing `attachAuthIfPresent` companion** (lines 20–34 of `attachAuthIfPresent.js`):
```js
async function attachAuthIfPresent(req, res, next) {
  const header = req.header('authorization') || req.header('Authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return next();  // dual-accept
  }
  try {
    const admin = ensureInitialized();
    const decoded = await admin.auth().verifyIdToken(match[1], true);
    req.auth = { uid: decoded.uid, email: decoded.email, claims: decoded };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Missing or invalid idToken' });
  }
}
```

**What to copy:**
- The `req.auth?.email` guard idiom
- The `AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean()` lookup
- The `req.admin = { uid, role, email }` attach shape (downstream handler reads `!!req.admin`)
- The "no 401, just `next()`" pattern from `attachAuthIfPresent` for non-admin / anonymous callers

**What to adapt:** REMOVE both 403 returns from `requireAdmin`. Replace with bare `next()` so the listing-detail handler (Pattern §2) sees `req.admin = undefined` for non-admin and treats them as thin-payload recipients.

**Target shape (verified against RESEARCH.md §Pattern 5 Option A):**
```js
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

**Mount on `GET /api/cars/:id`** (Pattern §2):
```js
app.get('/api/cars/:id', attachAuthIfPresent, lookupAdminIfPresent, async (req, res) => { ... });
```

**Open question** (A2 in RESEARCH.md, Open Question 4): perf of one extra `AdminUser.findOne` per listing-detail view. Accept for Phase 9; Phase 11 may revisit via Firebase custom claims.

---

### 9. `__tests__/listing-enforcement/hideOnFind.listingStatus.test.js` (CREATE) — LENF-01

**Analog:** `BACKEND_REPO/__tests__/enforcement/hideOnFind.test.js:1-99` (direct sibling — same shape, swap field)

**Imports + setup pattern** (lines 23–39):
```js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
const User = require('../../src/models/User');
const Car = require('../../src/models/Car');
const Broker = require('../../src/models/Broker');
const LogisticsPartner = require('../../src/models/LogisticsPartner');

let rs;

beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });

beforeEach(async () => {
  await User.deleteMany({});
  await Car.deleteMany({ /* no filter */ }).setOptions({ includeAllUsers: true });
  // ...
});
```

**Seed + assert pattern** (lines 52–99):
```js
async function seedActiveSellerWithCar() {
  await User.create({
    firebaseUid: SELLER_UID, email: 'seller@test.local',
    sellerStatus: 'APPROVED',
    moderationStatus: { state: 'active', severity: 'none' },
  });
  const car = await Car.create({
    sellerId: SELLER_UID, makeName: 'Toyota', modelName: 'Corolla',
    year: 2020, price: 15000, listingStatus: 'active',
  });
  return car;
}

test('suspend seller -> Car.find({}) returns []; ...', async () => {
  // ...
  await User.updateOne({ firebaseUid: SELLER_UID }, { $set: { 'moderationStatus.state': 'blocked_with_review' } });
  const publicFound = await Car.find({});
  expect(publicFound).toHaveLength(0);
  const raw = await Car.findById(car._id).setOptions({ includeAllUsers: true });
  expect(raw).not.toBeNull();
});
```

**What to copy:** Entire harness — `MongoMemoryReplSet`, `beforeAll`/`afterAll`/`beforeEach`, `seedActiveSellerWithCar` shape, the `Car.find` + `Car.findById` + `setOptions(bypass)` assertion triple.

**What to adapt:**
- Mutate `status` (the new field) instead of `moderationStatus.state`. Seed sellers as fully active so the seller-cascade hook does NOT hide them — the listing-status hook is the only gate exercised.
- Bypass flag is `includeAllListingStatuses` (not `includeAllUsers`)
- Add test cases for each of the 4 statuses: `active` visible by default, `suspended/archived/deleted` hidden by default, all 4 visible under bypass.
- Add Pitfall 2 test: admin queries `Car.find({ status: 'deleted' }).setOptions({ includeAllListingStatuses: true })` returns deleted listings (combined `$and` shape works).
- VALIDATION.md says also add a route-level supertest assertion (`GET /api/cars` returns zero non-active listings) — share harness with §10.

---

### 10. `__tests__/listing-enforcement/listingDetailStatusAware.test.js` (CREATE) — LENF-02

**Closest analog (HTTP harness):** `BACKEND_REPO/__tests__/listing-moderation/requireAdmin.listing.middleware.test.js:1-90` (supertest + firebase-admin mock)

**Supertest + firebase-admin mock pattern** (lines 16–55):
```js
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  const mock = {
    credential: { cert: jest.fn(() => ({})) },
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
  };
  mock.__verifyIdTokenMock = verifyIdTokenMock;
  return mock;
});

const admin = require('firebase-admin');
const AdminUser = require('../../src/models/AdminUser');

let mongo, app;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
  app = express();
  app.use(express.json());
  // Phase 9 — mount the LENF-02 modified handler with the new middleware chain
});
```

**Assertion pattern from same file** (lines 69–90):
```js
test('no Authorization header → 401 ...', async () => {
  const res = await request(app).get('/api/admin/moderation/listings/ping');
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: '...', message: '...' });
});
```

**What to copy:**
- The `MongoMemoryServer` + `mongoose.connect` harness
- The `jest.mock('firebase-admin', ...)` + `verifyIdTokenMock.mockResolvedValueOnce({ uid, email })` pattern for simulating authenticated admin vs anonymous callers
- The `app.use(express.json()); app.get('/api/cars/:id', ...)` mounting style
- The `request(app).get('/api/cars/:id').set('Authorization', 'Bearer x')` invocation

**What to adapt:**
- Mount the new middleware chain: `attachAuthIfPresent, lookupAdminIfPresent` + the modified handler
- Seed Car directly via `Car.collection.insertOne()` (mirror `suspendListing.test.js:50-60`) so the seller-cascade hook doesn't interfere
- Test cases per VALIDATION.md:
  - Non-admin GET on `suspended` listing → 200 + thin payload with EXACTLY the D-05 allowlist (use `expect(Object.keys(body).sort())` against the locked list)
  - `expect(body).not.toHaveProperty('sellerEmail' / 'description' / 'moderationNote' / etc.)` for each excluded field
  - Admin GET on `suspended` → full doc + `moderationBadge` with 5 fields
  - Admin GET on `active` → full doc, `expect(body).not.toHaveProperty('moderationBadge')` (Pitfall 4)
  - GET on non-existent id → 404
  - GET on malformed id → 404, not 500 (Pitfall 6)

**Match quality:** role-match. No existing `GET /api/cars/:id` supertest exists (RESEARCH.md A4); the harness pattern is reusable verbatim, but the route assertion is greenfield.

---

### 11. `__tests__/listing-enforcement/createPaymentIntent.gate.test.js` (CREATE) — LENF-03 cart-add half

**Closest analog (Stripe mock):** `BACKEND_REPO/__tests__/enforcement/confirmBooking.transaction.test.js:26-36`

**Stripe mock pattern** (lines 26–36, verified verbatim from RESEARCH.md §Example 5):
```js
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

**Mock reset + default pattern** (lines 105–108):
```js
stripeFactory.__paymentIntentsRetrieveMock.mockReset();
stripeFactory.__refundsCreateMock.mockReset();
stripeFactory.__paymentIntentsRetrieveMock.mockResolvedValue({ status: 'succeeded' });
stripeFactory.__refundsCreateMock.mockResolvedValue({ id: 're_mock_123' });
```

**What to copy:**
- The exact `jest.mock('stripe', ...)` factory + the `__xxxMock` exposure trick
- `MongoMemoryReplSet` harness from `__tests__/_helpers/mongoReplSet.js` (in case the gate ever wraps in a txn — currently it doesn't, but the mock factory needs it for parity)
- `supertest` HTTP wrapper (from §10 analog)

**What to adapt:**
- Mock `stripe.paymentIntents.create` (NOT `retrieve` — this is the create path)
- Tests per VALIDATION.md:
  - `carId` of `suspended` listing → POST returns 409 + D-11 body
  - `stripe.paymentIntents.create` mock NOT called when `carId` is suspended (`expect(createMock).not.toHaveBeenCalled()`)
  - `carId` of `active` listing → proceeds normally, returns `clientSecret`
  - All 3 non-active statuses (suspended/archived/deleted) return 409 with the correct banner block per `LISTING_STATUS_POLICY`

**Match quality:** role-match. The Stripe mock factory is byte-for-byte reusable; the HTTP gate logic is new (no precedent for create-payment-intent supertest).

---

### 12. `__tests__/listing-enforcement/confirmBooking.listingTOCTOU.test.js` (CREATE) — LENF-03 confirm-booking half

**Analog:** `BACKEND_REPO/__tests__/enforcement/confirmBooking.transaction.test.js` (the verified 7-case suite — direct template)

**Imports + fixture pattern** (lines 25–110, abridged):
```js
jest.mock('stripe', () => { /* see §11 */ });

const mongoose = require('mongoose');
const stripeFactory = require('stripe');
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');

// Register canonical ServiceOrder name with loose schema BEFORE requiring confirmBooking
if (!mongoose.models.ServiceOrder) {
  const serviceOrderSchema = new mongoose.Schema({ /* loose */ }, { strict: false });
  mongoose.model('ServiceOrder', serviceOrderSchema, 'service_orders');
}

const User = require('../../src/models/User');
const Car = require('../../src/models/Car');
const { confirmBooking, ProviderSuspendedError } = require('../../src/payments/confirmBooking');

const stripe = stripeFactory();
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });

beforeEach(async () => {
  await User.deleteMany({});
  await Car.deleteMany({}).setOptions({ includeAllUsers: true });
  // ...
  stripeFactory.__refundsCreateMock.mockResolvedValue({ id: 're_mock_123' });
});

async function seedHappyPath(overrides = {}) {
  const buyerUid = overrides.buyerUid || 'buyer-1';
  // ... full seed: User (buyer), User (provider), User (seller), Car
}
```

**What to copy (verbatim where possible):**
- Entire test-file scaffolding (jest.mock, imports, beforeAll/afterAll/beforeEach, ServiceOrder loose-schema register, `seedHappyPath` helper)
- The 7-case structure as a starting menu — Phase 9 adds parallel cases for listing-status TOCTOU
- The Promise.allSettled race-test idiom from case 6 (D-13 race)

**What to adapt — new test cases per VALIDATION.md:**
- Listing flipped to `suspended` between create-payment-intent and confirm-booking: confirm returns 409 + body has `refundId`, no orders, car NOT flipped to `booked`
- Stripe refund called BEFORE the throw (use `jest.fn.mock.invocationCallOrder` for ordering)
- Refund failure: `__refundsCreateMock.mockRejectedValue(new Error('stripe down'))` → response body has `refundFailed: true`, `refundId: null`
- `withTransaction` retry does NOT issue a second refund (assert `idempotencyKey` was passed via `__refundsCreateMock.mock.calls[0][1]`)
- Concurrent admin.suspendListing + confirm — exactly one outcome (refund-abort OR booking-then-suspend)
- Route-level supertest: `ListingNotAvailableError` thrown from service maps to `409 listing_not_available` with D-11 body (uses §10 harness on top of this fixture)
- Regression: re-import existing test cases that exercise the 3 v1.0 refund call sites (now routed through the new helper) — copy or symlink test case sources to ensure zero diff (D-15)

**Match quality:** EXACT. This is the closest analog in either repo — copy the entire file structure and add the listing assertions.

---

### 13. `__tests__/listing-enforcement/refundAndThrow.helper.test.js` (CREATE) — D-14 unit tests

**Closest analog (small unit-style harness):** `BACKEND_REPO/__tests__/listing-moderation/listingCapabilities.test.js:1-60`

**Setup pattern** (lines 1–14):
```js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
```

**Assertion idiom** (lines 22–62):
```js
describe('LISTING_STATUS_POLICY + resolveBlockedBuyerActions (LDATA-01)', () => {
  test('active state has empty buyerBlocked + null banner', () => {
    expect(LISTING_STATUS_POLICY.active.buyerBlocked).toEqual([]);
    expect(LISTING_STATUS_POLICY.active.banner).toBeNull();
  });
  // ...
});
```

**What to copy:** The minimal `MongoMemoryServer` setup (likely overkill here — `refundAndThrow` is pure logic + Stripe mock — but matches house style); the `describe` / `test` structure.

**What to adapt:**
- Drop the Mongo harness if not needed — pure function tests can skip it
- Add the Stripe mock factory from §11
- Test cases per VALIDATION.md LENF-03 (D-14 helper):
  - `refundAndThrow(stripe, 'pi_1', { error: 'listing_not_available', ... })` calls `stripe.refunds.create` ONCE with `idempotencyKey: 'refund-pi_1'`
  - Throws an instance of `ListingNotAvailableError` with `errorBody.error === 'listing_not_available'`
  - On Stripe success, thrown error has `refundId === 're_mock_123'` and `refundFailed === false`
  - On Stripe failure (mockRejectedValue), thrown error has `refundFailed === true` and `refundId === null`
  - Discriminator: when `errorBody.error === 'provider_suspended'`, throws `ProviderSuspendedError` (NOT `ListingNotAvailableError`) — preserves v1.0 contract

**Match quality:** role-match. No existing pure-function unit-test file with Stripe mock; this is the closest unit-test idiom in the repo.

---

### 14. `MOBILE_REPO/src/services/AuthService.ts` (MODIFY) — service, axios error parsing

**Analogs (in same file):**
- Existing `confirmBooking` shape at `AuthService.ts:392-404`:
  ```ts
  confirmBooking: async (paymentIntentId: string, carId: string, buyerUid: string) => {
    try {
      const response = await apiClient.post('/api/payments/confirm-booking', {
        paymentIntentId, carId, buyerUid,
      }, { timeout: 30000 });
      return response.data;
    } catch (error) {
      console.error('Failed to confirm booking', error);
      throw error;
    }
  },
  ```
- Existing Firebase error-body unwrap at `AuthService.ts:14-25`:
  ```ts
  signUp: async (email, password) => {
    try {
      const response = await axios.post(`${AUTH_URL}:signUp?key=${API_KEY}`, { ... });
      return response.data;
    } catch (error) {
      throw error.response ? error.response.data.error : error;
    }
  },
  ```

**What to copy:**
- The try/catch wrapper
- The `error.response?.data` unwrap idiom
- The bare `throw` of a structured error to the screen

**What to adapt:**
- Catch the 409 response from confirm-booking and create-payment-intent, detect `error.response?.data?.error === 'listing_not_available'`, and either:
  - Throw a typed error class (mirror `MOBILE_REPO/src/services/moderation/errors.ts:1-12` — `ModerationError`)
  - OR throw the raw `error.response.data` body so the screen can parse `{ listingStatus, reasonCategory, banner, refundId, refundFailed }`
- Phase 9 is BACKEND ONLY per CONTEXT — RESEARCH.md confirms mobile work is Phase 10. The PATTERNS entry here exists ONLY because the user explicitly called out the file in pattern context. **Recommend deferring this edit to Phase 10** unless the planner has reason to land it early.

**Match quality:** EXACT (same file, same idiom). But scope-flagged for deferral.

---

### 15. `MOBILE_REPO/src/services/http/client.ts` (VERIFY ONLY — no edits expected)

**Analog (self):** existing 403 interceptor at `client.ts:98-126`:
```ts
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const res = err.response;
    const isAcctSuspended =
      res?.status === 403 && res?.data?.error === ACCOUNT_SUSPENDED;
    const skipFlag =
      (err.config as AxiosRequestConfig | undefined)
        ?._skipModerationInterceptor === true;

    if (isAcctSuspended && !skipFlag) { /* trigger refresh + throw ModerationError */ }
    throw err;
  },
);
```

**What to confirm (Pitfall 7 in RESEARCH.md):**
- Interceptor matches on `status === 403` + `error === 'account_suspended'` ONLY
- A 409 `listing_not_available` response will NOT match the `isAcctSuspended` check, so it passes through to the caller (`AuthService.confirmBooking` / `createPaymentIntent`) untouched
- No code change required in Phase 9; the `_skipModerationInterceptor` flag does NOT need to be set on 409 paths because the interceptor never fires

**What to document in `09-VERIFICATION.md`:** "Verified that `client.ts:98-126` 403 interceptor does not intercept 409 `listing_not_available`. Phase 10 mobile handler can rely on raw axios error propagation."

**Match quality:** EXACT (same file, verify-only).

---

### 16. `MOBILE_REPO/src/constants/translations.ts` (MODIFY) — i18n strings

**Analog:** existing Phase 6 moderation-banner block at `translations.ts:505-516`:
```ts
RU: {
  // ...
  errAlreadyAtSeverity: 'Пользователь уже в этом статусе.',
  errNotSuspended: 'Пользователь не заблокирован.',
  errAccountSuspended: 'Действие заблокировано: ваш аккаунт ограничен.',
  errNetwork: 'Ошибка сети. Проверьте подключение.',
  errGeneric: 'Не удалось выполнить действие.',
  // ...
}
```

EN parity lives at `translations.ts:1197+` (verified via grep — `errNotSuspended: 'User is not suspended.'` at line 1197).

**What to copy:** Key-value pair style; "category prefix" naming (`err...`, `toast...`); RU and EN sections kept symmetric.

**What to adapt:**
- Add 6 new keys per LISTING_STATUS_POLICY (Phase 7 D-14b): `listingBannerSuspendedTitle`, `listingBannerSuspendedBody`, `listingBannerArchivedTitle`, `listingBannerArchivedBody`, `listingBannerDeletedTitle`, `listingBannerDeletedBody`
- Optionally add 5 reason-category strings (`listingReasonSpam`, `listingReasonPolicyViolation`, `listingReasonFraud`, `listingReasonInactiveSeller`, `listingReasonOther`)
- Add RU first per CarEx convention (project default language); add EN parity per project constraint "all moderator and affected-user strings are RU-first and must have EN parity"

**Scope flag:** Phase 9 is BACKEND ONLY per CONTEXT scope; RESEARCH.md says "Phase 11 binds RU/EN copy to them." This entry exists because the user prompt named the file. **Recommend deferring to Phase 11 (LQUAL-01 finalizes translations)** unless planner has reason to ship keys early.

**Match quality:** EXACT (same file, same block style).

---

## Shared Patterns

### S-1: Bypass-flag short-circuit at top of `pre(/^find/)` hook
**Source:** `BACKEND_REPO/src/models/Car.js:64`
**Applies to:** §1 (new Phase 9 hook)
**Excerpt:**
```js
if (this.getOptions().includeAllUsers) return;
```
Always check the bypass flag FIRST. Default behavior is hide-safely.

### S-2: `$and`-combine when caller already filters on the hook's join key
**Source:** `BACKEND_REPO/src/models/Car.js:79-93` (CR-01 fix preserved)
**Applies to:** §1 (Pitfall 2 mitigation — admin queries `status: 'deleted'` must work)
**Excerpt:**
```js
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
```

### S-3: Chained bypass flags inside `session.withTransaction()`
**Source:** `BACKEND_REPO/src/moderation/listingService.js:402, 425, 523, 541, 640, 658, 787, 811` (Phase 8 already does this in 8 sites)
**Applies to:** §5 (confirm-booking step 4 must chain BOTH flags)
**Excerpt:**
```js
const current = await Car.findById(carId)
  .setOptions({ includeAllListingStatuses: true, includeAllUsers: true })
  .session(session)
  .lean();
```

### S-4: Refund-first-throw-second invariant (D-11)
**Source:** `BACKEND_REPO/src/payments/confirmBooking.js:38-56`
**Applies to:** §6 (new helper preserves the same invariant)
**Excerpt:**
```js
async function refundThenThrow(stripe, paymentIntentId, errorCode, providerUid) {
  let refundId = null;
  let refundFailed = false;
  try {
    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    refundId = refund.id;
  } catch (err) {
    refundFailed = true;
    console.error('[confirmBooking] Stripe refund failed:', err);
  }
  const err = new ProviderSuspendedError(errorCode);
  err.providerUid = providerUid;
  err.refundId = refundId;
  err.refundFailed = refundFailed;
  throw err;
}
```
NEVER throw before the refund attempt. The Stripe call MUST happen first.

### S-5: `mongoose.isValidObjectId` guard at top of any handler that takes `:id`
**Source:** Phase 8 review WR-05 fix (`listingService.js:100` — `// WR-05: malformed carId → listing_not_found`)
**Applies to:** §2 (GET `/api/cars/:id`) and §3 (POST create-payment-intent gate)
**Excerpt:**
```js
if (!mongoose.isValidObjectId(req.params.id)) {
  return res.status(404).json({ message: 'Car not found' });
}
```
Maps CastError to 404, not 500 — preserves do-not-leak symmetry.

### S-6: Express handler `try { ... } catch (error) { console.error; res.status(500).json({ message }) }`
**Source:** `BACKEND_REPO/server.js:313-328, 1018-1042` (every handler in the file)
**Applies to:** §2, §3, §4
**Excerpt:**
```js
try {
  // handler body
} catch (error) {
  console.error('Fetch car error:', error);
  res.status(500).json({ message: error.message });
}
```
Existing convention — no error-handler middleware in this app; each handler maps its own catch.

### S-7: Stripe mock factory for tests
**Source:** `BACKEND_REPO/__tests__/enforcement/confirmBooking.transaction.test.js:26-36`
**Applies to:** §11, §12, §13 (every test that hits a Stripe code path)
**Excerpt:** see §11 analog above. Reuse verbatim across all new test files.

### S-8: `MongoMemoryReplSet` harness for transactional tests
**Source:** `BACKEND_REPO/__tests__/_helpers/mongoReplSet.js` + every test in `__tests__/enforcement/` and `__tests__/listing-moderation/`
**Applies to:** §9, §10 (if HTTP test wraps a txn), §12
**Excerpt:**
```js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });
```

### S-9: Direct `Car.collection.insertOne` for test seeding to bypass hide hooks
**Source:** `BACKEND_REPO/__tests__/listing-moderation/suspendListing.test.js:50-60`
**Applies to:** §10, §11, §12 (any test that seeds a non-active Car)
**Excerpt:**
```js
async function seedCar(overrides = {}) {
  const _id = new mongoose.Types.ObjectId();
  await Car.collection.insertOne({
    _id, sellerId: 'seller-x', status: 'active', listingStatus: 'active',
    createdAt: new Date(), ...overrides,
  });
  return _id.toString();
}
```
Bypasses BOTH the Mongoose pre-save validators AND the existing `pre(/^find/)` hooks (writes never trigger find middleware). Use for any non-active seed.

### S-10: Firebase-admin mock for HTTP-with-auth tests
**Source:** `BACKEND_REPO/__tests__/listing-moderation/requireAdmin.listing.middleware.test.js:23-33`
**Applies to:** §10 (LENF-02 — needs to simulate admin vs non-admin caller)
**Excerpt:**
```js
jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  const mock = {
    credential: { cert: jest.fn(() => ({})) },
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
  };
  mock.__verifyIdTokenMock = verifyIdTokenMock;
  return mock;
});
```
Use `admin.__verifyIdTokenMock.mockResolvedValueOnce({ uid, email })` to inject a caller identity per test.

---

## No Analog Found

All Phase 9 files have a real codebase analog. Two scope notes (NOT missing analogs):

| File | Note |
|------|------|
| `MOBILE_REPO/src/services/AuthService.ts` MODIFY (§14) | Has exact analog in same file, but the edit is **out of Phase 9 scope** per CONTEXT (mobile work = Phase 10). Recommend deferral. |
| `MOBILE_REPO/src/constants/translations.ts` MODIFY (§16) | Has exact analog (Phase 6 banner block), but the edit is **out of Phase 9 scope** per CONTEXT (translation binding = Phase 11 LQUAL-01). Recommend deferral. |

Both files were in the user's prompt for completeness; planner should confirm phase boundary before scheduling them in Phase 9 PLAN.md.

---

## Metadata

**Analog search scope:**
- `MOBILE_REPO/src/` (services, constants, context)
- `BACKEND_REPO/src/` (models, payments, security, moderation)
- `BACKEND_REPO/server.js`
- `BACKEND_REPO/__tests__/` (all subdirectories)

**Files scanned (verified by Read tool):**
- `Car.js`, `requireAdmin.js`, `attachAuthIfPresent.js`, `confirmBooking.js`, `listingCapabilities.js`, `listingErrors.js`, `listingService.js` (excerpts), `server.js` (relevant route ranges), `AuthService.ts` (excerpts), `client.ts`, `translations.ts` (excerpts), `errors.ts` (mobile moderation), 4 representative test files

**Pattern extraction date:** 2026-05-28

**Open items requiring planner attention:**
- Field naming for `moderationBadge` (A1 from RESEARCH.md Open Question 1 — `reasonCategory` vs `moderationReason` vs `moderationNote`)
- Stripe `idempotencyKey` retro-add to existing 3 v1.0 call sites (A3 from RESEARCH.md Open Question 2)
- `ProviderSuspendedError` re-export location to avoid circular require (Pattern §6 Option A vs B)
- Phase boundary for §14 and §16 mobile edits (CONTEXT says backend-only)
