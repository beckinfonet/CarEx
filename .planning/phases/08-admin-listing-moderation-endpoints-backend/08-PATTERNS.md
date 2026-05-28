# Phase 8: Admin Listing Moderation Endpoints (Backend) - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 15 (13 CREATE + 2 MODIFY)
**Analogs found:** 15 / 15 (all files have a verified analog in the v1.0 user-mod surface or the seller PUT)
**Backend repo path:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/` (sibling of `carEx`)

> All "file paths" below resolve to the BACKEND repo. The carEx mobile repo is NOT touched in Phase 8.

---

## File Classification

| # | File (relative to backend repo root) | Role | Data Flow | Closest Analog | Match Quality |
|---|---------------------------------------|------|-----------|----------------|---------------|
| 1 | `src/uploads/carImages.js` | extracted-config-module | bootstrap | inline `upload` at `server.js:52-64` | role-extraction (no exact analog — this IS the extraction) |
| 2 | `src/moderation/listingService.js` | service | CRUD + transaction | `src/moderation/service.js` | exact (per-action async function with `withTransaction`) |
| 3 | `src/moderation/listingSchemas.js` | validation module | parse | `src/moderation/schemas.js` | exact (Zod `.strict()` per-action schemas + enum re-export) |
| 4 | `src/moderation/denySelfModerationListing.js` | middleware | request-response | `src/moderation/denySelfModeration.js` | role-match (UID comparison via param vs. via fetched Car.sellerId) |
| 5 | `src/moderation/listingErrors.js` (or inline) | utility | error-discrimination | `confirmBooking.js:31 ProviderSuspendedError` + `service.js:22 NotImplementedError` | role-match (extends `Error`, adds `.code`) |
| 6 | `__tests__/listing-moderation/listingSchemas.test.js` | unit test | parse | `__tests__/moderation/schemas.test.js` | exact (Zod `.strict()` + enum tests, no DB) |
| 7 | `__tests__/listing-moderation/denySelfModerationListing.test.js` | unit test | middleware | `__tests__/moderation/denySelfModeration.test.js` | role-match (needs in-memory Mongo for Car fetch — divergence from v1.0 which has no DB) |
| 8 | `__tests__/listing-moderation/listingTransaction.atomicity.test.js` | integration test | rollback assertion | `__tests__/moderation/suspend.test.js:139-141` (last-admin abort) + `editProfile.test.js` no_changes-pre-txn pattern | role-match (no dedicated v1.0 atomicity test; v1.0 last-admin throw IS the rollback pattern) |
| 9 | `__tests__/listing-moderation/suspendListing.test.js` | integration test | service-call | `__tests__/moderation/suspend.test.js` | exact (replica-set fixture + audit-row + Car-update assertions) |
| 10 | `__tests__/listing-moderation/archiveListing.test.js` | integration test | service-call | `__tests__/moderation/suspend.test.js` (same shape) | exact |
| 11 | `__tests__/listing-moderation/deleteListing.test.js` | integration test | service-call | `__tests__/moderation/suspend.test.js` + `deleteProviderProfile.test.js` (doc-survives assertion) | exact-with-divergence (`Car.countDocuments({_id})` post-delete is the LADM-04 invariant; v1.0 deleteProviderProfile asserts the OPPOSITE — doc IS gone) |
| 12 | `__tests__/listing-moderation/restoreListing.test.js` | integration test | service-call | `__tests__/moderation/unsuspend.test.js` | exact (same suspended→active pattern, plus archived/deleted starting states) |
| 13 | `__tests__/listing-moderation/editListing.test.js` | integration test | service-call + multer | `__tests__/moderation/editProfile.test.js` + `server.js:763-845` seller-PUT image shape | composite (v1.0 editProfile for fieldDiff shape; seller-PUT for image multipart) |
| 14 | `src/moderation/listingRouter.js` (MODIFY) | route module | request-response dispatch | `src/moderation/router.js` | exact (KNOWN_USER_ERRORS + handleServiceError + per-route handler pattern) |
| 15 | `server.js` (MODIFY) | bootstrap | wiring | self (lines 52-64 = current inline `upload`; replace with require) | self-refactor (no external analog needed) |

---

## Pattern Assignments

### 1. `src/uploads/carImages.js` (NEW — extraction)

**Role:** Configuration module that owns the multer-S3 `upload` instance + the underlying `S3Client`.

**Data flow:** Module-load → exports `{ upload, s3 }`. Consumed by `server.js` (seller PUT at `/api/cars/:id`) AND `listingRouter.js` (Edit handler).

**Closest analog:** The CURRENT inline construction at `server.js:43-64`. There is no prior extracted-config analog in the codebase — this IS the extraction. RESEARCH.md Pitfall 1 names this file path explicitly.

**Excerpt to copy verbatim (from `server.js:43-64`):**
```js
// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const folder = req.body.bodyType ? req.body.bodyType.toLowerCase() : 'misc';
      cb(null, `${folder}/${Date.now().toString()}-${file.originalname}`);
    },
  }),
});
```

**Diffs from analog:** Move into a NEW file, prepend three `require`s (`@aws-sdk/client-s3`, `multer`, `multer-s3`), wrap with `module.exports = { upload, s3 };`. Do NOT include `uploadAvatar` (server.js:66-78) — that is a separate config not in Phase 8 scope. Do NOT change the bucket, region, key function, or metadata function.

**Critical preservation:** The `key` function MUST stay byte-identical — it determines the S3 key/folder prefix, and seller-PUT tests rely on this exact shape. Phase 8's Edit handler reads `req.body.bodyType` from the multipart body the same way.

**Lines to read first (executor read_first):**
- `server.js:1-10` (require list — to mirror imports)
- `server.js:43-64` (current inline config — verbatim source)
- `server.js:763` (seller PUT — to confirm `upload.array('images', 25)` is the consumer pattern)

---

### 2. `src/moderation/listingService.js` (NEW — 5 exported async functions)

**Role:** Service module. Exports `editListing`, `suspendListing`, `archiveListing`, `deleteListing`, `restoreListing`. Each opens a Mongoose session, writes one `ListingModerationAction` row, mutates `Car`, commits atomically.

**Data flow:** Called by `listingRouter.js` handlers. Reads/writes `Car` collection. Inserts into `listing_moderation_actions` collection. For Edit only: also reads `vehicle_makes` and `vehicle_models` (via lazy `mongoose.model(...)` resolution).

**Closest analog:** `src/moderation/service.js` — specifically the `suspend` function at `service.js:42-134` for transition handlers and `editProfile` at `service.js:438-530` for Edit.

**Excerpt — top-of-file comment + imports (from `service.js:1-21`):**
```js
// src/moderation/service.js
//
// Moderation service layer. Each handler opens a Mongoose session and runs the
// audit-row insert + User.moderationStatus mutation inside a single
// session.withTransaction() so the pair is atomic.
//
// NOTE: We bypass actions.writeAction() inside transactions because writeAction
// calls ModerationAction.create(singleDoc) which cannot accept { session }. The
// array form (ModerationAction.create([doc], { session })) is required by Mongoose
// to pass options.

