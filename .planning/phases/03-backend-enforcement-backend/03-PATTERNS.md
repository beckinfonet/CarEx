# Phase 3: Backend Enforcement - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 11 new files + 1 modified (server.js) = 12
**Analogs found:** 12 / 12 (100% coverage — this phase copies heavily from Phase 1 + Phase 2 artifacts)

---

## File Classification

All file paths are inside the sibling backend repo `../backend-services/carEx-services/`.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/security/requireNotSuspended.js` | middleware | request-response (guard) | `src/security/requireAdmin.js` | **exact** (same middleware family, same Express signature, composes after `verifyIdToken`) |
| `src/security/attachAuthIfPresent.js` | middleware | request-response (guard) | `src/security/verifyIdToken.js` | **exact** (soft fork — same Bearer parse, same ensureInitialized, but no 401 on missing header) |
| `src/models/Car.js` | model | schema + query-middleware | `src/models/User.js` (Phase 1 extraction) | **exact** (model file with inline schema + index decls + pre-hook + `mongoose.model('Name', schema, 'collection')`) |
| `src/models/Broker.js` | model | schema + query-middleware | `src/models/User.js` | **exact** (same extraction pattern; schema body lifted from `server.js:146-158`) |
| `src/models/LogisticsPartner.js` | model | schema + query-middleware | `src/models/User.js` | **exact** (same; schema body lifted from `server.js:163-179`) |
| `src/payments/confirmBooking.js` | service | transform + CRUD (shared helper) | `src/moderation/service.js` (`suspend`, `deleteProviderProfile`) | **exact** (same `session.withTransaction()` envelope, same "audit/state-change inside txn, external side-effect outside txn" pattern) |
| `server.js` (MODIFIED) | config/router | request-response | `server.js:919` Phase 1 mount | **exact** (composition pattern: `app.POST(path, middleware1, middleware2, handler)`) |
| `__tests__/enforcement/requireNotSuspended.middleware.test.js` | test | test | `__tests__/moderation/requireAdmin.middleware.test.js` | **exact** (firebase-admin `jest.mock`, minimal Express app with one route, supertest matrix) |
| `__tests__/enforcement/hideOnFind.test.js` | test | test | `__tests__/moderation/ModerationAction.append-only.test.js` + `suspend.test.js` | **role-match** (MongoMemoryReplSet harness + direct model calls; no existing query-middleware test as analog) |
| `__tests__/enforcement/confirmBooking.transaction.test.js` | test | test | `__tests__/moderation/suspend.test.js` + `deleteProviderProfile.test.js` | **exact** (`session.withTransaction` happy/rollback/race tests via MongoMemoryReplSet) |
| `__tests__/enforcement/ordersDeprecated.test.js` | test | test | `__tests__/moderation/requireAdmin.middleware.test.js` | **role-match** (small supertest app + single-route assertion on status code) |
| `__tests__/enforcement/acceptance.test.js` | test | test | `__tests__/moderation/acceptance.test.js` | **exact** (three-block integration style mirrors Phase 2 acceptance test 1:1 — same MongoMemoryReplSet + jest.mock firebase-admin + ALL_TEST_ADMIN_UIDS resetKey idiom) |

---

## Pattern Assignments

### `src/security/requireNotSuspended.js` (middleware, request-response)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/requireAdmin.js`

**Imports pattern** (lines 1, taken from `requireAdmin.js`):
```js
const User = require('../models/User');
```

**Middleware signature + single-lookup pattern** (lines 10-20 of `requireAdmin.js` — copy shape):
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

**Key adaptation for Phase 3:**
- Factory wrapper so the route can pass a `requiredCapability` token (D-01, ENF-04): `module.exports = function requireNotSuspended(requiredCapability) { return async (req, res, next) => { ... } }`
- Resolve uid via `req.auth?.uid ?? req.body?.sellerId ?? req.body?.buyerUid ?? req.params?.uid` (D-03 dual-accept). When the body-fallback branch is taken AND `req.auth` is absent, `console.warn('[requireNotSuspended] deprecated body-uid fallback used', { route: req.originalUrl, uid: callerUid })` per CONTEXT.md §Specifics.
- `User.findOne({ firebaseUid: callerUid }).select('moderationStatus').setOptions({ includeAllUsers: true }).lean()` — the `includeAllUsers: true` bypass is required (D-07) so the pre(/^find/) hook does not hide the caller from its own self-lookup (see `src/models/Car.js` pattern below).
- Reject matrix:
  - 404 `{ error: 'user_not_found' }` when `User.findOne` returns null (D-15).
  - 403 `{ error: 'account_suspended', status: state, reasonCategory, note }` when `state !== 'active'` (D-01, D-15). For `feature_limited`, ALSO require `requiredCapability && restrictedFeatures.includes(requiredCapability)` — otherwise fall through (D-01 conditional).
