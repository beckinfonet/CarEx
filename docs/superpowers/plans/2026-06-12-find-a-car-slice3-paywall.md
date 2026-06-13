# Find a Car — Slice 3 (Paywall + Contact Reveal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller can unlock a buyer's contact details from the request detail screen. The full paywall (RequestUnlock records, Stripe flow, idempotent reveal, buyer notification) ships now, but the *charge* is gated by a backend flag (`REQUEST_UNLOCK_ENABLED`, default off) so the feature launches free and billing turns on later with a single Railway env change — no app release.

**Architecture:** New `RequestUnlock` Mongoose collection (unique `(requestId, sellerUid)`). Three new approved-seller routes on the existing `/api/car-requests` router: a free/already-unlocked `POST /:id/unlock`, and a Stripe pair `POST /:id/unlock/payment-intent` + `POST /:id/unlock/confirm`. Both write the unlock, bump `unlockCount`, reveal contact, and fire a buyer notification via a dedicated 1:1 helper (`notifyRequestUnlocked` — writes a `Notification` row + best-effort push; it does NOT use the car-watch `emit()` fan-out, which is subscription-based). Browse/detail responses gain `paywallEnabled` and reveal contact only when the caller holds an unlock. Mobile adds `RequestService` unlock methods, replaces the Slice-2 stub on `CarRequestDetailsScreen` with free/paid/revealed states (reusing the existing `useStripe` payment-sheet pattern), adds a default-on `NotificationSettings` toggle, and a `carex://my-requests` deep link.

**Tech Stack:** Backend — Node/Express, Mongoose, Stripe, Jest + supertest + mongodb-memory-server. Mobile — React Native 0.83 + TypeScript, `@stripe/stripe-react-native` (`useStripe`), axios (`apiClient`), Jest with mocked `apiClient`.

**Two repos:**
- Backend: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (branch `feat/car-requests-slice3` off `main` — Slice 2 already merged via PR #12)
- Mobile: `/Users/beckmaldinVL/development/mobileApps/carEx` (branch `feat/find-a-car`)

Spec: `docs/superpowers/specs/2026-06-12-find-a-car-slice3-paywall-design.md`.

---

## Decisions locked for this slice

- **Escape hatch** = backend env flag `REQUEST_UNLOCK_ENABLED` (default `false`). Off → free unlock (no Stripe). On → Stripe required. Flip on Railway, no app release.
- A free unlock is a **real unlock**: records `RequestUnlock` (`amount: 0`, `paymentIntentId: null`), bumps `unlockCount`, reveals contact, **notifies the buyer**. Only the Stripe step differs between free and paid.
- **Caller identity / gate**: `req.auth.uid` + approved-seller (reuse Slice-2 `getApprovedSeller`). Same `403 not_approved_seller`.
- **Idempotency**: unique `(requestId, sellerUid)`. A duplicate unlock reveals contact again but does not double-count or re-notify.
- **Reveal**: an unlocked response includes `contactPhone`, `contactPhoneVerified`, `telegramUsername`, `telegramVerified`; `buyerUid` stays internal. A seller who already unlocked can view the request even after it closes; a non-unlocked seller still only sees `open` requests.
- **Buyer notification** is a 1:1 helper (not `emit()`), gated by `notificationPrefs.requestUnlockEnabled` which **defaults ON** (`!== false`) including for existing users. Push is best-effort (wrapped so a push failure never breaks the unlock).
- Screens aren't unit-tested (codebase convention); model, config, redaction, notify helper, routes, and service methods are TDD'd.

## File structure

**Backend (create unless noted):**
- `src/models/RequestUnlock.js` — the unlock record + unique index
- `src/carRequests/stripeClient.js` — Stripe singleton (mockable in tests)
- `src/carRequests/notifyUnlock.js` — `notifyRequestUnlocked(request, deps?)` 1:1 buyer notification
- `__tests__/carRequests/notifyUnlock.test.js`
- `__tests__/carRequests/unlockRoutes.test.js`
- Modify: `src/carRequests/unlockPrice.js` — add `isPaywallEnabled()`
- Modify: `__tests__/carRequests/unlockPrice.test.js` — cover `isPaywallEnabled`
- Modify: `src/carRequests/redactForSeller.js` — add `revealForSeller()`
- Modify: `__tests__/carRequests/redactForSeller.test.js` — cover `revealForSeller`
- Modify: `src/carRequests/router.js` — unlock routes + reveal/`paywallEnabled` on browse & detail
- Modify: `src/models/User.js` — `notificationPrefs.requestUnlockEnabled` (default `true`)
- Modify: `server.js` — allowlist `requestUnlockEnabled` in `NOTIFICATION_PREF_BOOL_KEYS`
- Modify: `src/notifications/translations.js` — `request_unlock` + `push_request_unlock` (RU/EN)

**Mobile (modify unless noted):**
- `src/services/requests/RequestService.ts` — `unlock`, `unlockPaymentIntent`, `confirmUnlock` + types
- `src/services/requests/__tests__/RequestService.test.ts` — tests for the three methods
- `src/screens/CarRequestDetailsScreen.tsx` — replace the Slice-2 unlock stub
- `src/screens/NotificationSettingsScreen.tsx` — add the default-on toggle
- `src/constants/translations.ts` — UI strings + `notif_request_unlock_title/body` (RU/EN)
- `App.tsx` — add `MyRequests: 'my-requests'` to `linking` + route `carex://my-requests`
- `src/screens/NotificationsScreen.tsx` — route a `my-requests` deeplink on in-app tap

---

# PART A — Backend (`carEx-services`)

> All backend paths are relative to `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`. Run commands from there.

## Task A0: Branch

- [ ] **Step 1: Create the slice branch off main**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/car-requests-slice3
```

---

## Task A1: RequestUnlock model

**Files:**
- Create: `src/models/RequestUnlock.js`
- Test: covered by `unlockRoutes.test.js` (the unique index is exercised there); model has no logic beyond schema.

- [ ] **Step 1: Write the model**

Create `src/models/RequestUnlock.js`:

```javascript
const mongoose = require('mongoose');

const requestUnlockSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'CarRequest', required: true, index: true },
    sellerUid: { type: String, required: true, index: true },
    paymentIntentId: { type: String, default: null }, // null for a free-mode unlock
    amount: { type: Number, required: true }, // 0 in free mode
    currency: { type: String, default: 'KGS' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Pay once: a seller never unlocks the same request twice.
requestUnlockSchema.index({ requestId: 1, sellerUid: 1 }, { unique: true });

module.exports = mongoose.models.RequestUnlock || mongoose.model('RequestUnlock', requestUnlockSchema);
```

- [ ] **Step 2: Commit**

```bash
git add src/models/RequestUnlock.js
git commit -m "feat(car-requests): add RequestUnlock model (unique requestId+sellerUid)"
```

---

## Task A2: Paywall flag config

Extend the Slice-2 price helper with the escape-hatch flag.

**Files:**
- Modify: `src/carRequests/unlockPrice.js`
- Test: `__tests__/carRequests/unlockPrice.test.js`

- [ ] **Step 1: Add the failing test**

In `__tests__/carRequests/unlockPrice.test.js`, add a new describe block after the existing `getUnlockPrice` block (the file already saves/restores `process.env` via the top-level `ORIGINAL`/`afterEach` — add this block inside the same file, after the closing `});` of the `getUnlockPrice` describe):

```javascript
const { isPaywallEnabled } = require('../../src/carRequests/unlockPrice');

