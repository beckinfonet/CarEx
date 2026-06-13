# Find a Car — Slice 1 (Buyer Posts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in, phone-verified buyer can post a "Find a Car" request and manage (view / edit / close / delete) their own requests. No seller-facing browse or paywall yet (those are Slices 2–4).

**Architecture:** A new `CarRequest` Mongoose collection in the backend, exposed through a dedicated router mounted at `/api/car-requests` behind the existing `verifyIdToken` middleware (so the buyer's identity comes from the verified Firebase ID token, never the request body). The mobile app gets a new `RequestService` (mirroring `ModerationService`), two new screens (`FindCarScreen`, `MyRequestsScreen`), a reusable `RequestCard`, new nav routes, RU/EN translations, and Profile entry points.

**Tech Stack:** Backend — Node/Express, Mongoose, MongoDB, Jest + supertest + mongodb-memory-server. Mobile — React Native 0.83 + TypeScript, axios (`apiClient`), Jest with mocked `apiClient`.

**Two repos:**
- Backend: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services` (work on `main`)
- Mobile: `/Users/beckmaldinVL/development/mobileApps/carEx` (branch `feat/find-a-car`)

---

## Decisions locked for this slice

- `buyerUid` is always `req.auth.uid` (from `verifyIdToken`); never read a buyer id from the body.
- Posting requires `user.isPhoneVerified === true`. `contactPhone` is set server-side to the user's verified `user.phoneNumber` — not trusted from the client.
- Required request fields: `makeId` + `budgetMax`. Everything else optional.
- `expiresAt = createdAt + 30 days` is stored now; the browse-side expiry filter and any sweep job land in Slice 2/4. `GET /mine` returns the buyer's requests regardless of status so they can see/manage them.
- Screens are not unit-tested (matches codebase convention); model, router, and service are TDD'd.

## File structure

**Backend (create unless noted):**
- `src/models/CarRequest.js` — Mongoose model (one responsibility: the schema)
- `src/carRequests/router.js` — Express router: create + buyer-manage endpoints
- `src/carRequests/validateRequestInput.js` — pure validation/normalization helper (testable without HTTP)
- `__tests__/carRequests/router.test.js` — supertest + in-memory mongo
- `__tests__/carRequests/validateRequestInput.test.js` — unit tests for the helper
- Modify: `server.js` — require the model + router, mount `app.use('/api/car-requests', verifyIdToken, carRequestsRouter)`

**Mobile (create unless noted):**
- `src/services/requests/RequestService.ts` — buyer-side API methods + types
- `src/services/requests/__tests__/RequestService.test.ts` — jest with mocked `apiClient`
- `src/components/RequestCard.tsx` — list card (reused by MyRequests now, seller browse later)
- `src/screens/FindCarScreen.tsx` — post/edit form
- `src/screens/MyRequestsScreen.tsx` — buyer's requests list
- Modify: `src/types/navigation.ts` — add `FindCar`, `MyRequests`
- Modify: `App.tsx` — import + register the two screens
- Modify: `src/constants/translations.ts` — add RU + EN keys
- Modify: `src/screens/ProfileScreen.tsx` — add "Find a Car" + "My Requests" CTAs

---

# PART A — Backend (`carEx-services`)

> All backend paths below are relative to `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services`. Run commands from that directory.

## Task A1: CarRequest model

**Files:**
- Create: `src/models/CarRequest.js`
- Test: covered indirectly by router tests (model has no logic beyond schema)

- [ ] **Step 1: Write the model**

Create `src/models/CarRequest.js`:

```javascript
const mongoose = require('mongoose');

const carRequestSchema = new mongoose.Schema(
  {
    buyerUid: { type: String, required: true, index: true },
    makeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleMake', required: true },
    modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleModel', default: null },
    makeName: { type: String, required: true },
    modelName: { type: String, default: null },
    yearMin: { type: Number, default: null },
    yearMax: { type: Number, default: null },
    budgetMin: { type: Number, default: null },
    budgetMax: { type: Number, required: true },
    currency: { type: String, default: 'KGS' },
    exteriorColor: { type: String, default: null },
    interiorColor: { type: String, default: null },
    interiorMaterial: { type: String, default: null },
    engine: { type: String, default: null },
    fuel: { type: String, default: null },
    note: { type: String, default: null, maxlength: 2000 },
    contactPhone: { type: String, required: true },
    contactPhoneVerified: { type: Boolean, default: false },
    telegramUsername: { type: String, default: null },
    telegramVerified: { type: Boolean, default: false },
    status: { type: String, enum: ['open', 'closed', 'expired'], default: 'open', index: true },
    expiresAt: { type: Date, required: true },
    unlockCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

carRequestSchema.index({ status: 1, makeId: 1 });
carRequestSchema.index({ buyerUid: 1, createdAt: -1 });

module.exports = mongoose.models.CarRequest || mongoose.model('CarRequest', carRequestSchema);
```

- [ ] **Step 2: Commit**

```bash
git add src/models/CarRequest.js
git commit -m "feat(car-requests): add CarRequest mongoose model"
```

---

## Task A2: Input validation/normalization helper

This pure function validates + normalizes the create/update body. Extracting it keeps the router thin and makes the rules unit-testable without HTTP or Mongo.

**Files:**
- Create: `src/carRequests/validateRequestInput.js`
- Test: `__tests__/carRequests/validateRequestInput.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/validateRequestInput.test.js`:

```javascript
const { validateRequestInput } = require('../../src/carRequests/validateRequestInput');

describe('validateRequestInput', () => {
  const validBody = { makeId: '64b000000000000000000001', budgetMax: 15000 };

  it('accepts a minimal valid body (make + budgetMax)', () => {
    const { errors, value } = validateRequestInput(validBody);
    expect(errors).toEqual([]);
    expect(value.budgetMax).toBe(15000);
  });

  it('rejects a missing makeId', () => {
    const { errors } = validateRequestInput({ budgetMax: 15000 });
    expect(errors).toContain('makeId is required');
  });

  it('rejects a non-positive budgetMax', () => {
    const { errors } = validateRequestInput({ makeId: validBody.makeId, budgetMax: 0 });
    expect(errors).toContain('budgetMax must be a positive number');
  });

  it('rejects budgetMin greater than budgetMax', () => {
    const { errors } = validateRequestInput({ ...validBody, budgetMin: 20000 });
    expect(errors).toContain('budgetMin cannot exceed budgetMax');
  });

  it('rejects yearMin greater than yearMax', () => {
    const { errors } = validateRequestInput({ ...validBody, yearMin: 2020, yearMax: 2015 });
    expect(errors).toContain('yearMin cannot exceed yearMax');
  });

  it('strips a leading @ from telegramUsername', () => {
    const { value } = validateRequestInput({ ...validBody, telegramUsername: '@bishkek_cars' });
    expect(value.telegramUsername).toBe('bishkek_cars');
  });

  it('coerces numeric strings for budget/year', () => {
    const { value } = validateRequestInput({ makeId: validBody.makeId, budgetMax: '15000', yearMin: '2015' });
    expect(value.budgetMax).toBe(15000);
    expect(value.yearMin).toBe(2015);
  });

  it('drops unknown fields', () => {
    const { value } = validateRequestInput({ ...validBody, hackerField: 'x' });
    expect(value.hackerField).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/validateRequestInput.test.js`
Expected: FAIL with "Cannot find module '../../src/carRequests/validateRequestInput'".

- [ ] **Step 3: Write the helper**

Create `src/carRequests/validateRequestInput.js`:

```javascript
const ALLOWED_STRING_FIELDS = [
  'exteriorColor',
  'interiorColor',
  'interiorMaterial',
  'engine',
  'fuel',
  'note',
];

function toNumberOrNull(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Validate + normalize a CarRequest create/update body.
 * Returns { errors: string[], value: object }. `value` contains only
 * recognized, normalized fields. Caller derives buyerUid/contactPhone
 * server-side — they are intentionally NOT read here.
 */
function validateRequestInput(body = {}) {
  const errors = [];
  const value = {};

  // makeId (required)
  if (!body.makeId || typeof body.makeId !== 'string') {
    errors.push('makeId is required');
  } else {
    value.makeId = body.makeId;
  }

  if (body.modelId && typeof body.modelId === 'string') {
    value.modelId = body.modelId;
  }

  // budgetMax (required, positive)
  const budgetMax = toNumberOrNull(body.budgetMax);
  if (budgetMax === null || Number.isNaN(budgetMax) || budgetMax <= 0) {
    errors.push('budgetMax must be a positive number');
  } else {
    value.budgetMax = budgetMax;
  }

  // budgetMin (optional)
  const budgetMin = toNumberOrNull(body.budgetMin);
  if (budgetMin !== null) {
    if (Number.isNaN(budgetMin) || budgetMin < 0) {
      errors.push('budgetMin must be a non-negative number');
    } else {
      value.budgetMin = budgetMin;
      if (value.budgetMax !== undefined && budgetMin > value.budgetMax) {
        errors.push('budgetMin cannot exceed budgetMax');
      }
    }
  }

  // year range (optional)
  const yearMin = toNumberOrNull(body.yearMin);
  const yearMax = toNumberOrNull(body.yearMax);
  if (yearMin !== null) {
    if (Number.isNaN(yearMin)) errors.push('yearMin must be a number');
    else value.yearMin = yearMin;
  }
  if (yearMax !== null) {
    if (Number.isNaN(yearMax)) errors.push('yearMax must be a number');
    else value.yearMax = yearMax;
  }
  if (value.yearMin !== undefined && value.yearMax !== undefined && value.yearMin > value.yearMax) {
    errors.push('yearMin cannot exceed yearMax');
  }

  // free-text string fields (optional)
  for (const f of ALLOWED_STRING_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && String(body[f]).trim() !== '') {
      value[f] = String(body[f]).trim();
    }
  }

  // telegram (optional, strip leading @)
  if (body.telegramUsername && String(body.telegramUsername).trim() !== '') {
    value.telegramUsername = String(body.telegramUsername).trim().replace(/^@+/, '');
  }

  return { errors, value };
}

module.exports = { validateRequestInput };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/validateRequestInput.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/validateRequestInput.js __tests__/carRequests/validateRequestInput.test.js
git commit -m "feat(car-requests): add request input validation helper"
```

---

## Task A3: Router — create + buyer-manage endpoints

The router assumes upstream middleware has set `req.auth = { uid, email }` (production: `verifyIdToken`; tests: a fake injector). It uses `VehicleMake` / `VehicleModel` / `User` / `CarRequest` models.

**Files:**
- Create: `src/carRequests/router.js`
- Test: `__tests__/carRequests/router.test.js`

- [ ] **Step 1: Write the failing test**

Create `__tests__/carRequests/router.test.js`:

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
let currentUid = 'buyer-1';

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: 'CarEx' });

  // Register the catalog + user models the router depends on.
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
      })
    );
  CarRequest = require('../../src/models/CarRequest');

  const carRequestsRouter = require('../../src/carRequests/router');

  app = express();
  app.use(express.json());
  // Fake auth: inject req.auth from the mutable currentUid.
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
  currentUid = 'buyer-1';
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

async function seedVerifiedBuyer(uid = 'buyer-1', phone = '+996555111222') {
  return User.create({ firebaseUid: uid, email: `${uid}@x.com`, phoneNumber: phone, isPhoneVerified: true });
}

describe('POST /api/car-requests', () => {
  it('creates a request for a verified buyer and derives contactPhone server-side', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer('buyer-1', '+996555111222');

    const res = await request(app)
      .post('/api/car-requests')
      .send({ makeId: make._id.toString(), budgetMax: 15000, telegramUsername: '@bishkek' });

    expect(res.status).toBe(201);
    expect(res.body.buyerUid).toBe('buyer-1');
    expect(res.body.makeName).toBe('Toyota');
    expect(res.body.contactPhone).toBe('+996555111222');
    expect(res.body.contactPhoneVerified).toBe(true);
    expect(res.body.telegramUsername).toBe('bishkek');
    expect(res.body.status).toBe('open');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects when the buyer has not verified their phone (403)', async () => {
    const { make } = await seedCatalog();
    await User.create({ firebaseUid: 'buyer-1', email: 'b@x.com', phoneNumber: '+996555111222', isPhoneVerified: false });

    const res = await request(app)
      .post('/api/car-requests')
      .send({ makeId: make._id.toString(), budgetMax: 15000 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('phone_not_verified');
  });

  it('rejects an invalid makeId (400)', async () => {
    await seedVerifiedBuyer();
    const res = await request(app)
      .post('/api/car-requests')
      .send({ makeId: new mongoose.Types.ObjectId().toString(), budgetMax: 15000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_make');
  });

  it('rejects a modelId that does not belong to the make (400)', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const otherModel = await VehicleModel.create({ makeId: new mongoose.Types.ObjectId(), name: 'Civic' });
    const res = await request(app)
      .post('/api/car-requests')
      .send({ makeId: make._id.toString(), modelId: otherModel._id.toString(), budgetMax: 15000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_model');
  });

  it('rejects a missing budgetMax (400 validation)', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const res = await request(app)
      .post('/api/car-requests')
      .send({ makeId: make._id.toString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.details).toContain('budgetMax must be a positive number');
  });
});

describe('GET /api/car-requests/mine', () => {
  it('returns only the caller\'s requests, newest first, with full contact', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer('buyer-1', '+996555111222');
    await seedVerifiedBuyer('buyer-2', '+996555999888');

    await CarRequest.create({
      buyerUid: 'buyer-2', makeId: make._id, makeName: 'Toyota', budgetMax: 9000,
      contactPhone: '+996555999888', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    await CarRequest.create({
      buyerUid: 'buyer-1', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555111222', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });

    const res = await request(app).get('/api/car-requests/mine');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].buyerUid).toBe('buyer-1');
    expect(res.body[0].contactPhone).toBe('+996555111222');
  });
});

describe('PUT /api/car-requests/:id', () => {
  it('updates own request fields', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const doc = await CarRequest.create({
      buyerUid: 'buyer-1', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555111222', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    const res = await request(app)
      .put(`/api/car-requests/${doc._id}`)
      .send({ makeId: make._id.toString(), budgetMax: 20000, note: 'low mileage only' });
    expect(res.status).toBe(200);
    expect(res.body.budgetMax).toBe(20000);
    expect(res.body.note).toBe('low mileage only');
  });

  it('refuses to update another buyer\'s request (404)', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const doc = await CarRequest.create({
      buyerUid: 'buyer-2', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555999888', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    const res = await request(app)
      .put(`/api/car-requests/${doc._id}`)
      .send({ makeId: make._id.toString(), budgetMax: 20000 });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/car-requests/:id/close', () => {
  it('sets status to closed for the owner', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const doc = await CarRequest.create({
      buyerUid: 'buyer-1', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555111222', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    const res = await request(app).patch(`/api/car-requests/${doc._id}/close`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('closed');
  });
});

describe('DELETE /api/car-requests/:id', () => {
  it('deletes the owner\'s request', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const doc = await CarRequest.create({
      buyerUid: 'buyer-1', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555111222', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    const res = await request(app).delete(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(await CarRequest.findById(doc._id)).toBeNull();
  });

  it('refuses to delete another buyer\'s request (404)', async () => {
    const { make } = await seedCatalog();
    await seedVerifiedBuyer();
    const doc = await CarRequest.create({
      buyerUid: 'buyer-2', makeId: make._id, makeName: 'Toyota', budgetMax: 12000,
      contactPhone: '+996555999888', contactPhoneVerified: true, expiresAt: new Date(Date.now() + 1e9),
    });
    const res = await request(app).delete(`/api/car-requests/${doc._id}`);
    expect(res.status).toBe(404);
    expect(await CarRequest.findById(doc._id)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/carRequests/router.test.js`
Expected: FAIL with "Cannot find module '../../src/carRequests/router'".

- [ ] **Step 3: Write the router**

Create `src/carRequests/router.js`:

```javascript
const express = require('express');
const mongoose = require('mongoose');
const CarRequest = require('../models/CarRequest');
const User = require('../models/User');
const { validateRequestInput } = require('./validateRequestInput');

const router = express.Router();

const REQUEST_TTL_DAYS = 30;

function getMake() {
  return mongoose.model('VehicleMake');
}
function getModel() {
  return mongoose.model('VehicleModel');
}

// Resolve + validate make/model. Returns { error, makeDoc, modelDoc }.
async function resolveMakeModel(makeId, modelId) {
  if (!mongoose.isValidObjectId(makeId)) return { error: 'invalid_make' };
  const makeDoc = await getMake().findOne({ _id: makeId, isActive: true }).lean();
  if (!makeDoc) return { error: 'invalid_make' };

  let modelDoc = null;
  if (modelId) {
    if (!mongoose.isValidObjectId(modelId)) return { error: 'invalid_model' };
    modelDoc = await getModel().findOne({ _id: modelId, makeId: makeDoc._id, isActive: true }).lean();
    if (!modelDoc) return { error: 'invalid_model' };
  }
  return { makeDoc, modelDoc };
}

// POST /api/car-requests — create
router.post('/', async (req, res) => {
  try {
    const buyerUid = req.auth && req.auth.uid;
    if (!buyerUid) return res.status(401).json({ error: 'unauthorized' });

    const buyer = await User.findOne({ firebaseUid: buyerUid }).lean();
    if (!buyer) return res.status(404).json({ error: 'user_not_found' });
    if (!buyer.isPhoneVerified || !buyer.phoneNumber) {
      return res.status(403).json({ error: 'phone_not_verified' });
    }

    const { errors, value } = validateRequestInput(req.body);
    if (errors.length) return res.status(400).json({ error: 'validation_error', details: errors });

    const { error, makeDoc, modelDoc } = await resolveMakeModel(value.makeId, value.modelId);
    if (error) return res.status(400).json({ error });

    const doc = await CarRequest.create({
      ...value,
      makeId: makeDoc._id,
      modelId: modelDoc ? modelDoc._id : null,
      makeName: makeDoc.name,
      modelName: modelDoc ? modelDoc.name : null,
      buyerUid,
      contactPhone: buyer.phoneNumber,
      contactPhoneVerified: true,
      telegramVerified: false,
      currency: 'KGS',
      status: 'open',
      expiresAt: new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000),
    });

    return res.status(201).json(doc.toObject());
  } catch (err) {
    console.error('[car-requests] create error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// GET /api/car-requests/mine — caller's own requests
router.get('/mine', async (req, res) => {
  try {
    const buyerUid = req.auth && req.auth.uid;
    if (!buyerUid) return res.status(401).json({ error: 'unauthorized' });
    const rows = await CarRequest.find({ buyerUid }).sort({ createdAt: -1 }).lean();
    return res.json(rows);
  } catch (err) {
    console.error('[car-requests] mine error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// Helper: load a request the caller owns, or null.
async function findOwned(id, buyerUid) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await CarRequest.findById(id);
  if (!doc || doc.buyerUid !== buyerUid) return null;
  return doc;
}

// PUT /api/car-requests/:id — edit own
router.put('/:id', async (req, res) => {
  try {
    const buyerUid = req.auth && req.auth.uid;
    if (!buyerUid) return res.status(401).json({ error: 'unauthorized' });

    const doc = await findOwned(req.params.id, buyerUid);
    if (!doc) return res.status(404).json({ error: 'not_found' });

    const { errors, value } = validateRequestInput(req.body);
    if (errors.length) return res.status(400).json({ error: 'validation_error', details: errors });

    const { error, makeDoc, modelDoc } = await resolveMakeModel(value.makeId, value.modelId);
    if (error) return res.status(400).json({ error });

    // Apply editable fields. Contact + ownership + lifecycle are NOT editable here.
    doc.makeId = makeDoc._id;
    doc.modelId = modelDoc ? modelDoc._id : null;
    doc.makeName = makeDoc.name;
    doc.modelName = modelDoc ? modelDoc.name : null;
    doc.budgetMax = value.budgetMax;
    doc.budgetMin = value.budgetMin ?? null;
    doc.yearMin = value.yearMin ?? null;
    doc.yearMax = value.yearMax ?? null;
    doc.exteriorColor = value.exteriorColor ?? null;
    doc.interiorColor = value.interiorColor ?? null;
    doc.interiorMaterial = value.interiorMaterial ?? null;
    doc.engine = value.engine ?? null;
    doc.fuel = value.fuel ?? null;
    doc.note = value.note ?? null;
    doc.telegramUsername = value.telegramUsername ?? null;

    await doc.save();
    return res.json(doc.toObject());
  } catch (err) {
    console.error('[car-requests] update error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// PATCH /api/car-requests/:id/close — mark found-it / close
router.patch('/:id/close', async (req, res) => {
  try {
    const buyerUid = req.auth && req.auth.uid;
    if (!buyerUid) return res.status(401).json({ error: 'unauthorized' });
    const doc = await findOwned(req.params.id, buyerUid);
    if (!doc) return res.status(404).json({ error: 'not_found' });
    doc.status = 'closed';
    await doc.save();
    return res.json(doc.toObject());
  } catch (err) {
    console.error('[car-requests] close error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// DELETE /api/car-requests/:id — delete own
router.delete('/:id', async (req, res) => {
  try {
    const buyerUid = req.auth && req.auth.uid;
    if (!buyerUid) return res.status(401).json({ error: 'unauthorized' });
    const doc = await findOwned(req.params.id, buyerUid);
    if (!doc) return res.status(404).json({ error: 'not_found' });
    await doc.deleteOne();
    return res.json({ ok: true });
  } catch (err) {
    console.error('[car-requests] delete error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/carRequests/router.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/carRequests/router.js __tests__/carRequests/router.test.js
git commit -m "feat(car-requests): add buyer create + manage router"
```

---

## Task A4: Mount the router in server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add the require near the other router requires**

Find where other routers are required (e.g. `notificationRouter`, `moderationRouter`) near the top of `server.js`. Add:

```javascript
const carRequestsRouter = require('./src/carRequests/router');
```

- [ ] **Step 2: Mount it behind verifyIdToken**

Find the block where routers are mounted (around `app.use('/api/notifications', verifyIdToken, notificationRouter);`, ~server.js:1096-1103). Add immediately after the notifications mount:

```javascript
app.use('/api/car-requests', verifyIdToken, carRequestsRouter);
```

- [ ] **Step 3: Verify the server boots and the full suite is green**

Run: `npx jest`
Expected: PASS — existing suite plus the two new car-request test files. No regressions.

Then sanity-check boot (Ctrl-C after "Connected to MongoDB" or the listen log):

Run: `node -e "require('./server.js')" ` — or your normal `npm start` — and confirm no syntax/require errors at load.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(car-requests): mount /api/car-requests behind verifyIdToken"
```

---

# PART B — Mobile (`carEx`)

> All mobile paths below are relative to `/Users/beckmaldinVL/development/mobileApps/carEx`. Run commands from that directory. Stay on branch `feat/find-a-car`.

## Task B1: RequestService + types

**Files:**
- Create: `src/services/requests/RequestService.ts`
- Test: `src/services/requests/__tests__/RequestService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/requests/__tests__/RequestService.test.ts`:

```typescript
jest.mock('../../http/client', () => ({
  apiClient: {
    post: jest.fn(),
    get: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '../../http/client';
import { RequestService } from '../RequestService';

const mockedApiClient = apiClient as unknown as {
  post: jest.Mock;
  get: jest.Mock;
  put: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

describe('RequestService', () => {
  beforeEach(() => {
    mockedApiClient.post.mockReset();
    mockedApiClient.get.mockReset();
    mockedApiClient.put.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
  });

  it('createRequest POSTs the input to /api/car-requests and returns data', async () => {
    const input = { makeId: 'm1', budgetMax: 15000 };
    mockedApiClient.post.mockResolvedValueOnce({ data: { _id: 'r1', ...input } });

    const result = await RequestService.createRequest(input);

    expect(mockedApiClient.post).toHaveBeenCalledWith('/api/car-requests', input);
    expect(result).toEqual({ _id: 'r1', makeId: 'm1', budgetMax: 15000 });
  });

  it('getMyRequests GETs /api/car-requests/mine and returns the array', async () => {
    mockedApiClient.get.mockResolvedValueOnce({ data: [{ _id: 'r1' }] });
    const result = await RequestService.getMyRequests();
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/car-requests/mine');
    expect(result).toEqual([{ _id: 'r1' }]);
  });

  it('updateRequest PUTs to /api/car-requests/:id', async () => {
    const input = { makeId: 'm1', budgetMax: 20000 };
    mockedApiClient.put.mockResolvedValueOnce({ data: { _id: 'r1', ...input } });
    const result = await RequestService.updateRequest('r1', input);
    expect(mockedApiClient.put).toHaveBeenCalledWith('/api/car-requests/r1', input);
    expect(result.budgetMax).toBe(20000);
  });

  it('closeRequest PATCHes /api/car-requests/:id/close', async () => {
    mockedApiClient.patch.mockResolvedValueOnce({ data: { _id: 'r1', status: 'closed' } });
    const result = await RequestService.closeRequest('r1');
    expect(mockedApiClient.patch).toHaveBeenCalledWith('/api/car-requests/r1/close');
    expect(result.status).toBe('closed');
  });

  it('deleteRequest DELETEs /api/car-requests/:id', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({ data: { ok: true } });
    const result = await RequestService.deleteRequest('r1');
    expect(mockedApiClient.delete).toHaveBeenCalledWith('/api/car-requests/r1');
    expect(result.ok).toBe(true);
  });

  it('rethrows on network error', async () => {
    mockedApiClient.post.mockRejectedValueOnce(new Error('boom'));
    await expect(RequestService.createRequest({ makeId: 'm1', budgetMax: 1 })).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: FAIL with "Cannot find module '../RequestService'".

- [ ] **Step 3: Write the service**

Create `src/services/requests/RequestService.ts`:

```typescript
import { apiClient } from '../http/client';

export interface CreateRequestInput {
  makeId: string;
  modelId?: string | null;
  yearMin?: number | null;
  yearMax?: number | null;
  budgetMin?: number | null;
  budgetMax: number;
  exteriorColor?: string | null;
  interiorColor?: string | null;
  interiorMaterial?: string | null;
  engine?: string | null;
  fuel?: string | null;
  note?: string | null;
  telegramUsername?: string | null;
}

export interface CarRequest {
  _id: string;
  buyerUid: string;
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
  contactPhone: string;
  contactPhoneVerified: boolean;
  telegramUsername: string | null;
  telegramVerified: boolean;
  status: 'open' | 'closed' | 'expired';
  expiresAt: string;
  unlockCount: number;
  createdAt: string;
  updatedAt: string;
}

// buyerUid is derived server-side from the Bearer token — never sent here.
export const RequestService = {
  createRequest: async (input: CreateRequestInput): Promise<CarRequest> => {
    try {
      const response = await apiClient.post('/api/car-requests', input);
      return response.data;
    } catch (error) {
      console.error('Failed to create car request', error);
      throw error;
    }
  },

  getMyRequests: async (): Promise<CarRequest[]> => {
    try {
      const response = await apiClient.get('/api/car-requests/mine');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch car requests', error);
      throw error;
    }
  },

  updateRequest: async (id: string, input: CreateRequestInput): Promise<CarRequest> => {
    try {
      const response = await apiClient.put(`/api/car-requests/${id}`, input);
      return response.data;
    } catch (error) {
      console.error('Failed to update car request', error);
      throw error;
    }
  },

  closeRequest: async (id: string): Promise<CarRequest> => {
    try {
      const response = await apiClient.patch(`/api/car-requests/${id}/close`);
      return response.data;
    } catch (error) {
      console.error('Failed to close car request', error);
      throw error;
    }
  },

  deleteRequest: async (id: string): Promise<{ ok: boolean }> => {
    try {
      const response = await apiClient.delete(`/api/car-requests/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete car request', error);
      throw error;
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/requests/__tests__/RequestService.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/requests/RequestService.ts src/services/requests/__tests__/RequestService.test.ts
git commit -m "feat(find-a-car): add RequestService (buyer endpoints)"
```

---

## Task B2: Translations (RU + EN)

**Files:**
- Modify: `src/constants/translations.ts`

- [ ] **Step 1: Add the keys to the RU tree**

Find the `RU: {` object. Add these keys (place them near the `sellCar`/`myListings` group for tidiness — exact position doesn't matter, but the key set must be identical in both trees):

```typescript
    // Find a Car (buyer requests)
    findCar: 'Найти авто',
    findCarHeader: 'Заявка на авто',
    editRequest: 'Изменить заявку',
    myRequests: 'Мои заявки',
    desiredCar: 'Желаемое авто',
    budget: 'Бюджет',
    budgetMax: 'Максимальный бюджет',
    budgetMin: 'Минимальный бюджет',
    yearFrom: 'Год от',
    yearTo: 'Год до',
    requestNote: 'Пожелания',
    requestNotePlaceholder: 'Опишите, что вы ищете',
    postRequest: 'Разместить заявку',
    requestPosted: 'Заявка размещена',
    requestUpdated: 'Заявка обновлена',
    requestValidationMissing: 'Укажите марку и максимальный бюджет',
    verifyPhoneToPost: 'Подтвердите номер телефона, чтобы разместить заявку',
    noRequests: 'У вас пока нет заявок',
    foundIt: 'Нашёл',
    closeRequestConfirm: 'Закрыть эту заявку?',
    deleteRequestConfirm: 'Удалить эту заявку?',
    requestStatusOpen: 'Открыта',
    requestStatusClosed: 'Закрыта',
    requestStatusExpired: 'Истекла',
    anyModel: 'Любая модель',
    loginToPost: 'Войдите, чтобы разместить заявку',
```

- [ ] **Step 2: Add the SAME keys to the EN tree**

Find the `EN: {` object and add:

```typescript
    // Find a Car (buyer requests)
    findCar: 'Find a Car',
    findCarHeader: 'Car Request',
    editRequest: 'Edit Request',
    myRequests: 'My Requests',
    desiredCar: 'Desired Car',
    budget: 'Budget',
    budgetMax: 'Max Budget',
    budgetMin: 'Min Budget',
    yearFrom: 'Year from',
    yearTo: 'Year to',
    requestNote: 'Notes',
    requestNotePlaceholder: 'Describe what you are looking for',
    postRequest: 'Post Request',
    requestPosted: 'Request posted',
    requestUpdated: 'Request updated',
    requestValidationMissing: 'Please provide a make and a max budget',
    verifyPhoneToPost: 'Verify your phone number to post a request',
    noRequests: 'You have no requests yet',
    foundIt: 'Found it',
    closeRequestConfirm: 'Close this request?',
    deleteRequestConfirm: 'Delete this request?',
    requestStatusOpen: 'Open',
    requestStatusClosed: 'Closed',
    requestStatusExpired: 'Expired',
    anyModel: 'Any model',
    loginToPost: 'Log in to post a request',
```

- [ ] **Step 3: Typecheck (the translations object is typed as `typeof TRANSLATIONS.RU`, so any key mismatch errors)**

Run: `npx tsc --noEmit`
Expected: No new errors related to `translations.ts`. If a key exists in one tree but not the other, TS will flag a mismatch where `t.<key>` is consumed — but since we added both, it should be clean.

- [ ] **Step 4: Commit**

```bash
git add src/constants/translations.ts
git commit -m "feat(find-a-car): add RU/EN strings for buyer requests"
```

---

## Task B3: Navigation routes

**Files:**
- Modify: `src/types/navigation.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Add routes to RootStackParamList**

In `src/types/navigation.ts`, add to the `RootStackParamList` type (place after `MyListings`):

```typescript
  FindCar: { requestId?: string } | undefined;
  MyRequests: undefined;
```

- [ ] **Step 2: Import the screens in App.tsx**

In `App.tsx`, near the other screen imports, add:

```typescript
import { FindCarScreen } from './src/screens/FindCarScreen';
import { MyRequestsScreen } from './src/screens/MyRequestsScreen';
```

(These files are created in Tasks B5/B6. If you are executing strictly top-to-bottom, complete B4–B6 before running the app; the imports will not resolve until then. The commit at the end of this task is fine because TS screens are added in the same branch shortly after — but do not run the app until B6 is done.)

- [ ] **Step 3: Register the screens in the Navigator**

In `App.tsx`, in the `<Stack.Navigator>` block (near `<Stack.Screen name="MyListings" ... />`), add:

```typescript
<Stack.Screen name="FindCar" component={FindCarScreen} />
<Stack.Screen name="MyRequests" component={MyRequestsScreen} />
```

- [ ] **Step 4: Commit**

```bash
git add src/types/navigation.ts App.tsx
git commit -m "feat(find-a-car): register FindCar + MyRequests routes"
```

---

## Task B4: RequestCard component

A presentational card for a single request. Used by `MyRequestsScreen` now and the seller browse list in Slice 2. Mirrors `CarCard` styling conventions (COLORS/SIZES, no hardcoded hex except neutrals).

**Files:**
- Create: `src/components/RequestCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/RequestCard.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Calendar, Wallet } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import type { CarRequest } from '../services/requests/RequestService';

interface RequestCardProps {
  request: CarRequest;
  onPress?: () => void;
}

function formatBudget(req: CarRequest): string {
  const max = req.budgetMax?.toLocaleString?.() ?? String(req.budgetMax);
  if (req.budgetMin) {
    const min = req.budgetMin.toLocaleString();
    return `${min} – ${max} ${req.currency}`;
  }
  return `${max} ${req.currency}`;
}

function formatYears(req: CarRequest): string | null {
  if (req.yearMin && req.yearMax) return `${req.yearMin}–${req.yearMax}`;
  if (req.yearMin) return `${req.yearMin}+`;
  if (req.yearMax) return `≤ ${req.yearMax}`;
  return null;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onPress }) => {
  const { t } = useLanguage();
  const years = formatYears(request);

  const statusLabel =
    request.status === 'open'
      ? t.requestStatusOpen
      : request.status === 'closed'
      ? t.requestStatusClosed
      : t.requestStatusExpired;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {request.makeName}
            {request.modelName ? ` ${request.modelName}` : ` · ${t.anyModel}`}
          </Text>
          {onPress ? <ChevronRight size={20} color={COLORS.textSecondary} /> : null}
        </View>

        <View style={styles.metaRow}>
          <Wallet size={14} color={COLORS.textSecondary} />
          <Text style={styles.meta}>{formatBudget(request)}</Text>
          {years ? (
            <>
              <Calendar size={14} color={COLORS.textSecondary} style={styles.metaIconSpacing} />
              <Text style={styles.meta}>{years}</Text>
            </>
          ) : null}
        </View>

        <View style={[styles.statusBadge, statusStyle(request.status)]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

function statusStyle(status: CarRequest['status']) {
  if (status === 'open') return { backgroundColor: COLORS.accent };
  return { backgroundColor: COLORS.textSecondary };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: SIZES.borderRadius,
    padding: SIZES.padding,
    marginBottom: SIZES.padding,
  },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  meta: { color: COLORS.textSecondary, fontSize: 13, marginLeft: 4 },
  metaIconSpacing: { marginLeft: 12 },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { color: '#000', fontSize: 11, fontWeight: '700' },
});
```

> Note: confirm `COLORS.card` exists in `src/constants/theme.ts`. If the theme uses a different surface key (e.g. `COLORS.surface` or `COLORS.backgroundSecondary`), use that key instead — match what `CarCard.tsx` uses for its container background.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors in `RequestCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/RequestCard.tsx
git commit -m "feat(find-a-car): add RequestCard component"
```

---

## Task B5: MyRequestsScreen

Mirrors `MyListingsScreen`'s fetch-on-focus pattern, but uses `RequestService.getMyRequests()` and supports close/delete + an edit nav + a CTA to create.

**Files:**
- Create: `src/screens/MyRequestsScreen.tsx`

- [ ] **Step 1: Write the screen**

Create `src/screens/MyRequestsScreen.tsx`:

```typescript
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Trash2, CheckCircle } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { RequestService, CarRequest } from '../services/requests/RequestService';
import { RequestCard } from '../components/RequestCard';

export const MyRequestsScreen = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const [requests, setRequests] = useState<CarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user?.localId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await RequestService.getMyRequests();
      setRequests(rows);
    } catch (e) {
      console.error('Failed to fetch requests', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.localId]);

  React.useEffect(() => {
    if (isFocused) fetchRequests();
  }, [isFocused, fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleClose = (req: CarRequest) => {
    Alert.alert(t.foundIt, t.closeRequestConfirm, [
      { text: t.requestStatusClosed, style: 'cancel' },
      {
        text: t.foundIt,
        onPress: async () => {
          try {
            await RequestService.closeRequest(req._id);
            fetchRequests();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const handleDelete = (req: CarRequest) => {
    Alert.alert(t.myRequests, t.deleteRequestConfirm, [
      { text: t.requestStatusClosed, style: 'cancel' },
      {
        text: t.foundIt,
        style: 'destructive',
        onPress: async () => {
          try {
            await RequestService.deleteRequest(req._id);
            fetchRequests();
          } catch (e) {
            console.error(e);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: CarRequest }) => (
    <View>
      <RequestCard
        request={item}
        onPress={() => navigation.navigate('FindCar', { requestId: item._id })}
      />
      <View style={styles.actionRow}>
        {item.status === 'open' ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleClose(item)}>
            <CheckCircle size={16} color={COLORS.textPrimary} />
            <Text style={styles.actionText}>{t.foundIt}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item)}>
          <Trash2 size={16} color={COLORS.textPrimary} />
          <Text style={styles.actionText}>{t.requestStatusClosed}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.myRequests}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('FindCar')}>
          <Plus size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.accent} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
          ListEmptyComponent={<Text style={styles.empty}>{t.noRequests}</Text>}
        />
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
  list: { padding: SIZES.padding },
  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
  actionRow: { flexDirection: 'row', marginTop: -8, marginBottom: SIZES.padding },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  actionText: { color: COLORS.textPrimary, fontSize: 13, marginLeft: 6 },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors in `MyRequestsScreen.tsx`. (Confirm `COLORS.background` / `COLORS.accent` / `COLORS.card` exist; adjust to the actual theme keys used by `MyListingsScreen.tsx` if names differ.)

- [ ] **Step 3: Commit**

```bash
git add src/screens/MyRequestsScreen.tsx
git commit -m "feat(find-a-car): add MyRequestsScreen"
```

---

## Task B6: FindCarScreen (post/edit form)

The buyer form. Lighter than `SellCarScreen`: no images. Requires login + phone verification before submit. Reuses `MakeModelFormField` and the OTP verify modal pattern from `SellCarScreen` (via `useAuth().sendPhoneOtp` / `verifyPhone`). Supports edit mode via `route.params.requestId`.

**Files:**
- Create: `src/screens/FindCarScreen.tsx`

- [ ] **Step 1: Write the screen**

Create `src/screens/FindCarScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Smartphone } from 'lucide-react-native';
import { COLORS, SIZES } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { MakeModelFormField } from '../components/MakeModelFormField';
import { RequestService, CreateRequestInput } from '../services/requests/RequestService';
import type { RootStackParamList } from '../types/navigation';

type FindCarRoute = RouteProp<RootStackParamList, 'FindCar'>;

interface FormState {
  makeId: string;
  modelId: string;
  yearMin: string;
  yearMax: string;
  budgetMin: string;
  budgetMax: string;
  exteriorColor: string;
  interiorColor: string;
  interiorMaterial: string;
  engine: string;
  fuel: string;
  note: string;
  telegramUsername: string;
}

const EMPTY: FormState = {
  makeId: '',
  modelId: '',
  yearMin: '',
  yearMax: '',
  budgetMin: '',
  budgetMax: '',
  exteriorColor: '',
  interiorColor: '',
  interiorMaterial: '',
  engine: '',
  fuel: '',
  note: '',
  telegramUsername: '',
};

function toNum(s: string): number | null {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

export const FindCarScreen = () => {
  const { t } = useLanguage();
  const { user, sendPhoneOtp, verifyPhone } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<FindCarRoute>();
  const requestId = route.params?.requestId;
  const isEdit = !!requestId;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // OTP modal state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Prefill in edit mode.
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await RequestService.getMyRequests();
        const found = rows.find((r) => r._id === requestId);
        if (found && !cancelled) {
          setForm({
            makeId: found.makeId ?? '',
            modelId: found.modelId ?? '',
            yearMin: found.yearMin?.toString() ?? '',
            yearMax: found.yearMax?.toString() ?? '',
            budgetMin: found.budgetMin?.toString() ?? '',
            budgetMax: found.budgetMax?.toString() ?? '',
            exteriorColor: found.exteriorColor ?? '',
            interiorColor: found.interiorColor ?? '',
            interiorMaterial: found.interiorMaterial ?? '',
            engine: found.engine ?? '',
            fuel: found.fuel ?? '',
            note: found.note ?? '',
            telegramUsername: found.telegramUsername ?? '',
          });
        }
      } catch (e) {
        console.error('Failed to load request', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, requestId]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleVerifyPhone = async () => {
    if (!user?.phoneNumber) {
      Alert.alert(t.error, t.verifyPhoneToPost);
      return;
    }
    setLoading(true);
    try {
      await sendPhoneOtp();
      setOtpModalVisible(true);
    } catch (e) {
      Alert.alert(t.error, t.verifyPhoneToPost);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert(t.error, t.wrongCode);
      return;
    }
    setVerifying(true);
    try {
      await verifyPhone(otpCode);
      setOtpModalVisible(false);
      setOtpCode('');
      Alert.alert(t.success, t.phoneVerified);
    } catch (e) {
      Alert.alert(t.error, t.wrongCode);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.makeId || toNum(form.budgetMax) === null) {
      Alert.alert(t.error, t.requestValidationMissing);
      return;
    }
    const input: CreateRequestInput = {
      makeId: form.makeId,
      modelId: form.modelId || null,
      yearMin: toNum(form.yearMin),
      yearMax: toNum(form.yearMax),
      budgetMin: toNum(form.budgetMin),
      budgetMax: toNum(form.budgetMax) as number,
      exteriorColor: form.exteriorColor || null,
      interiorColor: form.interiorColor || null,
      interiorMaterial: form.interiorMaterial || null,
      engine: form.engine || null,
      fuel: form.fuel || null,
      note: form.note || null,
      telegramUsername: form.telegramUsername || null,
    };
    setSubmitting(true);
    try {
      if (isEdit) {
        await RequestService.updateRequest(requestId as string, input);
        Alert.alert(t.success, t.requestUpdated);
      } else {
        await RequestService.createRequest(input);
        Alert.alert(t.success, t.requestPosted);
      }
      navigation.navigate('MyRequests');
    } catch (e: any) {
      const code = e?.response?.data?.error;
      if (code === 'phone_not_verified') {
        Alert.alert(t.error, t.verifyPhoneToPost);
      } else {
        Alert.alert(t.error, t.requestValidationMissing);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Not logged in.
  if (!user?.localId) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Text style={styles.statusText}>{t.loginToPost}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.primaryBtnText}>{t.login}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Logged in but phone not verified — show verify gate.
  if (!user.isPhoneVerified) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <Smartphone size={64} color={COLORS.accent} />
        <Text style={styles.statusTitle}>{t.verifyPhoneToPost}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyPhone} disabled={loading}>
          {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{t.verifyPhone}</Text>}
        </TouchableOpacity>

        <Modal visible={otpModalVisible} transparent animationType="fade" onRequestClose={() => setOtpModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t.enterCode}</Text>
                  <TouchableOpacity onPress={() => setOtpModalVisible(false)}>
                    <X size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.otpInput}
                  placeholder="000000"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otpCode}
                  onChangeText={setOtpCode}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={submitOtp} disabled={verifying}>
                  {verifying ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>{t.verify}</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator color={COLORS.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? t.editRequest : t.findCarHeader}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>{t.desiredCar}</Text>
        <MakeModelFormField
          type="make"
          value={form.makeId}
          onChange={(id) => setForm((p) => ({ ...p, makeId: id, modelId: '' }))}
          placeholder={t.brand}
          t={t}
        />
        <MakeModelFormField
          type="model"
          value={form.modelId}
          onChange={(id) => set('modelId', id)}
          selectedMakeId={form.makeId}
          placeholder={t.model}
          t={t}
        />

        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} placeholder={t.yearFrom} placeholderTextColor={COLORS.textSecondary} keyboardType="number-pad" value={form.yearMin} onChangeText={(v) => set('yearMin', v)} />
          <TextInput style={[styles.input, styles.half]} placeholder={t.yearTo} placeholderTextColor={COLORS.textSecondary} keyboardType="number-pad" value={form.yearMax} onChangeText={(v) => set('yearMax', v)} />
        </View>

        <Text style={styles.section}>{t.budget}</Text>
        <View style={styles.row}>
          <TextInput style={[styles.input, styles.half]} placeholder={t.budgetMin} placeholderTextColor={COLORS.textSecondary} keyboardType="number-pad" value={form.budgetMin} onChangeText={(v) => set('budgetMin', v)} />
          <TextInput style={[styles.input, styles.half]} placeholder={t.budgetMax} placeholderTextColor={COLORS.textSecondary} keyboardType="number-pad" value={form.budgetMax} onChangeText={(v) => set('budgetMax', v)} />
        </View>

        <Text style={styles.section}>{t.extInt ?? t.desiredCar}</Text>
        <TextInput style={styles.input} placeholder={t.bodyColor} placeholderTextColor={COLORS.textSecondary} value={form.exteriorColor} onChangeText={(v) => set('exteriorColor', v)} />
        <TextInput style={styles.input} placeholder={t.interiorColorInput} placeholderTextColor={COLORS.textSecondary} value={form.interiorColor} onChangeText={(v) => set('interiorColor', v)} />
        <TextInput style={styles.input} placeholder={t.enterEngine} placeholderTextColor={COLORS.textSecondary} value={form.engine} onChangeText={(v) => set('engine', v)} />

        <Text style={styles.section}>{t.requestNote}</Text>
        <TextInput style={[styles.input, styles.multiline]} placeholder={t.requestNotePlaceholder} placeholderTextColor={COLORS.textSecondary} multiline value={form.note} onChangeText={(v) => set('note', v)} />

        <TextInput style={styles.input} placeholder={t.telegramUsername} placeholderTextColor={COLORS.textSecondary} autoCapitalize="none" value={form.telegramUsername} onChangeText={(v) => set('telegramUsername', v)} />

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>{isEdit ? t.requestUpdated : t.postRequest}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', padding: SIZES.padding },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.padding, paddingVertical: 12 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  form: { padding: SIZES.padding, paddingBottom: 48 },
  section: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  input: { backgroundColor: COLORS.card, color: COLORS.textPrimary, borderRadius: SIZES.borderRadius, padding: 14, marginBottom: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  half: { width: '48%' },
  submitBtn: { backgroundColor: COLORS.accent, borderRadius: SIZES.borderRadius, padding: 16, alignItems: 'center', marginTop: 24 },
  submitBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  primaryBtn: { backgroundColor: COLORS.accent, borderRadius: SIZES.borderRadius, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', marginTop: 16 },
  primaryBtnText: { color: '#000', fontWeight: '700' },
  statusTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  statusText: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SIZES.padding },
  modalContent: { backgroundColor: COLORS.background, borderRadius: SIZES.borderRadius, padding: SIZES.padding },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  otpInput: { backgroundColor: COLORS.card, color: COLORS.textPrimary, borderRadius: SIZES.borderRadius, padding: 14, textAlign: 'center', fontSize: 24, letterSpacing: 8, marginBottom: 16 },
});
```

> Notes for the implementer:
> - This screen references existing translation keys from `SellCarScreen`: `t.brand`, `t.model`, `t.bodyColor`, `t.interiorColorInput`, `t.enterEngine`, `t.telegramUsername`, `t.extInt`, `t.error`, `t.success`, `t.wrongCode`, `t.phoneVerified`, `t.enterCode`, `t.verify`, `t.verifyPhone`, `t.login`. Confirm each exists in `translations.ts`; if any is missing, add it RU+EN (it almost certainly exists because SellCar uses it). `t.extInt` is referenced with a `?? t.desiredCar` fallback in case the key name differs.
> - Confirm `useAuth()` exposes `sendPhoneOtp` and `verifyPhone` (the Explore confirmed it does, AuthContext lines 539–551).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors. Resolve any missing-translation-key errors by adding the key to both trees (Task B2 pattern).

- [ ] **Step 3: Commit**

```bash
git add src/screens/FindCarScreen.tsx
git commit -m "feat(find-a-car): add FindCarScreen post/edit form"
```

---

## Task B7: Profile entry points

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

- [ ] **Step 1: Add icons to the import**

In `ProfileScreen.tsx`, add `Search` and `ClipboardList` to the existing `lucide-react-native` import (merge into the existing destructured import; do not add a second import line):

```typescript
import { /* existing icons, */ Search, ClipboardList } from 'lucide-react-native';
```

- [ ] **Step 2: Add two menu items**

In the `menuItems` array, add (for any logged-in user — place near `myListings`):

```typescript
    {
      id: 'findCar',
      title: t.findCar,
      icon: <Search size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('FindCar'),
    },
    {
      id: 'myRequests',
      title: t.myRequests,
      icon: <ClipboardList size={24} color={COLORS.accent} />,
      onPress: () => navigation.navigate('MyRequests'),
    },
```

> If the `menuItems` array is only rendered for logged-in users already, no extra guard is needed. If it renders for guests too, wrap these two entries in the same `...(user ? [ ... ] : [])` spread pattern used by the seller/broker conditionals.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: No errors. `navigation.navigate('FindCar')` / `'MyRequests'` are now valid because the routes were added in Task B3.

- [ ] **Step 4: Commit**

```bash
git add src/screens/ProfileScreen.tsx
git commit -m "feat(find-a-car): add Find a Car + My Requests profile entry points"
```

---

## Task B8: Full mobile verification

- [ ] **Step 1: Run the mobile test suite**

Run: `npx jest`
Expected: PASS, including the new `RequestService` tests. No regressions.

- [ ] **Step 2: Typecheck the whole app**

Run: `npx tsc --noEmit`
Expected: Clean.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: No new lint errors in the added files.

- [ ] **Step 4: Manual smoke test (requires the backend running locally + `currentEnv` reachable)**

Per CLAUDE.md, dev backend is `http://localhost:5001` (iOS) / `http://10.0.2.2:5001` (Android). With the backend running:

1. Log in as a user.
2. Profile → **Find a Car**. If the phone isn't verified, verify it (dev OTP bypass code is `123456`).
3. Pick a make, enter a max budget, optionally a model/year/colors/note/Telegram, tap **Post Request**.
4. Confirm it lands on **My Requests** and the new request appears with status **Open**.
5. Tap the card → edit → change budget → save → confirm the update shows.
6. Tap **Found it** → confirm status flips to **Closed**.
7. Delete a request → confirm it disappears.
8. Confirm a second user does NOT see the first user's requests under My Requests (ownership scoping).

- [ ] **Step 5: Final slice commit / branch state**

No code change here; ensure all prior commits are present:

Run: `git log --oneline -12`
Expected: the A1–A4 backend commits (in the backend repo) and B1–B7 mobile commits (in `feat/find-a-car`).

---

## Self-review notes (author)

- **Spec coverage (Slice 1 only):** model ✔ (A1), create endpoint with OTP enforcement ✔ (A3, `phone_not_verified`), buyer manage endpoints (mine/edit/close/delete) ✔ (A3), server-derived `buyerUid` + `contactPhone` ✔ (A3), FindCarScreen ✔ (B6), MyRequestsScreen ✔ (B5), RequestService ✔ (B1), nav ✔ (B3), i18n ✔ (B2), entry points ✔ (B7). Seller browse, paywall, and match notifications are intentionally **out of this slice** (Slices 2–4).
- **Cross-repo note:** backend commits land in `carEx-services` on `main`; mobile commits land in `carEx` on `feat/find-a-car`. They are deployed/tested independently — run the backend first so the mobile smoke test has an API.
- **Known follow-ups deferred to later slices:** auto-expiry sweep/cron (store `expiresAt` now, enforce on browse later); contact redaction (only matters once sellers can read requests — Slice 2); unlock fee constant + Stripe (Slice 3).
- **Type consistency:** `CreateRequestInput` / `CarRequest` names are used identically across `RequestService.ts`, `RequestCard.tsx`, `MyRequestsScreen.tsx`, `FindCarScreen.tsx`. Endpoint paths match the backend router exactly (`/api/car-requests`, `/mine`, `/:id`, `/:id/close`).