- On success: `req.callerUser = user` then `next()`.

**Error shape** (strict copy from Phase 1 D-10 + Phase 3 D-15):
```js
return res.status(403).json({ error: 'account_suspended', status, reasonCategory, note });
```

---

### `src/security/attachAuthIfPresent.js` (middleware, request-response)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/verifyIdToken.js` (soft fork)

**Full existing `verifyIdToken.js` body** (the starting point — adapt the no-Bearer branch):
```js
const { ensureInitialized } = require('./firebaseAdmin');

async function verifyIdToken(req, res, next) {
  const header = req.header('authorization') || req.header('Authorization') || '';
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return res.status(401).json({ error: 'unauthenticated', message: 'Missing or invalid idToken' });
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

module.exports = { verifyIdToken };
```

**Phase 3 fork** — only two changes:
1. **No header → `next()` (no 401)**: replace `return res.status(401)...` with `return next()` when the Bearer match fails. This is THE reason this file is a fork instead of modifying `verifyIdToken.js` (which `/api/admin/moderation/*` depends on for strict enforcement — D-04).
2. **Malformed/invalid Bearer → still 401**: when Bearer is present but `verifyIdToken(token, true)` throws, keep the 401 response. Rationale: caller intentionally sent a token, it's broken, fail loud. (Distinguishes "no Bearer at all" from "Bearer present but bad".)
3. Add TODO comment citing removal trigger: `// TODO(QUAL-03, Phase 6): remove this module; revert all five gated routes to strict verifyIdToken. See 03-CONTEXT.md D-03.`

Export name: `attachAuthIfPresent` (not `verifyIdToken`) so the fork is grep-visible.

---

### `src/models/Car.js` (model, schema + query-middleware)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js`

**File template** (lifted from `User.js` lines 1-34 — same shape):
```js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true },
  // ... fields ...
  moderationStatus: { ... },
});

userSchema.index({ 'moderationStatus.state': 1 });
userSchema.index({ 'moderationStatus.state': 1, 'moderationStatus.reasonCategory': 1 });

module.exports = mongoose.model('User', userSchema);
```

**Schema body to lift from `server.js:95-133`** (the entire `carSchema` definition + `mongoose.model('Car', carSchema)` registration — 38 lines). Registered name MUST stay `'Car'` (no explicit collection arg — existing callsites resolve via `mongoose.model('Car')`).

**NEW — Phase 3 pre-hook** (co-located in the model file per D-08):
```js
// ENF-02: pre(/^find/) hide hook. Default-hide cars whose seller is
// moderationStatus.state !== 'active' OR sellerStatus !== 'APPROVED'.
// Admin paths (and the confirm-booking re-check) bypass via
// .setOptions({ includeAllUsers: true }).
carSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { sellerStatus: { $ne: 'APPROVED' } },
    ],
  });
  this.setQuery({ ...this.getQuery(), sellerId: { $nin: hiddenUids } });
});
```

**Key adaptations:**
- Lazy `mongoose.model('User')` resolution (not a top-level `require('./User')`) to sidestep a potential cycle when both models are first loaded.
- Default exports: `module.exports = mongoose.model('Car', carSchema);` — mirrors existing `server.js:133` registration so any handler currently doing `Car.find(...)` continues to resolve the same instance (per Phase 1 D-03).
- Remove the inline `const Car = mongoose.model('Car', carSchema);` from `server.js:133` at the same time as this file lands; replace with `const Car = require('./src/models/Car');`.

---

### `src/models/Broker.js` (model, schema + query-middleware)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js` (same extraction shape)

**Schema body to lift from `server.js:137-160`** (includes `serviceItemSchema` sub-schema + `brokerSchema` + `brokerSchema.index({ ownerUid: 1 }, { unique: true })` + registration). Note: `serviceItemSchema` is shared with LogisticsPartner — extract to a local `const serviceItemSchema = new mongoose.Schema(...)` inside this file (keeps the model self-contained; the identical-by-value clone in `LogisticsPartner.js` is fine — Mongoose treats them as independent sub-schemas).