const mongoose = require('mongoose');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const ModerationAction = require('../models/ModerationAction');
```

**Excerpt — canonical transition handler shape (from `service.js:42-134`, `suspend`):**
```js
async function suspend({ adminUid, adminEmail, targetUid, severity, reasonCategory, note }) {
  if (!adminUid || !adminEmail || !targetUid || !severity || !reasonCategory) {
    throw new Error('suspend: ... are required');
  }

  // Pre-transaction read: confirm target exists + detect re-suspend-same-severity
  // idempotency violation. Fast-path 400 so we don't pay txn cost on a no-op.
  const target = await User.findOne({ firebaseUid: targetUid }).lean();
  if (!target) throw new Error('target_not_found');
  if (target.moderationStatus && target.moderationStatus.state === severity) {
    throw new Error('already_at_severity');
  }

  const setAt = new Date();
  const session = await mongoose.startSession();
  let insertedAction;
  let newModerationStatus;
  try {
    await session.withTransaction(async () => {
      // 1. Insert audit row FIRST. Array form required by Mongoose to accept { session }.
      const [action] = await ModerationAction.create([{
        targetUid, adminUid, adminEmail,
        action: 'suspend', severity, reasonCategory, note: note ?? null,
      }], { session });
      insertedAction = action;

      // 2. Update User.moderationStatus with the new subdoc.
      newModerationStatus = { state: severity, severity, reasonCategory, note: note ?? null,
        setByAdminUid: adminUid, setAt, restrictedFeatures, lastActionId: action._id };
      const updated = await User.updateOne(
        { firebaseUid: targetUid },
        { $set: { moderationStatus: newModerationStatus } },
        { session }
      );
      if (updated.matchedCount !== 1) throw new Error('target_not_found');
    });
  } finally {
    await session.endSession();
  }

  return {
    ok: true,
    user: { moderationStatus: newModerationStatus },
    action: { _id: insertedAction._id.toString(), action: insertedAction.action, createdAt: insertedAction.createdAt },
  };
}
```

**Excerpt — canonical Edit handler shape (from `service.js:438-530`, `editProfile`):**
```js
async function editProfile({ adminUid, adminEmail, targetUid, role, fields, note }) {
  // D-05 defensive whitelist check at service boundary. Throw BEFORE any DB read.
  const submittedKeys = Object.keys(fields);
  const unknownFields = submittedKeys.filter((k) => !whitelist.includes(k));
  if (unknownFields.length > 0) {
    const err = new Error('invalid_field');
    err.fields = unknownFields;
    throw err;
  }

  const target = await User.findOne({ firebaseUid: targetUid }).lean();
  if (!target) throw new Error('target_not_found');
  if (target[roleField] !== 'APPROVED') throw new Error('role_not_assigned');

  const currentProfile = await ProfileModel.findOne({ ownerUid: targetUid }).lean();
  if (!currentProfile) throw new Error('provider_profile_not_found');

  // D-04 + D-06: compute fieldDiff, changed-only. Filter out no-op keys BEFORE the txn.
  const fieldDiff = {};
  const changeSet = {};
  for (const key of submittedKeys) {
    const before = currentProfile[key];
    const after = fields[key];
    if (!valuesEqual(before, after)) {
      fieldDiff[key] = { before: before ?? null, after };
      changeSet[key] = after;
    }
  }
  if (Object.keys(fieldDiff).length === 0) throw new Error('no_changes');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [action] = await ModerationAction.create([{
        targetUid, adminUid, adminEmail,
        action: 'edit_profile', severity: 'none', reasonCategory: null,
        note: note ?? null, roleAffected: role, fieldDiff,
      }], { session });
      insertedAction = action;

      const updated = await ProfileModel.updateOne({ ownerUid: targetUid }, { $set: changeSet }, { session });
      if (updated.matchedCount !== 1) throw new Error('provider_profile_not_found');
    });
  } finally {
    await session.endSession();
  }
  return { ok: true, fieldDiff, action: { ... } };
}
```

**Excerpt — lazy-model helper (from `service.js:307-320`, the `getProfileModel` pattern Phase 8's `getVehicleModels` MUST mirror):**
```js
const PROFILE_MODEL_BY_ROLE = { broker: 'Broker', logistics: 'LogisticsPartner' };

function getProfileModel(role) {
  const modelName = PROFILE_MODEL_BY_ROLE[role];
  if (!modelName) throw new Error('invalid_role_for_delete');
  // Lazy lookup — server.js registers these at app boot. In test runtime the test
  // file registers loose-schema variants under the canonical names BEFORE require'ing
  // service.js, so this resolves to the test seed model.
  return mongoose.model(modelName);
}
```

**Diffs from analog (per-handler renaming + listing-specific adaptations):**

| Concern | v1.0 user-mod | Phase 8 listing-mod |
|---------|---------------|---------------------|
| Domain primary key | `User.firebaseUid` (string param) | `Car._id` (string param `carId`) |
| Read query | `User.findOne({ firebaseUid })` | `Car.findById(carId).setOptions({ includeAllListingStatuses: true })` ← MUST chain this (Pitfall 5) |
| Mutation | `User.updateOne({ firebaseUid })` | `Car.updateOne({ _id: carId })` |
| Audit collection | `ModerationAction` | `ListingModerationAction` |
| Audit row fields | `{ targetUid, ..., severity, ... }` | `{ listingId, sellerUid, ..., fromStatus, toStatus, ... }` (severity REMOVED; fromStatus/toStatus ADDED — verified ListingModerationAction.js:58-67) |
| Error class | `new Error('code')` matched on `err.message` | `class ListingServiceError { code }` matched on `err.code` (D-12 cleanup) |
| Reason taxonomy | 4 values (`spam`, `policy_violation`, `fraud`, `other`) — schemas.js:11 | 5 values (adds `inactive_seller`) — derive from `Car.schema.path('moderationReason').enumValues` |
| Same-state check | `target.moderationStatus.state === severity` → `already_at_severity` | `current.status === target` → `already_in_state` (D-B-1); Restore-on-active → `not_moderated` (D-03 / Pitfall 10) |
| Last-admin guard | YES (suspend only, service.js:82-99) | NONE — listings have no admin-protected analog |
| Lazy-model helper | `getProfileModel(role)` → `mongoose.model('Broker'|'LogisticsPartner')` | `getVehicleModels()` → `mongoose.model('VehicleMake'|'VehicleModel')` (RESEARCH.md Pitfall 7) — same lazy pattern, different model names |
| Edit fieldDiff stamp | NO Car-level "lastEditedBy" — v1.0 has no field-level audit stamps on the User doc | YES — `Car.lastEditedBy`/`lastEditedAt` MUST be stamped on Edit only (D-A-3); Suspend/Archive/Delete/Restore stamp `moderatedBy`/`moderatedAt` (D-15, D-C-2) |
| Image multipart | None — v1.0 editProfile is JSON-only | Edit handler receives `uploadedFiles` array; reuses seller-PUT image diff shape (see Pattern Assignment 13 for excerpt) |
| Return shape | `{ ok, user: {moderationStatus}, action: {_id, action, createdAt} }` | `{ ok, listing: {_id, status, moderatedBy, moderatedAt, lastEditedBy?, lastEditedAt?}, action: {_id, action, fromStatus, toStatus, createdAt} }` (D-02) |

**Lines to read first (executor):**
- `src/moderation/service.js:1-21` (top-of-file comment block — copy verbatim with rename)
- `src/moderation/service.js:42-134` (suspend — canonical transition shape)
- `src/moderation/service.js:147-207` (unsuspend — canonical restore shape)
- `src/moderation/service.js:307-320` (getProfileModel — lazy-model pattern for VehicleMake/Model)
- `src/moderation/service.js:438-530` (editProfile — fieldDiff/changeSet shape)
- `src/models/Car.js:46-52` (status + moderation fields available)
- `src/models/ListingModerationAction.js:38-83` (audit row field set)
- `server.js:778-796` (seller-PUT image-diff + makeId/modelId validation — Edit handler will mirror)

---

### 3. `src/moderation/listingSchemas.js` (NEW)

**Role:** Validation module. Exports 5 Zod schemas (`suspendListingSchema`, `archiveListingSchema`, `deleteListingSchema`, `restoreListingSchema`, `editListingSchema`) + `reasonCategoryEnum` for downstream test reuse.

**Data flow:** Required at `listingRouter.js` top-of-file. Each handler calls `<schema>.safeParse(req.body)` before service dispatch.

**Closest analog:** `src/moderation/schemas.js` — same `.strict()` + enum-from-Mongoose-source-of-truth pattern.

**Excerpt to mirror verbatim — header + enum + noteField (from `schemas.js:1-16`):**
```js
// src/moderation/schemas.js
//
// Per-action Zod schemas for POST/PATCH/DELETE moderation endpoints.
// Every schema is .strict() (D-05 + D-35) — unknown top-level keys reject.
// Enum values mirror the Mongoose model enums so they cannot drift (D-35).

const { z } = require('zod');

const reasonCategoryEnum = z.enum(['spam', 'policy_violation', 'fraud', 'other']);
const severityEnum = z.enum(['feature_limited', 'blocked_with_review', 'permanently_banned']);
const noteField = z.string().max(2000).optional();
```

**Excerpt — per-action `.strict()` schema (from `schemas.js:36-45`):**
```js
const unsuspendSchema = z.object({
  note: noteField,
}).strict();