describe('isPaywallEnabled', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('defaults to false when the env is unset', () => {
    delete process.env.REQUEST_UNLOCK_ENABLED;
    expect(isPaywallEnabled()).toBe(false);
  });

  it('is true only for the exact string "true"', () => {
    process.env.REQUEST_UNLOCK_ENABLED = 'true';
    expect(isPaywallEnabled()).toBe(true);
  });

  it('is false for any other truthy-looking value', () => {
    process.env.REQUEST_UNLOCK_ENABLED = '1';
    expect(isPaywallEnabled()).toBe(false);
    process.env.REQUEST_UNLOCK_ENABLED = 'yes';
    expect(isPaywallEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/unlockPrice.test.js`
Expected: FAIL — `isPaywallEnabled is not a function`.

- [ ] **Step 3: Implement the flag**

In `src/carRequests/unlockPrice.js`, add the function and export it. Replace the final `module.exports` line:

```javascript
/**
 * Escape hatch for the unlock paywall. Default OFF — when false, unlocks are
 * free (no Stripe). Flip REQUEST_UNLOCK_ENABLED=true on Railway to require
 * payment, with no mobile release. Strict equality so only the literal "true"
 * enables billing.
 */
function isPaywallEnabled() {
  return process.env.REQUEST_UNLOCK_ENABLED === 'true';
}

module.exports = { getUnlockPrice, isPaywallEnabled, DEFAULT_AMOUNT, DEFAULT_CURRENCY };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/unlockPrice.test.js`
Expected: PASS (4 existing + 3 new = 7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/unlockPrice.js __tests__/carRequests/unlockPrice.test.js
git commit -m "feat(car-requests): add isPaywallEnabled escape-hatch flag"
```

---

## Task A3: revealForSeller helper

The inverse of `redactForSeller`: for an unlocked request, strip only `buyerUid` and tag `unlocked: true`, keeping the contact fields.

**Files:**
- Modify: `src/carRequests/redactForSeller.js`
- Test: `__tests__/carRequests/redactForSeller.test.js`

- [ ] **Step 1: Add the failing test**

In `__tests__/carRequests/redactForSeller.test.js`, change the top `require` line to also import `revealForSeller`:

```javascript
const { redactForSeller, revealForSeller, SELLER_HIDDEN_FIELDS } = require('../../src/carRequests/redactForSeller');
```

Then add this describe block after the existing `describe('redactForSeller', ...)` block:

```javascript
describe('revealForSeller', () => {
  it('keeps the contact fields and tags unlocked true', () => {
    const out = revealForSeller(fullDoc);
    expect(out.contactPhone).toBe('+996555111222');
    expect(out.contactPhoneVerified).toBe(true);
    expect(out.telegramUsername).toBe('bishkek_cars');
    expect(out.telegramVerified).toBe(false);
    expect(out.unlocked).toBe(true);
  });

  it('still strips buyerUid', () => {
    expect(revealForSeller(fullDoc).buyerUid).toBeUndefined();
  });

  it('accepts a Mongoose doc and does not mutate the input', () => {
    const input = { ...fullDoc };
    const mongooseLike = { toObject: () => ({ ...fullDoc }) };
    expect(revealForSeller(mongooseLike).contactPhone).toBe('+996555111222');
    revealForSeller(input);
    expect(input.buyerUid).toBe('buyer-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/redactForSeller.test.js`
Expected: FAIL — `revealForSeller is not a function`.

- [ ] **Step 3: Implement revealForSeller**

In `src/carRequests/redactForSeller.js`, add the function and export it. Replace the final `module.exports` line:

```javascript
/**
 * Seller-safe copy of an UNLOCKED request: keeps the contact fields the seller
 * paid for, strips only the internal buyerUid, tags unlocked:true. Pure — never
 * mutates the input. Accepts a Mongoose doc (.toObject()) or a plain/lean object.
 */
function revealForSeller(doc) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete obj.buyerUid;
  obj.unlocked = true;
  return obj;
}

module.exports = { redactForSeller, revealForSeller, SELLER_HIDDEN_FIELDS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/redactForSeller.test.js`
Expected: PASS (6 existing + 3 new = 9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/redactForSeller.js __tests__/carRequests/redactForSeller.test.js
git commit -m "feat(car-requests): add revealForSeller (unlocked contact)"
```

---

## Task A4: Buyer notification preference + copy

Add the `requestUnlockEnabled` preference (default on), allowlist it for updates, and add the notification copy keys.

**Files:**
- Modify: `src/models/User.js`
- Modify: `server.js`
- Modify: `src/notifications/translations.js`

- [ ] **Step 1: Add the preference to the User model**

In `src/models/User.js`, inside the `notificationPrefs` sub-document (next to `newListingEnabled`), add:

```javascript
    // Slice 3: buyer is notified when a seller unlocks their request contact.
    // Default ON (opt-out) — absent docs read as enabled via `!== false` gating.
    requestUnlockEnabled: { type: Boolean, default: true },
```

- [ ] **Step 2: Allowlist the preference for PUT /api/users/:uid**

In `server.js`, find `const NOTIFICATION_PREF_BOOL_KEYS = ['muteAll', 'savedSearchEnabled', 'watchEnabled', 'newListingEnabled'];` (~line 550) and add the new key:

```javascript
const NOTIFICATION_PREF_BOOL_KEYS = ['muteAll', 'savedSearchEnabled', 'watchEnabled', 'newListingEnabled', 'requestUnlockEnabled'];
```

- [ ] **Step 3: Add the notification copy (RU + EN)**

In `src/notifications/translations.js`, add to the **RU** map (alongside the other in-app + push keys):

```javascript
    request_unlock: {
      title: 'Продавец заинтересован',
      body: 'Продавец заинтересован в вашей заявке: {makeModel}. Откройте, чтобы посмотреть.',
    },
    push_request_unlock: { title: 'Продавец заинтересован', body: 'Откройте, чтобы посмотреть.' },
```

And to the **EN** map:

```javascript
    request_unlock: {
      title: 'A seller is interested',
      body: 'A seller is interested in your request: {makeModel}. Tap to view.',
    },
    push_request_unlock: { title: 'A seller is interested', body: 'Tap to view.' },
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npx jest __tests__/notifications 2>/dev/null; npx jest src/notifications 2>/dev/null; echo done`
Expected: existing notification tests still pass (no test asserts the exact key set; adding keys is additive).

- [ ] **Step 5: Commit**

```bash
git add src/models/User.js server.js src/notifications/translations.js
git commit -m "feat(car-requests): add requestUnlockEnabled pref (default on) + notif copy"
```

---

## Task A5: Stripe singleton

A tiny module so the router gets one Stripe client and tests can mock it.

**Files:**
- Create: `src/carRequests/stripeClient.js`

- [ ] **Step 1: Write it**

Create `src/carRequests/stripeClient.js`:

```javascript
// Single Stripe client for car-request unlocks. Mirrors server.js's singleton.
// The placeholder secret keeps module load safe in test/CI where the env is
// unset; tests mock this module, and the real key is set in prod (Railway).
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

module.exports = stripe;
```

- [ ] **Step 2: Commit**

```bash
git add src/carRequests/stripeClient.js
git commit -m "feat(car-requests): add Stripe client singleton for unlocks"
```

---

## Task A6: notifyRequestUnlocked helper

1:1 buyer notification — writes a `Notification` row and best-effort push, gated by the buyer's prefs.

**Files:**
- Create: `src/carRequests/notifyUnlock.js`
- Test: `__tests__/carRequests/notifyUnlock.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/notifyUnlock.test.js`:

```javascript
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { notifyRequestUnlocked } = require('../../src/carRequests/notifyUnlock');

let mongo;
let User;
let Notification;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'CarEx' });
  User =
    mongoose.models.User ||
    mongoose.model('User', new mongoose.Schema({ firebaseUid: String, language: String, notificationPrefs: {} }));
  Notification = require('../../src/models/Notification');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Notification.deleteMany({});
});

const request = { _id: new mongoose.Types.ObjectId(), buyerUid: 'buyer-1', makeName: 'Toyota', modelName: 'Camry' };

it('writes a Notification row and calls push for an opted-in buyer', async () => {
  await User.create({ firebaseUid: 'buyer-1', language: 'EN' }); // no prefs => default on
  const fcm = { send: jest.fn().mockResolvedValue({ ok: true, delivered: 0 }) };

  const row = await notifyRequestUnlocked(request, { fcm });

  expect(row).not.toBeNull();
  expect(row.uid).toBe('buyer-1');
  expect(row.titleKey).toBe('request_unlock');
  expect(row.params.makeModel).toBe('Toyota Camry');
  expect(row.data.deeplink).toBe('carex://my-requests');
  expect(fcm.send).toHaveBeenCalledWith(
    expect.objectContaining({ uid: 'buyer-1', title: 'request_unlock', lang: 'EN' })
  );
  expect(await Notification.countDocuments({ uid: 'buyer-1' })).toBe(1);
});

it('suppresses when the buyer muted all notifications', async () => {
  await User.create({ firebaseUid: 'buyer-1', notificationPrefs: { muteAll: true } });
  const fcm = { send: jest.fn() };
  const row = await notifyRequestUnlocked(request, { fcm });
  expect(row).toBeNull();
  expect(fcm.send).not.toHaveBeenCalled();
  expect(await Notification.countDocuments({})).toBe(0);
});

it('suppresses when requestUnlockEnabled is explicitly false', async () => {
  await User.create({ firebaseUid: 'buyer-1', notificationPrefs: { requestUnlockEnabled: false } });
  const row = await notifyRequestUnlocked(request, { fcm: { send: jest.fn() } });
  expect(row).toBeNull();
});

it('returns null for an unknown buyer', async () => {
  const row = await notifyRequestUnlocked(request, { fcm: { send: jest.fn() } });
  expect(row).toBeNull();
});

it('still writes the row when push throws (best-effort push)', async () => {
  await User.create({ firebaseUid: 'buyer-1' });
  const fcm = { send: jest.fn().mockRejectedValue(new Error('no creds')) };
  const row = await notifyRequestUnlocked(request, { fcm });
  expect(row).not.toBeNull();
  expect(await Notification.countDocuments({ uid: 'buyer-1' })).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/notifyUnlock.test.js`
Expected: FAIL — `Cannot find module '../../src/carRequests/notifyUnlock'`.

- [ ] **Step 3: Write the helper**

Create `src/carRequests/notifyUnlock.js`:

```javascript
const mongoose = require('mongoose');

function getUser() {
  if (!mongoose.models.User) require('../models/User');
  return mongoose.model('User');
}
function getNotification() {
  if (!mongoose.models.Notification) require('../models/Notification');
  return mongoose.model('Notification');
}

/**
 * Notify a request's buyer that a seller unlocked their contact. 1:1 (not the
 * car-watch emit() fan-out). Gated by the buyer's prefs — muteAll and
 * requestUnlockEnabled both default ON (a missing field is treated as enabled).
 * Push is best-effort: a push failure is swallowed so the row still lands.
 * Returns the Notification row, or null if suppressed / buyer unknown.
 *
 * @param {object} request - the CarRequest (needs buyerUid, makeName, modelName)
 * @param {object} [deps] - { User, Notification, fcm } injectable for tests
 */
async function notifyRequestUnlocked(request, deps = {}) {
  const User = deps.User || getUser();
  const Notification = deps.Notification || getNotification();

  const buyer = await User.findOne({ firebaseUid: request.buyerUid })
    .select('firebaseUid notificationPrefs language')
    .lean();
  if (!buyer) return null;

  const prefs = buyer.notificationPrefs || {};
  if (prefs.muteAll === true) return null;
  if (prefs.requestUnlockEnabled === false) return null;

  const makeModel = request.modelName ? `${request.makeName} ${request.modelName}` : request.makeName;
  const deeplink = 'carex://my-requests';

  const [row] = await Notification.create([
    {
      uid: request.buyerUid,
      kind: 'request_unlock',
      titleKey: 'request_unlock',
      bodyKey: 'request_unlock',
      params: { makeModel },
      data: { deeplink, carId: null },
    },
  ]);

  try {
    const fcm = deps.fcm || require('../notifications/push/fcm');
    await fcm.send({
      uid: request.buyerUid,
      title: 'request_unlock',
      lang: buyer.language === 'EN' ? 'EN' : 'RU',
      data: { deeplink },
    });
  } catch (e) {
    console.error('[car-requests] unlock push failed:', e.message);
  }

  return row;
}

module.exports = { notifyRequestUnlocked };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/notifyUnlock.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/notifyUnlock.js __tests__/carRequests/notifyUnlock.test.js
git commit -m "feat(car-requests): add 1:1 buyer unlock notification helper"
```

---

## Task A7: Unlock routes + reveal on browse/detail

Add the three unlock routes and make browse/detail reveal contact when the caller holds an unlock and report `paywallEnabled`.

**Files:**
- Modify: `src/carRequests/router.js`
- Test: `__tests__/carRequests/unlockRoutes.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/unlockRoutes.test.js`:

```javascript
jest.mock('../../src/carRequests/stripeClient', () => ({
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
}));

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const stripe = require('../../src/carRequests/stripeClient');

let mongo;
let app;
let VehicleMake;
let User;
let CarRequest;
let RequestUnlock;
let Notification;

let currentUid = 'seller-1';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'CarEx' });

  VehicleMake =
    mongoose.models.VehicleMake ||
    mongoose.model('VehicleMake', new mongoose.Schema({ name: String, isActive: { type: Boolean, default: true } }), 'vehicle_makes');
  User =
    mongoose.models.User ||
    mongoose.model('User', new mongoose.Schema({ firebaseUid: String, sellerStatus: String, language: String, notificationPrefs: {} }));
  CarRequest = require('../../src/models/CarRequest');
  RequestUnlock = require('../../src/models/RequestUnlock');
  Notification = require('../../src/models/Notification');
  await RequestUnlock.syncIndexes(); // ensure the unique index exists in-memory

  const carRequestsRouter = require('../../src/carRequests/router');
  app = express();
  app.use(express.json());
  app.use('/api/car-requests', (req, res, next) => {
    req.auth = { uid: currentUid, email: `${currentUid}@x.com` };
    next();
  }, carRequestsRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  currentUid = 'seller-1';
  delete process.env.REQUEST_UNLOCK_ENABLED;
  stripe.paymentIntents.create.mockReset();
  stripe.paymentIntents.retrieve.mockReset();
  await Promise.all([
    CarRequest.deleteMany({}), RequestUnlock.deleteMany({}),
    User.deleteMany({}), VehicleMake.deleteMany({}), Notification.deleteMany({}),
  ]);
});