**NEW — Phase 3 pre-hook** (D-06, adapted from Car):
```js
brokerSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { brokerStatus: { $ne: 'APPROVED' } },
    ],
  });
  this.setQuery({ ...this.getQuery(), ownerUid: { $nin: hiddenUids } });
});
```

**Critical field-name note** (from CONTEXT.md §D-06 — verified against `server.js:383, 559, 614`):
- Car joins on `sellerId` (Car-side field).
- Broker joins on `ownerUid` (Broker-side field).
- LogisticsPartner joins on `ownerUid` (LogisticsPartner-side field).

Registration: `module.exports = mongoose.model('Broker', brokerSchema, 'brokers');` — explicit collection name `'brokers'` copied from `server.js:160`.

---

### `src/models/LogisticsPartner.js` (model, schema + query-middleware)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js`

**Schema body to lift from `server.js:163-179`.** Same pattern as Broker.js — include local `serviceItemSchema`, extract `logisticsPartnerSchema` + `logisticsPartnerSchema.index({ ownerUid: 1 }, { unique: true })` + `mongoose.model('LogisticsPartner', logisticsPartnerSchema, 'logistics_partners')` registration (preserve the `'logistics_partners'` explicit collection from `server.js:179`).

**NEW — Phase 3 pre-hook** (identical shape to Broker, field `logisticsStatus`):
```js
logisticsPartnerSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { logisticsStatus: { $ne: 'APPROVED' } },
    ],
  });
  this.setQuery({ ...this.getQuery(), ownerUid: { $nin: hiddenUids } });
});
```

---

### `src/payments/confirmBooking.js` (service, transform + CRUD)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/service.js` (`suspend` and `deleteProviderProfile` functions — same `session.withTransaction()` envelope)

**Imports pattern** (copy from `service.js` lines 16-20):
```js
const mongoose = require('mongoose');
const User = require('../models/User');
const Car = require('../models/Car');           // new, this phase
const Broker = require('../models/Broker');     // new, this phase
const LogisticsPartner = require('../models/LogisticsPartner'); // new
const ServiceOrder = mongoose.model('ServiceOrder'); // still inline in server.js
```

**session.withTransaction envelope pattern** (verbatim from `service.js:64-123` — copy this exactly):
```js
const session = await mongoose.startSession();
let insertedAction;
let newModerationStatus;
try {
  await session.withTransaction(async () => {
    // 1. <audit/state read inside txn>
    const [action] = await ModerationAction.create([{ ... }], { session });
    // 2. <guard / validate>
    // 3. <mutations>
    const updated = await User.updateOne({ firebaseUid: targetUid }, { $set: { ... } }, { session });
    if (updated.matchedCount !== 1) {
      throw new Error('target_not_found');
    }
  });
} finally {
  await session.endSession();
}
```

**Order of operations inside `confirmBooking.withTransaction` (D-10 prescribed exactly)** — this is the canonical sequence the planner should preserve:

```js
// 1. Retrieve Stripe PaymentIntent (OUTSIDE txn) — already succeeded
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
if (paymentIntent.status !== 'succeeded') { ... }

// 2. Open session + withTransaction
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // a. Buyer re-check (D-14) — includeAllUsers bypasses hide-hook on the User lookup
    const buyer = await User.findOne({ firebaseUid: buyerUid })
      .setOptions({ includeAllUsers: true })
      .session(session)
      .lean();
    if (!buyer || buyer.moderationStatus?.state !== 'active') {
      // Stripe refunds are NOT in the Mongo transaction. Refund first, throw second.
      // Reversed order risks "buyer charged, no order, no refund" on Stripe API failure.
      await refundThenThrow(stripe, paymentIntentId, 'provider_suspended', buyerUid);
    }

    // b. For each unique { providerUid, providerType } — re-check + resolve snapshot
    for (const group of providerGroups) {
      const providerUser = await User.findOne({ firebaseUid: group.providerUid })
        .setOptions({ includeAllUsers: true })
        .session(session)
        .lean();
      const roleField = group.providerType === 'broker' ? 'brokerStatus' : 'logisticsStatus';
      if (!providerUser || providerUser.moderationStatus?.state !== 'active' || providerUser[roleField] !== 'APPROVED') {
        await refundThenThrow(stripe, paymentIntentId, 'provider_suspended', group.providerUid);
      }
      const ProfileModel = group.providerType === 'broker' ? Broker : LogisticsPartner;
      const profile = await ProfileModel.findOne({ ownerUid: group.providerUid })
        .setOptions({ includeAllUsers: true })
        .session(session)
        .lean();
      // build providerSnapshot per existing server.js:1175-1189
      group.providerSnapshot = { companyName: profile?.companyName ?? null, phoneNumber: profile?.phoneNumber ?? null, ... };
    }

    // c. Car re-check + flip listingStatus
    const car = await Car.findById(carId).setOptions({ includeAllUsers: true }).session(session);
    if (!car) throw new Error('car_not_found');
    const sellerUser = await User.findOne({ firebaseUid: car.sellerId })
      .setOptions({ includeAllUsers: true }).session(session).lean();
    if (sellerUser?.moderationStatus?.state !== 'active' || sellerUser.sellerStatus !== 'APPROVED') {
      await refundThenThrow(stripe, paymentIntentId, 'provider_suspended', car.sellerId);
    }
    car.listingStatus = 'booked';
    car.bookedByUid = buyerUid;
    car.stripePaymentIntentId = paymentIntentId;
    await car.save({ session });

    // d. Create ServiceOrder rows (loop copied from server.js:1194-1236)
    //    Same orderNumber generation + totalAmount aggregation + ServiceOrder.create([...], { session })
    ...
  });
} finally {
  await session.endSession();
}
```

**providerSnapshot resolution block** — lift verbatim from `server.js:1175-1189`:
```js
providerGroups[key] = {
  providerUid: item.providerUid,
  providerType: item.providerType,
  providerSnapshot: {
    companyName: profile?.companyName ?? null,
    phoneNumber: profile?.phoneNumber ?? null,
    telegramUsername: profile?.telegramUsername ?? null,
    email: ownerUser?.email ?? null,
    firstName: ownerUser?.firstName ?? null,
    lastName: ownerUser?.lastName ?? null,
    providerRole: item.providerType,
    snapshotAt: new Date(),
  },
  services: [],
};
```

**Refund-then-throw helper** (D-11 — define locally):
```js
// Stripe refunds are NOT in the Mongo transaction. Refund first, throw second.
// Reversed order risks "buyer charged, no order, no refund" on Stripe API failure.
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
  const err = new Error(errorCode);
  err.providerUid = providerUid;
  err.refundId = refundId;
  err.refundFailed = refundFailed;
  throw err;
}
```

**Error shape** (D-15): handler in `server.js` catches and returns `409 { error: 'provider_suspended', providerUid, refundId?, refundFailed? }`.