const deleteProfileSchema = z.object({
  role: roleEnumProfileDeletable,
  reasonCategory: reasonCategoryEnum,
  note: noteField,
}).strict();
```

**Diffs from analog:**

- Replace 4-value `reasonCategoryEnum` with 5-value DERIVED from Mongoose: `z.enum(Car.schema.path('moderationReason').enumValues)`. RESEARCH.md verified at runtime this returns `['spam','policy_violation','fraud','inactive_seller','other']`. Re-export the underlying array as `REASON_CATEGORIES` for test reuse (D-10).
- Remove `severityEnum`, `roleEnumAll`, `roleEnumProfileDeletable`, `dispatchSchema`, `revokeRoleSchema`, `editProfileBrokerFields`, `editProfileLogisticsFields`, `editProfileBrokerSchema`, `editProfileLogisticsSchema`, `editProfileSchema` — none of these have listing-domain analogs.
- Add five NEW per-action schemas with the LISTING-specific shapes (per D-09 + D-14 + D-C):
  - `suspendListingSchema = z.object({ reasonCategory, note: noteField }).strict()` — `reasonCategory` REQUIRED (D-14)
  - `archiveListingSchema = z.object({ reasonCategory, note: noteField }).strict()` — REQUIRED
  - `deleteListingSchema = z.object({ reasonCategory, note: noteField }).strict()` — REQUIRED
  - `restoreListingSchema = z.object({ note: noteField }).strict()` — NO `reasonCategory` (D-C)
  - `editListingSchema` — broad whitelist of ~24 fields per D-A. Permissive validators (`z.string().optional()`, `z.coerce.number().int().nonnegative().optional()`). EXACT field list in RESEARCH.md Pattern 4 (lines 371-398).
- NO `discriminatedUnion` (Phase 8's surface is 5 dedicated routes, not 1 dispatch route — v1.0 D-01 vs Phase 8 D-01).

**Source-of-truth for Edit field whitelist:** mirror the seller-PUT destructuring at `server.js:772-776` exactly, MINUS the excluded fields from CONTEXT.md D-A. The seller destructures into 23 fields; Edit allows the same 23 (+`existingImageUrls` for multipart) and rejects everything else via `.strict()`.

**Lines to read first (executor):**
- `src/moderation/schemas.js:1-95` (entire file — copy shape, replace per-action contents)
- `src/models/Car.js:46-47` (enum source of truth for `status` and `moderationReason`)
- `server.js:772-776` (seller-PUT field destructure — defines the Edit whitelist)

---

### 4. `src/moderation/denySelfModerationListing.js` (NEW middleware)

**Role:** Express middleware. Fetches Car by `req.params.carId`, rejects 400 if `car.sellerId === req.admin.uid`; 404 if not found.

**Data flow:** Mounts on each of the 5 PATCH routes in `listingRouter.js`, BEFORE the handler. Reads Car collection (cheap projection — `.select('sellerId')`). No writes.

**Closest analog:** `src/moderation/denySelfModeration.js` — same role, but v1.0 compares param-to-param (`req.params.targetUid === req.admin.uid`) while Phase 8 must FETCH the car to discover `sellerId` first (the listing's owner UID is not in the URL).

**Excerpt to mirror — full v1.0 middleware (from `denySelfModeration.js:14-33`):**
```js
function denySelfModeration(req, res, next) {
  const targetUid = req.params && req.params.targetUid;
  const adminUid = req.admin && req.admin.uid;

  // Defensive: if either is missing, fall through.
  if (!targetUid || !adminUid) {
    return next();
  }

  if (targetUid === adminUid) {
    // D-29: log-only, NOT ModerationAction.create. Audit ledger is for state changes.
    console.log(`[moderation] denied self-moderation attempt by ${adminUid} at ${new Date().toISOString()}`);
    return res.status(400).json({ error: 'cannot_moderate_self' });
  }

  return next();
}

module.exports = { denySelfModeration };
```

**Diffs from analog (per D-04 + Pitfall 5):**

| Concern | v1.0 | Phase 8 |
|---------|------|---------|
| Discovery of target owner | `req.params.targetUid` (the target's UID IS the URL param) | `Car.findById(req.params.carId).setOptions({ includeAllListingStatuses: true }).select('sellerId').lean()` |
| Sync vs async | sync function | `async` function (does a DB read) |
| Missing-target handling | `next()` (defensive — UID-equality only) | `return res.status(404).json({ error: 'listing_not_found' })` — D-04 explicitly: do NOT leak existence by always returning the self-mod code |
| Rejection code | `cannot_moderate_self` | `cannot_moderate_own_listing` (D-04) |
| Log message | `[moderation] denied self-moderation attempt by ${adminUid} at ${ts}` | `[listing-moderation] denied self-moderation attempt by ${adminUid} on listing ${carId} (sellerId=${car.sellerId}) at ${ts}` |
| Error handling | none needed (sync, no I/O) | wrap fetch in try/catch → 500 `internal_error` on unexpected DB failures |

**Critical: the fetch must NOT add `.where({ status: 'active' })` or any status filter** — Edit on a `suspended`/`archived`/`deleted` listing must pass the middleware (D-A-4 + Pitfall 8). Only the `includeAllListingStatuses` setOption.

**Lines to read first (executor):**
- `src/moderation/denySelfModeration.js:1-36` (entire file — shape to mirror)
- `src/models/Car.js:42` (`sellerId` field definition)
- `src/models/Car.js:63-95` (existing pre(/^find/) seller-cascade hook — confirms Car reads are already hook-aware; Phase 9 will add a parallel hook reading `includeAllListingStatuses`)

---

### 5. `src/moderation/listingErrors.js` (NEW — or inline at top of `listingService.js`)

**Role:** Error class. Discriminates client-fixable 400s from internal 500s by code.

**Data flow:** Constructed in `listingService.js`, caught in `listingRouter.js`'s `handleListingServiceError`, mapped to response codes via `KNOWN_LISTING_ERRORS` Set.

**Closest analog:** Two patterns coexist in the backend:

1. **v1.0 user-mod pattern** (`service.js` throughout) — plain `new Error('code')`, matched on `err.message`. Used 30+ times.
2. **Strong-typed class pattern** (`confirmBooking.js:31`):
   ```js
   class ProviderSuspendedError extends Error {
     constructor(providerUid, providerType) {
       super(`Provider ${providerUid} (${providerType}) is suspended`);
       this.name = 'ProviderSuspendedError';
       this.providerUid = providerUid;
       this.providerType = providerType;
     }
   }
   ```
3. **In-service helper** (`service.js:22-27`):
   ```js
   class NotImplementedError extends Error {
     constructor(method) {
       super(`ModerationService.${method} is not yet implemented (Phase 2)`);
       this.name = 'NotImplementedError';
     }
   }
   ```

**Excerpt to write (per CONTEXT.md D-12, matches the `confirmBooking.js` shape):**
```js
class ListingServiceError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ListingServiceError';
    this.code = code;
  }
}

module.exports = { ListingServiceError };
```

**Diffs from analog:**
- Adds `.code` field (D-12 cleanup over v1.0's `err.message` matching — RESEARCH.md State of the Art row 1).
- For Edit's `invalid_field` case, the service ALSO attaches `err.fields = unknownFields` (mirroring `service.js:451-454`); `handleListingServiceError` surfaces it in the 400 body.

**Decision (per CONTEXT.md `## Claude's Discretion`):** Phase 8 SHOULD commit to the class pattern over v1.0's string-error pattern. RESEARCH.md Recommendation in Open Question 2 says so explicitly. The `handleListingServiceError` function MUST read `err.code` first, with `err.message` fallback for defensive compat.

**Inline vs. separate file:** RESEARCH.md is ambivalent. Inline-at-top-of-`listingService.js` saves 1 file; separate file makes the test imports cleaner. The CONTEXT.md `<code_context>` § Integration Points line "or inline at top of listingService.js" leaves it to executor discretion.

**Lines to read first (executor):**
- `src/payments/confirmBooking.js:31-40` (canonical `class XError extends Error { code }` shape)
- `src/moderation/service.js:22-27` (in-file class pattern — alternative location)
- `src/moderation/service.js:451-454` (the `err.fields` attachment pattern Phase 8 Edit must mirror)

---

### 6. `__tests__/listing-moderation/listingSchemas.test.js` (NEW)

**Role:** Unit test for Zod schemas. No DB.

**Data flow:** Imports schemas, calls `safeParse`, asserts on `.success` + `.error.issues`.

**Closest analog:** `__tests__/moderation/schemas.test.js` — exact role match. Uses NO Mongo (verified — `grep -c MongoMemoryReplSet ... = 0`).

