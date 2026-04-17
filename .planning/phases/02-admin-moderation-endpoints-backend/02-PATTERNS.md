# Phase 2: Admin Moderation Endpoints (Backend) - Pattern Map

**Mapped:** 2026-04-17
**Files to create/modify:** 12
**Analogs found:** 12 / 12
**Scope:** All paths below are in the sibling backend repo `../backend-services/carEx-services/` (absolute: `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`). No files in the `carEx` mobile repo are touched in Phase 2.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/moderation/router.js` (MODIFY — extend) | router | request-response, CRUD | self (current `/ping` scaffold) + `server.js:913-919` mount | exact |
| `src/moderation/service.js` (MODIFY — fill stubs) | service | CRUD, transactional write | `server.js:1148-1232` (POST /api/orders — multi-step write) | role-match |
| `src/moderation/schemas.js` (CREATE) | validation | transform (request body → typed action) | no Zod in repo yet; closest analog is ad-hoc guards in `server.js:957-965` (approve-request body validation) | no analog (new pattern) |
| `src/moderation/rateLimit.js` (CREATE) | middleware | request-response | `src/security/requireAdmin.js` (single-purpose async middleware reading `req.admin`) | role-match |
| `src/moderation/denySelfModeration.js` (CREATE) | middleware | request-response | `src/security/requireAdmin.js` | exact |
| `package.json` (MODIFY — add deps) | config | n/a | self (existing deps block) | exact |
| `__tests__/moderation/suspend.test.js` (CREATE) | test | integration (supertest) | `__tests__/moderation/requireAdmin.middleware.test.js` | exact |
| `__tests__/moderation/unsuspend.test.js` (CREATE) | test | integration (supertest) | `__tests__/moderation/requireAdmin.middleware.test.js` | exact |
| `__tests__/moderation/revokeRole.test.js` (CREATE) | test | integration (supertest) | `__tests__/moderation/requireAdmin.middleware.test.js` | exact |
| `__tests__/moderation/deleteProviderProfile.test.js` (CREATE) | test | integration (supertest) | `__tests__/moderation/requireAdmin.middleware.test.js` + `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` (loose-schema seed pattern) | exact |
| `__tests__/moderation/editProfile.test.js` (CREATE) | test | integration (supertest) | `__tests__/moderation/requireAdmin.middleware.test.js` | exact |
| `__tests__/moderation/rateLimit.test.js` (CREATE) | test | integration (supertest loop) | `__tests__/moderation/requireAdmin.middleware.test.js` | role-match |

---

## Pattern Assignments

### `src/moderation/router.js` (router, request-response + CRUD)

**Analog (current state):** `src/moderation/router.js:1-10` (extended, not replaced)
**Mount point analog:** `server.js:915-919`

**Current router skeleton** (must extend, not replace):

```javascript
// src/moderation/router.js:1-10 — CURRENT (Phase 1 scaffold)
const express = require('express');

const router = express.Router();

// Scaffold route. Real Phase 2 routes mount behind this same router.
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
```

**Mount pattern to honor** (do NOT re-mount — already wired in server.js):

```javascript
// server.js:913-919 — EXISTING, DO NOT DUPLICATE
// --- Admin Routes ---