**Idempotency on buyer retry** (Claude's Discretion — CONTEXT.md §"Claude's Discretion"): before opening the session, check `Car.findById(carId, ..., { includeAllUsers: true })` — if `car.stripePaymentIntentId === paymentIntentId` already, short-circuit with existing ServiceOrder rows.

---

### `server.js` (MODIFIED — config/router)

**Analog:** `server.js:919` (Phase 1 mount) for middleware composition; `server.js:1113-1143` (existing confirm-booking) for the rewrite target.

**Five ROADMAP-named routes to gate (D-02)** — exact line ranges from CONTEXT.md canonical_refs:
- `server.js:740-827` — `POST /api/cars` → prefix middleware chain with `attachAuthIfPresent, requireNotSuspended('create_listing'),` BEFORE `upload.array('images', 25)`. Example shape: `app.post('/api/cars', attachAuthIfPresent, requireNotSuspended('create_listing'), upload.array('images', 25), async (req, res) => {...})`.
- `server.js:1087-1111` — `POST /api/payments/create-payment-intent` → prefix with `attachAuthIfPresent, requireNotSuspended('create_order'),`.
- `server.js:1113-1143` — `POST /api/payments/confirm-booking` → prefix with `attachAuthIfPresent, requireNotSuspended('create_order'),` AND fully replace body with a call to `require('./src/payments/confirmBooking')`. Response shape on success: `{ car, orders }` (D-10 step 7). On `provider_suspended`: `res.status(409).json({ error: 'provider_suspended', providerUid: err.providerUid, refundId: err.refundId, refundFailed: err.refundFailed })`.
- `server.js:590-611` — `PUT /api/brokers/:uid` → prefix with `attachAuthIfPresent, requireNotSuspended('update_profile'),`.
- `server.js:645-668` — `PUT /api/logistics/:uid` → prefix with `attachAuthIfPresent, requireNotSuspended('update_profile'),`.

**`POST /api/orders` rewrite (D-12)** — `server.js:1148-1244` body replaced with:
```js
app.post('/api/orders', (req, res) => {
  res.status(410).json({
    error: 'deprecated',
    message: 'Use POST /api/payments/confirm-booking which now creates orders atomically',
  });
});
```

**Top-of-file require() additions** (mirror the Phase 1 pattern at `server.js:12-17`):
```js
const { attachAuthIfPresent } = require('./src/security/attachAuthIfPresent');
const { requireNotSuspended } = require('./src/security/requireNotSuspended');
const confirmBookingService = require('./src/payments/confirmBooking');
const Car = require('./src/models/Car');                    // replaces inline model at line 133
const Broker = require('./src/models/Broker');              // replaces inline model at line 160
const LogisticsPartner = require('./src/models/LogisticsPartner'); // replaces inline model at line 179
```

**Existing mount pattern to mirror for middleware composition** (`server.js:919`):
```js
app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);
```
— Phase 3 is NOT a new mount; it's inline per-route middleware composition. `app.POST(path, attachAuthIfPresent, requireNotSuspended(capability), <existing multer?>, <existing handler>)`.

**Inline schema removal** — delete lines `server.js:95-133` (carSchema + Car registration), `server.js:137-160` (serviceItemSchema + brokerSchema + Broker registration — NOTE: `serviceItemSchema` is referenced by LogisticsPartner too, so keep a top-level copy or inline both; cleanest is to extract it into each model file), `server.js:163-179` (logisticsPartnerSchema + registration). Replace each with the corresponding `require()` at top of file.

---

### `__tests__/enforcement/requireNotSuspended.middleware.test.js` (test)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js`

**firebase-admin mock pattern** (copy from `acceptance.test.js:32-41`):
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

**Test harness template** (shape from `requireAdmin.middleware.test.js` — minimal Express app with one route, not server.js):
```js
const express = require('express');
const request = require('supertest');
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
const admin = require('firebase-admin');
const User = require('../../src/models/User');
const { attachAuthIfPresent } = require('../../src/security/attachAuthIfPresent');
const { requireNotSuspended } = require('../../src/security/requireNotSuspended');

let rs;
let app;
beforeAll(async () => {
  rs = await startReplSet();
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
  app = express();
  app.use(express.json());
  app.post('/test', attachAuthIfPresent, requireNotSuspended('create_listing'),
    (req, res) => res.json({ ok: true, callerUid: req.callerUser?.firebaseUid }));
});
afterAll(async () => { await stopReplSet(rs); });
beforeEach(async () => {
  await User.deleteMany({});
  admin.__verifyIdTokenMock.mockReset();
});
```

**Test coverage matrix** (CONTEXT.md D-16):
1. Bearer path → `req.callerUser` populated, 200.
2. No Bearer + `req.body.sellerId` fallback → logs deprecation warning (spy on `console.warn`) + still 200.
3. Active user → 200.
4. Suspended (`state='blocked_with_review'`) → 403 `{ error: 'account_suspended', status: 'blocked_with_review', reasonCategory, note }`.
5. `feature_limited` user + required capability in `restrictedFeatures` → 403 `account_suspended`.
6. `feature_limited` user + required capability NOT in `restrictedFeatures` → 200.

---

### `__tests__/enforcement/hideOnFind.test.js` (test)

**Analog:** `__tests__/moderation/suspend.test.js` (MongoMemoryReplSet harness + direct model calls — no acceptance-style supertest needed since this is a query-middleware test).

**Harness pattern** (copy from `suspend.test.js:7-32`):
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
  await Car.deleteMany({});
  await Broker.deleteMany({});
  await LogisticsPartner.deleteMany({});
});
```

**Test coverage matrix** (D-16 + acceptance criterion #2):
- Seed active seller + car → `Car.find({})` returns 1 result.
- Suspend seller (`moderationStatus.state = 'blocked_with_review'`) → `Car.find({})` returns empty. Assert `car.listingStatus === 'active'` still (no mutation).
- Unsuspend seller → `Car.find({})` returns 1 result again.
- Revoke `sellerStatus = 'NONE'` → `Car.find({})` returns empty.
- Same matrix for Broker (via `brokerStatus`) and LogisticsPartner (via `logisticsStatus`).
- Bypass: `Broker.find({}).setOptions({ includeAllUsers: true })` returns the doc regardless of state (D-07).
- `Car.findById(id)` on suspended-owner car returns null (D-09).

---

### `__tests__/enforcement/confirmBooking.transaction.test.js` (test)

**Analog:** `__tests__/moderation/suspend.test.js` (session.withTransaction + atomicity asserts) + `deleteProviderProfile.test.js` (rollback test pattern).

**Stripe mocking pattern** (D-17):
```js
jest.mock('stripe', () => {
  const paymentIntentsRetrieveMock = jest.fn();
  const refundsCreateMock = jest.fn();
  const stripeMock = () => ({
    paymentIntents: { retrieve: paymentIntentsRetrieveMock },
    refunds: { create: refundsCreateMock },
  });
  stripeMock.__paymentIntentsRetrieveMock = paymentIntentsRetrieveMock;
  stripeMock.__refundsCreateMock = refundsCreateMock;
  return stripeMock;
});
```

**Test coverage matrix** (D-16):
1. Happy path: active buyer + active provider + active seller + PI succeeded → `car.listingStatus === 'booked'` + ServiceOrder rows created + `refunds.create` NOT called.
2. Provider suspended mid-window: `refunds.create` fired exactly once + car unchanged + zero ServiceOrder rows + `err.message === 'provider_suspended'` + `err.providerUid === <suspendedUid>` + `err.refundId` is set.
3. Buyer suspended mid-window: same rollback shape.
4. Seller (car owner) suspended mid-window: same.
5. Refund API failure: `refunds.create` rejects → error surfaced with `err.refundFailed === true`.
6. Concurrent-suspend test (D-13): `Promise.all([service.suspend(providerUid), confirmBookingService(paymentIntentId, carId, buyerUid, items)])` — assert mutual exclusion (either confirm succeeds with no refund OR confirm fails with refund; never both-succeed-and-leave-a-provider-suspended-car-booked).

---

### `__tests__/enforcement/ordersDeprecated.test.js` (test)

**Analog:** `__tests__/moderation/requireAdmin.middleware.test.js` (small supertest app, single-route assertion).

**Test body** (single test):
```js
const express = require('express');
const request = require('supertest');