**Excerpt to mirror — happy-path + strict-mode + enum-rejection (from `schemas.test.js:14-54`):**
```js
describe('suspendSchema', () => {
  test('accepts well-formed suspend body', () => {
    const res = suspendSchema.safeParse({
      action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam', note: 'testing',
    });
    expect(res.success).toBe(true);
  });

  test('rejects unknown top-level key (strict mode)', () => {
    const res = suspendSchema.safeParse({
      action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam', foo: 'bar',
    });
    expect(res.success).toBe(false);
    expect(res.error.issues.some(i => i.code === 'unrecognized_keys')).toBe(true);
  });

  test('rejects severity not in enum', () => {
    const res = suspendSchema.safeParse({
      action: 'suspend', severity: 'warning', reasonCategory: 'spam',
    });
    expect(res.success).toBe(false);
  });

  test('rejects note longer than 2000 chars', () => {
    const res = suspendSchema.safeParse({
      action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam',
      note: 'x'.repeat(2001),
    });
    expect(res.success).toBe(false);
  });
});
```

**Diffs from analog:**
- 5 `describe(...)` blocks instead of 8 (one per Phase 8 schema; no dispatch / revoke / editProfile blocks).
- ADD test: `reasonCategoryEnum` derivation matches `Car.schema.path('moderationReason').enumValues` (D-10 enum-drift lock). Mirror by `expect(z.enum(Car.schema.path('moderationReason').enumValues).options).toEqual(['spam','policy_violation','fraud','inactive_seller','other'])`.
- ADD test: `restoreListingSchema` rejects `reasonCategory` as unknown key (D-C symmetry).
- For Edit: assert `.strict()` rejects unknown field (`{ foo: 'bar' }` → fail with `unrecognized_keys` code carrying the offending key list).
- For Edit: assert permissive validators — `{ price: '12000' }` (string from multipart) coerces to number 12000.

**Lines to read first (executor):**
- `__tests__/moderation/schemas.test.js:1-100` (entire file — copy shape, replace per-schema contents)
- `src/moderation/listingSchemas.js` (post-implementation — assertion target)
- `src/models/Car.js:46-47` (enum source of truth)

---

### 7. `__tests__/listing-moderation/denySelfModerationListing.test.js` (NEW)

**Role:** Middleware unit test. Mounts the middleware on a minimal Express app, asserts on the response.

**Data flow:** `supertest` against a minimal app. UNLIKE v1.0's denySelfModeration test, this one DOES need Mongo (the middleware fetches Car.sellerId). Use plain `MongoMemoryServer` — no transactions, so no replica-set needed.

**Closest analog:** `__tests__/moderation/denySelfModeration.test.js` — exact shape for the supertest harness; divergence is the DB requirement.

**Excerpt to mirror — minimal Express harness (from `denySelfModeration.test.js:6-18`):**
```js
function appWith(req_admin_uid) {
  const app = express();
  app.use(express.json());
  // Inject fake req.admin (simulating requireAdmin output).
  app.use((req, res, next) => {
    req.admin = { uid: req_admin_uid, email: 'admin@test.local', role: 'admin' };
    next();
  });
  app.post('/:targetUid', denySelfModeration, (req, res) => {
    res.json({ passed: true, targetUid: req.params.targetUid });
  });
  return app;
}
```

**Excerpt — console-log assertion (from `denySelfModeration.test.js:55-62`):**
```js
test('rejected attempt logs to console with admin uid', async () => {
  const app = appWith('admin-uid-42');
  await request(app).post('/admin-uid-42').send({ action: 'suspend' });
  expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  const loggedMessage = consoleLogSpy.mock.calls[0][0];
  expect(loggedMessage).toMatch(/\[moderation\] denied self-moderation attempt by admin-uid-42 at \d{4}-\d{2}-\d{2}T/);
});
```

**Diffs from analog:**
- ADD `beforeAll`/`afterAll` for plain `MongoMemoryServer.create()` (NOT the replica-set helper — see Pitfall 6).
- ADD `beforeEach` that seeds 1-2 Car documents directly via `Car.collection.insertOne(...)` (mirroring `editProfile.test.js:54-57`).
- The route becomes `app.patch('/:carId', ...)` (param name + verb match Phase 8 routes).
- Three NEW test cases on top of v1.0's three:
  1. `car.sellerId === admin.uid` → 400 `{ error: 'cannot_moderate_own_listing' }`
  2. `car.sellerId !== admin.uid` → handler runs (next called)
  3. Car not found → 404 `{ error: 'listing_not_found' }` (D-04 do-not-leak-existence)
- Console-warn assertion regex updated to `/\[listing-moderation\] denied self-moderation attempt by admin-uid-42 on listing .* \(sellerId=admin-uid-42\) at \d{4}-\d{2}-\d{2}T/` (RESEARCH.md Pattern 5).
- Optional: assert the middleware does NOT write to `ListingModerationAction` (D-05 / Pitfall — verify count is 0 after a rejection).

**Lines to read first (executor):**
- `__tests__/moderation/denySelfModeration.test.js:1-63` (entire file)
- `__tests__/moderation/editProfile.test.js:54-57` (direct-insert Car-equivalent pattern via `.collection.insertOne`)
- `src/moderation/denySelfModerationListing.js` (post-implementation target)

---

### 8. `__tests__/listing-moderation/listingTransaction.atomicity.test.js` (NEW)

**Role:** Integration test. Stubs `ListingModerationAction.create` or `Car.updateOne` to throw mid-flight; asserts rollback.

**Data flow:** Uses replica-set fixture. Seeds Car + admin. Spies/mocks one of the two transactional writes to throw. Asserts no audit row landed AND `Car.status` was not changed (or vice versa).

**Closest analog:** No dedicated v1.0 atomicity test exists. The IDIOM lives in `suspend.test.js:114-141` (the last-admin-protected test) — the middle of the transaction throws, and the test then asserts `User.moderationStatus.state` is unchanged AND `audits.length === 0`. This is the canonical "abort-mid-txn → both writes rolled back" assertion shape.

**Excerpt — canonical rollback assertion (from `suspend.test.js:131-141`):**
```js
await expect(service.suspend({
  adminUid: 'admin-a-uid', adminEmail: 'admin-a@test.local',
  targetUid: 'admin-b-uid', severity: 'blocked_with_review', reasonCategory: 'fraud',
})).rejects.toThrow('last_admin_protected');

const b = await User.findOne({ firebaseUid: 'admin-b-uid' }).lean();
expect(b.moderationStatus.state).toBe('active');                  // unchanged
const audits = await ModerationAction.find({ targetUid: 'admin-b-uid' }).lean();
expect(audits.length).toBe(0);                                     // transaction aborted — no audit row left behind
```

**Diffs from analog (Phase 8 atomicity test):**
- Uses replica-set helper (`startReplSet` / `stopReplSet`).
- Test 1 — audit-then-throw: monkey-patch `Car.updateOne` (e.g., via `jest.spyOn(Car, 'updateOne').mockImplementationOnce(() => { throw new Error('simulated DB failure'); })`); call `service.suspendListing(...)`; assert `Car.findById(carId)` still has `status: 'active'` AND `ListingModerationAction.countDocuments({ listingId: carId })` is 0 (audit insert rolled back).
- Test 2 — Car-update-then-throw: same shape, monkey-patch `ListingModerationAction.create`; assert `Car.status` did NOT change AND no audit row exists.
- Optional Test 3 — happy path, no monkey-patch: assert BOTH writes landed (positive control to prove the test harness works).

**Lines to read first (executor):**
- `__tests__/moderation/suspend.test.js:114-141` (last-admin abort — canonical rollback assertion)
- `src/moderation/service.js:64-123` (the transactional shape being aborted)
- `src/moderation/listingService.js` (post-implementation target — the service-layer functions being exercised)

---

### 9. `__tests__/listing-moderation/suspendListing.test.js` (NEW)

**Role:** Service-level integration test for `suspendListing`. Replica-set fixture. Covers happy path + cross-state + same-state-rejection + reason-required.

**Closest analog:** `__tests__/moderation/suspend.test.js` — near-identical shape.

**Excerpt — beforeAll/afterAll + beforeEach + happy path (from `suspend.test.js:7-67`):**
```js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
const service = require('../../src/moderation/service');
const User = require('../../src/models/User');
const AdminUser = require('../../src/models/AdminUser');
const ModerationAction = require('../../src/models/ModerationAction');

let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });

beforeEach(async () => {
  await User.deleteMany({});
  await AdminUser.deleteMany({});
  try { await ModerationAction.collection.drop(); } catch (_) { /* collection doesn't exist yet — ignore */ }
});

describe('service.suspend (...)', () => {
  test('happy path: inserts audit row and updates User.moderationStatus atomically', async () => {
    await AdminUser.create({ email: 'admin@test.local', role: 'admin' });
    await User.create({ firebaseUid: 'admin-uid', email: 'admin@test.local' });
    await User.create({ firebaseUid: 'target-1', email: 'target@test.local' });

    const result = await service.suspend({ ... });

    expect(result.ok).toBe(true);
    expect(result.user.moderationStatus.state).toBe('feature_limited');
    // ... full audit-row + User-doc assertions
  });
});
```