// New moderation surface (SEC-01 + SEC-02). Mounted BEFORE legacy /api/admin/*
// routes so the Bearer-idToken chain applies first. Per D-05 (hybrid cutover),
// legacy routes below keep their existing callerUid-in-body pattern until a
// follow-up milestone migrates them (D-06).
app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);
```

**Pattern to apply in Phase 2:** Register `rateLimiter` at the router level via `router.use(rateLimiter)` BEFORE any route definitions (so it runs after `verifyIdToken`+`requireAdmin` at the app-mount level but before per-route logic). Apply `denySelfModeration` per-route (not router-wide — Phase 5 history GET shouldn't have it). Keep `/ping` intact. Router exports stay as default `module.exports = router`.

**Route handlers — no existing Express-router handlers in the repo**, because every legacy endpoint is defined as `app.post('/api/...', handler)` directly on the Express app (see `server.js:934, 957, 998` etc.). Phase 2 establishes the router-style handler pattern. Handler body pattern (mirrors the legacy try/catch + `res.json` + `console.error` style but swaps `{ message }` for `{ error, message }` per D-10):

```javascript
// Pattern for Phase 2 handlers (no direct analog — copies handler-body shape
// from server.js legacy routes but responds with the new D-10 error envelope):
router.post('/:targetUid', denySelfModeration, async (req, res) => {
  const parsed = dispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await service.suspend({
      adminUid: req.admin.uid,        // from requireAdmin
      adminEmail: req.admin.email,    // from requireAdmin
      targetUid: req.params.targetUid,
      ...parsed.data,
    });
    return res.json(result);
  } catch (err) {
    // Service throws tagged errors (e.g., new Error('last_admin_protected'))
    // Map known tags to 400; unknown to 500 via console.error.
    if (KNOWN_USER_ERRORS.has(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[moderation] suspend error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});
```

**Note on `req.admin`:** `src/security/requireAdmin.js:18` sets `req.admin = { role: admin.role, email: admin.email }` — NOTE there is NO `uid` field today. Phase 2 must either (a) propagate `req.auth.uid` into `req.admin.uid` by modifying `requireAdmin.js`, OR (b) read `req.auth.uid` directly inside handlers. The Phase 2 CONTEXT.md D-27/D-31 repeatedly references `req.admin.uid`, so option (a) is the compatible path. Read `src/security/verifyIdToken.js:19` which sets `req.auth = { uid, email, claims }` — the uid is available upstream.

---

### `src/moderation/service.js` (service, CRUD + transactional write)

**Analog (current stub):** `src/moderation/service.js:1-31` — signatures LOCKED by Phase 1, fill bodies only.

**Stub signatures that must NOT change:**

```javascript
// src/moderation/service.js:11-29 — SIGNATURES LOCKED
async function suspend({ adminUid, targetUid, severity, reasonCategory, note }) { /* Phase 2 fills */ }
async function unsuspend({ adminUid, targetUid, note }) { /* Phase 2 fills */ }
async function revokeRole({ adminUid, targetUid, role, reasonCategory, note }) { /* Phase 2 fills */ }
async function deleteProviderProfile({ adminUid, targetUid, role, reasonCategory, note }) { /* Phase 2 fills */ }
async function editProfile({ adminUid, targetUid, role, fieldDiff, note }) { /* Phase 2 fills */ }
```

**NOTE:** CONTEXT.md D-36 router pattern passes `adminEmail` too; the current signatures don't list it. Planner must either (a) add `adminEmail` to each signature or (b) look up admin email from `adminUid`. Easier to extend the signatures — tests assert on the audit row's `adminEmail` field and the simplest source is `req.admin.email` propagated from `requireAdmin`.

**Audit-write pattern (single source of truth — do NOT call `ModerationAction.create` directly):**

```javascript
// src/moderation/actions.js:1-17 — USE THIS, not ModerationAction.create()
const ModerationAction = require('../models/ModerationAction');

async function writeAction(doc) {
  if (!doc || typeof doc !== 'object') {
    throw new Error('writeAction requires an object');
  }
  if (!doc.targetUid || !doc.adminUid || !doc.adminEmail || !doc.action) {
    throw new Error('writeAction: targetUid, adminUid, adminEmail, action are required');
  }
  return ModerationAction.create(doc);
}

module.exports = { writeAction };
```

**Capability map usage (for `suspend` to populate `restrictedFeatures`):**

```javascript
// src/moderation/capabilities.js:52-59 — USE THIS, not duplicated logic
function resolveRestrictedFeatures(state) {
  const entry = STATUS_POLICY[state];
  if (!entry) throw new Error(`Unknown moderation state: ${state}`);
  if (entry.capabilities === 'all') return [];
  if (entry.capabilities.blocked === 'all_writes') return ['all_writes'];
  if (Array.isArray(entry.capabilities.blocked)) return [...entry.capabilities.blocked];
  throw new Error(`Malformed STATUS_POLICY entry for state: ${state}`);
}
```

**Multi-step write closest analog** (`server.js:1148-1232` POST /api/orders — multi-resource read + create, no transaction, but shows the shape of resolving multiple collections before a create):

```javascript
// server.js:1148-1192 — multi-collection read + write (NO transaction — Phase 2 adds that)
app.post('/api/orders', async (req, res) => {
  try {
    const { buyerUid, car, items } = req.body;
    if (!buyerUid || !items || !items.length) {
      return res.status(400).json({ message: 'buyerUid and items required' });
    }

    const providerGroups = {};
    for (const item of items) {
      // ... resolves Broker OR LogisticsPartner + User ...
      let profile = null;
      if (item.providerType === 'broker') {
        profile = await Broker.findOne({ ownerUid: item.providerUid }).lean();
      } else if (item.providerType === 'logistics') {
        profile = await LogisticsPartner.findOne({ ownerUid: item.providerUid }).lean();
      }
      const ownerUser = await User.findOne({ firebaseUid: item.providerUid }).lean();
      // ... builds providerGroups ...
    }

    // ... creates orders one per provider group ...
    const order = await ServiceOrder.create({ /* ... */ });
```

**Transaction pattern — no analog in the codebase** (CONTEXT.md §Established Patterns: "Transactions via `session.withTransaction()` — pattern not yet present in this codebase, Phase 2 establishes it"). The planner should follow Mongoose canonical form:

```javascript
// Phase 2 NEW pattern — no in-repo analog; docs:
// https://mongoosejs.com/docs/transactions.html#with-transactions
const session = await mongoose.startSession();
try {
  await session.withTransaction(async () => {
    // 1. Insert audit row FIRST (D-18, D-19: lastActionId back-link)
    const [action] = await ModerationAction.create([{ targetUid, adminUid, adminEmail, action: 'suspend', severity, reasonCategory, note }], { session });
    // 2. (suspend only) Last-admin guard inside the txn
    const activeAdminCount = await User.countDocuments({
      email: { $in: await AdminUser.distinct('email') },
      'moderationStatus.state': 'active',
    }, { session });
    if (/* target is last admin */) throw new Error('last_admin_protected');
    // 3. Update User.moderationStatus with lastActionId: action._id
    await User.updateOne(
      { firebaseUid: targetUid },
      { $set: { moderationStatus: { ...newModerationStatus, lastActionId: action._id } } },
      { session }
    );
  });
  return { ok: true, user: { moderationStatus: newModerationStatus }, action: { _id, action: 'suspend', createdAt } };
} finally {
  await session.endSession();
}
```

**Reference model joins (unchanged from Phase 1):**
- `User` — `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/User.js` — key is `firebaseUid` (the `:targetUid` URL param); `moderationStatus` subdoc is the write target.
- `AdminUser` — `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/AdminUser.js` — joined by `email`; used for the last-admin guard query.
- `ModerationAction` — `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/models/ModerationAction.js` — write via `actions.writeAction()` wrapper.
- `Broker` / `LogisticsPartner` — registered in `server.js:160, 179` with collections `'brokers'` and `'logistics_partners'`. Service code uses `mongoose.model('Broker')` / `mongoose.model('LogisticsPartner')` to access them without importing server.js (same pattern the migration script uses via loose strict:false binding — but here the models are already registered via server.js load order, so `mongoose.model('Broker')` works).

**Edit-profile whitelist — ground-truth schemas:**

```javascript
// server.js:146-156 — Broker schema (source of truth for edit-profile broker whitelist)
const brokerSchema = new mongoose.Schema({
  ownerUid: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },    // EDITABLE (D-03)
  description: String,                               // NOT EDITABLE (D-03)
  phoneNumber: String,                               // EDITABLE (D-03)
  telegramUsername: String,                          // EDITABLE (D-03)
  services: [serviceItemSchema],                     // NOT EDITABLE
  paymentOptions: [String],                          // NOT EDITABLE
  avatarUrl: String,                                 // NOT EDITABLE
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },  // NOT EDITABLE — operational flag (D-10 carry-forward)
  createdAt: { type: Date, default: Date.now },     // NOT EDITABLE
});
```

```javascript
// server.js:163-175 — LogisticsPartner schema (source of truth for logistics whitelist)
const logisticsPartnerSchema = new mongoose.Schema({
  ownerUid: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },    // EDITABLE (D-03)
  description: String,                               // NOT EDITABLE
  phoneNumber: String,                               // EDITABLE (D-03)
  telegramUsername: String,                          // EDITABLE (D-03)
  services: [serviceItemSchema],                     // NOT EDITABLE
  coverageAreas: [String],                          // EDITABLE (D-03)
  timelines: String,                                 // EDITABLE (D-03)
  paymentOptions: [String],                          // NOT EDITABLE
  avatarUrl: String,                                 // NOT EDITABLE
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
});
```

**Legacy "apply only provided fields" pattern** (use the IDIOM, not the byte-identical code — Phase 2's edit-profile is narrower + whitelisted + change-diff audited):

```javascript
// server.js:590-611 — PUT /api/brokers/:uid (conceptual reference only; do NOT copy callerUid,
// do NOT reuse the whole list — Phase 2 locks a narrower whitelist per D-03).
app.put('/api/brokers/:uid', async (req, res) => {
  try {
    const { companyName, description, phoneNumber, telegramUsername, services, paymentOptions } = req.body;
    const update = {};
    if (companyName !== undefined) update.companyName = companyName;
    // ...
    const broker = await Broker.findOneAndUpdate(
      { ownerUid: req.params.uid },
      update,
      { new: true, upsert: true }  // Phase 2 uses { session }, NO upsert (target must exist per D-07)
    );
```

---

### `src/moderation/schemas.js` (validation)

**No analog — Phase 2 introduces Zod to this codebase.** Closest idiom is the ad-hoc body-field check in the legacy admin routes:

```javascript
// server.js:957-965 — legacy ad-hoc validation (the ANTI-PATTERN; Zod replaces this)
const { callerUid, type } = req.body;
if (!callerUid || !type) return res.status(400).json({ message: 'callerUid and type required' });
// ...
const validTypes = ['seller', 'broker', 'logistics'];
if (!validTypes.includes(type)) return res.status(400).json({ message: 'Invalid type' });
```

**Phase 2 pattern — no in-repo precedent; follow zod@^3.24 `.strict()` docs (CONTEXT.md D-34..D-37):**

```javascript
// src/moderation/schemas.js — Phase 2 NEW PATTERN
const { z } = require('zod');

const reasonCategoryEnum = z.enum(['spam', 'policy_violation', 'fraud', 'other']);
const severityEnum = z.enum(['feature_limited', 'blocked_with_review', 'permanently_banned']);
const roleEnum = z.enum(['seller', 'broker', 'logistics']);

const suspendSchema = z.object({
  action: z.literal('suspend'),
  severity: severityEnum,
  reasonCategory: reasonCategoryEnum,
  note: z.string().max(2000).optional(),
}).strict();  // D-05 + D-35 — rejects unknown top-level keys

const revokeRoleSchema = z.object({
  action: z.literal('revoke_role'),
  role: roleEnum,
  reasonCategory: reasonCategoryEnum,
  note: z.string().max(2000).optional(),
}).strict();

const dispatchSchema = z.discriminatedUnion('action', [suspendSchema, revokeRoleSchema]);

const unsuspendSchema = z.object({
  note: z.string().max(2000).optional(),
}).strict();

const deleteProfileSchema = z.object({
  role: z.enum(['broker', 'logistics']),  // D-14 — NOT seller
  reasonCategory: reasonCategoryEnum,
  note: z.string().max(2000).optional(),
}).strict();

const editProfileBrokerSchema = z.object({
  role: z.literal('broker'),
  fields: z.object({
    companyName: z.string().optional(),
    phoneNumber: z.string().optional(),
    telegramUsername: z.string().optional(),
  }).strict(),  // D-05 — unknown field → 400
  note: z.string().max(2000).optional(),
}).strict();

const editProfileLogisticsSchema = z.object({
  role: z.literal('logistics'),
  fields: z.object({
    companyName: z.string().optional(),
    phoneNumber: z.string().optional(),
    telegramUsername: z.string().optional(),
    coverageAreas: z.array(z.string()).optional(),
    timelines: z.string().optional(),
  }).strict(),
  note: z.string().max(2000).optional(),
}).strict();

module.exports = {
  dispatchSchema,
  suspendSchema,
  revokeRoleSchema,
  unsuspendSchema,
  deleteProfileSchema,
  editProfileBrokerSchema,
  editProfileLogisticsSchema,
};
```

**Enum sources of truth** (keep imports sync'd so enums cannot drift per D-35):
- `severity` values: `User.moderationStatus.state` enum (minus `'active'`) and `ModerationAction.severity` enum (minus `'none'`). See `src/models/User.js:20` and `src/models/ModerationAction.js:8`.
- `reasonCategory` values: `User.moderationStatus.reasonCategory` enum (`src/models/User.js:22`).
- `action` literal values: `ModerationAction.action` enum (`src/models/ModerationAction.js:7`).

---

### `src/moderation/rateLimit.js` (middleware)

**Analog (for module shape):** `src/security/requireAdmin.js:1-23`

**Module shape to honor** (single-purpose async middleware, named export, JSDoc header):

```javascript
// src/security/requireAdmin.js — SHAPE TO MIRROR (module layout only; library call differs)
const AdminUser = require('../models/AdminUser');

/**
 * Express middleware. Requires verifyIdToken upstream (reads req.auth.email).
 * Looks up AdminUser by email (case-insensitive), attaches req.admin = { role, email }.
 *
 * 403 shape per D-10:
 *   { error: 'unauthorized', message: 'Admin access required' }
 */
async function requireAdmin(req, res, next) {
  // ...
}

module.exports = { requireAdmin };
```

**Phase 2 pattern — no in-repo precedent for `express-rate-limit`. Follow v8 docs:**

```javascript
// src/moderation/rateLimit.js — Phase 2 NEW
const rateLimit = require('express-rate-limit');

/**
 * Per-admin rate limiter for /api/admin/moderation/*.
 * Keyed by req.admin.uid (set by requireAdmin, upstream).
 * Window: 15 min, Limit: 30 — per D-30, D-31, D-32.
 * Memory store — single Railway instance only (see STATE.md blocker per D-33).
 *
 * 429 shape:
 *   { error: 'rate_limited', retryAfter: <seconds> }
 */
const moderationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,   // sets RateLimit-* headers (v8 default behavior)
  legacyHeaders: false,
  keyGenerator: (req) => req.admin?.uid || req.admin?.email || 'anonymous',
  handler: (req, res /*, next, options */) => {
    const retryAfter = Math.ceil(req.rateLimit.resetTime - Date.now()) / 1000;
    res.status(429)
       .set('Retry-After', String(Math.ceil(retryAfter)))
       .json({ error: 'rate_limited', retryAfter: Math.ceil(retryAfter) });
  },
});

module.exports = { moderationRateLimiter };
```

**IMPORTANT:** `keyGenerator` depends on `req.admin.uid`. If `requireAdmin.js` is NOT updated to propagate `uid` from `req.auth.uid`, the keyGenerator must fall back to `req.admin.email` (which IS set today per `requireAdmin.js:18`). The planner should pick one and pin it explicitly.

---

### `src/moderation/denySelfModeration.js` (middleware)

**Analog:** `src/security/requireAdmin.js:1-23` — identical module shape, tiny body.

**Pattern:**

```javascript
// src/moderation/denySelfModeration.js — Phase 2 NEW (shape mirrors requireAdmin.js exactly)

/**
 * Express middleware. Rejects moderation actions where the target UID equals
 * the acting admin's UID (D-26). Runs AFTER requireAdmin, BEFORE the handler.
 * Applied per-route because future non-mutating routes (Phase 5 history GET)
 * should not carry this guard.
 *
 * 400 shape per D-10 family:
 *   { error: 'cannot_moderate_self' }
 */
function denySelfModeration(req, res, next) {
  const targetUid = req.params.targetUid;
  const adminUid = req.admin && req.admin.uid;  // requires requireAdmin to propagate uid
  if (!targetUid || !adminUid) {
    return next();  // let the real handler 404/error — not this middleware's lane
  }
  if (targetUid === adminUid) {
    console.log(`[moderation] denied self-moderation attempt by ${adminUid} at ${new Date().toISOString()}`);  // D-29
    return res.status(400).json({ error: 'cannot_moderate_self' });
  }
  return next();
}

module.exports = { denySelfModeration };
```

**Rejected-attempt logging** (D-29 — console only, NOT to ModerationAction):

```javascript
// Follow the pattern established elsewhere in server.js (console.error / console.log
// with a bracketed subsystem tag). Examples:
//   server.js:248: console.log('[Admin] SUPER_ADMIN_EMAIL not set in .env — skipping super admin seed');
//   server.js:321: console.warn('ANDROID_SHA256_CERT_FINGERPRINTS not set - ...');
//   src/security/ensureBaseline.js:12: console.warn(`[Baseline] ${pending} users missing ...`)
console.log(`[moderation] denied self-moderation attempt by ${adminUid}`);
```

---

### `package.json` (config — dependency additions)

**Analog:** `package.json` itself (current file).

**Current state** (`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package.json:22-33`):

```json
"dependencies": {
  "@aws-sdk/client-s3": "^3.975.0",
  "cors": "^2.8.6",
  "dotenv": "^17.2.3",
  "express": "^5.2.1",
  "firebase-admin": "^13.8.0",
  "mongoose": "^9.1.5",
  "multer": "^2.0.2",
  "multer-s3": "^3.0.1",
  "stripe": "^20.4.1",
  "twilio": "^5.3.4"
}
```

**Phase 2 additions** (both `dependencies`, not `devDependencies`, per `firebase-admin` precedent in Phase 1 plan 01-05):

```json
"express-rate-limit": "^8.3.0",
"zod": "^3.24.0"
```

Per D-37 and research/STACK.md pins.

---

### Tests — all six files follow the same harness pattern

**Canonical analog:** `__tests__/moderation/requireAdmin.middleware.test.js:1-90`

**Full harness template** (copy verbatim, adapt per-test):

```javascript
// __tests__/moderation/<action>.test.js — Phase 2 pattern (mirrors requireAdmin.middleware.test.js)

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock firebase-admin BEFORE any module that uses it — same as Phase 1's requireAdmin test.
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
const { verifyIdToken } = require('../../src/security/verifyIdToken');
const { requireAdmin } = require('../../src/security/requireAdmin');
const router = require('../../src/moderation/router');
const AdminUser = require('../../src/models/AdminUser');
const User = require('../../src/models/User');
const ModerationAction = require('../../src/models/ModerationAction');

let mongo;
let app;

beforeAll(async () => {
  // NOTE: Phase 2 transaction tests REQUIRE replica-set mode. Default MongoMemoryServer.create()
  // is standalone and does NOT support transactions. Use:
  //   const { MongoMemoryReplSet } = require('mongodb-memory-server');
  //   mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Per CONTEXT.md D-39 — mongodb-memory-server ^10.4.3 is already installed as a devDep.
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });

  app = express();
  app.use(express.json());
  app.use('/api/admin/moderation', verifyIdToken, requireAdmin, router);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  admin.__verifyIdTokenMock.mockReset();
  await AdminUser.deleteMany({});
  await User.deleteMany({});
  await ModerationAction.deleteMany({ targetUid: /.*/ }).catch(() => {});  // append-only guard — deleteMany throws; catch to reset state between tests via drop
  // ModerationAction.append-only guard makes deleteMany throw. Drop the collection instead:
  try { await ModerationAction.collection.drop(); } catch (_) {}
});

describe('<action>', () => {
  test('happy path', async () => {
    await AdminUser.create({ email: 'admin@test.local', role: 'admin' });
    await User.create({ firebaseUid: 'target-1', email: 't1@test.local' });
    admin.__verifyIdTokenMock.mockResolvedValueOnce({ uid: 'admin-uid', email: 'admin@test.local' });

    const res = await request(app)
      .post('/api/admin/moderation/target-1')
      .set('Authorization', 'Bearer ok-token')
      .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.moderationStatus.state).toBe('feature_limited');
    expect(res.body.action.action).toBe('suspend');

    const updated = await User.findOne({ firebaseUid: 'target-1' }).lean();
    expect(updated.moderationStatus.state).toBe('feature_limited');
    expect(updated.moderationStatus.lastActionId.toString()).toBe(res.body.action._id);

    const audit = await ModerationAction.findOne({ targetUid: 'target-1' }).lean();
    expect(audit.action).toBe('suspend');
    expect(audit.adminUid).toBe('admin-uid');
    expect(audit.adminEmail).toBe('admin@test.local');
  });
});
```

**Key deviations for each test file:**

| Test file | Deviation from canonical harness |
|-----------|----------------------------------|
| `suspend.test.js` | Covers 6 cases per D-38: happy, re-suspend different severity, re-suspend same (400 `already_at_severity`), self-mod (400 `cannot_moderate_self`), last-admin (400 `last_admin_protected`), Zod reject unknown severity. Replica-set mongo required for transaction success assertion. |
| `unsuspend.test.js` | PATCH verb, 2 cases: happy + 400 `not_suspended`. |
| `revokeRole.test.js` | 3 role paths (seller/broker/logistics) + asserts Broker/LogisticsPartner docs still exist post-revoke (negates T-bad mutation) + 400 `role_not_assigned` + self-mod 400. |
| `deleteProviderProfile.test.js` | Uses the loose-schema seed pattern from `__tests__/moderation/migrate-moderation.test.js:17-18` to seed Broker/LogisticsPartner without importing server.js:`const Broker = mongoose.model('Broker_testseed', new mongoose.Schema({}, { strict: false, collection: 'brokers' }));` — keeps test hermetic. Also asserts `ServiceOrder.providerSnapshot` remains populated after delete (per D-15). |
| `editProfile.test.js` | 5 cases per D-38: narrow whitelist applied; unknown field 400 (`invalid_field`); no-op 400 (`no_changes`); fieldDiff shape (`before`/`after` per D-04); `role_not_assigned` 400. |
| `rateLimit.test.js` | Loop 30 successful requests, assert 31st returns 429 + `Retry-After` header + `{ error: 'rate_limited', retryAfter: <number> }`. Also assert admin A's limit doesn't affect admin B (different mock email → different keyGenerator output). |

**Seeding legacy-shape docs** (bypass Mongoose defaults via `.collection.insertOne` — copied from `__tests__/moderation/migrate-moderation.test.js:37-38`):

```javascript
// When a test needs a User without moderationStatus (edge case):
await User.collection.insertOne({ firebaseUid: 'legacy-1', email: 'l1@test.local' });
```

**Reading append-only collection state between tests** (ModerationAction blocks `deleteMany` at the schema level per `src/models/ModerationAction.js:23`):

```javascript
// Standard pattern — drop the collection instead of deleteMany:
try {
  await ModerationAction.collection.drop();
} catch (_) {
  // collection doesn't exist yet — ignore
}
```

---

## Shared Patterns

### 1. Authentication (inherited from Phase 1 — Phase 2 does NOT re-wire)

**Source:** `server.js:915-919` — router mount point.

```javascript
// ALREADY WIRED. Phase 2 adds routes INSIDE the router; does not touch this line.
app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);
```

**Apply to:** All Phase 2 routes automatically (they live in `src/moderation/router.js`).

**Contract for handlers:**
- `req.auth.uid` and `req.auth.email` set by `verifyIdToken` (`src/security/verifyIdToken.js:19`).
- `req.admin.role` and `req.admin.email` set by `requireAdmin` (`src/security/requireAdmin.js:18`).
- `req.admin.uid` — **NOT SET TODAY.** Phase 2 must either extend `requireAdmin.js` to propagate `uid` from `req.auth.uid`, or read `req.auth.uid` directly. Planner should pick one and document it in the plan's "Phase 1 amendments" section.

### 2. Error Envelope (CONTEXT.md D-10 carry-forward + Phase 2 extensions)

**Source:** `src/security/verifyIdToken.js:14-22`, `src/security/requireAdmin.js:11-16`.

```javascript
// 401 — unauthenticated (Phase 1):
{ error: 'unauthenticated', message: 'Missing or invalid idToken' }