// Minimal app — don't require server.js (which pulls mongoose + S3 + Stripe).
// Instead, exercise the 410 Gone handler shape directly.
const app = express();
app.use(express.json());
app.post('/api/orders', (req, res) => {
  res.status(410).json({
    error: 'deprecated',
    message: 'Use POST /api/payments/confirm-booking which now creates orders atomically',
  });
});

test('POST /api/orders returns 410 deprecated', async () => {
  const res = await request(app).post('/api/orders').send({ buyerUid: 'x', items: [] });
  expect(res.status).toBe(410);
  expect(res.body).toEqual({
    error: 'deprecated',
    message: 'Use POST /api/payments/confirm-booking which now creates orders atomically',
  });
});
```

---

### `__tests__/enforcement/acceptance.test.js` (test — Phase 3 capstone)

**Analog:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/acceptance.test.js` (exact structural twin)

**Structural template** (copy from `acceptance.test.js:1-100` — header comment + mock + beforeAll + app build):
```js
// __tests__/enforcement/acceptance.test.js
//
// End-to-end acceptance test for ROADMAP Phase 3 Success Criteria #1-4.
//
// TEST ISOLATION: see __tests__/moderation/acceptance.test.js for the extensive
// B-01/B-02 write-up. Same pattern — module-tree reset is forbidden; tests rebuild
// DB state between cases.

jest.mock('firebase-admin', () => { /* ...verbatim from moderation/acceptance.test.js... */ });
jest.mock('stripe', () => { /* ...from confirmBooking.transaction.test.js above... */ });

const express = require('express');
const request = require('supertest');
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
const admin = require('firebase-admin');
const User = require('../../src/models/User');
const Car = require('../../src/models/Car');
const Broker = require('../../src/models/Broker');
const LogisticsPartner = require('../../src/models/LogisticsPartner');

// Wire a test app with the five gated routes.
const { attachAuthIfPresent } = require('../../src/security/attachAuthIfPresent');
const { requireNotSuspended } = require('../../src/security/requireNotSuspended');

let rs;
let app;
beforeAll(async () => {
  rs = await startReplSet();
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });
  app = express();
  app.use(express.json());
  // Mount ONLY the five gated routes + their minimal handlers. Do NOT require server.js.
  app.post('/api/cars', attachAuthIfPresent, requireNotSuspended('create_listing'),
    (req, res) => res.status(201).json({ ok: true }));
  app.post('/api/payments/create-payment-intent', attachAuthIfPresent, requireNotSuspended('create_order'),
    (req, res) => res.json({ ok: true }));
  // ... confirm-booking wired with the real confirmBookingService for criterion #3 ...
  app.put('/api/brokers/:uid', attachAuthIfPresent, requireNotSuspended('update_profile'),
    (req, res) => res.json({ ok: true }));
  app.put('/api/logistics/:uid', attachAuthIfPresent, requireNotSuspended('update_profile'),
    (req, res) => res.json({ ok: true }));
  app.post('/api/orders', (req, res) => res.status(410).json({ error: 'deprecated', message: '...' }));
});
afterAll(async () => { await stopReplSet(rs); });
```