**Excerpt — same-state rejection (from `suspend.test.js:95-112`):**
```js
test('re-suspend at identical severity: throws already_at_severity, no state change', async () => {
  // ... seed ...
  await service.suspend({ ... });
  await expect(service.suspend({ /* same severity */ })).rejects.toThrow('already_at_severity');
  const audits = await ModerationAction.find({ targetUid: 'target-1' }).lean();
  expect(audits.length).toBe(1); // only the original, no duplicate
});
```

**Diffs from analog (per D-16 catalog):**
- Replace `User` + `ModerationAction` with `Car` + `ListingModerationAction`.
- Seed via `Car.collection.insertOne({ _id: 'car-1', sellerId: 'seller-x', status: 'active', ... })` (NOT `Car.create({...})` — avoid invoking Phase 9's future hide hook on test seeds; mirrors editProfile.test.js:54-57 pattern).
- 5 tests per D-16:
  1. **happy path active→suspended:** assert audit row has `action='suspend'`, `fromStatus='active'`, `toStatus='suspended'`, `reasonCategory='spam'`; assert Car has `status='suspended'`, `moderationReason='spam'`, `moderatedBy=adminUid`, `moderatedAt instanceof Date`.
  2. **same-state rejection:** `suspended → suspend` throws `already_in_state`; `audits.length === 1` (no duplicate).
  3. **cross-state OK (D-B open matrix):** `archived → suspend` OK; `deleted → suspend` OK; both write a new audit row with the correct fromStatus.
  4. **reason category required:** calling `suspendListing` without `reasonCategory` throws (service-layer required-arg check mirroring `service.js:43-44`).
  5. **self-moderation rejected:** (best tested via supertest harness mounting `denySelfModerationListing` + the route; OR call the middleware directly with a mocked Car.findById that returns `{sellerId: adminUid}` and assert the 400). Phase 8 D-04 + D-16 says cover both layers.

**Lines to read first (executor):**
- `__tests__/moderation/suspend.test.js:1-164` (entire file — copy shape)
- `__tests__/moderation/editProfile.test.js:19-26` (lazy-model registration dance for VehicleMake/VehicleModel — Phase 8 suspend test does NOT need it; Edit test does)
- `src/moderation/listingService.js` (post-implementation target)
- `src/models/ListingModerationAction.js:38-83` (audit row field assertions)

---

### 10. `__tests__/listing-moderation/archiveListing.test.js` (NEW)

**Role:** Service-level integration test for `archiveListing`.

**Closest analog:** `__tests__/moderation/suspend.test.js` (same shape — Archive is structurally identical to Suspend, only the target status + action verb differ).

**Excerpt:** Same as suspend.test.js, with `'suspended'` replaced by `'archived'` throughout and `action: 'archive'` in audit-row assertions.

**Diffs from analog (per D-16):**
- Replace fixture seed status + assertion target with `'archived'`.
- 3 tests per D-16:
  1. **happy path active→archived:** assert audit row `action='archive'`, `fromStatus='active'`, `toStatus='archived'`; Car has `status='archived'`.
  2. **cross-state suspended→archived OK:** D-B open matrix; assert audit row `fromStatus='suspended'`.
  3. **self-moderation rejected:** as in suspendListing.test.js.

**Lines to read first (executor):**
- `__tests__/listing-moderation/suspendListing.test.js` (sibling — copy + s/suspend/archive/)
- `__tests__/moderation/suspend.test.js:1-164`

---

### 11. `__tests__/listing-moderation/deleteListing.test.js` (NEW)

**Role:** Service-level integration test for `deleteListing`. Critical invariant: doc remains in DB (soft-delete).

**Closest analog:** Two analogs:
1. `__tests__/moderation/suspend.test.js` — for the transition + audit assertions shape.
2. `__tests__/moderation/deleteProviderProfile.test.js:78-99` — for the doc-survival pattern, BUT INVERTED (v1.0 hard-deletes; Phase 8 soft-deletes, so Phase 8 asserts the OPPOSITE invariant from v1.0).

**Excerpt to invert — v1.0's hard-delete assertion (from `deleteProviderProfile.test.js:82-83`):**
```js
const brokerDoc = await Broker.findOne({ ownerUid: 'broker-1' }).lean();
expect(brokerDoc).toBeNull(); // hard-deleted
```

**Phase 8's soft-delete inverted assertion (LADM-04):**
```js
// Doc MUST still exist after soft-delete (RESEARCH.md LADM-04 row + Phase Requirements table).
const carDocCount = await Car.countDocuments({ _id: carId });
expect(carDocCount).toBe(1);

const carDoc = await Car.findById(carId).setOptions({ includeAllListingStatuses: true }).lean();
expect(carDoc).not.toBeNull();
expect(carDoc.status).toBe('deleted');
```

**Diffs from analog (per D-16):**
- 3 tests per D-16:
  1. **happy path active→deleted:** assert audit row `action='delete'`, `toStatus='deleted'`; Car has `status='deleted'` AND DOC STILL EXISTS (`countDocuments === 1`).
  2. **cross-state archived→deleted OK:** D-B; assert audit row `fromStatus='archived'`.
  3. **self-moderation rejected.**

**Lines to read first (executor):**
- `__tests__/listing-moderation/suspendListing.test.js` (sibling — same shape, different verb)
- `__tests__/moderation/deleteProviderProfile.test.js:55-100` (INVERTED — v1.0 asserts doc gone; Phase 8 asserts doc persists)

---

### 12. `__tests__/listing-moderation/restoreListing.test.js` (NEW)

**Role:** Service-level integration test for `restoreListing`. Critical: from `suspended`/`archived`/`deleted` → `active`; clears moderation fields; audit row `reasonCategory: null`.

**Closest analog:** `__tests__/moderation/unsuspend.test.js` — exact shape match for the inverse-transition pattern.

**Excerpt — happy path + reason-cleared assertions (from `unsuspend.test.js:33-69`):**
```js
test('happy path: suspended → active, new audit row with action=unsuspend severity=none', async () => {
  await AdminUser.create({ email: 'admin@test.local', role: 'admin' });
  await User.create({ firebaseUid: 'admin-uid', email: 'admin@test.local' });
  await User.create({
    firebaseUid: 'target-1', email: 'target@test.local',
    moderationStatus: {
      state: 'blocked_with_review', severity: 'blocked_with_review',
      reasonCategory: 'fraud', note: 'some prior note',
      setByAdminUid: 'admin-uid', setAt: new Date(),
      restrictedFeatures: ['all_writes'],
    },
  });

  const result = await service.unsuspend({
    adminUid: 'admin-uid', adminEmail: 'admin@test.local',
    targetUid: 'target-1', note: 'appealed successfully',
  });

  expect(result.user.moderationStatus.state).toBe('active');
  expect(result.user.moderationStatus.reasonCategory).toBeNull();  // CLEARED
  expect(result.user.moderationStatus.note).toBeNull();             // CLEARED
  expect(result.user.moderationStatus.restrictedFeatures).toEqual([]);

  const audit = await ModerationAction.findOne({ targetUid: 'target-1' }).lean();
  expect(audit.action).toBe('unsuspend');
  expect(audit.severity).toBe('none');  // analog to Phase 8's reasonCategory=null
});
```

**Excerpt — not-suspended rejection (from `unsuspend.test.js:71-79`):**
```js
test('not_suspended: unsuspend on already-active user throws not_suspended', async () => {
  // ... seed active user ...
  await expect(service.unsuspend({ ... })).rejects.toThrow('not_suspended');
});
```

**Diffs from analog (per D-16, D-C, D-C-1, D-C-2):**
- 4+ tests per D-16:
  1. **happy paths × 3 starting states:** `suspended → active`, `archived → active`, `deleted → active`. For each, assert:
     - Car.status === 'active'
     - Car.moderationReason === null (CLEARED per D-C-1)
     - Car.moderationNote === null (CLEARED per D-C-1)
     - Car.moderatedBy === adminUid (UPDATED per D-C-2 — Restore IS a state change)
     - Car.moderatedAt is a fresh Date
     - audit row: `action='restore'`, `fromStatus={prior}`, `toStatus='active'`, `reasonCategory: null` (D-C)
  2. **not_moderated on already-active:** D-03 + Pitfall 10 — Restore on `status='active'` throws `not_moderated` (NOT `already_in_state`). Audit row count 0 after.
  3. **self-moderation rejected:** Admin cannot restore their own listing (D-04 applies even on Restore).

**Lines to read first (executor):**
- `__tests__/moderation/unsuspend.test.js:1-80+` (entire file — copy shape)
- `src/moderation/listingService.js` `restoreListing` (post-implementation)
- 08-CONTEXT.md D-C / D-C-1 / D-C-2 / D-03 (`not_moderated` distinction)

---

### 13. `__tests__/listing-moderation/editListing.test.js` (NEW)

**Role:** Service-level integration test for `editListing`. Heaviest test in Phase 8 — covers fieldDiff shape, image diff, multiple-status starting states, makeId/modelId validation.

**Closest analog:** Composite:
1. `__tests__/moderation/editProfile.test.js` — for fieldDiff structure + lazy-model registration dance.
2. `server.js:763-845` (seller PUT) — for the image multipart shape (the executor mirrors this in test seed + assertions).

**Excerpt — lazy-model registration dance (from `editProfile.test.js:16-26`):**
```js
const mongoose = require('mongoose');
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');

if (!mongoose.models.Broker) {
  mongoose.model('Broker', new mongoose.Schema({}, { strict: false, collection: 'brokers' }));
}
if (!mongoose.models.LogisticsPartner) {
  mongoose.model('LogisticsPartner', new mongoose.Schema({}, { strict: false, collection: 'logistics_partners' }));
}
const Broker = mongoose.model('Broker');
const LogisticsPartner = mongoose.model('LogisticsPartner');

const service = require('../../src/moderation/service');
```

**Phase 8 mirror (for VehicleMake / VehicleModel per Pitfall 7):**
```js
if (!mongoose.models.VehicleMake) {
  mongoose.model('VehicleMake', new mongoose.Schema({}, { strict: false, collection: 'vehicle_makes' }));
}
if (!mongoose.models.VehicleModel) {
  mongoose.model('VehicleModel', new mongoose.Schema({}, { strict: false, collection: 'vehicle_models' }));
}
```

**Excerpt — fieldDiff happy-path (from `editProfile.test.js:51-79`):**
```js
test('broker single-field change: fieldDiff has one entry, Broker updated, others untouched', async () => {
  await seedActor();
  await User.create({ firebaseUid: 'b-1', email: 'b@test.local', brokerStatus: 'APPROVED' });
  await Broker.collection.insertOne({
    ownerUid: 'b-1', companyName: 'Old', phoneNumber: '+111', telegramUsername: 'old_handle',
    description: 'untouched', status: 'active', createdAt: new Date(),
  });

  const result = await service.editProfile({
    adminUid: 'admin-uid', adminEmail: 'admin@test.local',
    targetUid: 'b-1', role: 'broker',
    fields: { companyName: 'New' },
  });

  expect(result.fieldDiff).toEqual({ companyName: { before: 'Old', after: 'New' } });

  const updatedBroker = await Broker.findOne({ ownerUid: 'b-1' }).lean();
  expect(updatedBroker.companyName).toBe('New');
  expect(updatedBroker.phoneNumber).toBe('+111');             // untouched (not in submission)

  const audit = await ModerationAction.findOne({ targetUid: 'b-1' }).lean();
  expect(audit.action).toBe('edit_profile');
  expect(audit.fieldDiff.companyName).toEqual({ before: 'Old', after: 'New' });
});
```

**Excerpt — image-handling shape from seller-PUT (from `server.js:778-785`, must be mirrored in Edit service AND tested here):**
```js
let imageUrls = car.imageUrls || [];
if (existingImageUrls) {
  try { imageUrls = JSON.parse(existingImageUrls); } catch (e) {}
}
const newUrls = req.files ? req.files.map(f => f.location) : [];
imageUrls = [...imageUrls, ...newUrls];
```

**Diffs from analog (per D-16 + D-A-2 + D-A-4 + D-D-3):**
- Replace Broker/LogisticsPartner with Car; replace User-role-precheck with Car-status-any-allowed (D-A-4 — Edit valid on any status).
- Phase 8 test cases per D-16:
  1. **single-field text edit:** `fields: { price: 11500 }` on Car with `price: 12000` → `fieldDiff = { price: { before: 12000, after: 11500 } }`; Car.price === 11500; OTHER fields untouched; `Car.lastEditedBy === adminUid` (D-A-3); `Car.moderatedBy` NOT touched (D-A-3).
  2. **multi-field edit:** 3+ fields change; fieldDiff has all 3 entries.
  3. **image-add:** `existingImageUrls: JSON.stringify(['s3://a'])` + `uploadedFiles: [{location: 's3://b'}]` → fieldDiff.imageUrls = `{ before: ['s3://a'], after: ['s3://a','s3://b'] }` (D-A-2 example).
  4. **image-remove:** existing `['a','b']`, submitted `['a']`, no new → after `['a']`.
  5. **image-reorder:** existing `['a','b']`, submitted `['b','a']` → after `['b','a']`; fieldDiff present (order changed).
  6. **unknown field → 400 `invalid_field`** with `err.fields` = `['frobnicate']` (mirrors editProfile.test.js's invalid_field test pattern).
  7. **empty diff → 400 `no_changes`** (mirrors `editProfile.test.js`'s no_changes test): submit `{ price: <currentPrice> }` → no fieldDiff entry → throw.
  8. **works on suspended listing (D-A-4):** seed Car with `status: 'suspended'`; Edit succeeds; audit row has `fromStatus='suspended'`, `toStatus='suspended'` (= current status; D-A-4), `action='edit'`.
  9. **works on archived listing.**
  10. **works on deleted listing.**
  11. **makeId/modelId validation OK:** seed VehicleMake + VehicleModel; submit valid IDs → Car updated, makeName/modelName re-resolved.
  12. **invalid makeId → 400 `invalid_make`:** mirrors `server.js:788-789` seller PUT.
  13. **invalid modelId → 400 `invalid_model`:** mirrors `server.js:790-791`.

**Lines to read first (executor):**
- `__tests__/moderation/editProfile.test.js:1-130+` (entire file — fieldDiff shape + lazy-model dance)
- `server.js:763-845` (seller-PUT — image multipart + makeId/modelId validation source)
- `08-CONTEXT.md` D-A / D-A-2 / D-A-3 / D-A-4 / D-D / D-D-3
- `src/moderation/listingService.js` `editListing` (post-implementation)

---

### 14. `src/moderation/listingRouter.js` (MODIFY)

**Role:** Express router. CURRENTLY 29 lines with only `/ping`. AFTER Phase 8: adds 5 `router.patch(...)` blocks + 4-5 new requires + `KNOWN_LISTING_ERRORS` Set + `handleListingServiceError` function.

**Data flow:** Mounted at `server.js:854` behind `verifyIdToken → requireAdmin → listingModerationRateLimiter`. Routes dispatch to `listingService` functions; errors funnel through `handleListingServiceError`.

**Closest analog:** `src/moderation/router.js` — exact shape match. The KNOWN_USER_ERRORS Set + handleServiceError function + per-route Zod-parse-then-service-call pattern transfers verbatim with renaming.

**Excerpt — KNOWN_USER_ERRORS + handleServiceError (from `router.js:55-84`):**
```js
// Service errors this module translates to user-facing 400 responses.
// Anything not in this set bubbles up as 500 internal_error.
const KNOWN_USER_ERRORS = new Set([
  'already_at_severity',       // Plan 02-03
  'not_suspended',             // Plan 02-03
  'last_admin_protected',      // Plan 02-03
  'target_not_found',          // Plan 02-03 (+ others)
  'role_not_assigned',         // Plan 02-04 / 02-05
  'invalid_field',             // Plan 02-05 (edit-profile)
  'no_changes',                // Plan 02-05 (edit-profile)
  'invalid_role_for_delete',   // Plan 02-05
  'provider_profile_not_found', // Plan 02-05 (delete-provider-profile)
]);

function handleServiceError(err, res, tag) {
  if (KNOWN_USER_ERRORS.has(err.message)) {
    const body = { error: err.message };
    // D-05 enrichment: when service throws invalid_field with err.fields attached,
    // surface the offending field names so the mobile UI can name them.
    if (err.message === 'invalid_field' && Array.isArray(err.fields)) {
      body.fields = err.fields;
    }
    return res.status(400).json(body);
  }
  console.error(`[moderation] ${tag} error:`, err);
  return res.status(500).json({ error: 'internal_error', message: err.message });
}
```

**Excerpt — single-handler pattern (from `router.js:132-148`, unsuspend):**
```js
router.patch('/:targetUid/unsuspend', denySelfModeration, async (req, res) => {
  const parsed = unsuspendSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parsed.error.issues });
  }
  try {
    const result = await service.unsuspend({
      adminUid: req.admin.uid,
      adminEmail: req.admin.email,
      targetUid: req.params.targetUid,
      note: parsed.data.note,
    });
    return res.json(result);
  } catch (err) {
    return handleServiceError(err, res, 'unsuspend');
  }
});
```

**Excerpt — Zod unknown-key → invalid_field translation (from `router.js:183-198`, edit-profile):**
```js
router.post('/:targetUid/edit-profile', denySelfModeration, async (req, res) => {
  const parsed = editProfileSchema.safeParse(req.body || {});
  if (!parsed.success) {
    // Zod .strict() surfaces unknown keys via the 'unrecognized_keys' issue code.
    // Convert to D-05 invalid_field shape so router-layer rejection is identical to service-layer.
    const issues = parsed.error.issues;
    const unknownIssue = issues.find((i) => i.code === 'unrecognized_keys');
    if (unknownIssue) {
      return res.status(400).json({
        error: 'invalid_field',
        fields: unknownIssue.keys || [],
      });
    }
    return res.status(400).json({ error: 'invalid_payload', issues });
  }
  // ... service call ...
});
```

**Diffs from analog:**

- **PRESERVE `/ping` route BYTE-IDENTICAL** (Pitfall 4 — Phase 7's rate-limit test in `__tests__/listing-moderation/listingModerationRateLimiter.test.js:50` requires this path to keep responding `{ ok: true }`).
- Replace KNOWN_USER_ERRORS with `KNOWN_LISTING_ERRORS` (D-03 + D-04):
  ```js
  const KNOWN_LISTING_ERRORS = new Set([
    'listing_not_found',
    'invalid_transition',         // forward-compat per D-B-2; v1.1 never emits
    'already_in_state',
    'not_moderated',
    'invalid_field',
    'no_changes',
    'invalid_payload',
    'cannot_moderate_own_listing', // from middleware
    'invalid_make',                // from VehicleMake.findOne in Edit
    'invalid_model',               // from VehicleModel.findOne in Edit
  ]);
  ```
- Rename `handleServiceError` → `handleListingServiceError`; tag string becomes `'[listing-moderation]'`.
- Switch error-discrimination from `err.message` to `err.code` (with `err.message` fallback for defensive compat) — D-12 + RESEARCH.md State of the Art.
- DO NOT mount `router.use(listingModerationRateLimiter)` — the limiter is mounted at app level in `server.js:854` (Phase 7 D-04 divergence from v1.0). Header comment in current `listingRouter.js:1-15` already explains this.
- 5 new route blocks BELOW `/ping`:
  - `router.patch('/:carId/suspend', denySelfModerationListing, async (req, res) => { ... })`
  - `router.patch('/:carId/archive', denySelfModerationListing, ...)` — same shape
  - `router.patch('/:carId/delete', denySelfModerationListing, ...)` — same shape
  - `router.patch('/:carId/restore', denySelfModerationListing, ...)` — note: no `reasonCategory` body field
  - `router.patch('/:carId', upload.array('images', 25), denySelfModerationListing, ...)` — MULTER ON THIS ROUTE ONLY (D-D-1); also includes the Zod-unknown-key → `invalid_field` translation from the edit-profile excerpt above
- DO NOT add a history GET endpoint — out of scope per CONTEXT.md `<deferred>` (`Listing-history GET endpoint`).
- DO NOT keep `dispatchSchema` / discriminatedUnion pattern from v1.0 — Phase 8 has 5 dedicated routes per D-01.

**Imports added (RESEARCH.md notes 4 new requires + 1 express = 5 total, intentionally breaking the Phase 7 "dependency-free" property per D-13):**
```js
const express = require('express');
const service = require('./listingService');
const schemas = require('./listingSchemas');
const { denySelfModerationListing } = require('./denySelfModerationListing');
const { upload } = require('../uploads/carImages');  // Pitfall 1 resolution
// Optional 5th: const { ListingServiceError } = require('./listingErrors');  // only if instanceof check needed; handleListingServiceError matches on err.code so this isn't required
```

**Lines to read first (executor):**
- `src/moderation/listingRouter.js:1-29` (current Phase 7 scaffold — preserve `/ping`)
- `src/moderation/router.js:55-84` (KNOWN_USER_ERRORS + handleServiceError — canonical shape)
- `src/moderation/router.js:132-148` (unsuspend handler — canonical Zod-then-service shape)
- `src/moderation/router.js:183-212` (editProfile handler — canonical unknown-key-rejection shape, mirror for Edit)
- `__tests__/listing-moderation/listingModerationRateLimiter.test.js:50` (regression test that hits `/ping` — proves preservation invariant)

---

### 15. `server.js` (MODIFY — minor)

**Role:** Bootstrap. Replace inline multer `upload` config with a require of the new `src/uploads/carImages.js` module.

**Data flow:** No behavior change. Same `upload` instance flows into the same seller `PUT /api/cars/:id` route at `server.js:763`. Phase 8's `listingRouter.js` ALSO requires the same module — single source of truth.

**Closest analog:** Self (current `server.js:43-64` is the source; the rewrite is purely an extraction).

**Diff (minimal — 2 changes only):**

- ADD `const { upload, s3 } = require('./src/uploads/carImages');` near the existing requires block (server.js top of file).
- REMOVE lines 43-64 (the `S3Client` constructor + the `multer({ storage: multerS3({...}) })` block). The seller-PUT consumer at line 763 still references `upload` — it now resolves to the imported one.
- DO NOT remove `uploadAvatar` (lines 66-78) — separate config, separate consumer (avatar upload route), not in Phase 8 scope.
- DO NOT change the mount line at `server.js:854` — already covers the 5 new endpoints (Phase 7 D-03).

**Critical preservation:** Behavior must be EXACTLY the same — same bucket, same region, same `key` function (folder-by-bodyType), same `metadata` function. Pre-Phase-8 seller PUT and post-Phase-8 seller PUT MUST produce identical S3 keys.

**Lines to read first (executor):**
- `server.js:1-78` (imports + S3/multer construction — full extraction-context)
- `server.js:763-845` (seller PUT consumer — confirms `upload.array('images', 25)` still resolves)
- `server.js:854` (Phase 7 mount — DO NOT TOUCH)

---

## Shared Patterns

### Pattern A: `session.withTransaction()` audit-then-target-update sequencing

**Source:** `src/moderation/service.js:64-123` (suspend), `:165-193` (unsuspend), `:248-282` (revokeRole), `:355-393` (deleteProviderProfile), `:485-518` (editProfile)

**Apply to:** ALL 5 service functions in `listingService.js` (Pattern Assignment 2).

**The pattern (verbatim from service.js — top-of-file comment lines 1-14 + suspend body 64-123):**
```js
// NOTE: We bypass actions.writeAction() inside transactions because writeAction
// calls ModerationAction.create(singleDoc) which cannot accept { session }. The
// array form (ModerationAction.create([doc], { session })) is required by Mongoose
// to pass options.

const session = await mongoose.startSession();
let insertedAction;
try {
  await session.withTransaction(async () => {
    // 1. Audit row FIRST. Array form mandatory.
    const [action] = await ListingModerationAction.create([{ /* fields */ }], { session });
    insertedAction = action;

    // 2. Target update.
    const updated = await Car.updateOne({ _id: carId }, { $set: { /* ... */ } }, { session });
    if (updated.matchedCount !== 1) throw new ListingServiceError('listing_not_found');
  });
} finally {
  await session.endSession();
}
```

**Gotcha (Pitfall 2 / RESEARCH.md):** `.create([doc], { session })` array form is MANDATORY. The single-doc form `.create(doc, { session })` silently ignores `{ session }` — Mongoose overload resolution treats arg 2 as another doc when arg 1 is not an array. Code-review grep: any `ListingModerationAction.create(` not followed by `[` → bug.

---

### Pattern B: KNOWN_*_ERRORS Set + handleServiceError discrimination

**Source:** `src/moderation/router.js:59-84`

**Apply to:** `listingRouter.js` (Pattern Assignment 14) — ship parallel `KNOWN_LISTING_ERRORS` Set + `handleListingServiceError` function. Do NOT extend the v1.0 set.

**The pattern:**
```js
const KNOWN_LISTING_ERRORS = new Set([ /* 10 codes per D-03 + D-04 */ ]);

function handleListingServiceError(err, res, tag) {
  const code = err.code || err.message;  // D-12: prefer err.code; fall back to err.message defensively
  if (KNOWN_LISTING_ERRORS.has(code)) {
    const body = { error: code };
    if (code === 'invalid_field' && Array.isArray(err.fields)) body.fields = err.fields;
    return res.status(400).json(body);
  }
  console.error(`[listing-moderation] ${tag} error:`, err);
  return res.status(500).json({ error: 'internal_error', message: err.message });
}
```

**Gotcha:** the order matters — `err.code` first, `err.message` fallback. v1.0 uses `err.message` only; switching defensively keeps Phase 8 forward-compatible with the cleaner D-12 class pattern without breaking if any defensive `new Error('code')` slips through.

---

### Pattern C: Zod `.strict()` schemas with enum derivation from Mongoose

**Source:** `src/moderation/schemas.js:11-95`

**Apply to:** `listingSchemas.js` (Pattern Assignment 3). All 5 schemas must chain `.strict()`. Enums derived from `Car.schema.path(...).enumValues` per D-10.

**The pattern:**
```js
const { z } = require('zod');
const Car = require('../models/Car');

// Source-of-truth lock: derive from Mongoose enum at module load (D-10).
const REASON_CATEGORIES = Car.schema.path('moderationReason').enumValues;
const reasonCategoryEnum = z.enum(REASON_CATEGORIES);

const noteField = z.string().max(2000).optional();

const suspendListingSchema = z.object({
  reasonCategory: reasonCategoryEnum,
  note: noteField,
}).strict();

// Re-export REASON_CATEGORIES for downstream test reuse (per D-10).
module.exports = { REASON_CATEGORIES, reasonCategoryEnum, suspendListingSchema, /* ... */ };
```

---

### Pattern D: `Car.findById` always with `setOptions({ includeAllListingStatuses: true })`

**Source:** CONTEXT.md D-B-3 + D-04; RESEARCH.md Pitfall 5

**Apply to:** EVERY `Car.findById(...)` call in Phase 8 files (`listingService.js`, `denySelfModerationListing.js`, all test seeds that go through `.findById`). Phase 7 has not landed the hide hook yet; Phase 9 will. Setting the option NOW means Phase 9 lands without retroactively touching Phase 8 code.

**The pattern:**
```js
const car = await Car.findById(carId)
  .setOptions({ includeAllListingStatuses: true })
  .select('sellerId')  // middleware uses a cheap projection
  .lean();
```

**Code-review check:** Grep for `Car.findById` in any Phase 8 file → all must chain `.setOptions({ includeAllListingStatuses: true })`. ZERO exceptions.

---

### Pattern E: Lazy `mongoose.model(...)` resolution for cross-file model lookups

**Source:** `src/moderation/service.js:307-320` (getProfileModel)

**Apply to:** `listingService.js` for `VehicleMake` / `VehicleModel` resolution in `editListing` (Pitfall 7 — these models are inlined in `server.js:99-100`, NOT in `src/models/`).

**The pattern:**
```js
function getVehicleModels() {
  return {
    VehicleMake: mongoose.model('VehicleMake'),
    VehicleModel: mongoose.model('VehicleModel'),
  };
}
```

**Why it works in tests:** server.js registers the canonical-name models at boot; in test runtime, the test file registers loose-schema variants under the canonical name BEFORE require'ing `listingService.js`. Either way, `mongoose.model('VehicleMake')` resolves to the right registration (RESEARCH.md Pattern 5 + editProfile.test.js:19-26 dance).

---

### Pattern F: Replica-set fixture for transaction tests; plain Mongo for non-transactional tests

**Source:** `__tests__/_helpers/mongoReplSet.js`; usage at `__tests__/moderation/suspend.test.js:7-21`

**Apply to:**
- USES replica-set: `suspendListing.test.js`, `archiveListing.test.js`, `deleteListing.test.js`, `restoreListing.test.js`, `editListing.test.js`, `listingTransaction.atomicity.test.js` (all 6 service-level tests that drive `withTransaction`).
- USES plain `MongoMemoryServer` (or no DB at all): `listingSchemas.test.js` (no DB needed — Zod runs in memory), `denySelfModerationListing.test.js` (needs Mongo for Car fetch, but the middleware does no transactions).

**The pattern (replica-set):**
```js
const { startReplSet, stopReplSet } = require('../_helpers/mongoReplSet');
let rs;
beforeAll(async () => { rs = await startReplSet(); });
afterAll(async () => { await stopReplSet(rs); });

beforeEach(async () => {
  await Car.deleteMany({});
  try { await ListingModerationAction.collection.drop(); } catch (_) { /* may not exist yet */ }
});
```

**Gotcha (Pitfall 6):** `MongoMemoryServer.create()` (standalone) cannot run transactions — Mongo rejects with "Transaction numbers are only allowed on a replica set member or mongos". Any txn-using test that imports `MongoMemoryServer` directly fails on the FIRST `withTransaction` call.

---

### Pattern G: Tests do NOT boot `server.js`; they build minimal Express apps OR call services directly

**Source:** CONTEXT.md D-17 + RESEARCH.md D-36

**Apply to:** ALL 8 Phase 8 test files.

**Two acceptable shapes:**
1. **Direct service call** (suspend/archive/delete/restore/edit/atomicity tests): `await service.suspendListing({...})` then assert on Mongo state.
2. **Minimal Express app for middleware** (denySelfModerationListing.test.js): assemble `express()`, inject fake `req.admin` via custom middleware, mount the middleware under test, use supertest.

**The pattern (Express harness from `denySelfModeration.test.js:6-18`):**
```js
function appWith(req_admin_uid) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.admin = { uid: req_admin_uid, email: 'admin@test.local' }; next(); });
  app.patch('/:carId', denySelfModerationListing, (req, res) => res.json({ passed: true }));
  return app;
}
```

---

## No Analog Found

(None — every Phase 8 file has a verified analog. The "extraction" cases — `src/uploads/carImages.js` and `server.js` modification — have the SOURCE as their own analog.)

---

## Metadata

**Analog search scope:** `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/` (sibling repo to `carEx`)
- `src/moderation/` — v1.0 user-mod + Phase 7 listing-mod substrate
- `src/models/` — Car, ListingModerationAction, User, AdminUser, ModerationAction
- `src/payments/` — confirmBooking (for ProviderSuspendedError class pattern)
- `server.js` — seller-PUT + S3/multer + VehicleMake/VehicleModel
- `__tests__/moderation/` — v1.0 user-mod tests (8 test files referenced)
- `__tests__/listing-moderation/` — Phase 7 test files (6 — PRESERVED)
- `__tests__/_helpers/mongoReplSet.js` — replica-set fixture

**Files scanned (Read with line refs):**
- `src/moderation/service.js` (lines 1-533 — full file)
- `src/moderation/router.js` (lines 1-263 — full file)
- `src/moderation/schemas.js` (lines 1-95 — full file)
- `src/moderation/denySelfModeration.js` (lines 1-36 — full file)
- `src/moderation/listingRouter.js` (lines 1-29 — full file, Phase 7 scaffold)
- `src/models/Car.js` (lines 1-97 — full file)
- `src/models/ListingModerationAction.js` (lines 1-107 — full file)
- `server.js` (lines 1-110 + 750-860 — bootstrap + seller PUT + mounts)
- `__tests__/moderation/suspend.test.js` (lines 1-164 — full file)
- `__tests__/moderation/unsuspend.test.js` (lines 1-80+)
- `__tests__/moderation/editProfile.test.js` (lines 1-130+)
- `__tests__/moderation/deleteProviderProfile.test.js` (lines 1-130+)
- `__tests__/moderation/denySelfModeration.test.js` (lines 1-63 — full file)
- `__tests__/moderation/schemas.test.js` (lines 1-100+)
- `__tests__/_helpers/mongoReplSet.js` (lines 1-36 — full file)
- `__tests__/listing-moderation/listingModerationRateLimiter.test.js` (lines 1-80 — for `/ping` regression context)

**Pattern extraction date:** 2026-05-28
**Phase:** 08-admin-listing-moderation-endpoints-backend