// 403 — unauthorized (Phase 1):
{ error: 'unauthorized', message: 'Admin access required' }

// 400 — Phase 2 new codes (per CONTEXT.md §Established Patterns and D-02/D-05/D-06/D-20/D-22/D-28/D-31):
{ error: 'invalid_payload', issues: [...] }     // Zod parse failure; include parsed.error.issues (per Specifics)
{ error: 'invalid_field', fields: [...] }        // Unknown edit-profile field (D-05)
{ error: 'no_changes' }                          // Edit-profile no-op (D-06)
{ error: 'role_not_assigned' }                   // Target lacks requested role (D-07, D-11)
{ error: 'already_at_severity' }                 // Re-suspend same severity (D-20)
{ error: 'not_suspended' }                       // Unsuspend on active user (D-22)
{ error: 'cannot_moderate_self' }                // Self-moderation (D-26)
{ error: 'last_admin_protected' }                // Last active admin (D-28)
{ error: 'invalid_role_for_delete' }             // seller role on delete-provider-profile (D-14)

// 429 — rate limited (D-31):
{ error: 'rate_limited', retryAfter: <seconds> }   // Also sets Retry-After header

// 500 — unexpected:
{ error: 'internal_error', message: err.message }   // console.error(err) first
```

**Apply to:** All Phase 2 handlers.

**NOTE on `{ error, message }` vs legacy `{ message }`:** CONTEXT.md §"Established Patterns (must honor)" specifies new auth-adjacent routes use `{ error, message? }`; legacy routes keep `{ message }`. Every Phase 2 error above uses the `{ error, ... }` envelope.

### 3. Success Envelope (CONTEXT.md D-02)

**Apply to:** All Phase 2 mutating handlers.

```javascript
// 200 — success on suspend/unsuspend/revoke/edit:
{
  ok: true,
  user: { moderationStatus: { state, severity, reasonCategory, note, setByAdminUid, setAt, restrictedFeatures, lastActionId } },
  action: { _id, action, createdAt },
}