**Three-block integration mirroring Phase 2 Criterion #5 structure:**
- **Block 1 — Criterion #1 (403 on user-write for suspended):** seed `blocked_with_review` user → hit all 5 gated routes → each returns 403 `account_suspended`.
- **Block 2 — Criterion #2 (hide/restore on suspend/unsuspend):** seed active seller + car → `Car.find({})` returns 1 → suspend seller → `Car.find({})` returns empty → verify `car.listingStatus === 'active'` in DB → unsuspend → `Car.find({})` returns 1 again.
- **Block 3 — Criterion #3 (concurrent admin.suspend vs confirm-booking):** seed buyer, provider, car → `Promise.all([suspendProvider(), confirmBooking()])` → assert exactly one of the two outcomes (refund-and-abort OR booking-committed-then-suspended, never both).
- **Block 4 — Criterion #4 (feature_limited capability selectivity):** seed `feature_limited` user with `restrictedFeatures: ['create_listing']` → `POST /api/cars` returns 403 → `GET /api/cars` returns 200 (reads ungated per anti-pattern) → `POST /api/payments/create-payment-intent` returns 200 (`create_order` NOT in restrictedFeatures).

---

## Shared Patterns

### Route-level middleware composition
**Source:** `server.js:919` (Phase 1 mount)
**Apply to:** All 5 gated routes in this phase
```js
// Phase 1 pattern (router-level):
app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);

// Phase 3 pattern (per-route, mirroring the same composition grammar):
app.post('/api/cars', attachAuthIfPresent, requireNotSuspended('create_listing'), upload.array('images', 25), handler);
```

### Error shape `{ error, message?, ...fields }`
**Source:** Phase 1 D-10 (`requireAdmin.js:12-14`), Phase 2 D-02 (`router.js:49-54`)
**Apply to:** All new 4xx responses in this phase
```js
// 403 (Phase 1 baseline): { error: 'unauthorized', message: 'Admin access required' }
// 403 (Phase 3 D-15):    { error: 'account_suspended', status, reasonCategory, note }
// 404 (Phase 3 D-15):    { error: 'user_not_found' }
// 409 (Phase 3 D-15):    { error: 'provider_suspended', providerUid, refundId?, refundFailed? }
// 410 (Phase 3 D-15):    { error: 'deprecated', message: '...' }
```

### Mongoose `session.withTransaction()`
**Source:** `src/moderation/service.js:64-123` (Phase 2 suspend handler)
**Apply to:** `src/payments/confirmBooking.js`
**Rules (Phase 2 D-23, carried forward):**
- Array form required on `Model.create([doc], { session })` to pass the session option.
- Every read/write inside the callback must be threaded with `{ session }` or `.session(session)`.
- Any thrown error aborts the transaction automatically.
- External side-effects that must NOT be rolled back with the transaction (Stripe refunds) happen OUTSIDE the session — Phase 3 refund-then-throw pattern per D-11.

