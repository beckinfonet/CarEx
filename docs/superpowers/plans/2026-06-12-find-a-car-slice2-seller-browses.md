# Find a Car — Slice 2 (Seller Browses) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An approved seller can browse **open** buyer car-requests (contact details redacted) and open a request's detail page, which shows the request specs plus the flat unlock price. No payment/reveal yet — the "Unlock" CTA is a stub until Slice 3.

**Architecture:** Two new **seller-facing** routes are added to the existing `/api/car-requests` router (`GET /` browse, `GET /:id` detail), both behind an **approved-seller** check derived from the verified token (`req.auth.uid`), never from the request body. Buyer contact fields are stripped by a dedicated, unit-tested `redactForSeller` helper (the contact-privacy spine). The flat unlock price comes from a server-side, admin-changeable `getUnlockPrice` config and is echoed in every seller response. The mobile app gains seller methods + redacted types on `RequestService`, a `CarRequestsScreen` (browse + make/model/budget filters), a `CarRequestDetailsScreen` (specs + locked-contact + stub unlock), an approved-seller-only Profile entry point, and RU/EN strings.

**Tech Stack:** Backend — Node/Express, Mongoose, MongoDB, Jest + supertest + mongodb-memory-server. Mobile — React Native 0.83 + TypeScript, axios (`apiClient`), Jest with mocked `apiClient`.

**Two repos:**
- Backend: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (branch `feat/car-requests-slice2` off `main`)
- Mobile: `/Users/beckmaldinVL/development/mobileApps/carEx` (branch `feat/find-a-car`)

---

## Decisions locked for this slice

- **Caller identity** for seller routes is `req.auth.uid` (set by `verifyIdToken`) — the spec's `callerUid` query param is **superseded** by the Slice-1 token-derived-identity decision. Never trust a uid from query/body.
- **Approved-seller gate** is enforced **server-side**: load the caller's `User`, require `sellerStatus === 'APPROVED'`, else `403 { error: 'not_approved_seller' }`. Mobile additionally hides the entry point unless approved and renders a "sellers only" state if the API 403s. The spec's "GatedScreenWrapper" note does **not** apply — that wrapper gates moderation state (suspended/banned), not seller approval.
- **Contact redaction** strips `buyerUid`, `contactPhone`, `contactPhoneVerified`, `telegramUsername`, `telegramVerified` from every seller-facing response and adds `unlocked: boolean`. There is no `RequestUnlock` model until Slice 3, so `unlocked` is always `false` this slice.
- **Browse scope:** only `status: 'open'` **and** `expiresAt > now`, excluding the caller's own requests (`buyerUid !== callerUid`). No auto-expire sweep job (deferred to Slice 4); the `expiresAt > now` filter is sufficient for correctness.
- **Unlock price** is server-authoritative via `getUnlockPrice()` (env `REQUEST_UNLOCK_PRICE` / `REQUEST_UNLOCK_CURRENCY`, defaults `500` / `KGS`) and returned as `unlockPrice` + `currency` in browse and detail responses.
- **Unlock CTA** on the detail screen is a stub this slice (shows a "coming soon" alert). Stripe reveal is Slice 3.
- Screens are not unit-tested (matches codebase convention); the config helper, redaction helper, router routes, and service methods are TDD'd.

## File structure

**Backend (create unless noted):**
- `src/carRequests/unlockPrice.js` — pure config helper returning `{ amount, currency }`
- `src/carRequests/redactForSeller.js` — pure redaction helper (the contact-privacy spine)
- `__tests__/carRequests/unlockPrice.test.js` — unit tests for the config helper
- `__tests__/carRequests/redactForSeller.test.js` — unit tests for redaction
- `__tests__/carRequests/sellerRoutes.test.js` — supertest + in-memory mongo for the two seller routes
- Modify: `src/carRequests/router.js` — add `GET /` (browse) + `GET /:id` (detail) seller routes
- No `server.js` change — the router is already mounted at `/api/car-requests` behind `verifyIdToken`.

**Mobile (create unless noted):**
- `src/screens/CarRequestsScreen.tsx` — seller browse list + filters
- `src/screens/CarRequestDetailsScreen.tsx` — request detail + locked contact + stub unlock
- Modify: `src/services/requests/RequestService.ts` — `getOpenRequests`, `getRequestDetail`, redacted types, `RequestCardData`
- Modify: `src/services/requests/__tests__/RequestService.test.ts` — tests for the two new methods
- Modify: `src/components/RequestCard.tsx` — widen prop type to `RequestCardData` so redacted requests are accepted
- Modify: `src/types/navigation.ts` — add `CarRequests`, `CarRequestDetails`
- Modify: `App.tsx` — import + register the two screens
- Modify: `src/constants/translations.ts` — add RU + EN keys
- Modify: `src/screens/ProfileScreen.tsx` — add approved-seller-only "Buyer Requests" entry

---

# PART A — Backend (`carEx-services`)

> All backend paths below are relative to `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`. Run commands from that directory.

## Task A0: Branch

- [ ] **Step 1: Create the slice branch off main**

```bash
git checkout main
git pull --ff-only
git checkout -b feat/car-requests-slice2
```

---

## Task A1: Unlock-price config helper

A pure helper so the flat fee is server-authoritative and admin-changeable via env without a mobile release.