async function approvedSeller(uid = 'seller-1') {
  return User.create({ firebaseUid: uid, sellerStatus: 'APPROVED', language: 'EN' });
}
async function buyer(uid = 'buyer-1') {
  return User.create({ firebaseUid: uid, language: 'EN' });
}
async function openRequest(overrides = {}) {
  const make = await VehicleMake.create({ name: 'Toyota', isActive: true });
  return CarRequest.create({
    buyerUid: 'buyer-1', makeId: make._id, makeName: 'Toyota', modelName: 'Camry', budgetMax: 15000, currency: 'KGS',
    contactPhone: '+996555111222', contactPhoneVerified: true, telegramUsername: 'bishkek_cars',
    status: 'open', expiresAt: new Date(Date.now() + 1e9), ...overrides,
  });
}

describe('POST /:id/unlock (free path)', () => {
  it('reveals contact, records the unlock, bumps count, notifies the buyer', async () => {
    await approvedSeller();
    await buyer();
    const doc = await openRequest();

    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock`);
    expect(res.status).toBe(200);
    expect(res.body.request.unlocked).toBe(true);
    expect(res.body.request.contactPhone).toBe('+996555111222');
    expect(res.body.request.telegramUsername).toBe('bishkek_cars');
    expect(res.body.request.buyerUid).toBeUndefined();

    const unlock = await RequestUnlock.findOne({ requestId: doc._id, sellerUid: 'seller-1' });
    expect(unlock.amount).toBe(0);
    expect(unlock.paymentIntentId).toBeNull();
    expect((await CarRequest.findById(doc._id)).unlockCount).toBe(1);
    expect(await Notification.countDocuments({ uid: 'buyer-1', titleKey: 'request_unlock' })).toBe(1);
  });

  it('is idempotent — second unlock reveals again without double-count or second record', async () => {
    await approvedSeller();
    await buyer();
    const doc = await openRequest();
    await request(app).post(`/api/car-requests/${doc._id}/unlock`);
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock`);
    expect(res.status).toBe(200);
    expect(res.body.request.contactPhone).toBe('+996555111222');
    expect(await RequestUnlock.countDocuments({ requestId: doc._id, sellerUid: 'seller-1' })).toBe(1);
    expect((await CarRequest.findById(doc._id)).unlockCount).toBe(1);
  });

  it('rejects a non-approved seller (403)', async () => {
    await User.create({ firebaseUid: 'seller-1', sellerStatus: 'NONE' });
    const doc = await openRequest();
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock`);
    expect(res.status).toBe(403);
  });

  it('returns 409 payment_required when the paywall is ON and not yet unlocked', async () => {
    process.env.REQUEST_UNLOCK_ENABLED = 'true';
    await approvedSeller();
    const doc = await openRequest();
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('payment_required');
  });
});

describe('Stripe path', () => {
  beforeEach(() => { process.env.REQUEST_UNLOCK_ENABLED = 'true'; });

  it('payment-intent returns a client secret with the server amount', async () => {
    await approvedSeller();
    const doc = await openRequest();
    stripe.paymentIntents.create.mockResolvedValueOnce({ id: 'pi_1', client_secret: 'pi_1_secret' });

    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock/payment-intent`);
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBe('pi_1_secret');
    expect(res.body.paymentIntentId).toBe('pi_1');
    expect(res.body.amount).toBe(500);
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500, metadata: expect.objectContaining({ requestId: String(doc._id), sellerUid: 'seller-1' }) })
    );
  });

  it('payment-intent short-circuits when already unlocked', async () => {
    await approvedSeller();
    const doc = await openRequest();
    await RequestUnlock.create({ requestId: doc._id, sellerUid: 'seller-1', amount: 0, currency: 'KGS' });
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock/payment-intent`);
    expect(res.status).toBe(200);
    expect(res.body.alreadyUnlocked).toBe(true);
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('confirm reveals + records + notifies on a succeeded, matching intent', async () => {
    await approvedSeller();
    await buyer();
    const doc = await openRequest();
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({
      id: 'pi_9', status: 'succeeded', amount: 500,
      metadata: { requestId: String(doc._id), sellerUid: 'seller-1' },
    });

    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock/confirm`).send({ paymentIntentId: 'pi_9' });
    expect(res.status).toBe(200);
    expect(res.body.request.contactPhone).toBe('+996555111222');
    const unlock = await RequestUnlock.findOne({ requestId: doc._id, sellerUid: 'seller-1' });
    expect(unlock.paymentIntentId).toBe('pi_9');
    expect(unlock.amount).toBe(500);
    expect(await Notification.countDocuments({ uid: 'buyer-1', titleKey: 'request_unlock' })).toBe(1);
  });

  it('confirm rejects an unsucceeded intent (402)', async () => {
    await approvedSeller();
    const doc = await openRequest();
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({ id: 'pi_x', status: 'requires_payment_method', metadata: {} });
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock/confirm`).send({ paymentIntentId: 'pi_x' });
    expect(res.status).toBe(402);
  });

  it('confirm rejects a metadata mismatch (400)', async () => {
    await approvedSeller();
    const doc = await openRequest();
    stripe.paymentIntents.retrieve.mockResolvedValueOnce({
      id: 'pi_z', status: 'succeeded', amount: 500, metadata: { requestId: 'other', sellerUid: 'seller-1' },
    });
    const res = await request(app).post(`/api/car-requests/${doc._id}/unlock/confirm`).send({ paymentIntentId: 'pi_z' });
    expect(res.status).toBe(400);
  });
});

describe('GET /:id reveal + paywallEnabled', () => {
  it('reveals contact for a seller who already unlocked', async () => {
    await approvedSeller();
    const doc = await openRequest();
    await RequestUnlock.create({ requestId: doc._id, sellerUid: 'seller-1', amount: 0, currency: 'KGS' });
    const res = await request(app).get(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(200);
    expect(res.body.paywallEnabled).toBe(false);
    expect(res.body.request.unlocked).toBe(true);
    expect(res.body.request.contactPhone).toBe('+996555111222');
  });

  it('stays redacted for a seller who has not unlocked', async () => {
    await approvedSeller();
    const doc = await openRequest();
    const res = await request(app).get(`/api/car-requests/${doc._id}`);
    expect(res.body.request.unlocked).toBe(false);
    expect(res.body.request.contactPhone).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/unlockRoutes.test.js`
Expected: FAIL — unlock routes 404 (not implemented) and detail lacks `paywallEnabled`.

- [ ] **Step 3: Add requires + helpers to the router**

In `src/carRequests/router.js`, extend the require block near the top (after the Slice-2 requires for `getUnlockPrice`/`redactForSeller`):

```javascript
const { getUnlockPrice, isPaywallEnabled } = require('./unlockPrice');
const { redactForSeller, revealForSeller } = require('./redactForSeller');
const RequestUnlock = require('../models/RequestUnlock');
const stripe = require('./stripeClient');
const { notifyRequestUnlocked } = require('./notifyUnlock');
```

> Note: this REPLACES the existing `const { getUnlockPrice } = require('./unlockPrice');` and `const { redactForSeller } = require('./redactForSeller');` lines from Slice 2. Delete those two old lines.

Then add these helpers immediately after the `getApprovedSeller` function:

```javascript
async function hasUnlocked(requestId, sellerUid) {
  return !!(await RequestUnlock.findOne({ requestId, sellerUid }).lean());
}

// Record a new unlock (idempotent on the unique index), bump the count, and
// notify the buyer. Returns true on a fresh unlock, false if it already existed.
async function recordUnlockAndNotify(reqDoc, sellerUid, { amount, currency, paymentIntentId }) {
  try {
    await RequestUnlock.create({ requestId: reqDoc._id, sellerUid, paymentIntentId: paymentIntentId || null, amount, currency });
  } catch (err) {
    if (err && err.code === 11000) return false; // already unlocked — no double count/notify
    throw err;
  }
  await CarRequest.updateOne({ _id: reqDoc._id }, { $inc: { unlockCount: 1 } });
  try {
    await notifyRequestUnlocked(reqDoc);
  } catch (e) {
    console.error('[car-requests] unlock notify failed:', e.message);
  }
  return true;
}
```

- [ ] **Step 4: Update the browse route to tag unlocked + paywallEnabled**

In `src/carRequests/router.js`, in the `router.get('/', ...)` handler, replace the response-building tail (from `const rows = await CarRequest.find(filter)...` through the `return res.json(...)`) with:

```javascript
    const rows = await CarRequest.find(filter).sort({ createdAt: -1 }).lean();
    const ids = rows.map((r) => r._id);
    const unlocks = await RequestUnlock.find({ sellerUid: callerUid, requestId: { $in: ids } }).select('requestId').lean();
    const unlockedSet = new Set(unlocks.map((u) => String(u.requestId)));
    const { amount, currency } = getUnlockPrice();
    const requests = rows.map((r) =>
      unlockedSet.has(String(r._id)) ? revealForSeller(r) : redactForSeller(r, { unlocked: false })
    );
    return res.json({ unlockPrice: amount, currency, paywallEnabled: isPaywallEnabled(), requests });
```

- [ ] **Step 5: Update the detail route to reveal when unlocked + report paywallEnabled**

In `src/carRequests/router.js`, replace the body of `router.get('/:id', ...)` (between the approved-seller check and the `catch`) with:

```javascript
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    const doc = await CarRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not_found' });

    const unlocked = await hasUnlocked(doc._id, callerUid);
    // A non-unlocked seller only sees open requests; an unlocked seller can view
    // their already-revealed request even after it closes.
    if (!unlocked && doc.status !== 'open') return res.status(404).json({ error: 'not_found' });

    const { amount, currency } = getUnlockPrice();
    const requestOut = unlocked ? revealForSeller(doc) : redactForSeller(doc, { unlocked: false });
    return res.json({ unlockPrice: amount, currency, paywallEnabled: isPaywallEnabled(), request: requestOut });
```

- [ ] **Step 6: Add the three unlock routes before `module.exports`**

In `src/carRequests/router.js`, immediately before `module.exports = router;`, add:

```javascript
// POST /api/car-requests/:id/unlock — free / already-unlocked path
router.post('/:id/unlock', async (req, res) => {
  try {
    const callerUid = req.auth && req.auth.uid;
    if (!callerUid) return res.status(401).json({ error: 'unauthorized' });
    const seller = await getApprovedSeller(callerUid);
    if (!seller) return res.status(403).json({ error: 'not_approved_seller' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'not_found' });

    const doc = await CarRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not_found' });

    if (await hasUnlocked(doc._id, callerUid)) {
      return res.json({ request: revealForSeller(doc) });
    }
    if (doc.status !== 'open') return res.status(404).json({ error: 'not_found' });
    if (isPaywallEnabled()) return res.status(409).json({ error: 'payment_required' });

    const { currency } = getUnlockPrice();
    await recordUnlockAndNotify(doc, callerUid, { amount: 0, currency, paymentIntentId: null });
    const fresh = await CarRequest.findById(doc._id);
    return res.json({ request: revealForSeller(fresh) });
  } catch (err) {
    console.error('[car-requests] unlock error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// POST /api/car-requests/:id/unlock/payment-intent — Stripe step 1
router.post('/:id/unlock/payment-intent', async (req, res) => {
  try {
    const callerUid = req.auth && req.auth.uid;
    if (!callerUid) return res.status(401).json({ error: 'unauthorized' });
    const seller = await getApprovedSeller(callerUid);
    if (!seller) return res.status(403).json({ error: 'not_approved_seller' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'not_found' });

    const doc = await CarRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not_found' });
    if (await hasUnlocked(doc._id, callerUid)) return res.json({ alreadyUnlocked: true });
    if (doc.status !== 'open') return res.status(404).json({ error: 'not_found' });

    const { amount, currency } = getUnlockPrice();
    const intent = await stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      metadata: { requestId: String(doc._id), sellerUid: callerUid, kind: 'request_unlock' },
    });
    return res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, amount, currency });
  } catch (err) {
    console.error('[car-requests] unlock intent error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// POST /api/car-requests/:id/unlock/confirm — Stripe step 2
router.post('/:id/unlock/confirm', async (req, res) => {
  try {
    const callerUid = req.auth && req.auth.uid;
    if (!callerUid) return res.status(401).json({ error: 'unauthorized' });
    const seller = await getApprovedSeller(callerUid);
    if (!seller) return res.status(403).json({ error: 'not_approved_seller' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'not_found' });

    const doc = await CarRequest.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not_found' });
    if (await hasUnlocked(doc._id, callerUid)) {
      return res.json({ request: revealForSeller(doc) });
    }

    const { paymentIntentId } = req.body || {};
    if (!paymentIntentId) return res.status(400).json({ error: 'missing_payment_intent' });

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!intent || intent.status !== 'succeeded') {
      return res.status(402).json({ error: 'payment_not_completed' });
    }
    if (!intent.metadata || intent.metadata.requestId !== String(doc._id) || intent.metadata.sellerUid !== callerUid) {
      return res.status(400).json({ error: 'payment_intent_mismatch' });
    }

    const { currency } = getUnlockPrice();
    await recordUnlockAndNotify(doc, callerUid, { amount: intent.amount, currency, paymentIntentId });
    const fresh = await CarRequest.findById(doc._id);
    return res.json({ request: revealForSeller(fresh) });
  } catch (err) {
    console.error('[car-requests] unlock confirm error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});
```

- [ ] **Step 7: Run the unlock-routes test to verify it passes**

Run: `npx jest __tests__/carRequests/unlockRoutes.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 8: Run the full car-requests + full backend suite — no regressions**

Run: `npx jest __tests__/carRequests`
Expected: PASS — Slice 1, Slice 2, and Slice 3 car-request suites all green.

Run: `npx jest`
Expected: PASS except the known pre-existing `ServiceOrder.providerSnapshot` failure (unrelated). Slice-2 `sellerRoutes.test.js` still passes (browse/detail now also return `paywallEnabled`, which its assertions don't forbid).

- [ ] **Step 9: Commit**

```bash
git add src/carRequests/router.js __tests__/carRequests/unlockRoutes.test.js
git commit -m "feat(car-requests): add unlock routes + contact reveal + paywallEnabled"
```

---

# PART B — Mobile (`carEx`)

> All mobile paths are relative to `/Users/beckmaldinVL/development/mobileApps/carEx`. Stay on branch `feat/find-a-car`.

## Task B1: RequestService unlock methods + types

**Files:**
- Modify: `src/services/requests/RequestService.ts`
- Test: `src/services/requests/__tests__/RequestService.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/services/requests/__tests__/RequestService.test.ts`, add inside the `describe('RequestService', ...)` block (before the `rethrows on network error` test):

```typescript
  it('unlock POSTs /api/car-requests/:id/unlock and returns the revealed request', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: { request: { _id: 'r1', unlocked: true, contactPhone: '+996555111222' } },
    });
    const result = await RequestService.unlock('r1');
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/car-requests/r1/unlock');
    expect(result.request.unlocked).toBe(true);
    expect(result.request.contactPhone).toBe('+996555111222');
  });

  it('unlockPaymentIntent POSTs the payment-intent endpoint', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: { clientSecret: 'cs_1', paymentIntentId: 'pi_1', amount: 500, currency: 'KGS' },
    });
    const result = await RequestService.unlockPaymentIntent('r1');
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/car-requests/r1/unlock/payment-intent');
    expect(result.clientSecret).toBe('cs_1');
  });

  it('confirmUnlock POSTs the confirm endpoint with the payment intent id', async () => {
    mockedApiClient.post.mockResolvedValueOnce({
      data: { request: { _id: 'r1', unlocked: true, contactPhone: '+996555111222' } },
    });
    const result = await RequestService.confirmUnlock('r1', 'pi_1');
    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/car-requests/r1/unlock/confirm', { paymentIntentId: 'pi_1' });
    expect(result.request.contactPhone).toBe('+996555111222');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: FAIL — `RequestService.unlock` is not a function.

- [ ] **Step 3: Extend the types + add the methods**

In `src/services/requests/RequestService.ts`, add the optional revealed-contact fields to `RedactedCarRequest` (insert after the existing `unlocked: boolean;` line):

```typescript
  // Present only when `unlocked` is true (the seller has paid/revealed).
  contactPhone?: string;
  contactPhoneVerified?: boolean;
  telegramUsername?: string | null;
  telegramVerified?: boolean;
```

Add `paywallEnabled` to both response interfaces. Change `BrowseResponse` and `RequestDetailResponse` to include it:

```typescript
export interface BrowseResponse {
  unlockPrice: number;
  currency: string;
  paywallEnabled: boolean;
  requests: RedactedCarRequest[];
}

export interface RequestDetailResponse {
  unlockPrice: number;
  currency: string;
  paywallEnabled: boolean;
  request: RedactedCarRequest;
}
```

Add these response types after `RequestDetailResponse`:

```typescript
export interface UnlockResponse {
  request: RedactedCarRequest;
}

export interface UnlockPaymentIntentResponse {
  clientSecret?: string;
  paymentIntentId?: string;
  amount?: number;
  currency?: string;
  alreadyUnlocked?: boolean;
}
```

Then add the three methods inside the `RequestService` object after `getRequestDetail` (insert after its closing `},`):

```typescript
  unlock: async (id: string): Promise<UnlockResponse> => {
    try {
      const response = await apiClient.post(`/api/car-requests/${id}/unlock`);
      return response.data;
    } catch (error) {
      console.error('Failed to unlock car request', error);
      throw error;
    }
  },

  unlockPaymentIntent: async (id: string): Promise<UnlockPaymentIntentResponse> => {
    try {
      const response = await apiClient.post(`/api/car-requests/${id}/unlock/payment-intent`);
      return response.data;
    } catch (error) {
      console.error('Failed to create unlock payment intent', error);
      throw error;
    }
  },

  confirmUnlock: async (id: string, paymentIntentId: string): Promise<UnlockResponse> => {
    try {
      const response = await apiClient.post(`/api/car-requests/${id}/unlock/confirm`, { paymentIntentId });
      return response.data;
    } catch (error) {
      console.error('Failed to confirm car request unlock', error);
      throw error;
    }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: PASS (9 existing + 3 new = 12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/requests/RequestService.ts src/services/requests/__tests__/RequestService.test.ts
git commit -m "feat(find-a-car): add unlock service methods + paywall/reveal types"
```

---

## Task B2: Translations (RU + EN)

**Files:**
- Modify: `src/constants/translations.ts`

- [ ] **Step 1: Add the keys to the RU tree**

Find the `// Find a Car — Slice 2 (seller browse)` group in the `RU:` object and add immediately after `specifications: 'Характеристики',`:

```typescript
    // Find a Car — Slice 3 (paywall / unlock)
    freeUnlockNote: 'Бесплатно сейчас. Позже это станет платной услугой.',
    revealContact: 'Показать контакты',
    unlockForPrice: 'Открыть контакты',
    callBuyer: 'Позвонить',
    openWhatsApp: 'Написать в WhatsApp',
    openTelegram: 'Написать в Telegram',
    telegramUnverified: 'Telegram (не подтверждён)',
    contactRevealed: 'Контакты покупателя',
    categoryRequestUnlock: 'Интерес продавца к заявке',
    notif_request_unlock_title: 'Продавец заинтересован',
    notif_request_unlock_body: 'Продавец заинтересован в вашей заявке: {makeModel}.',
```

- [ ] **Step 2: Add the SAME keys to the EN tree**

Find the `// Find a Car — Slice 2 (seller browse)` group in the `EN:` object and add immediately after `specifications: 'Specifications',`:

```typescript
    // Find a Car — Slice 3 (paywall / unlock)
    freeUnlockNote: 'Free for now. This will become a paid service later.',
    revealContact: 'Reveal contact',
    unlockForPrice: 'Unlock contact',
    callBuyer: 'Call',
    openWhatsApp: 'Message on WhatsApp',
    openTelegram: 'Message on Telegram',
    telegramUnverified: 'Telegram (unverified)',
    contactRevealed: 'Buyer contact',
    categoryRequestUnlock: 'Seller interest in my request',
    notif_request_unlock_title: 'A seller is interested',
    notif_request_unlock_body: 'A seller is interested in your request: {makeModel}.',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep translations.ts`
Expected: no output (no key-parity errors).

- [ ] **Step 4: Commit**

```bash
git add src/constants/translations.ts
git commit -m "feat(find-a-car): add RU/EN strings for unlock + reveal + notification"
```

---

## Task B3: CarRequestDetailsScreen — real unlock flow

Replace the Slice-2 stub. Render one of three states: revealed contact (tap-to-call/WhatsApp/Telegram), free-mode note + reveal, or paid-mode Stripe unlock. Mirrors the `useStripe` pattern from `CarDetailsScreen.tsx:379-445`.

**Files:**
- Modify: `src/screens/CarRequestDetailsScreen.tsx`

- [ ] **Step 1: Update imports + state**

In `src/screens/CarRequestDetailsScreen.tsx`, replace the import of `react-native` primitives and add `Linking` + the Stripe hook + icons. Change the top imports so they read:

```typescript
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock, Phone, MessageCircle, Send } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { RequestService, RedactedCarRequest } from '../services/requests/RequestService';
import { RootStackParamList } from '../types/navigation';
```

Inside the component, after the existing `const { requestId } = route.params;` line, add the Stripe hook and a `paywallEnabled` + `unlocking` state. Add to the existing state block:

```typescript
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [paywallEnabled, setPaywallEnabled] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
```

In `fetchDetail`, after `setUnlockPrice(res.unlockPrice);`, add:

```typescript
      setPaywallEnabled(res.paywallEnabled);
```

- [ ] **Step 2: Replace the stub handler with the real unlock logic**

In `src/screens/CarRequestDetailsScreen.tsx`, replace the entire `handleUnlock` function with:

```typescript
  const revealInPlace = (revealed: RedactedCarRequest) => setRequest(revealed);

  const handleFreeReveal = useCallback(async () => {
    setUnlocking(true);
    try {
      const res = await RequestService.unlock(requestId);
      revealInPlace(res.request);
    } catch (e: any) {
      Alert.alert(t.requestDetails, e?.response?.data?.error || t.error);
    } finally {
      setUnlocking(false);
    }
  }, [requestId, t]);

  const handlePaidUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const intent = await RequestService.unlockPaymentIntent(requestId);
      // Server says it is already unlocked → just refetch the revealed detail.
      if (intent.alreadyUnlocked || !intent.clientSecret) {
        const res = await RequestService.getRequestDetail(requestId);
        revealInPlace(res.request);
        return;
      }
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: intent.clientSecret,
        merchantDisplayName: 'CarEx',
        returnURL: 'carex://stripe-redirect',
      });
      if (initError) {
        Alert.alert(t.paymentFailed, initError.message);
        return;
      }
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert(t.paymentFailed, presentError.message);
        }
        return;
      }
      const res = await RequestService.confirmUnlock(requestId, intent.paymentIntentId!);
      revealInPlace(res.request);
    } catch (e: any) {
      Alert.alert(t.paymentFailed, e?.response?.data?.message || e?.message || t.error);
    } finally {
      setUnlocking(false);
    }
  }, [requestId, initPaymentSheet, presentPaymentSheet, t]);

  const dialPhone = (phone: string) => Linking.openURL(`tel:${phone}`);
  const openWhatsApp = (phone: string) => Linking.openURL(`https://wa.me/${phone.replace(/[^\d]/g, '')}`);
  const openTelegram = (handle: string) => Linking.openURL(`https://t.me/${handle.replace(/^@+/, '')}`);
```

- [ ] **Step 3: Replace the contact box JSX**

In `src/screens/CarRequestDetailsScreen.tsx`, replace the entire `<View style={styles.contactBox}>...</View>` block with this conditional block:

```typescript
          {request.unlocked && request.contactPhone ? (
            <View style={styles.contactBox}>
              <Text style={styles.contactRevealedLabel}>{t.contactRevealed}</Text>
              <TouchableOpacity style={styles.contactAction} onPress={() => dialPhone(request.contactPhone!)}>
                <Phone size={18} color={COLORS.accent} />
                <Text style={styles.contactActionText}>{request.contactPhone}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactAction} onPress={() => openWhatsApp(request.contactPhone!)}>
                <MessageCircle size={18} color={COLORS.accent} />
                <Text style={styles.contactActionText}>{t.openWhatsApp}</Text>
              </TouchableOpacity>
              {request.telegramUsername ? (
                <TouchableOpacity style={styles.contactAction} onPress={() => openTelegram(request.telegramUsername!)}>
                  <Send size={18} color={COLORS.accent} />
                  <Text style={styles.contactActionText}>
                    @{request.telegramUsername} · {t.telegramUnverified}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={styles.contactBox}>
              <View style={styles.contactHeaderRow}>
                <Lock size={18} color={COLORS.textSecondary} />
                <Text style={styles.contactHidden}>{t.contactHidden}</Text>
              </View>
              {!paywallEnabled ? <Text style={styles.freeNote}>{t.freeUnlockNote}</Text> : null}
              <TouchableOpacity
                style={[styles.unlockBtn, unlocking && styles.unlockBtnDisabled]}
                onPress={paywallEnabled ? handlePaidUnlock : handleFreeReveal}
                disabled={unlocking}
                activeOpacity={0.85}>
                {unlocking ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.unlockBtnText}>
                    {paywallEnabled
                      ? `${t.unlockForPrice}${unlockPrice != null ? ` · ${unlockPrice.toLocaleString()} ${currency}` : ''}`
                      : t.revealContact}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
```

- [ ] **Step 4: Add the new styles**

In `src/screens/CarRequestDetailsScreen.tsx`, add these entries to the `StyleSheet.create({...})` object (next to the existing `unlockBtn` styles):

```typescript
  unlockBtnDisabled: { opacity: 0.6 },
  freeNote: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  contactRevealedLabel: {
    color: COLORS.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10,
  },
  contactAction: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  contactActionText: { color: COLORS.textPrimary, fontSize: 15, flexShrink: 1 },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep CarRequestDetailsScreen`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CarRequestDetailsScreen.tsx
git commit -m "feat(find-a-car): wire real unlock flow (free + Stripe) + contact reveal"
```

---

## Task B4: NotificationSettings toggle

Add the default-on "seller interest in my request" toggle.

**Files:**
- Modify: `src/screens/NotificationSettingsScreen.tsx`

- [ ] **Step 1: Extend the prefs interface + state**

In `src/screens/NotificationSettingsScreen.tsx`, add to the `NotificationPrefs` interface (after `newListingEnabled?: boolean;`):

```typescript
  requestUnlockEnabled?: boolean;
```

Add the state seed after the `newListingEnabled` state line:

```typescript
  const [requestUnlockEnabled, setRequestUnlockEnabled] = useState<boolean>(
    prefs.requestUnlockEnabled ?? true,
  );
```

- [ ] **Step 2: Add the toggle callback**

In `src/screens/NotificationSettingsScreen.tsx`, after the `onToggleNewListing` callback, add:

```typescript
  const onToggleRequestUnlock = useCallback(
    (value: boolean) => {
      setRequestUnlockEnabled(value);
      persistPrefs({ requestUnlockEnabled: value });
    },
    [persistPrefs],
  );
```

- [ ] **Step 3: Add the toggle row**

In `src/screens/NotificationSettingsScreen.tsx`, in the category-toggles group, the new-listings row currently ends the group (it uses `styles.toggleRow` without `rowDivider`). Change that new-listings row to include the divider, then add the request-unlock row as the new last row. Replace:

```typescript
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{t.categoryNewListings}</Text>
    <Switch
      value={newListingEnabled}
      disabled={muteAll}
      onValueChange={onToggleNewListing}
      trackColor={{ false: COLORS.border, true: COLORS.accent }}
    />
  </View>
```

with:

```typescript
  <View style={[styles.toggleRow, styles.rowDivider]}>
    <Text style={styles.toggleLabel}>{t.categoryNewListings}</Text>
    <Switch
      value={newListingEnabled}
      disabled={muteAll}
      onValueChange={onToggleNewListing}
      trackColor={{ false: COLORS.border, true: COLORS.accent }}
    />
  </View>
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{t.categoryRequestUnlock}</Text>
    <Switch
      value={requestUnlockEnabled}
      disabled={muteAll}
      onValueChange={onToggleRequestUnlock}
      trackColor={{ false: COLORS.border, true: COLORS.accent }}
    />
  </View>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep NotificationSettings`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/screens/NotificationSettingsScreen.tsx
git commit -m "feat(find-a-car): add default-on request-unlock notification toggle"
```

---

## Task B5: Deep link to My Requests

The unlock notification carries `carex://my-requests`. Route it both on push-tap (App.tsx) and in-app tap (NotificationsScreen).

**Files:**
- Modify: `App.tsx`
- Modify: `src/screens/NotificationsScreen.tsx`

- [ ] **Step 1: Add MyRequests to the linking config**

In `App.tsx`, in the `linking.config.screens` object (the block with `Notifications: 'notifications'`), add:

```typescript
            MyRequests: 'my-requests',
```

- [ ] **Step 2: Route the deeplink in routeDeeplink**

In `App.tsx`, in the `routeDeeplink` function, find the block that handles the `notifications` path (`if (normalizedPath === 'notifications' ...) { navigationRef.navigate('Notifications'); return; }`) and add immediately after it:

```typescript
      if (normalizedPath === 'my-requests' || normalizedPath.startsWith('my-requests/')) {
        navigationRef.navigate('MyRequests');
        return;
      }
```

- [ ] **Step 3: Route the in-app tap in NotificationsScreen**

In `src/screens/NotificationsScreen.tsx`, in the `routeNotification` function (the handler that parses `notification.data?.deeplink`), find the existing `notifications` deeplink branch and add immediately after it:

```typescript
    if (deeplink.startsWith('carex://my-requests') || deeplink.includes('/my-requests')) {
      navigation.navigate('MyRequests');
      return;
    }
```

> Note: match the exact variable name the function uses for the parsed link and the navigation object (`navigation` vs `navigate`). If `routeNotification` resolves the deeplink into a normalized path variable instead of the raw string, mirror the `notifications` branch's style there. Step 4's typecheck + a manual read of the surrounding lines confirms the right shape.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "App.tsx|NotificationsScreen"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/screens/NotificationsScreen.tsx
git commit -m "feat(find-a-car): route carex://my-requests deep link"
```

---

## Task B6: Full mobile verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit 2>&1 | grep -E "RequestService|CarRequestDetails|NotificationSettings|translations|App.tsx|NotificationsScreen"`
Expected: no output (no new errors in this slice's files).

- [ ] **Step 2: Run the requests test suite**

Run: `npx jest src/services/requests`
Expected: PASS (12 tests).

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint src/screens/CarRequestDetailsScreen.tsx src/screens/NotificationSettingsScreen.tsx src/services/requests/RequestService.ts`
Expected: no new errors (pre-existing inline-style warnings elsewhere are not introduced by these files).

---

## Slice complete — handoff

- Backend: `feat/car-requests-slice3` → PR into `main` (Railway deploys on merge). **Leave `REQUEST_UNLOCK_ENABLED` unset / `false`** so unlocks stay free at launch.
- Mobile: commits on `feat/find-a-car`.
- **Manual smoke test (after backend deploy + `npm run ios`/`android`):** as an APPROVED seller → Buyer Requests → open a request → see the "Free for now…" note + "Reveal contact" → tap → contact appears with Call / WhatsApp / Telegram actions. As the buyer who posted it → receive the "A seller is interested" notification (in-app + push) → tapping it opens My Requests. In `NotificationSettings`, the new toggle shows ON by default.
- **Go live with billing later:** set `REQUEST_UNLOCK_ENABLED=true` (and confirm `REQUEST_UNLOCK_PRICE`) on Railway. The detail screen automatically switches to the "Unlock · {price}" Stripe flow — no app release.

## Self-review notes (coverage vs spec)

- RequestUnlock model + unique index → A1. Paywall flag → A2. Reveal helper → A3. Buyer pref (default on) + copy → A4. Stripe client → A5. 1:1 notification → A6. Free + Stripe routes + reveal + paywallEnabled → A7.
- Mobile service methods → B1. Strings → B2. Detail screen (free/paid/revealed) → B3. Default-on toggle → B4. Deep link → B5. Verification → B6.
- Idempotency, server-authoritative amount, contact-privacy (reveal only with an unlock), and the default-on notification are each exercised by a named test.
```