// 200 — success on delete-provider-profile (no user.moderationStatus change per D-13 step 2 — but xStatus changes):
{
  ok: true,
  user: { brokerStatus: 'NONE' },     // or logisticsStatus
  action: { _id, action: 'delete_provider_profile', createdAt },
}
```

### 4. Logging pattern (console-tagged, subsystem in brackets)

**Sources:**
- `src/security/ensureBaseline.js:12` — `console.warn(\`[Baseline] ${pending} users missing moderationStatus — run: ...\`);`
- `server.js:248` — `console.log('[Admin] SUPER_ADMIN_EMAIL not set in .env — skipping super admin seed');`
- `server.js:268` — `console.log(\`[Admin SMS] Twilio not configured — skipping notification for ${requestType}...\`);`
- `server.js:1172` — `console.warn(\`[providerSnapshot] Warning: provider ${item.providerUid} ...\`);`

**Apply to:** All Phase 2 code that emits informational or warning lines. Tag with `[moderation]` for service/handler logs (D-29), `[rateLimit]` for limiter events if needed.

### 5. Mongoose model access pattern

**Source:** Mixed — models under `src/models/` are required directly; models still in server.js are accessed via `mongoose.model('Name')` after server.js loads, OR via loose `strict: false` schemas bound to the known collection name.

**For Phase 2:**
- `User`, `AdminUser`, `ModerationAction` — `require('../models/User')` etc. (`src/models/*.js` per Phase 1 D-01).
- `Broker`, `LogisticsPartner`, `ServiceOrder` — stay inline in server.js (Phase 1 D-02). Service-layer code accesses via `mongoose.model('Broker')` / `mongoose.model('LogisticsPartner')` — relies on server.js having loaded first at runtime. Tests cannot rely on that; use the loose-schema pattern from `__tests__/moderation/migrate-moderation.test.js:17-18`.

```javascript
// src/moderation/service.js — runtime model access (server.js has already registered these):
const mongoose = require('mongoose');
const Broker = mongoose.model('Broker');                    // registered in server.js:160
const LogisticsPartner = mongoose.model('LogisticsPartner'); // registered in server.js:179
```

### 6. Legacy anti-pattern to REJECT

**Source of the bad pattern (do NOT copy):** `server.js:957-962`

```javascript
// ANTI-PATTERN — DO NOT COPY to Phase 2 handlers:
app.post('/api/admin/requests/:uid/approve', async (req, res) => {
  try {
    const { callerUid, type } = req.body;                            // callerUid in body = spoofable
    if (!callerUid || !type) return res.status(400).json({ message: 'callerUid and type required' });
    const admin = await verifyAdminByUid(callerUid);                 // legacy helper
    if (!admin) return res.status(403).json({ message: 'Unauthorized' });  // legacy error shape
```

**Why rejected:** CONTEXT.md §"Anti-Pattern Warnings": "Do NOT reuse the legacy `callerUid`-in-body pattern — every Phase 2 route uses `req.admin.uid` from the verified idToken. Copy-pasting from `server.js:957` (approve/reject) is the failure mode to avoid."

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All Phase 2 files have at least a role-match analog in the existing backend. Zod schemas, `express-rate-limit` middleware, and `session.withTransaction()` are NEW patterns for this codebase — but the surrounding module shape (single-purpose middleware, thin service functions, one-export-per-file) is fully mirrored by Phase 1 analogs. |

---

## Metadata

**Analog search scope:**
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js` (1536 lines — all admin routes, all schemas, POST /api/orders)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/` (models, security, moderation — all 10 files read)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/` (all 6 Phase 1 test files read)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/scripts/migrate-moderation.js` (loose-schema pattern)
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package.json`

**Files scanned:** 19 backend files.

**Key absent patterns flagged for planner:**
1. **Transactions (`session.withTransaction()`)** — zero prior use. Phase 2 establishes. Reference: https://mongoosejs.com/docs/transactions.html#with-transactions.
2. **Zod validation** — zero prior use. Phase 2 establishes. Reference: https://zod.dev/api/object#strict.
3. **`express-rate-limit`** — zero prior use. Phase 2 establishes. Reference: https://www.npmjs.com/package/express-rate-limit.
4. **`req.admin.uid`** — not populated by current `requireAdmin.js`. Planner must either amend Phase 1 middleware (add `uid: req.auth.uid` to `req.admin`) or switch every Phase 2 reference to `req.auth.uid`. The Phase 2 CONTEXT.md consistently says `req.admin.uid`, so amending `requireAdmin.js` is the lower-friction path and should be called out as a "Phase 1 amendment" plan task.
5. **Replica-set MongoMemoryServer** — current tests use standalone `MongoMemoryServer.create()` which does NOT support transactions. Phase 2 tests that exercise transaction commit/rollback must import `MongoMemoryReplSet` (same package, `mongodb-memory-server@^10.4.3` already installed per `package.json:36`). D-39 notes this.

**Pattern extraction date:** 2026-04-17