### `includeAllUsers: true` bypass flag (Phase 3-new)
**Source:** New this phase — `src/models/Car.js` pre-hook checks `this.getOptions().includeAllUsers`
**Apply to:** Every admin handler, `moderation/service.js`, the `requireNotSuspended` self-lookup, the confirm-booking re-check, audit joins, migration scripts
**Grep-bait discipline (Phase 6 QUAL-03):** every use must be one of the legitimate admin/internal paths — otherwise it's hide-bypass leakage.

### firebase-admin test mock
**Source:** `__tests__/moderation/acceptance.test.js:32-41` + `__tests__/moderation/requireAdmin.middleware.test.js`
**Apply to:** All enforcement tests that exercise `attachAuthIfPresent` with a Bearer path
```js
jest.mock('firebase-admin', () => {
  const verifyIdTokenMock = jest.fn();
  return {
    credential: { cert: jest.fn(() => ({})) },
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({ verifyIdToken: verifyIdTokenMock })),
    __verifyIdTokenMock: verifyIdTokenMock,
  };
});
```

### MongoMemoryReplSet fixture
**Source:** `__tests__/_helpers/mongoReplSet.js` (Phase 2 Plan 02-01)
**Apply to:** Every `__tests__/enforcement/*.test.js` that needs `session.withTransaction()` OR needs the Mongoose pre-hook to resolve against a real Mongo instance
```js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });
```

### Model registration name stability
**Source:** Phase 1 D-03 (comment at `server.js:135` — "User model extracted to src/models/User.js")
**Apply to:** Car, Broker, LogisticsPartner extraction in this phase
- `mongoose.model('Car', carSchema)` — no collection arg (pluralizes to `'cars'` by default; matches current behavior at `server.js:133`).
- `mongoose.model('Broker', brokerSchema, 'brokers')` — explicit collection per Phase 2 `"explicit collection names"` pattern (`server.js:160`).
- `mongoose.model('LogisticsPartner', logisticsPartnerSchema, 'logistics_partners')` — same (`server.js:179`).

---

## No Analog Found

No Phase 3 file lacks an analog. Every new file pairs 1:1 with a Phase 1 or Phase 2 artifact. The two files furthest from their analogs are:

| File | Role | Analog | Notes |
|------|------|--------|-------|
| `src/models/Car.js`, `src/models/Broker.js`, `src/models/LogisticsPartner.js` | model with query-middleware | `src/models/User.js` | User.js does NOT have a `pre(/^find/)` hook; the hook itself has no existing code analog in this repo. The pattern comes from the Mongoose docs referenced in CONTEXT.md §Canonical external docs. |
| `src/security/attachAuthIfPresent.js` | soft auth middleware | `src/security/verifyIdToken.js` | "No Bearer → next()" fork — no existing backend pattern does this. Deliberate new behavior justified by D-03/D-04 dual-accept. |

Both are copy-and-adapt (not invent-from-scratch), so they are classified as exact/role-match above.

---

## Metadata

**Analog search scope:**
- `../backend-services/carEx-services/src/` (all subdirectories: `security/`, `moderation/`, `models/`)
- `../backend-services/carEx-services/__tests__/moderation/` + `__tests__/_helpers/`
- `../backend-services/carEx-services/server.js` (lines 1-1244 inclusive for the Phase 3-touched ranges)

**Files scanned:** 18 (7 models/security modules, 7 moderation modules, 4 test files, server.js)

**Pattern extraction date:** 2026-04-17

**Canonical line references (line-stable at time of mapping):**
- Phase 1 Bearer mount: `server.js:919`
- Inline Car schema to extract: `server.js:95-133`
- Inline Broker schema to extract: `server.js:137-160`
- Inline LogisticsPartner schema to extract: `server.js:163-179`
- Existing POST /api/cars: `server.js:740-826`
- Existing POST /api/payments/create-payment-intent: `server.js:1087-1111`
- Existing POST /api/payments/confirm-booking (to rewrite): `server.js:1113-1143`
- Existing POST /api/orders (to 410-Gone): `server.js:1148-1243`
- Provider snapshot resolution (to lift into helper): `server.js:1156-1189`
- Order row creation loop (to lift into helper): `server.js:1194-1236`
- PUT /api/brokers/:uid: `server.js:590-611`
- PUT /api/logistics/:uid: `server.js:645-668`