**Files:**
- Create: `src/carRequests/unlockPrice.js`
- Test: `__tests__/carRequests/unlockPrice.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/unlockPrice.test.js`:

```javascript
const { getUnlockPrice } = require('../../src/carRequests/unlockPrice');

describe('getUnlockPrice', () => {
  const ORIGINAL = { ...process.env };
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('defaults to 500 KGS when no env is set', () => {
    delete process.env.REQUEST_UNLOCK_PRICE;
    delete process.env.REQUEST_UNLOCK_CURRENCY;
    expect(getUnlockPrice()).toEqual({ amount: 500, currency: 'KGS' });
  });

  it('reads the env override', () => {
    process.env.REQUEST_UNLOCK_PRICE = '1200';
    process.env.REQUEST_UNLOCK_CURRENCY = 'USD';
    expect(getUnlockPrice()).toEqual({ amount: 1200, currency: 'USD' });
  });

  it('falls back to the default amount when the env value is invalid', () => {
    process.env.REQUEST_UNLOCK_PRICE = 'not-a-number';
    delete process.env.REQUEST_UNLOCK_CURRENCY;
    expect(getUnlockPrice()).toEqual({ amount: 500, currency: 'KGS' });
  });

  it('falls back to the default amount when the env value is non-positive', () => {
    process.env.REQUEST_UNLOCK_PRICE = '0';
    expect(getUnlockPrice().amount).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/unlockPrice.test.js`
Expected: FAIL with "Cannot find module '../../src/carRequests/unlockPrice'".

- [ ] **Step 3: Write the helper**

Create `src/carRequests/unlockPrice.js`:

```javascript
const DEFAULT_AMOUNT = 500;
const DEFAULT_CURRENCY = 'KGS';

/**
 * Server-authoritative flat unlock fee. Admin-changeable via env without a
 * mobile release. Returns { amount, currency }. Invalid/non-positive amounts
 * fall back to the default so a bad env value can never produce a free unlock.
 */
function getUnlockPrice() {
  const raw = Number(process.env.REQUEST_UNLOCK_PRICE);
  const amount = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_AMOUNT;
  const currency = process.env.REQUEST_UNLOCK_CURRENCY || DEFAULT_CURRENCY;
  return { amount, currency };
}

module.exports = { getUnlockPrice, DEFAULT_AMOUNT, DEFAULT_CURRENCY };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/unlockPrice.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/unlockPrice.js __tests__/carRequests/unlockPrice.test.js
git commit -m "feat(car-requests): add server-authoritative unlock price config"
```

---

## Task A2: Contact-redaction helper

The contact-privacy spine. A pure function that strips every buyer-contact field from a seller-facing request object and tags it with `unlocked`. Unit-tested hard because a leak here is the core security failure for this feature.

**Files:**
- Create: `src/carRequests/redactForSeller.js`
- Test: `__tests__/carRequests/redactForSeller.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/redactForSeller.test.js`:

```javascript
const { redactForSeller, SELLER_HIDDEN_FIELDS } = require('../../src/carRequests/redactForSeller');

const fullDoc = {
  _id: 'r1',
  buyerUid: 'buyer-1',
  makeName: 'Toyota',
  modelName: 'Camry',
  budgetMax: 15000,
  currency: 'KGS',
  status: 'open',
  contactPhone: '+996555111222',
  contactPhoneVerified: true,
  telegramUsername: 'bishkek_cars',
  telegramVerified: false,
};

describe('redactForSeller', () => {
  it('strips every contact + owner field', () => {
    const out = redactForSeller(fullDoc, { unlocked: false });
    for (const f of SELLER_HIDDEN_FIELDS) {
      expect(out[f]).toBeUndefined();
    }
  });

  it('keeps the non-contact fields a seller is allowed to see', () => {
    const out = redactForSeller(fullDoc, { unlocked: false });
    expect(out.makeName).toBe('Toyota');
    expect(out.budgetMax).toBe(15000);
    expect(out.status).toBe('open');
  });

  it('tags the result with the unlocked flag', () => {
    expect(redactForSeller(fullDoc, { unlocked: false }).unlocked).toBe(false);
    expect(redactForSeller(fullDoc, { unlocked: true }).unlocked).toBe(true);
  });

  it('defaults unlocked to false when not provided', () => {
    expect(redactForSeller(fullDoc).unlocked).toBe(false);
  });

  it('accepts a Mongoose doc with toObject()', () => {
    const mongooseLike = { toObject: () => ({ ...fullDoc }) };
    const out = redactForSeller(mongooseLike, { unlocked: false });
    expect(out.contactPhone).toBeUndefined();
    expect(out.makeName).toBe('Toyota');
  });

  it('does not mutate the input object', () => {
    const input = { ...fullDoc };
    redactForSeller(input, { unlocked: false });
    expect(input.contactPhone).toBe('+996555111222');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/redactForSeller.test.js`
Expected: FAIL with "Cannot find module '../../src/carRequests/redactForSeller'".

- [ ] **Step 3: Write the helper**

Create `src/carRequests/redactForSeller.js`:

```javascript
// Buyer-private fields that must NEVER reach a seller who has not paid to unlock.
const SELLER_HIDDEN_FIELDS = [
  'buyerUid',
  'contactPhone',
  'contactPhoneVerified',
  'telegramUsername',
  'telegramVerified',
];

/**
 * Produce a seller-safe copy of a CarRequest. Strips every contact/owner field
 * and tags the result with `unlocked`. Pure — never mutates the input. Accepts
 * either a Mongoose document (with .toObject()) or a plain/lean object.
 */
function redactForSeller(doc, { unlocked = false } = {}) {
  const obj = doc && typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  for (const field of SELLER_HIDDEN_FIELDS) {
    delete obj[field];
  }
  obj.unlocked = unlocked;
  return obj;
}

module.exports = { redactForSeller, SELLER_HIDDEN_FIELDS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/redactForSeller.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/redactForSeller.js __tests__/carRequests/redactForSeller.test.js
git commit -m "feat(car-requests): add seller contact-redaction helper"
```

---

## Task A3: Seller browse + detail routes

Add two seller-facing routes to the existing router. Both require an APPROVED seller (server-side). The existing buyer routes are untouched.

**Files:**
- Modify: `src/carRequests/router.js`
- Test: `__tests__/carRequests/sellerRoutes.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/sellerRoutes.test.js`:

```javascript
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let app;
let VehicleMake;
let VehicleModel;
let User;
let CarRequest;

// Mutable auth identity the fake middleware injects per-test.
let currentUid = 'seller-1';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'CarEx' });

  VehicleMake =
    mongoose.models.VehicleMake ||
    mongoose.model(
      'VehicleMake',
      new mongoose.Schema({ name: String, slug: String, isActive: { type: Boolean, default: true } }),
      'vehicle_makes'
    );
  VehicleModel =
    mongoose.models.VehicleModel ||
    mongoose.model(
      'VehicleModel',
      new mongoose.Schema({
        makeId: mongoose.Schema.Types.ObjectId,
        name: String,
        isActive: { type: Boolean, default: true },
      }),
      'vehicle_models'
    );
  User =
    mongoose.models.User ||
    mongoose.model(
      'User',
      new mongoose.Schema({
        firebaseUid: String,
        email: String,
        phoneNumber: String,
        isPhoneVerified: Boolean,
        sellerStatus: String,
      })
    );
  CarRequest = require('../../src/models/CarRequest');

  const carRequestsRouter = require('../../src/carRequests/router');

  app = express();
  app.use(express.json());
  app.use('/api/car-requests', (req, res, next) => {
    req.auth = { uid: currentUid, email: `${currentUid}@example.com` };
    next();
  }, carRequestsRouter);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  currentUid = 'seller-1';
  await CarRequest.deleteMany({});
  await User.deleteMany({});
  await VehicleMake.deleteMany({});
  await VehicleModel.deleteMany({});
});

async function seedCatalog() {
  const make = await VehicleMake.create({ name: 'Toyota', slug: 'toyota', isActive: true });
  const model = await VehicleModel.create({ makeId: make._id, name: 'Camry', isActive: true });
  return { make, model };
}

async function seedApprovedSeller(uid = 'seller-1') {
  return User.create({ firebaseUid: uid, email: `${uid}@x.com`, sellerStatus: 'APPROVED' });
}

async function seedOpenRequest(make, overrides = {}) {
  return CarRequest.create({
    buyerUid: 'buyer-1',
    makeId: make._id,
    makeName: 'Toyota',
    budgetMax: 15000,
    currency: 'KGS',
    contactPhone: '+996555111222',
    contactPhoneVerified: true,
    telegramUsername: 'bishkek_cars',
    status: 'open',
    expiresAt: new Date(Date.now() + 1e9),
    ...overrides,
  });
}

describe('GET /api/car-requests (seller browse)', () => {
  it('returns open requests with contact redacted + unlockPrice for an approved seller', async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    await seedOpenRequest(make);

    const res = await request(app).get('/api/car-requests');

    expect(res.status).toBe(200);
    expect(res.body.unlockPrice).toBe(500);
    expect(res.body.currency).toBe('KGS');
    expect(res.body.requests).toHaveLength(1);
    const r = res.body.requests[0];
    expect(r.makeName).toBe('Toyota');
    expect(r.budgetMax).toBe(15000);
    expect(r.unlocked).toBe(false);
    expect(r.contactPhone).toBeUndefined();
    expect(r.buyerUid).toBeUndefined();
    expect(r.telegramUsername).toBeUndefined();
    expect(r.contactPhoneVerified).toBeUndefined();
  });

  it('rejects a caller who is not an approved seller (403)', async () => {
    const { make } = await seedCatalog();
    await User.create({ firebaseUid: 'seller-1', email: 'x@x.com', sellerStatus: 'NONE' });
    await seedOpenRequest(make);

    const res = await request(app).get('/api/car-requests');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('not_approved_seller');
  });

  it('excludes closed and expired requests', async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    await seedOpenRequest(make); // open
    await seedOpenRequest(make, { status: 'closed' });
    await seedOpenRequest(make, { expiresAt: new Date(Date.now() - 1000) }); // expired

    const res = await request(app).get('/api/car-requests');
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
  });

  it("excludes the caller's own requests", async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    await seedOpenRequest(make, { buyerUid: 'seller-1' }); // own
    await seedOpenRequest(make, { buyerUid: 'buyer-9' }); // someone else's

    const res = await request(app).get('/api/car-requests');
    expect(res.body.requests).toHaveLength(1);
    // buyerUid is redacted, so assert via the surviving count only.
  });

  it('filters by makeId', async () => {
    const { make } = await seedCatalog();
    const otherMake = await VehicleMake.create({ name: 'Honda', slug: 'honda', isActive: true });
    await seedApprovedSeller('seller-1');
    await seedOpenRequest(make);
    await seedOpenRequest(otherMake, { makeName: 'Honda' });

    const res = await request(app).get(`/api/car-requests?makeId=${make._id}`);
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].makeName).toBe('Toyota');
  });

  it('filters by minBudget (budgetMax >= minBudget)', async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    await seedOpenRequest(make, { budgetMax: 8000 });
    await seedOpenRequest(make, { budgetMax: 20000 });

    const res = await request(app).get('/api/car-requests?minBudget=10000');
    expect(res.body.requests).toHaveLength(1);
    expect(res.body.requests[0].budgetMax).toBe(20000);
  });
});

describe('GET /api/car-requests/:id (seller detail)', () => {
  it('returns a redacted request + unlockPrice for an approved seller', async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    const doc = await seedOpenRequest(make);

    const res = await request(app).get(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(200);
    expect(res.body.unlockPrice).toBe(500);
    expect(res.body.request.makeName).toBe('Toyota');
    expect(res.body.request.unlocked).toBe(false);
    expect(res.body.request.contactPhone).toBeUndefined();
    expect(res.body.request.buyerUid).toBeUndefined();
  });

  it('rejects a non-approved seller (403)', async () => {
    const { make } = await seedCatalog();
    await User.create({ firebaseUid: 'seller-1', email: 'x@x.com', sellerStatus: 'PENDING' });
    const doc = await seedOpenRequest(make);

    const res = await request(app).get(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown id', async () => {
    await seedApprovedSeller('seller-1');
    const res = await request(app).get(`/api/car-requests/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a non-open request', async () => {
    const { make } = await seedCatalog();
    await seedApprovedSeller('seller-1');
    const doc = await seedOpenRequest(make, { status: 'closed' });
    const res = await request(app).get(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(404);
  });

  it('does not collide with GET /mine (route ordering)', async () => {
    // /mine is a buyer route returning an array; it must not be captured by /:id.
    await seedApprovedSeller('seller-1');
    const res = await request(app).get('/api/car-requests/mine');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/sellerRoutes.test.js`
Expected: FAIL — the seller routes return 404 (not yet implemented), so the assertions fail.

- [ ] **Step 3: Add the requires + helper at the top of the router**

In `src/carRequests/router.js`, add these two requires immediately after the existing `validateRequestInput` require (currently line 4):

```javascript
const { getUnlockPrice } = require('./unlockPrice');
const { redactForSeller } = require('./redactForSeller');
```

Then, immediately after the existing `resolveMakeModel` function (it ends with its closing `}` near line 38), add the approved-seller helper:

```javascript
// Load the caller and require APPROVED seller status. Returns the user or null.
async function getApprovedSeller(uid) {
  if (!uid) return null;
  const user = await getUser().findOne({ firebaseUid: uid }).lean();
  if (!user || user.sellerStatus !== 'APPROVED') return null;
  return user;
}
```

- [ ] **Step 4: Add the browse route after `GET /mine`**

In `src/carRequests/router.js`, find the end of the `GET /mine` handler (its closing `});` near line 91) and add **immediately after it** (so it stays registered before the `/:id` param route added in the next step):

```javascript
// GET /api/car-requests — seller browse of OPEN, non-expired requests (contact redacted)
router.get('/', async (req, res) => {
  try {
    const callerUid = req.auth && req.auth.uid;
    if (!callerUid) return res.status(401).json({ error: 'unauthorized' });

    const seller = await getApprovedSeller(callerUid);
    if (!seller) return res.status(403).json({ error: 'not_approved_seller' });

    const filter = {
      status: 'open',
      expiresAt: { $gt: new Date() },
      buyerUid: { $ne: callerUid }, // never surface the seller's own requests
    };
    if (req.query.makeId && mongoose.isValidObjectId(req.query.makeId)) {
      filter.makeId = req.query.makeId;
    }
    if (req.query.modelId && mongoose.isValidObjectId(req.query.modelId)) {
      filter.modelId = req.query.modelId;
    }
    const minBudget = Number(req.query.minBudget);
    if (Number.isFinite(minBudget) && minBudget > 0) {
      filter.budgetMax = { $gte: minBudget };
    }

    const rows = await CarRequest.find(filter).sort({ createdAt: -1 }).lean();
    const { amount, currency } = getUnlockPrice();
    // No RequestUnlock model until Slice 3 — every row is locked for now.
    const requests = rows.map((r) => redactForSeller(r, { unlocked: false }));
    return res.json({ unlockPrice: amount, currency, requests });
  } catch (err) {
    console.error('[car-requests] browse error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});
```

- [ ] **Step 5: Add the detail route just before `module.exports`**

In `src/carRequests/router.js`, add this **immediately before** the final `module.exports = router;` line. Placing it last guarantees the named buyer GET route (`/mine`) is matched before this `/:id` param route:

```javascript
// GET /api/car-requests/:id — seller detail (contact redacted; no unlocks until Slice 3)
router.get('/:id', async (req, res) => {
  try {
    const callerUid = req.auth && req.auth.uid;
    if (!callerUid) return res.status(401).json({ error: 'unauthorized' });

    const seller = await getApprovedSeller(callerUid);
    if (!seller) return res.status(403).json({ error: 'not_approved_seller' });

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'not_found' });
    }
    const doc = await CarRequest.findById(req.params.id).lean();
    if (!doc || doc.status !== 'open') return res.status(404).json({ error: 'not_found' });

    const { amount, currency } = getUnlockPrice();
    const requestOut = redactForSeller(doc, { unlocked: false });
    return res.json({ unlockPrice: amount, currency, request: requestOut });
  } catch (err) {
    console.error('[car-requests] detail error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});
```

- [ ] **Step 6: Run the seller-route test to verify it passes**

Run: `npx jest __tests__/carRequests/sellerRoutes.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 7: Run the full backend suite — no regressions to Slice 1 or anything else**

Run: `npx jest`
Expected: PASS — Slice-1 `router.test.js` + `validateRequestInput.test.js` plus the three new files all green. (A pre-existing `ServiceOrder.providerSnapshot` failure is known and unrelated — see STATE.md; everything else must pass.)

- [ ] **Step 8: Commit**

```bash
git add src/carRequests/router.js __tests__/carRequests/sellerRoutes.test.js
git commit -m "feat(car-requests): add approved-seller browse + detail routes (contact redacted)"
```

---

# PART B — Mobile (`carEx`)

> All mobile paths below are relative to `/Users/beckmaldinVL/development/mobileApps/carEx`. Run commands from that directory. Stay on branch `feat/find-a-car`.

## Task B1: RequestService seller methods + types

**Files:**
- Modify: `src/services/requests/RequestService.ts`
- Test: `src/services/requests/__tests__/RequestService.test.ts`

- [ ] **Step 1: Add the failing tests**

In `src/services/requests/__tests__/RequestService.test.ts`, add these two `it` blocks inside the existing `describe('RequestService', ...)` block (after the `deleteRequest` test, before the `rethrows on network error` test):

```typescript
  it('getOpenRequests GETs /api/car-requests with filter params and returns the payload', async () => {
    mockedApiClient.get.mockResolvedValueOnce({
      data: { unlockPrice: 500, currency: 'KGS', requests: [{ _id: 'r1', unlocked: false }] },
    });

    const result = await RequestService.getOpenRequests({ makeId: 'm1', minBudget: 10000 });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/car-requests', {
      params: { makeId: 'm1', minBudget: 10000 },
    });
    expect(result.unlockPrice).toBe(500);
    expect(result.requests[0]._id).toBe('r1');
  });

  it('getOpenRequests omits empty filters', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: { unlockPrice: 500, currency: 'KGS', requests: [] } });
    await RequestService.getOpenRequests();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/car-requests', { params: {} });
  });

  it('getRequestDetail GETs /api/car-requests/:id and returns the payload', async () => {
    mockedApiClient.get.mockResolvedValueOnce({
      data: { unlockPrice: 500, currency: 'KGS', request: { _id: 'r1', unlocked: false } },
    });
    const result = await RequestService.getRequestDetail('r1');
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/car-requests/r1');
    expect(result.request._id).toBe('r1');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: FAIL — `RequestService.getOpenRequests` / `getRequestDetail` are not functions.

- [ ] **Step 3: Add the types + methods**

In `src/services/requests/RequestService.ts`, add these type exports immediately after the existing `CarRequest` interface (after its closing `}`, before the `RequestService` const):

```typescript
// Seller-facing shape: identical to CarRequest minus the buyer-contact fields,
// plus an `unlocked` flag. The backend strips contact fields for sellers.
export interface RedactedCarRequest {
  _id: string;
  makeId: string;
  modelId: string | null;
  makeName: string;
  modelName: string | null;
  yearMin: number | null;
  yearMax: number | null;
  budgetMin: number | null;
  budgetMax: number;
  currency: string;
  exteriorColor: string | null;
  interiorColor: string | null;
  interiorMaterial: string | null;
  engine: string | null;
  fuel: string | null;
  note: string | null;
  status: 'open' | 'closed' | 'expired';
  expiresAt: string;
  unlockCount: number;
  unlocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrowseFilters {
  makeId?: string | null;
  modelId?: string | null;
  minBudget?: number | null;
}

export interface BrowseResponse {
  unlockPrice: number;
  currency: string;
  requests: RedactedCarRequest[];
}

export interface RequestDetailResponse {
  unlockPrice: number;
  currency: string;
  request: RedactedCarRequest;
}

// The minimal field set RequestCard renders — satisfied by both the buyer's
// full CarRequest and the seller's RedactedCarRequest.
export type RequestCardData = Pick<
  CarRequest,
  '_id' | 'makeName' | 'modelName' | 'budgetMax' | 'budgetMin' | 'currency' | 'yearMin' | 'yearMax' | 'status'
>;
```

Then, inside the `RequestService` object, add these two methods after `deleteRequest` (insert after its closing `},`):

```typescript
  getOpenRequests: async (filters: BrowseFilters = {}): Promise<BrowseResponse> => {
    try {
      const params: Record<string, string | number> = {};
      if (filters.makeId) {params.makeId = filters.makeId;}
      if (filters.modelId) {params.modelId = filters.modelId;}
      if (filters.minBudget != null) {params.minBudget = filters.minBudget;}
      const response = await apiClient.get('/api/car-requests', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to browse car requests', error);
      throw error;
    }
  },

  getRequestDetail: async (id: string): Promise<RequestDetailResponse> => {
    try {
      const response = await apiClient.get(`/api/car-requests/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch car request detail', error);
      throw error;
    }
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: PASS (9 tests — 6 original + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/services/requests/RequestService.ts src/services/requests/__tests__/RequestService.test.ts
git commit -m "feat(find-a-car): add seller browse/detail methods to RequestService"
```

---

## Task B2: Translations (RU + EN)

**Files:**
- Modify: `src/constants/translations.ts`

- [ ] **Step 1: Add the keys to the RU tree**

Find the `// Find a Car (buyer requests)` group in the `RU: {` object (added in Slice 1) and add these keys immediately after `loginToPost`:

```typescript
    // Find a Car — Slice 2 (seller browse)
    buyerRequests: 'Заявки покупателей',
    noOpenRequests: 'Нет открытых заявок',
    sellersOnly: 'Доступно только одобренным продавцам',
    requestDetails: 'Детали заявки',
    contactHidden: 'Контактные данные скрыты',
    unlockContact: 'Открыть контакты',
    unlockComingSoon: 'Открытие контактов появится в следующем обновлении',
    filterMinBudget: 'Бюджет от',
    telegram: 'Telegram',
    specifications: 'Характеристики',
```

- [ ] **Step 2: Add the SAME keys to the EN tree**

Find the matching `// Find a Car (buyer requests)` group in the `EN: {` object and add immediately after `loginToPost`:

```typescript
    // Find a Car — Slice 2 (seller browse)
    buyerRequests: 'Buyer Requests',
    noOpenRequests: 'No open requests',
    sellersOnly: 'Approved sellers only',
    requestDetails: 'Request Details',
    contactHidden: 'Contact details hidden',
    unlockContact: 'Unlock Contact',
    unlockComingSoon: 'Contact unlock is coming in an upcoming update',
    filterMinBudget: 'Min budget',
    telegram: 'Telegram',
    specifications: 'Specifications',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors related to `translations.ts`. (The translations object is typed as `typeof TRANSLATIONS.RU`, so a key present in one tree but not the other would error.)

- [ ] **Step 4: Commit**

```bash
git add src/constants/translations.ts
git commit -m "feat(find-a-car): add RU/EN strings for seller browse"
```

---

## Task B3: RequestCard prop-type widening

`RequestCard` currently types its prop as the full `CarRequest`, but the seller browse passes a `RedactedCarRequest` (no contact fields). Widen the prop to the structural `RequestCardData` so both are accepted. The component already only reads non-contact fields.

**Files:**
- Modify: `src/components/RequestCard.tsx`

- [ ] **Step 1: Swap the imported type**

In `src/components/RequestCard.tsx`, change the type import on line 6 from:

```typescript
import type { CarRequest } from '../services/requests/RequestService';
```

to:

```typescript
import type { RequestCardData } from '../services/requests/RequestService';
```

- [ ] **Step 2: Replace every `CarRequest` reference with `RequestCardData`**

In the same file, update these references (there are five `CarRequest` usages — the props interface, both helper signatures, the `statusStyle` param type, and none elsewhere):

- `interface RequestCardProps { request: CarRequest; ... }` → `request: RequestCardData;`
- `function formatBudget(req: CarRequest)` → `function formatBudget(req: RequestCardData)`
- `function formatYears(req: CarRequest)` → `function formatYears(req: RequestCardData)`
- `function statusStyle(status: CarRequest['status'])` → `function statusStyle(status: RequestCardData['status'])`

- [ ] **Step 3: Typecheck (also confirms MyRequestsScreen still compiles — full CarRequest is assignable to RequestCardData)**

Run: `npx tsc --noEmit`
Expected: No errors. `MyRequestsScreen` passes a full `CarRequest`, which structurally satisfies `RequestCardData`.

- [ ] **Step 4: Commit**

```bash
git add src/components/RequestCard.tsx
git commit -m "refactor(find-a-car): widen RequestCard prop to RequestCardData"
```

---

## Task B4: Navigation routes + App.tsx registration

**Files:**
- Modify: `src/types/navigation.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Add routes to RootStackParamList**

In `src/types/navigation.ts`, add immediately after the `MyRequests: undefined;` line:

```typescript
  CarRequests: undefined;
  CarRequestDetails: { requestId: string };
```

- [ ] **Step 2: Import the screens in App.tsx**

In `App.tsx`, immediately after the existing `MyRequestsScreen` import (line 40), add:

```typescript
import { CarRequestsScreen } from './src/screens/CarRequestsScreen';
import { CarRequestDetailsScreen } from './src/screens/CarRequestDetailsScreen';
```

(These files are created in Tasks B5/B6. Do not run the app until B6 is done — the imports won't resolve until then.)

- [ ] **Step 3: Register the screens in the Navigator**

In `App.tsx`, immediately after the existing `<Stack.Screen name="MyRequests" ... />` line (line 342), add:

```typescript
<Stack.Screen name="CarRequests" component={CarRequestsScreen} />
<Stack.Screen name="CarRequestDetails" component={CarRequestDetailsScreen} />
```

- [ ] **Step 4: Commit**

```bash
git add src/types/navigation.ts App.tsx
git commit -m "feat(find-a-car): register CarRequests + CarRequestDetails routes"
```

---

## Task B5: CarRequestsScreen (seller browse)

Mirrors `MyRequestsScreen`'s fetch-on-focus + FlatList scaffolding, adds a `MakeModelFilterBar` + a min-budget input, handles the approved-seller 403 with a "sellers only" state, and navigates to detail on card press.

**Files:**
- Create: `src/screens/CarRequestsScreen.tsx`

- [ ] **Step 1: Write the screen**

Create `src/screens/CarRequestsScreen.tsx`:

```typescript
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RequestService, RedactedCarRequest } from '../services/requests/RequestService';
import { RequestCard } from '../components/RequestCard';
import { MakeModelFilterBar } from '../components/MakeModelFilterBar';
import { VehicleMake, VehicleModel } from '../hooks/useVehicleCatalog';

export const CarRequestsScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();

  const [requests, setRequests] = useState<RedactedCarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notApproved, setNotApproved] = useState(false);

  const [selectedMake, setSelectedMake] = useState<VehicleMake | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [minBudget, setMinBudget] = useState('');

  const fetchRequests = useCallback(async () => {
    if (!user?.localId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const parsedBudget = parseInt(minBudget, 10);
      const res = await RequestService.getOpenRequests({
        makeId: selectedMake?.id ?? null,
        modelId: selectedModel?.id ?? null,
        minBudget: Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : null,
      });
      setRequests(res.requests);
      setNotApproved(false);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setNotApproved(true);
        setRequests([]);
      } else {
        console.error('Failed to browse requests', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId, selectedMake, selectedModel, minBudget]);

  React.useEffect(() => {
    if (isFocused) {
      fetchRequests();
    }
  }, [isFocused, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const renderItem = ({ item }: { item: RedactedCarRequest }) => (
    <RequestCard
      request={item}
      onPress={() => navigation.navigate('CarRequestDetails', { requestId: item._id })}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.buyerRequests}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {notApproved ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>{t.sellersOnly}</Text>
        </View>
      ) : (
        <>
          <View style={styles.filters}>
            <MakeModelFilterBar
              selectedMake={selectedMake}
              selectedModel={selectedModel}
              onSelect={(make, model) => {
                setSelectedMake(make);
                setSelectedModel(model);
              }}
              t={{
                selectMake: t.selectMake,
                selectModel: t.selectModel,
                make: t.make,
                model: t.model,
              }}
            />
            <TextInput
              style={styles.budgetInput}
              value={minBudget}
              onChangeText={setMinBudget}
              keyboardType="number-pad"
              placeholder={t.filterMinBudget}
              placeholderTextColor={COLORS.textSecondary}
            />
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color={COLORS.accent} />
          ) : (
            <FlatList
              data={requests}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
              }
              ListEmptyComponent={<Text style={styles.empty}>{t.noOpenRequests}</Text>}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 24 },
  filters: { paddingHorizontal: SIZES.padding, gap: 10, marginBottom: 4 },
  budgetInput: {
    backgroundColor: COLORS.searchBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
  },
  list: { padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.padding },
  loader: { marginTop: 40 },
});
```

> Note: confirm `t.selectMake`, `t.selectModel`, `t.make`, `t.model` exist in `translations.ts` (they are used by the existing browse `MakeModelFilterBar` on Home, so they should). If any is missing, `npx tsc --noEmit` in Step 2 will flag it — add it to both trees mirroring the others.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors in `CarRequestsScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/CarRequestsScreen.tsx
git commit -m "feat(find-a-car): add CarRequestsScreen (seller browse + filters)"
```

---

## Task B6: CarRequestDetailsScreen (specs + locked contact + stub unlock)

Fetches one redacted request, renders its specs, shows a locked-contact section with the flat unlock price, and a stub "Unlock" CTA (Slice 3 wires Stripe). Handles loading, 403 (sellers only), and not-found.

**Files:**
- Create: `src/screens/CarRequestDetailsScreen.tsx`

- [ ] **Step 1: Write the screen**

Create `src/screens/CarRequestDetailsScreen.tsx`:

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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { RequestService, RedactedCarRequest } from '../services/requests/RequestService';
import { RootStackParamList } from '../types/navigation';

type DetailRoute = RouteProp<RootStackParamList, 'CarRequestDetails'>;

export const CarRequestDetailsScreen = () => {
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const route = useRoute<DetailRoute>();
  const { requestId } = route.params;

  const [request, setRequest] = useState<RedactedCarRequest | null>(null);
  const [unlockPrice, setUnlockPrice] = useState<number | null>(null);
  const [currency, setCurrency] = useState('KGS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_approved' | 'not_found' | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await RequestService.getRequestDetail(requestId);
      setRequest(res.request);
      setUnlockPrice(res.unlockPrice);
      setCurrency(res.currency);
      setError(null);
    } catch (e: any) {
      if (e?.response?.status === 403) {
        setError('not_approved');
      } else {
        setError('not_found');
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleUnlock = () => {
    // Slice 3 replaces this stub with the Stripe payment-intent + confirm flow.
    Alert.alert(t.unlockContact, t.unlockComingSoon);
  };

  const renderSpec = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return (
      <View style={styles.specRow} key={label}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{String(value)}</Text>
      </View>
    );
  };

  const budgetText = (req: RedactedCarRequest) =>
    req.budgetMin
      ? `${req.budgetMin.toLocaleString()} – ${req.budgetMax.toLocaleString()} ${req.currency}`
      : `${req.budgetMax.toLocaleString()} ${req.currency}`;

  const yearText = (req: RedactedCarRequest) => {
    if (req.yearMin && req.yearMax) {return `${req.yearMin}–${req.yearMax}`;}
    if (req.yearMin) {return `${req.yearMin}+`;}
    if (req.yearMax) {return `≤ ${req.yearMax}`;}
    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.requestDetails}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.accent} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.empty}>{error === 'not_approved' ? t.sellersOnly : t.noOpenRequests}</Text>
        </View>
      ) : request ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {request.makeName}
            {request.modelName ? ` ${request.modelName}` : ` · ${t.anyModel}`}
          </Text>

          <Text style={styles.section}>{t.specifications}</Text>
          {renderSpec(t.budget, budgetText(request))}
          {renderSpec(`${t.yearFrom} / ${t.yearTo}`, yearText(request))}
          {renderSpec(t.exteriorColor, request.exteriorColor)}
          {renderSpec(t.interiorColor, request.interiorColor)}
          {renderSpec(t.interiorMaterial, request.interiorMaterial)}
          {renderSpec(t.engine, request.engine)}
          {renderSpec(t.fuel, request.fuel)}
          {renderSpec(t.requestNote, request.note)}

          <View style={styles.contactBox}>
            <View style={styles.contactHeaderRow}>
              <Lock size={18} color={COLORS.textSecondary} />
              <Text style={styles.contactHidden}>{t.contactHidden}</Text>
            </View>
            <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock} activeOpacity={0.85}>
              <Text style={styles.unlockBtnText}>
                {t.unlockContact}
                {unlockPrice != null ? ` · ${unlockPrice.toLocaleString()} ${currency}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SIZES.padding,
    paddingVertical: 12,
  },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700' },
  headerSpacer: { width: 24 },
  body: { padding: SIZES.padding },
  title: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  specLabel: { color: COLORS.textSecondary, fontSize: 14 },
  specValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  contactBox: {
    marginTop: 24,
    padding: SIZES.padding,
    backgroundColor: COLORS.cardBackground,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  contactHidden: { color: COLORS.textSecondary, fontSize: 14 },
  unlockBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: SIZES.borderRadius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  unlockBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
});
```

> Note: `t.budget`, `t.yearFrom`, `t.yearTo`, `t.requestNote`, `t.anyModel` were added in Slice 1; `t.exteriorColor`, `t.interiorColor`, `t.interiorMaterial`, `t.engine`, `t.fuel` already exist. `t.specifications`, `t.contactHidden`, `t.unlockContact`, `t.unlockComingSoon` are added in Task B2. If `npx tsc --noEmit` flags any missing key, add it to both trees.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors in `CarRequestDetailsScreen.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/CarRequestDetailsScreen.tsx
git commit -m "feat(find-a-car): add CarRequestDetailsScreen (specs + locked contact stub)"
```

---

## Task B7: ProfileScreen seller entry point

Add an approved-seller-only "Buyer Requests" menu item that navigates to `CarRequests`.

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Add the conditional menu item**

In `src/screens/ProfileScreen.tsx`, the `menuItems` array currently ends its seller/provider section with the `requestSeller` spread (the block gated on `user.sellerStatus !== 'APPROVED'`, ~lines 67-72). Immediately **after** that closing `}] : []),` and before the broker block (`...(user && user.brokerStatus === 'APPROVED' ...`), add:

```typescript
    ...(user && user.sellerStatus === 'APPROVED' ? [{
      id: 'buyerRequests',
      title: t.buyerRequests,
      icon: <Users size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('CarRequests')
    }] : []),
```

(`Users` is already imported from `lucide-react-native` on line 10 — no import change needed.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors. `navigation.navigate('CarRequests')` resolves now that the route exists (Task B4).

- [ ] **Step 3: Commit**

```bash
git add src/screens/ProfileScreen.tsx
git commit -m "feat(find-a-car): add approved-seller Buyer Requests entry point"
```

---

## Task B8: Full mobile verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: No new errors introduced by this slice.

- [ ] **Step 2: Run the mobile test suite**

Run: `npx jest`
Expected: The `RequestService` suite passes (9 tests). Note the known baseline: ~18 pre-existing failures across 5 suites fail on clean `main` and are unrelated to this slice — compare against that baseline; do not attribute them to Slice 2.

- [ ] **Step 3: Lint the changed files**

Run: `npm run lint`
Expected: No new lint errors in the files this slice created/modified.

---

## Slice complete — handoff

- Backend: `feat/car-requests-slice2` ready to PR into `main` (mirrors how Slice 1 landed via PR #11). After merge, Railway deploys it.
- Mobile: commits on `feat/find-a-car`.
- **Manual smoke test (after `npm run ios`/`android`):** as an APPROVED seller, open Profile → Buyer Requests → see open requests with redacted contact → tap one → see specs + "Unlock · {price}" → tapping shows the "coming soon" alert. As a non-approved user, the Buyer Requests entry is hidden, and hitting the API directly returns 403.
- **Next (Slice 3 — Paywall):** `RequestUnlock` model + unlock endpoints + Stripe reveal flow replacing the stub + buyer "unlocked" notification + `NotificationSettings` toggle.
```
