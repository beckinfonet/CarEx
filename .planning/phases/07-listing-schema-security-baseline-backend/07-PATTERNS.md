# Phase 7: Listing Schema + Security Baseline (Backend) - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 14 (5 new + 3 modified + 6 new tests)
**Analogs found:** 14 / 14
**Repo note:** All analog paths live in the sibling backend repo at
`/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/`.
Paths below are written as `../backend-services/carEx-services/...` to match
how CONTEXT.md cites them and how the planner/executor will reference them
from this (mobile) repo.

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/models/ListingModerationAction.js` (NEW) | model (Mongoose schema, append-only audit) | event-sourced write-only | `../backend-services/carEx-services/src/models/ModerationAction.js` | exact (v1.0 sibling) |
| `src/moderation/listingRouter.js` (NEW) | router (Express) | request-response | `../backend-services/carEx-services/src/moderation/router.js` | structural (mount + /ping only) |
| `src/moderation/listingCapabilities.js` (NEW) | config module (state policy map) | pure lookup | `../backend-services/carEx-services/src/moderation/capabilities.js` | exact (v1.0 sibling) |
| `src/moderation/listingRateLimit.js` (NEW) | middleware-config (express-rate-limit factory) | request-response | `../backend-services/carEx-services/src/moderation/rateLimit.js` | exact (v1.0 sibling, different key prefix) |
| `scripts/migrate-listing-moderation.js` (NEW) | migration-script (one-off Node, idempotent) | batch | `../backend-services/carEx-services/scripts/migrate-moderation.js` | exact (v1.0 sibling) |
| `src/models/Car.js` (MODIFIED) | model (Mongoose schema, extend in place) | CRUD | `src/models/Car.js` itself (current file is the analog — extend, do not fork) | self / preserve |
| `src/security/ensureBaseline.js` (MODIFIED) | startup health check (extend in place) | one-shot | `src/security/ensureBaseline.js` itself (existing User check is the analog for shape) | self / extend |
| `server.js` (MODIFIED) | mount line | one-shot wiring | `server.js:851` existing user-mod mount line | exact |
| `__tests__/listing-moderation/ListingModerationAction.append-only.test.js` (NEW) | test (jest + mongodb-memory-server) | unit | `__tests__/moderation/ModerationAction.append-only.test.js` | exact (v1.0 sibling) |
| `__tests__/listing-moderation/listingCapabilities.test.js` (NEW) | test (jest, no DB needed but uses one for User-enum check) | unit | `__tests__/moderation/capabilities.test.js` | exact (v1.0 sibling) |
| `__tests__/listing-moderation/listingModerationRateLimiter.test.js` (NEW) | test (jest + supertest + minimal Express app) | integration | `__tests__/moderation/acceptance.test.js` lines 229–331 (BLOCK 3) | partial (only matching block; v1.0 has no standalone rate-limit test file) |
| `__tests__/listing-moderation/requireAdmin.listing.middleware.test.js` (NEW) | test (jest + supertest, mocks firebase-admin) | integration | `__tests__/moderation/requireAdmin.middleware.test.js` | exact (v1.0 sibling) |
| `__tests__/listing-moderation/Car.status-field.test.js` (NEW) | test (jest + mongodb-memory-server, schema-only) | unit | `__tests__/moderation/User.moderationStatus.test.js` | exact-shape (no `Car`-specific analog exists; User schema test is the template) |
| `__tests__/listing-moderation/migrate-listing-moderation.test.js` (NEW) | test (jest + mongodb-memory-server) | integration | `__tests__/moderation/migrate-moderation.test.js` | exact (v1.0 sibling) |

---

## Pattern Assignments

### 1. `src/models/ListingModerationAction.js` (model, append-only audit)

**Analog:** `../backend-services/carEx-services/src/models/ModerationAction.js`

**Why closest:** Same role (append-only audit collection), same data flow (write-only event log via `.create()`, all mutations/deletes blocked at app layer). D-09 deliberately spawns a sibling collection rather than extending this one — the file is the structural template to clone-and-modify.

**Full file excerpt (28 lines — clone whole shape):**
```js
// ../backend-services/carEx-services/src/models/ModerationAction.js (lines 1–27)
const mongoose = require('mongoose');

const moderationActionSchema = new mongoose.Schema({
  targetUid: { type: String, required: true },
  adminUid: { type: String, required: true },
  adminEmail: { type: String, required: true },
  action: { type: String, enum: ['suspend', 'unsuspend', 'revoke_role', 'delete_provider_profile', 'edit_profile'], required: true },
  severity: { type: String, enum: ['none', 'feature_limited', 'blocked_with_review', 'permanently_banned'], default: 'none' },
  reasonCategory: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'other'], default: null },
  note: { type: String, default: null, maxlength: 2000 },
  roleAffected: { type: String, enum: ['seller', 'broker', 'logistics', null], default: null },
  fieldDiff: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now, required: true },
});
moderationActionSchema.index({ targetUid: 1, createdAt: -1 });
moderationActionSchema.index({ adminUid: 1, createdAt: -1 });

// Append-only enforcement (D-17):
const APPEND_ONLY_ERR = new Error('ModerationAction is append-only');
moderationActionSchema.pre('updateOne', function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('updateMany', function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('findOneAndUpdate', function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('deleteOne', function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('deleteMany', function () { throw APPEND_ONLY_ERR; });
moderationActionSchema.pre('findOneAndDelete', function () { throw APPEND_ONLY_ERR; });

module.exports = mongoose.model('ModerationAction', moderationActionSchema, 'moderation_actions');
```

**Adaptation notes (D-10, D-11, D-12):**
- Replace `targetUid` with TWO fields per D-10: `listingId: String, required: true` AND `sellerUid: String, required: true` (denormalized for seller-history queries).
- `action` enum becomes `['suspend', 'archive', 'delete', 'restore', 'edit']` (5 listing-domain entries, none of the user-domain entries).
- Drop `severity` and `roleAffected` (user-domain only).
- Add `fromStatus` and `toStatus`, both `{ type: String, enum: ['active', 'suspended', 'archived', 'deleted'], required: true }` (state-transition record).
- Rename `note` → `reasonNote`; keep `reasonCategory` but with listing-domain enum from D-14a: `['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other']` (note the added `inactive_seller`).
- Keep `fieldDiff` as `mongoose.Schema.Types.Mixed` (D-12 + Specifics) — populated only when `action === 'edit'`.
- Indexes become THREE per D-10: `{ listingId: 1, createdAt: -1 }`, `{ adminUid: 1, createdAt: -1 }`, `{ sellerUid: 1, createdAt: -1 }`.
- Append-only error message becomes `'ListingModerationAction is append-only'` (D-11). Keep all 6 pre-hooks verbatim — same hook names, same `throw` pattern.
- Final `mongoose.model(...)` call: `mongoose.model('ListingModerationAction', schema, 'listing_moderation_actions')` per D-10 (explicit collection name, established pattern in `src/models/`).

---

### 2. `src/moderation/listingRouter.js` (router, request-response — Phase 7 ships only `/ping`)

**Analog:** `../backend-services/carEx-services/src/moderation/router.js`

**Why closest:** Same role (Express router mounted behind `verifyIdToken + requireAdmin`), same data-flow shape (per-route handlers using `req.admin.uid`). D-01 + D-02 explicitly call it a SEPARATE router; Phase 7 ships only the `/ping` scaffold. Real handlers arrive in Phase 8. Excerpt below is the structural minimum — imports + router instantiation + `/ping`. The `router.use(moderationRateLimiter)` line is intentionally **omitted** from the analog excerpt because Phase 7 mounts the listing limiter at the **app** level in `server.js` (D-03), not router-level — but the v1.0 file mounts it at router-level. Adaptation notes flag this divergence.

**Excerpt (lines 1–22 + 47–53 + 86–90 — 22 lines total, contiguous concept):**
```js
// ../backend-services/carEx-services/src/moderation/router.js (lines 1–22 — head + imports)
// src/moderation/router.js
//
// Admin moderation router. Mounted in server.js under
// app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter)
// so every route below runs AFTER Firebase-idToken verification and AdminUser check.
// ...
const express = require('express');
const service = require('./service');
const ModerationAction = require('../models/ModerationAction');
const { denySelfModeration } = require('./denySelfModeration');
const { moderationRateLimiter } = require('./rateLimit');
const { dispatchSchema, unsuspendSchema, deleteProfileSchema, editProfileSchema } = require('./schemas');
```

```js
// ../backend-services/carEx-services/src/moderation/router.js (lines 47–53 — router instantiation)
const router = express.Router();

// SEC-04: Per-admin rate limit applied to EVERY route in this router (including /ping
// and every mutating endpoint). Keyed on req.admin.uid by the limiter (Plan 02-02,
// D-30/D-31/D-32). Mounted HERE — after the app-level verifyIdToken + requireAdmin chain
// at server.js:919 (so req.admin.uid is populated) — and BEFORE any per-route handler.
router.use(moderationRateLimiter);
```

```js
// ../backend-services/carEx-services/src/moderation/router.js (lines 86–90 — /ping handler)
// Scaffold route from Phase 1 — unchanged. Not behind denySelfModeration because
// /ping has no :targetUid param.
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});
```

**Adaptation notes (D-01, D-02, D-03, D-04):**
- Reduce to the absolute minimum: `require('express')`, instantiate router, define `GET /ping`, export. NO service import, NO schemas import, NO ModerationAction import — Phase 7 ships only the scaffold (D-01).
- Do NOT replicate `router.use(moderationRateLimiter)` here. Per D-03 the listing limiter mounts at app level in `server.js`: `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter)`. Keeping limiter at app-mount (rather than router-level like v1.0) avoids importing the limiter inside the router — keeps Phase 7's router file dependency-free.
- `/ping` response unchanged: `{ ok: true }` (preserves the v1.0 acceptance contract used by `requireAdmin.listing.middleware.test.js`).
- File header comment block should mirror v1.0 router.js shape: mount path, what the file does, what arrives in Phase 8 (cross-reference forward).

---

### 3. `src/moderation/listingCapabilities.js` (config module, capability map)

**Analog:** `../backend-services/carEx-services/src/moderation/capabilities.js`

**Why closest:** Same role (pure JS module exporting a state→policy map + a resolver function), same data flow (synchronous lookup, no I/O). D-14 makes the parallel explicit.

**Full file excerpt (62 lines — whole module is the template):**
```js
// ../backend-services/carEx-services/src/moderation/capabilities.js (lines 1–62)
const STATUS_POLICY = {
  active: {
    capabilities: 'all',
    banner: null,
  },
  feature_limited: {
    capabilities: {
      blocked: [
        'create_listing',
        'create_order',
        'contact_seller',
        'request_seller_role',
        'request_broker_role',
        'request_logistics_role',
        'update_profile',
      ],
    },
    banner: {
      titleKey: 'moderation.feature_limited.title',
      bodyKey: 'moderation.feature_limited.body',
      appealAllowed: false,
      resolutionHintKey: 'moderation.feature_limited.resolution',
    },
  },
  blocked_with_review: { /* ... */ },
  permanently_banned: { /* ... */ },
};

function resolveRestrictedFeatures(state) {
  const entry = STATUS_POLICY[state];
  if (!entry) throw new Error(`Unknown moderation state: ${state}`);
  if (entry.capabilities === 'all') return [];
  if (entry.capabilities.blocked === 'all_writes') return ['all_writes'];
  if (Array.isArray(entry.capabilities.blocked)) return [...entry.capabilities.blocked];
  throw new Error(`Malformed STATUS_POLICY entry for state: ${state}`);
}

module.exports = { STATUS_POLICY, resolveRestrictedFeatures };
```

**Adaptation notes (D-14, D-14b):**
- Constant name: `STATUS_POLICY` → `LISTING_STATUS_POLICY`. Function name: `resolveRestrictedFeatures` → `resolveBlockedBuyerActions`.
- Keys are the four `Car.status` enum values (D-07): `active | suspended | archived | deleted` — NOT the user-mod state names.
- Replace `capabilities: 'all'` / `{ blocked: [...] }` shape with `buyerBlocked: []` (D-14 literal shape).
- Verbatim body per D-14:
  ```js
  active:    { buyerBlocked: [], banner: null }
  suspended: { buyerBlocked: ['add_to_cart', 'confirm_booking'], banner: { titleKey: 'listingBannerSuspendedTitle', bodyKey: 'listingBannerSuspendedBody', severity: 'warning' } }
  archived:  { buyerBlocked: ['add_to_cart', 'confirm_booking'], banner: { titleKey: 'listingBannerArchivedTitle', bodyKey: 'listingBannerArchivedBody', severity: 'neutral' } }
  deleted:   { buyerBlocked: ['view', 'add_to_cart', 'confirm_booking'], banner: { titleKey: 'listingBannerDeletedTitle', bodyKey: 'listingBannerDeletedBody', severity: 'destructive' } }
  ```
- Resolver per D-14: `function resolveBlockedBuyerActions(state) { return LISTING_STATUS_POLICY[state]?.buyerBlocked ?? []; }` — note the `?? []` fallback (v1.0 resolver throws on unknown state; Phase 7 chose nullish-coalesce return; CONTEXT.md decision is authoritative).
- Banner-key naming uses the `listingBanner*` prefix (D-14a) — different from v1.0's `moderation.<state>.<field>` convention to avoid translation-key collision with v1.0 keys.
- Export both names: `module.exports = { LISTING_STATUS_POLICY, resolveBlockedBuyerActions };`

---

### 4. `src/moderation/listingRateLimit.js` (middleware-config, express-rate-limit factory)

**Analog:** `../backend-services/carEx-services/src/moderation/rateLimit.js`

**Why closest:** Same role (express-rate-limit factory exporting a configured limiter), same data flow (per-request key extraction + 429 response). D-04 calls for a structural clone with a different `keyGenerator` prefix and a separate counter bucket.

**Full file excerpt (59 lines — whole module is the template, the keyGenerator block is the load-bearing diff point):**
```js
// ../backend-services/carEx-services/src/moderation/rateLimit.js (lines 1–58)
// src/moderation/rateLimit.js
//
// Per-admin rate limiter mounted at the /api/admin/moderation router level.
// Keyed by req.admin.uid (set by requireAdmin — see Plan 02-01 amendment).
// Window: 15 minutes. Max: 30 requests per window per admin. (D-30, D-31, D-32.)
// ...
const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const MAX_REQUESTS = 30;

const moderationRateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MAX_REQUESTS,
  standardHeaders: true,    // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
  legacyHeaders: false,     // no X-RateLimit-* (deprecated)
  keyGenerator: (req) => {
    if (req.admin && req.admin.uid) return `admin:${req.admin.uid}`;
    if (req.admin && req.admin.email) return `admin-email:${req.admin.email}`;
    return 'unauthenticated';
  },
  handler: (req, res /*, next, options */) => {
    const resetTimeMs = req.rateLimit && req.rateLimit.resetTime
      ? req.rateLimit.resetTime - Date.now()
      : WINDOW_MS;
    const retryAfter = Math.max(0, Math.ceil(resetTimeMs / 1000));
    res
      .status(429)
      .set('Retry-After', String(retryAfter))
      .json({ error: 'rate_limited', retryAfter });
  },
});

module.exports = {
  moderationRateLimiter,
  WINDOW_MS,
  MAX_REQUESTS,
};
```

**Adaptation notes (D-04, D-06):**
- Exported name: `moderationRateLimiter` → `listingModerationRateLimiter`.
- `windowMs`, `max`, `standardHeaders`, `legacyHeaders`, `handler` block: **byte-identical clone** (D-06 preserves the 429 response shape so the mobile interceptor needs no update).
- The `keyGenerator` is the single critical diff. **All three fallback tiers must change their prefix:**
  ```js
  keyGenerator: (req) => {
    if (req.admin && req.admin.uid) return `listing-admin:${req.admin.uid}`;
    if (req.admin && req.admin.email) return `listing-admin-email:${req.admin.email}`;
    return 'listing-unauthenticated';
  },
  ```
  Rationale (D-04): prefix `listing-admin:` ensures the in-memory bucket does NOT share counters with `admin:` (v1.0 user-mod limiter). An admin can spend 30 user-mod actions AND 30 listing actions in the same 15-min window — they have independent budgets.
- Header comment block: mirror v1.0 file's structure but rewrite to call out the separate-bucket rationale (D-04 verbatim explanation is the source).
- Export shape: `module.exports = { listingModerationRateLimiter, WINDOW_MS, MAX_REQUESTS };` — keep WINDOW_MS/MAX_REQUESTS exports for the listing test file to import (mirrors v1.0 acceptance test usage).

---

### 5. `scripts/migrate-listing-moderation.js` (migration-script, idempotent)

**Analog:** `../backend-services/carEx-services/scripts/migrate-moderation.js`

**Why closest:** Same role (one-off Node script, `node scripts/migrate-listing-moderation.js`), same data flow (batch backfill + index sync), same exit-discipline (non-zero on any failure). D-15 mirrors the structure.

**Excerpt (lines 1–30 + 98–127 — head + ensureIndexes + main):**
```js
// ../backend-services/carEx-services/scripts/migrate-moderation.js (lines 1–30 — head + backfillUsers)
#!/usr/bin/env node
// One-off migration. Idempotent. Run: node scripts/migrate-moderation.js
// Backfills User.moderationStatus, ServiceOrder.providerSnapshot, and DATA-01 / DATA-02 indexes.

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../src/models/User');
const ModerationAction = require('../src/models/ModerationAction');

async function backfillUsers() {
  const filter = { 'moderationStatus.state': { $exists: false } };
  const patch = {
    $set: {
      moderationStatus: {
        state: 'active',
        severity: 'none',
        reasonCategory: null,
        note: null,
        setByAdminUid: null,
        setAt: null,
        restrictedFeatures: [],
        lastActionId: null,
      },
    },
  };
  const result = await User.updateMany(filter, patch);
  console.log(`[migrate] users backfilled: ${result.modifiedCount}`);
  return result.modifiedCount;
}
```

```js
// ../backend-services/carEx-services/scripts/migrate-moderation.js (lines 98–127 — ensureIndexes + main + exit discipline)
async function ensureIndexes() {
  // Force creation of declared indexes on both models (D-29 step 3).
  await User.syncIndexes();
  await ModerationAction.syncIndexes();
  console.log('[migrate] indexes synced on users + moderation_actions');
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI env var is required');
  await mongoose.connect(uri, { dbName: 'CarEx' });
  console.log('[migrate] connected');

  const userCount = await backfillUsers();
  const { updated: orderCount, unresolvable } = await backfillOrders();
  await ensureIndexes();

  console.log(`[migrate] DONE — users: ${userCount}, orders: ${orderCount}, unresolvable orders: ${unresolvable}`);
  await mongoose.disconnect();

  if (unresolvable > 0) process.exit(2);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[migrate] FAILED:', err);
    process.exit(1);
  });
}

module.exports = { backfillUsers, backfillOrders, ensureIndexes };
```

**Adaptation notes (D-15, D-16, D-18):**
- Replace `User` import with `Car` (`require('../src/models/Car')`) and `ModerationAction` import with `ListingModerationAction` (`require('../src/models/ListingModerationAction')`).
- Replace `backfillUsers` with `backfillListings`:
  ```js
  async function backfillListings() {
    const filter = { status: { $exists: false } };
    const patch = { $set: { status: 'active' } };
    const result = await Car.updateMany(filter, patch);
    console.log(`[migrate-listing] listings backfilled: ${result.modifiedCount}`);
    return result.modifiedCount;
  }
  ```
  Other moderation fields default via schema (D-15) — no need to set them here.
- DROP `backfillOrders` entirely — Phase 7 has no order-side backfill (orders gain `pausedByListingModeration` only in Phase 9).
- `ensureIndexes()` becomes:
  ```js
  async function ensureIndexes() {
    await Car.syncIndexes();
    await ListingModerationAction.syncIndexes();
    console.log('[migrate-listing] indexes synced on cars + listing_moderation_actions');
  }
  ```
  This creates both new `{ status: 1 }` and `{ sellerId: 1, status: 1 }` indexes on `Car` (declared in modified Car schema) and the three audit indexes on `ListingModerationAction`.
- `main()`: drop the order count + unresolvable accounting. Add an **invariant check** per D-16:
  ```js
  const stillMissing = await Car.countDocuments({ status: { $exists: false } });
  if (stillMissing > 0) {
    console.error(`[migrate-listing] FAIL: ${stillMissing} cars still missing status after backfill`);
    process.exit(2);
  }
  ```
- Idempotency (D-18): the `{ status: { $exists: false } }` filter means a second run matches zero docs → `modifiedCount === 0`. Same property as v1.0 `backfillUsers`.
- Keep `require('dotenv').config()`, shebang, `require.main === module` guard, and module.exports of the functions for the test file to import.

---

### 6. `src/models/Car.js` (MODIFIED — extend in place)

**Analog:** the file **itself** — the existing schema is the contract that must be extended, not forked.

**Why closest:** D-02 mandates in-place extension. The existing seller-cascade `pre(/^find/)` hook (lines 50–82) is owned by Phase 9 and Phase 7 must leave it untouched.

**Schema head excerpt — current state (lines 1–42):**
```js
// ../backend-services/carEx-services/src/models/Car.js (lines 1–42 — current schema, MUST extend, NOT rewrite)
const mongoose = require('mongoose');

// Car Schema (listings reference makeId/modelId)
// Lifted verbatim from server.js:95-133 as part of Phase 3 Plan 03-01
// (ENF-02 model extraction + read-time hide hook).
const carSchema = new mongoose.Schema({
  makeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleMake' },
  modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleModel' },
  makeName: String,
  modelName: String,
  make: String,  // legacy, for old listings
  model: String, // legacy, for old listings
  // ... (many fields elided) ...
  sellerId: String, // Firebase UID of listing owner
  listingStatus: { type: String, enum: ['active', 'booked', 'sold'], default: 'active' },
  bookedByUid: { type: String, default: null },
  stripePaymentIntentId: { type: String, default: null },
});
```

**PRESERVATION CONTRACT — `pre(/^find/)` seller-cascade hook (lines 44–82) MUST NOT be modified in Phase 7:**
```js
// ../backend-services/carEx-services/src/models/Car.js (lines 44–82 — DO NOT TOUCH)
// ENF-02: hide Cars whose seller is non-active OR no longer APPROVED.
// Admin paths + the confirm-booking re-check opt out via the bypass flag on
// setOptions. Default behavior is hide-safely.
// The User model is resolved lazily inside the hook (not imported at the top
// of this file) to avoid a potential model-load cycle.
// See 03-CONTEXT.md D-07/D-08 and 03-PATTERNS.md.
carSchema.pre(/^find/, async function () {
  if (this.getOptions().includeAllUsers) return;
  const User = mongoose.model('User');
  const hiddenUids = await User.distinct('firebaseUid', {
    $or: [
      { 'moderationStatus.state': { $ne: 'active' } },
      { sellerStatus: { $ne: 'APPROVED' } },
    ],
  });
  // CR-01 fix: preserve the caller's filter on the join key (sellerId) ...
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

module.exports = mongoose.model('Car', carSchema);
```

**Adaptation notes (D-02, D-07, D-08, anti-pattern §3):**
- ADD to schema body (D-07 verbatim — order/placement: directly AFTER the existing `stripePaymentIntentId` line for visual grouping with `listingStatus`):
  ```js
  status: { type: String, enum: ['active', 'suspended', 'archived', 'deleted'], default: 'active', required: true, index: true },
  moderationReason: { type: String, enum: ['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other'], default: null },
  moderationNote: { type: String, default: null, maxlength: 2000 },
  moderatedBy: { type: String, default: null },           // Firebase uid of admin
  moderatedAt: { type: Date, default: null },
  lastEditedBy: { type: String, default: null },          // Firebase uid of admin (LADM-01)
  lastEditedAt: { type: Date, default: null },
  ```
- ADD compound index AFTER the schema literal (declared via `carSchema.index(...)` since the inline `index: true` only declares the single-field one):
  ```js
  carSchema.index({ sellerId: 1, status: 1 });
  ```
- ADD a banner comment at the top of the file (D-08) calling out the two-field contract:
  ```js
  // CAUTION (Phase 7 v1.1): This model has TWO independent status fields that both default to 'active'.
  //   - listingStatus: 'active' | 'booked' | 'sold'                         — seller-side lifecycle (booking flow)
  //   - status:        'active' | 'suspended' | 'archived' | 'deleted'      — admin-side moderation (LDATA-01)
  // Do NOT conflate. Phase 7 D-08, 07-CONTEXT.md.
  ```
- The existing `listingStatus` field stays untouched (anti-pattern §1 — do not add `suspended` to its enum).
- The existing `pre(/^find/)` hook on lines 50–82 stays untouched (D-02, anti-pattern §3). Phase 9 will add a SECOND hook for `status !== 'active'` filtering; the two hooks compose orthogonally with separate bypass keys (`includeAllUsers` vs the forthcoming `includeAllListingStatuses`).
- Do NOT change the `module.exports = mongoose.model('Car', carSchema);` line — model name and (implicit) collection name (`cars`) are stable.

---

### 7. `src/security/ensureBaseline.js` (MODIFIED — extend in place)

**Analog:** the file itself — extend, do not fork (D-17, established-pattern §"ensureBaseline runs after Mongoose connects and only LOGS").

**Existing file excerpt (full file, 22 lines — extension goes ALONGSIDE the User check):**
```js
// ../backend-services/carEx-services/src/security/ensureBaseline.js (lines 1–22 — current full file)
const User = require('../models/User');

/**
 * Startup health check (D-30). Runs once after Mongoose connects.
 * Counts users missing moderationStatus. If >0, logs a warning.
 * Does NOT auto-migrate — admin runs `node scripts/migrate-moderation.js` deliberately.
 */
async function ensureBaseline() {
  try {
    const pending = await User.countDocuments({ 'moderationStatus.state': { $exists: false } });
    if (pending > 0) {
      console.warn(`[Baseline] ${pending} users missing moderationStatus — run: node scripts/migrate-moderation.js`);
    } else {
      console.log('[Baseline] All users have moderationStatus.');
    }
  } catch (err) {
    console.error('[Baseline] Check failed:', err.message);
  }
}

module.exports = { ensureBaseline };
```

**PRESERVATION CONTRACT:**
- Existing `User.countDocuments({ 'moderationStatus.state': { $exists: false } })` check (lines 10–15) MUST remain intact and continue to log/warn exactly as today.
- Function name `ensureBaseline` and the single `module.exports` line MUST NOT change — `server.js:37` calls `await ensureBaseline()` and Phase 7 adds no new export.
- Top-level `try { ... } catch (err) { ... }` envelope MUST wrap the new check too — the v1.0 contract is "this function never throws into the server bootstrap".

**Adaptation notes (D-17, success criteria #2):**
- ADD `const Car = require('../models/Car');` to imports.
- INSERT a second `countDocuments` check inside the try block, AFTER the existing User check (so a Car-side failure doesn't mask a User-side warning). Mirror the exact log shape:
  ```js
  const pendingListings = await Car.countDocuments({ status: { $exists: false } });
  if (pendingListings > 0) {
    console.warn(`[Baseline] ${pendingListings} listings missing status — run: node scripts/migrate-listing-moderation.js`);
  } else {
    console.log('[Baseline] All listings have status.');
  }
  ```
- Update the docstring's reference list to mention both `migrate-moderation.js` and `migrate-listing-moderation.js`.
- Do NOT auto-migrate (D-17 + v1.0 D-30) — log only.

---

### 8. `server.js` (MODIFIED — add one mount line)

**Analog:** the existing mount line at `server.js:851` is the template for the new line.

**Why closest:** Identical middleware chain, identical pattern; only the prefix + router import differ.

**PRESERVATION CONTRACT — line 851 MUST NOT change:**
```js
// ../backend-services/carEx-services/server.js (lines 845–851 — existing mount block, DO NOT MODIFY line 851)
// --- Admin Routes ---

// New moderation surface (SEC-01 + SEC-02). Mounted BEFORE legacy /api/admin/*
// routes so the Bearer-idToken chain applies first. Per D-05 (hybrid cutover),
// legacy routes below keep their existing callerUid-in-body pattern until a
// follow-up milestone migrates them (D-06).
app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);
```

**Adaptation notes (D-03):**
- ADD imports at the top of `server.js` alongside the existing `moderationRouter` import (line 22):
  ```js
  const listingModerationRouter = require('./src/moderation/listingRouter');
  const { listingModerationRateLimiter } = require('./src/moderation/listingRateLimit');
  ```
- ADD ONE mount line **immediately after** line 851 (so the comment block above applies to both surfaces):
  ```js
  app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter);
  ```
- ORDER OF MIDDLEWARE: `verifyIdToken → requireAdmin → listingModerationRateLimiter → listingModerationRouter`. The rate-limiter sits AFTER `requireAdmin` so `req.admin.uid` is populated when `keyGenerator` runs (same constraint as v1.0 — see `rateLimit.js` keyGenerator comment).
- DIVERGENCE FROM v1.0: v1.0 mounts the limiter at router-level (inside `router.js` via `router.use(moderationRateLimiter)`); Phase 7 mounts the listing limiter at app-level. Net behavior is identical — every route in the listing router runs through the limiter — but the file ownership is cleaner (D-03 + D-04 keep Phase 7's router file dependency-free).
- DO NOT touch any other line in `server.js`. Specifically, do not move the existing `app.use('/api/admin/moderation', ...)` line — order matters for Express route-matching against the longer prefix `/api/admin/moderation/listings`. Express tries routes in registration order; the existing user-mod mount is at `/api/admin/moderation` (shorter prefix) — but Express only matches routes whose path actually exists in the mounted router, so a `GET /api/admin/moderation/listings/ping` request will NOT match `/api/admin/moderation` because `moderationRouter` has no `/listings/ping` route. Adding the longer-prefix mount AFTER the shorter-prefix mount is therefore safe (both Express and the testing in Phase 7 cover this).

---

### 9. `__tests__/listing-moderation/ListingModerationAction.append-only.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/ModerationAction.append-only.test.js`

**Why closest:** Same role (jest + `mongodb-memory-server` schema-level test of the 6 pre-hooks), same data flow, exactly the same assertion shape.

**Full file excerpt (58 lines — whole file is the template):**
```js
// ../backend-services/carEx-services/__tests__/moderation/ModerationAction.append-only.test.js (lines 1–58)
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

describe('ModerationAction — append-only', () => {
  let ModerationAction;
  let seedId;

  beforeAll(async () => {
    ModerationAction = require('../../src/models/ModerationAction');
    const doc = await ModerationAction.create({
      targetUid: 't1',
      adminUid: 'a1',
      adminEmail: 'a1@test.local',
      action: 'suspend',
      severity: 'feature_limited',
      reasonCategory: 'spam',
      note: 'initial',
    });
    seedId = doc._id;
  });

  test('updateOne throws', async () => {
    await expect(
      ModerationAction.updateOne({ _id: seedId }, { note: 'tampered' })
    ).rejects.toThrow('ModerationAction is append-only');
  });

  test('findOneAndUpdate throws', async () => {
    await expect(
      ModerationAction.findOneAndUpdate({ _id: seedId }, { note: 'tampered' })
    ).rejects.toThrow('ModerationAction is append-only');
  });

  test('deleteOne throws', async () => {
    await expect(
      ModerationAction.deleteOne({ _id: seedId })
    ).rejects.toThrow('ModerationAction is append-only');
  });

  test('findOneAndDelete throws', async () => {
    await expect(
      ModerationAction.findOneAndDelete({ _id: seedId })
    ).rejects.toThrow('ModerationAction is append-only');
  });
});
```

**Adaptation notes (D-11, D-19):**
- Replace `require('../../src/models/ModerationAction')` with `require('../../src/models/ListingModerationAction')`.
- Replace the seed doc shape per D-10:
  ```js
  const doc = await ListingModerationAction.create({
    listingId: 'car-id-1',
    sellerUid: 'seller-1',
    adminUid: 'a1',
    adminEmail: 'a1@test.local',
    action: 'suspend',
    fromStatus: 'active',
    toStatus: 'suspended',
    reasonCategory: 'spam',
    reasonNote: 'initial',
  });
  ```
- Replace the error message in every `rejects.toThrow(...)` from `'ModerationAction is append-only'` to `'ListingModerationAction is append-only'`.
- ADD test cases per D-11 — v1.0 file is missing `updateMany` and `deleteMany` (probably an oversight); the listing test should cover ALL 6 hooks (D-11 invariant: "Phase 7 tests assert every hook fires"):
  ```js
  test('updateMany throws', async () => {
    await expect(
      ListingModerationAction.updateMany({ _id: seedId }, { reasonNote: 'tampered' })
    ).rejects.toThrow('ListingModerationAction is append-only');
  });

  test('deleteMany throws', async () => {
    await expect(
      ListingModerationAction.deleteMany({ _id: seedId })
    ).rejects.toThrow('ListingModerationAction is append-only');
  });
  ```
- Describe block name: `'ListingModerationAction — append-only'`.

---

### 10. `__tests__/listing-moderation/listingCapabilities.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/capabilities.test.js`

**Why closest:** Same role (pure module test, asserts the policy map matches the schema enum + the resolver returns expected lists), same shape (no HTTP, no fixtures beyond the model import).

**Excerpt (lines 16–46 — the load-bearing section):**
```js
// ../backend-services/carEx-services/__tests__/moderation/capabilities.test.js (lines 16–46)
describe('STATUS_POLICY + resolveRestrictedFeatures (DATA-04)', () => {
  const User = require('../../src/models/User');
  const { STATUS_POLICY, resolveRestrictedFeatures } = require('../../src/moderation/capabilities');

  test('STATUS_POLICY keys match User.moderationStatus.state enum', () => {
    const statePath = User.schema.path('moderationStatus.state');
    expect(statePath).toBeDefined();
    const schemaEnum = new Set(statePath.enumValues);
    const policyKeys = new Set(Object.keys(STATUS_POLICY));
    expect(policyKeys).toEqual(schemaEnum);
  });

  test("active state grants 'all' capabilities with no banner", () => {
    expect(STATUS_POLICY.active.capabilities).toBe('all');
    expect(STATUS_POLICY.active.banner).toBeNull();
  });

  test('feature_limited blocks the expected 7 tokens', () => {
    expect(STATUS_POLICY.feature_limited.capabilities.blocked).toEqual([
      'create_listing',
      'create_order',
      'contact_seller',
      'request_seller_role',
      'request_broker_role',
      'request_logistics_role',
      'update_profile',
    ]);
    /* ... */
  });
```

**Adaptation notes (D-14, D-19):**
- Replace `STATUS_POLICY` → `LISTING_STATUS_POLICY`, `resolveRestrictedFeatures` → `resolveBlockedBuyerActions`, and import path to `'../../src/moderation/listingCapabilities'`.
- Schema-enum cross-check: read the enum from `Car.schema.path('status').enumValues` (NOT `User.moderationStatus.state`):
  ```js
  const Car = require('../../src/models/Car');
  test('LISTING_STATUS_POLICY keys match Car.status enum (D-19 lock)', () => {
    const enumValues = new Set(Car.schema.path('status').enumValues);
    const policyKeys = new Set(Object.keys(LISTING_STATUS_POLICY));
    expect(policyKeys).toEqual(enumValues);   // expect {'active','suspended','archived','deleted'}
  });
  ```
- Per-state assertions per D-14:
  ```js
  expect(LISTING_STATUS_POLICY.active.buyerBlocked).toEqual([]);
  expect(LISTING_STATUS_POLICY.active.banner).toBeNull();

  expect(LISTING_STATUS_POLICY.suspended.buyerBlocked).toEqual(['add_to_cart', 'confirm_booking']);
  expect(LISTING_STATUS_POLICY.suspended.banner.titleKey).toBe('listingBannerSuspendedTitle');
  expect(LISTING_STATUS_POLICY.suspended.banner.severity).toBe('warning');

  expect(LISTING_STATUS_POLICY.archived.buyerBlocked).toEqual(['add_to_cart', 'confirm_booking']);
  expect(LISTING_STATUS_POLICY.archived.banner.severity).toBe('neutral');

  expect(LISTING_STATUS_POLICY.deleted.buyerBlocked).toEqual(['view', 'add_to_cart', 'confirm_booking']);
  expect(LISTING_STATUS_POLICY.deleted.banner.severity).toBe('destructive');
  ```
- Resolver assertions:
  ```js
  expect(resolveBlockedBuyerActions('active')).toEqual([]);
  expect(resolveBlockedBuyerActions('deleted')).toEqual(['view', 'add_to_cart', 'confirm_booking']);
  expect(resolveBlockedBuyerActions('unknown_state')).toEqual([]);   // ?? [] fallback (D-14)
  ```
- Skip the v1.0 "every banner titleKey follows X convention" test — the new keys are flat (`listingBannerSuspendedTitle`, not `moderation.suspended.title`), so the v1.0 regex check is not applicable.

---

### 11. `__tests__/listing-moderation/listingModerationRateLimiter.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/acceptance.test.js` lines 229–331 (BLOCK 3).

**Why closest:** No standalone rate-limit test file exists in v1.0 — the rate-limit assertions live inside the broader `acceptance.test.js`. BLOCK 3 (`Criterion #5 part 3: rate_limited on 31st action, per-admin keying`) is the exact pattern Phase 7 needs to fork into a dedicated file. Two tests live there: (a) 30-then-429 with header check, (b) per-admin-keying with a SECOND admin proving independent buckets.

**Excerpt (lines 268–299 — the canonical 30-then-429 test):**
```js
// ../backend-services/carEx-services/__tests__/moderation/acceptance.test.js (lines 268–299)
test('30 successful suspends from admin A, the 31st returns 429 with retryAfter + Retry-After header', async () => {
  // Every call from admin A resolves the same token.
  admin.__verifyIdTokenMock.mockResolvedValue({ uid: ADMIN_A_UID, email: ADMIN_A_EMAIL });

  // 30 successful suspend calls, rotating targets.
  for (let i = 0; i < 30; i++) {
    const res = await request(app)
      .post(`/api/admin/moderation/rl-target-${i}`)
      .set('Authorization', 'Bearer ok-token')
      .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  }

  // 31st request -- must return 429 rate_limited.
  const res = await request(app)
    .post(`/api/admin/moderation/rl-target-30`)
    .set('Authorization', 'Bearer ok-token')
    .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });

  expect(res.status).toBe(429);
  expect(res.body.error).toBe('rate_limited');
  expect(typeof res.body.retryAfter).toBe('number');
  expect(res.body.retryAfter).toBeGreaterThanOrEqual(0);
  // Retry-After header must be a non-negative integer (seconds).
  expect(res.headers['retry-after']).toMatch(/^\d+$/);

  // Exactly 30 successful audit rows exist (the 31st should NOT have written one).
  const audits = await ModerationAction.find({ adminUid: ADMIN_A_UID }).lean();
  expect(audits.length).toBe(30);
}, 60_000);
```

**Excerpt (lines 301–330 — the per-admin keying test, second admin proves independent buckets):**
```js
// ../backend-services/carEx-services/__tests__/moderation/acceptance.test.js (lines 301–330)
test('per-admin keying: admin C is not rate-limited even after admin A exhausts the bucket', async () => {
  admin.__verifyIdTokenMock.mockResolvedValue({ uid: ADMIN_A_UID, email: ADMIN_A_EMAIL });
  for (let i = 0; i < 30; i++) {
    const r = await request(app)
      .post(`/api/admin/moderation/rl-target-${i}`)
      .set('Authorization', 'Bearer ok-token')
      .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });
    expect(r.status).toBe(200);
  }

  // Sanity: admin A's next call is 429 (confirms bucket is full).
  const aBlocked = await request(app)
    .post(`/api/admin/moderation/rl-target-30`)
    .set('Authorization', 'Bearer ok-token')
    .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });
  expect(aBlocked.status).toBe(429);

  // Now switch to admin C -- different uid, independent bucket per D-31.
  admin.__verifyIdTokenMock.mockResolvedValue({ uid: ADMIN_C_UID, email: ADMIN_C_EMAIL });

  const cRes = await request(app)
    .post(`/api/admin/moderation/rl-target-31`)
    .set('Authorization', 'Bearer ok-token')
    .send({ action: 'suspend', severity: 'feature_limited', reasonCategory: 'spam' });

  expect(cRes.status).toBe(200);
  expect(cRes.body.ok).toBe(true);
}, 60_000);
```

**Adaptation notes (D-04, D-06, D-19, D-20):**
- D-20 mandates the test NOT boot `server.js`. Build a minimal app in `beforeAll`:
  ```js
  const express = require('express');
  app = express();
  app.use(express.json());
  app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter);
  ```
  (Mirrors the v1.0 `requireAdmin.middleware.test.js` minimal-app pattern — see file 12 below.)
- Mock `firebase-admin` the same way (`jest.mock('firebase-admin', () => ({ ... __verifyIdTokenMock }))`) — see file 12 excerpt.
- Hit `GET /api/admin/moderation/listings/ping` (the scaffold route) 31 times — the call shape is simpler than v1.0's POST `/suspend` because Phase 7 has no service layer:
  ```js
  for (let i = 0; i < 30; i++) {
    const r = await request(app)
      .get('/api/admin/moderation/listings/ping')
      .set('Authorization', 'Bearer ok-token');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true });
  }
  const blocked = await request(app)
    .get('/api/admin/moderation/listings/ping')
    .set('Authorization', 'Bearer ok-token');
  expect(blocked.status).toBe(429);
  expect(blocked.body.error).toBe('rate_limited');
  expect(blocked.headers['retry-after']).toMatch(/^\d+$/);
  ```
- DROP the audit-count assertion (`ModerationAction.find(...)`) — Phase 7's `/ping` writes no audit rows.
- ADD a **separate-bucket** test: mount BOTH `/api/admin/moderation` (v1.0 router) AND `/api/admin/moderation/listings` (new router) on the same minimal app, then prove that admin-A exhausting one bucket does NOT block the other:
  ```js
  // After 30 hits on /api/admin/moderation/listings/ping (now 429),
  // the same admin can still call /api/admin/moderation/ping (v1.0) → 200.
  ```
  This directly exercises D-04's "separate bucket" rationale.
- Per-admin keying test: identical shape — admin A exhausts → 429; admin C with a different uid succeeds.
- Limiter state CARRIES OVER between tests (in-memory store), so each test must call `listingModerationRateLimiter.resetKey('listing-admin:' + uid)` in `beforeEach` to start with a fresh bucket (mirrors v1.0 acceptance.test.js comment at lines 237–240).

---

### 12. `__tests__/listing-moderation/requireAdmin.listing.middleware.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js`

**Why closest:** Same role (jest + supertest, mock firebase-admin, build a minimal Express app), exact set of 401/403/200 cases that LSEC-01/02 require.

**Excerpt (lines 1–48 — head, firebase-admin mock, app setup):**
```js
// ../backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js (lines 1–48)
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock firebase-admin BEFORE requiring any module that uses it.
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

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });

  app = express();
  app.use(express.json());
  app.use('/api/admin/moderation', verifyIdToken, requireAdmin, router);
});
```

**Excerpt (lines 50–82 — the four canonical assertions):**
```js
// ../backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js (lines 50–82)
describe('/api/admin/moderation/ping (SEC-01 + SEC-02)', () => {
  test('no Authorization header → 401 unauthenticated', async () => {
    const res = await request(app).get('/api/admin/moderation/ping');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthenticated', message: 'Missing or invalid idToken' });
  });

  test('malformed Authorization header → 401 unauthenticated', async () => {
    const res = await request(app).get('/api/admin/moderation/ping').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  test('invalid Bearer token (verifyIdToken throws) → 401 unauthenticated', async () => {
    admin.__verifyIdTokenMock.mockRejectedValueOnce(new Error('invalid signature'));
    const res = await request(app).get('/api/admin/moderation/ping').set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'unauthenticated', message: 'Missing or invalid idToken' });
  });

  test('valid idToken but email not an AdminUser → 403 unauthorized', async () => {
    admin.__verifyIdTokenMock.mockResolvedValueOnce({ uid: 'u1', email: 'notadmin@test.local' });
    const res = await request(app).get('/api/admin/moderation/ping').set('Authorization', 'Bearer ok-token');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'unauthorized', message: 'Admin access required' });
  });

  test('valid admin idToken → 200 { ok: true }', async () => {
    await AdminUser.create({ email: 'admin@test.local', role: 'admin' });
    admin.__verifyIdTokenMock.mockResolvedValueOnce({ uid: 'u2', email: 'admin@test.local' });
    const res = await request(app).get('/api/admin/moderation/ping').set('Authorization', 'Bearer ok-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

**Adaptation notes (D-19, D-20, D-06):**
- Replace `require('../../src/moderation/router')` with `require('../../src/moderation/listingRouter')`.
- Replace ALL `/api/admin/moderation/ping` paths with `/api/admin/moderation/listings/ping`.
- Mount line in `beforeAll`: `app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingRouter);` — for THIS file (middleware-isolation test), the rate limiter is intentionally NOT in the chain so the four 401/403/200 cases don't accidentally hit a 429. The rate-limiter test (file 11) covers the limiter-in-chain case separately.
- Keep the 401/403 response-body asserts byte-identical (D-06 contract).
- Describe block name: `'/api/admin/moderation/listings/ping (LSEC-01 + LSEC-02)'`.
- Add a `req.admin.uid propagates` spy test mirroring v1.0 lines 91–112 — confirms the limiter's `keyGenerator` will see the uid when the full chain runs.

---

### 13. `__tests__/listing-moderation/Car.status-field.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/User.moderationStatus.test.js`

**Why closest:** No existing `Car` model unit test exists in the backend repo. The User.moderationStatus test is the canonical shape for "schema-level defaults + enum-rejection + edge cases" — exactly what Phase 7 needs for `Car.status` per D-19.

**Excerpt (full file, 59 lines — whole pattern is the template):**
```js
// ../backend-services/carEx-services/__tests__/moderation/User.moderationStatus.test.js (lines 1–59)
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let User;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  User = require('../../src/models/User');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('User.moderationStatus (DATA-01)', () => {
  test('defaults state to "active" on new user', () => {
    const u = new User({ firebaseUid: 'u1', email: 'u1@test.local' });
    expect(u.moderationStatus.state).toBe('active');
    expect(u.moderationStatus.severity).toBe('none');
    expect(u.moderationStatus.reasonCategory).toBeNull();
    /* ... */
  });

  test('state enum rejects invalid value', async () => {
    const u = new User({ firebaseUid: 'u2', email: 'u2@test.local', moderationStatus: { state: 'banned' } });
    await expect(u.validate()).rejects.toThrow(/state/);
  });

  test('state enum accepts all four severity states', async () => {
    for (const s of ['active', 'feature_limited', 'blocked_with_review', 'permanently_banned']) {
      const u = new User({ firebaseUid: `u-${s}`, email: `${s}@test.local`, moderationStatus: { state: s } });
      await expect(u.validate()).resolves.toBeUndefined();
    }
  });

  test('reasonCategory enum rejects invalid value', async () => {
    const u = new User({ firebaseUid: 'u3', email: 'u3@test.local', moderationStatus: { reasonCategory: 'invalid_reason' } });
    await expect(u.validate()).rejects.toThrow(/reasonCategory/);
  });

  test('note rejects strings over 2000 chars', async () => {
    const u = new User({ firebaseUid: 'u4', email: 'u4@test.local', moderationStatus: { note: 'x'.repeat(2001) } });
    await expect(u.validate()).rejects.toThrow(/note/);
  });
});
```

**Adaptation notes (D-07, D-08, D-19):**
- Replace `User` with `Car` import + model.
- Test cases per D-07 + D-19:
  ```js
  test('defaults status to "active" on new car', () => {
    const c = new Car({ sellerId: 'seller-1' });
    expect(c.status).toBe('active');
    expect(c.moderationReason).toBeNull();
    expect(c.moderationNote).toBeNull();
    expect(c.moderatedBy).toBeNull();
    expect(c.moderatedAt).toBeNull();
    expect(c.lastEditedBy).toBeNull();
    expect(c.lastEditedAt).toBeNull();
  });

  test('status enum accepts the four moderation states', async () => {
    for (const s of ['active', 'suspended', 'archived', 'deleted']) {
      const c = new Car({ sellerId: 'seller-1', status: s });
      await expect(c.validate()).resolves.toBeUndefined();
    }
  });

  test('status enum rejects invalid value', async () => {
    const c = new Car({ sellerId: 'seller-1', status: 'banned' });
    await expect(c.validate()).rejects.toThrow(/status/);
  });

  test('moderationReason enum accepts all five values incl. inactive_seller (D-14a)', async () => {
    for (const r of ['spam', 'policy_violation', 'fraud', 'inactive_seller', 'other']) {
      const c = new Car({ sellerId: 'seller-1', moderationReason: r });
      await expect(c.validate()).resolves.toBeUndefined();
    }
  });

  test('moderationNote rejects strings over 2000 chars', async () => {
    const c = new Car({ sellerId: 'seller-1', moderationNote: 'x'.repeat(2001) });
    await expect(c.validate()).rejects.toThrow(/moderationNote/);
  });
  ```
- D-08 NAMING-COLLISION LOCK — the test must assert that `listingStatus` and `status` are TWO DISTINCT fields with NON-OVERLAPPING enums:
  ```js
  test('D-08 lock: listingStatus (lifecycle) and status (moderation) are distinct with disjoint enums', () => {
    const listingStatusEnum = new Set(Car.schema.path('listingStatus').enumValues);
    const statusEnum = new Set(Car.schema.path('status').enumValues);
    expect(listingStatusEnum).toEqual(new Set(['active', 'booked', 'sold']));
    expect(statusEnum).toEqual(new Set(['active', 'suspended', 'archived', 'deleted']));
    // The only overlap is 'active' — both default to it; that is intentional, not a bug (D-08).
    const overlap = [...statusEnum].filter((v) => listingStatusEnum.has(v));
    expect(overlap).toEqual(['active']);
  });
  ```
  This locks the two-field contract in CI — if a future PR collapses them or reuses one, the test fails immediately.
- Describe block name: `'Car.status (LDATA-01 + D-07 + D-08)'`.
- Preserve the v1.0 `beforeAll/afterAll` MongoMemoryServer harness verbatim.

---

### 14. `__tests__/listing-moderation/migrate-listing-moderation.test.js`

**Analog:** `../backend-services/carEx-services/__tests__/moderation/migrate-moderation.test.js`

**Why closest:** Same role (in-memory Mongo, seed docs, run script's exported functions, assert pre/post counts + idempotency), same data flow.

**Excerpt (lines 1–55 — head + seed setup + canonical "adds field" test + idempotency test):**
```js
// ../backend-services/carEx-services/__tests__/moderation/migrate-moderation.test.js (lines 1–55)
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;
let User;
let migrate;
let Broker;
let ServiceOrder;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  User = require('../../src/models/User');
  require('../../src/models/ModerationAction'); // register so ensureIndexes can sync it
  Broker = mongoose.model('Broker_testseed', new mongoose.Schema({}, { strict: false, collection: 'brokers' }));
  ServiceOrder = mongoose.model('ServiceOrder_testseed', new mongoose.Schema({}, { strict: false, collection: 'service_orders' }));
  migrate = require('../../scripts/migrate-moderation');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Broker.deleteMany({});
  await ServiceOrder.deleteMany({});
});

describe('migrate-moderation — backfillUsers (DATA-01)', () => {
  test('adds moderationStatus to users missing it', async () => {
    // Bypass Mongoose to simulate legacy docs without moderationStatus.
    await User.collection.insertOne({ firebaseUid: 'legacy-1', email: 'l1@test.local' });
    await User.collection.insertOne({ firebaseUid: 'legacy-2', email: 'l2@test.local' });

    const updated = await migrate.backfillUsers();
    expect(updated).toBe(2);

    const u1 = await User.findOne({ firebaseUid: 'legacy-1' }).lean();
    expect(u1.moderationStatus.state).toBe('active');
    expect(u1.moderationStatus.severity).toBe('none');
    expect(u1.moderationStatus.restrictedFeatures).toEqual([]);
  });

  test('is idempotent on a second run', async () => {
    await User.collection.insertOne({ firebaseUid: 'legacy-3', email: 'l3@test.local' });
    await migrate.backfillUsers();
    const second = await migrate.backfillUsers();
    expect(second).toBe(0);
  });
});
```

**Excerpt (lines 110–117 — ensureIndexes test):**
```js
// ../backend-services/carEx-services/__tests__/moderation/migrate-moderation.test.js (lines 110–117)
describe('migrate-moderation — ensureIndexes', () => {
  test('creates moderationStatus.state index on users', async () => {
    await migrate.ensureIndexes();
    const indexes = await User.collection.getIndexes();
    const names = Object.keys(indexes);
    expect(names.some((n) => n.includes('moderationStatus.state'))).toBe(true);
  });
});
```

**Adaptation notes (D-15, D-16, D-18, D-19):**
- Replace imports: `User` → `Car`, `ModerationAction` register → `require('../../src/models/ListingModerationAction')`.
- DROP the `Broker` / `ServiceOrder` loose-schema registration — Phase 7 migration has no order side.
- Replace `migrate = require('../../scripts/migrate-moderation')` with `migrate = require('../../scripts/migrate-listing-moderation')`.
- Adapt the legacy-doc seed pattern per D-19 (the test must seed via `Car.collection.insertOne(...)` to bypass Mongoose defaults, then verify the script adds `status`):
  ```js
  // Seed 10 docs per D-19: 7 missing `status`, 3 already have `status: 'suspended'`
  for (let i = 0; i < 7; i++) {
    await Car.collection.insertOne({ sellerId: `seller-${i}`, makeName: 'Toyota', modelName: 'Camry' });
  }
  for (let i = 7; i < 10; i++) {
    await Car.collection.insertOne({ sellerId: `seller-${i}`, makeName: 'Honda', modelName: 'Civic', status: 'suspended' });
  }

  const preCount = await Car.countDocuments({});
  expect(preCount).toBe(10);

  const updated = await migrate.backfillListings();
  expect(updated).toBe(7);   // only the 7 missing-status docs

  const postCount = await Car.countDocuments({});
  expect(postCount).toBe(preCount);  // D-16 invariant: count is unchanged
  const stillMissing = await Car.countDocuments({ status: { $exists: false } });
  expect(stillMissing).toBe(0);  // D-16 hard merge-gate

  // 3 pre-existing 'suspended' docs were untouched
  const suspended = await Car.countDocuments({ status: 'suspended' });
  expect(suspended).toBe(3);
  ```
- Idempotency test per D-18: run `backfillListings()` twice; second invocation returns `0`.
- ensureIndexes test per D-15: assert BOTH `{ status: 1 }` AND `{ sellerId: 1, status: 1 }` indexes exist on `cars`:
  ```js
  await migrate.ensureIndexes();
  const indexes = await Car.collection.getIndexes();
  const names = Object.keys(indexes);
  expect(names.some((n) => n.includes('status'))).toBe(true);
  expect(names.some((n) => n.includes('sellerId_1_status_1') || (n.includes('sellerId') && n.includes('status')))).toBe(true);
  ```
- IMPORTANT: do NOT call the full `main()` in tests — it calls `process.exit()`, which would kill the test runner. Only invoke the exported `backfillListings` / `ensureIndexes` functions (mirrors v1.0 test's pattern of calling exports, not `main`).

---

## Shared Patterns

### Pattern A: Mongoose append-only collection (6 pre-hooks)
**Source:** `../backend-services/carEx-services/src/models/ModerationAction.js` lines 18–25
**Apply to:** `src/models/ListingModerationAction.js`
**Verbatim shape (replace name + collection in adaptation):**
```js
const APPEND_ONLY_ERR = new Error('ListingModerationAction is append-only');
schema.pre('updateOne',        function () { throw APPEND_ONLY_ERR; });
schema.pre('updateMany',       function () { throw APPEND_ONLY_ERR; });
schema.pre('findOneAndUpdate', function () { throw APPEND_ONLY_ERR; });
schema.pre('deleteOne',        function () { throw APPEND_ONLY_ERR; });
schema.pre('deleteMany',       function () { throw APPEND_ONLY_ERR; });
schema.pre('findOneAndDelete', function () { throw APPEND_ONLY_ERR; });
```

### Pattern B: Explicit collection-name model registration
**Source:** Every file in `../backend-services/carEx-services/src/models/` (e.g., ModerationAction.js line 27)
**Apply to:** `src/models/ListingModerationAction.js`
**Established convention (code_context §"Established Patterns"):**
```js
module.exports = mongoose.model('ListingModerationAction', schema, 'listing_moderation_actions');
```
Third arg is mandatory — never let Mongoose pluralize. v1.0 enforces this throughout `src/models/`.

### Pattern C: 401 / 403 / 429 response envelopes
**Source:** `verifyIdToken.js:26,34`, `requireAdmin.js:12,16`, `rateLimit.js:46–49`
**Apply to:** All Phase 7 routes (just `/ping` for now) + all Phase 7 tests
**Verbatim envelopes (D-06 contract — must not change so mobile interceptor keeps working):**
```js
401: { error: 'unauthenticated', message: 'Missing or invalid idToken' }
403: { error: 'unauthorized',    message: 'Admin access required' }
429: { error: 'rate_limited',    retryAfter: <integer-seconds> }   + Retry-After header
```

### Pattern D: jest test isolation (no server.js boot)
**Source:** `requireAdmin.middleware.test.js` lines 26–38 (build a minimal Express app in `beforeAll`)
**Apply to:** ALL Phase 7 test files (D-20)
**Canonical setup:**
```js
let mongo, app;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = express();
  app.use(express.json());
  app.use('/api/admin/moderation/listings', verifyIdToken, requireAdmin, listingModerationRateLimiter, listingModerationRouter);
});
afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });
```

### Pattern E: firebase-admin mock for integration tests
**Source:** `requireAdmin.middleware.test.js` lines 6–18
**Apply to:** `requireAdmin.listing.middleware.test.js` + `listingModerationRateLimiter.test.js`
**Verbatim mock block:**
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
Plus in `beforeAll`: `process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'test' });` so `ensureInitialized()` is satisfied.

### Pattern F: Migration script discipline
**Source:** `scripts/migrate-moderation.js` lines 105–127
**Apply to:** `scripts/migrate-listing-moderation.js`
**Five locked properties (v1.0 D-29 / D-31 — Phase 7 D-15/D-16/D-18):**
1. Shebang `#!/usr/bin/env node` + `require('dotenv').config()` at top.
2. Idempotent filter (`{ field: { $exists: false } }`) so reruns match zero docs.
3. `process.exit(1)` on uncaught error, `process.exit(2)` on a documented soft-failure (Phase 7 uses code 2 for the D-16 post-count invariant failure).
4. `require.main === module` guard around `main()` so the test can import the exports without auto-running.
5. `module.exports = { backfillListings, ensureIndexes };` so the test file calls them directly.

---

## No Analog Found

None. Every Phase 7 file has a v1.0 sibling or, in the case of `Car.status-field.test.js`, a structurally identical sibling test (`User.moderationStatus.test.js`) that maps cleanly. The rate-limiter test file (#11) has no standalone v1.0 analog but its content lives verbatim inside `acceptance.test.js` BLOCK 3 — flagged as "partial" match quality above but the pattern is complete.

---

## Metadata

**Analog search scope:**
- `../backend-services/carEx-services/src/models/` (6 files)
- `../backend-services/carEx-services/src/moderation/` (8 files)
- `../backend-services/carEx-services/src/security/` (6 files)
- `../backend-services/carEx-services/scripts/` (1 file)
- `../backend-services/carEx-services/__tests__/moderation/` (16 files)
- `../backend-services/carEx-services/__tests__/admin/` (1 file)
- `../backend-services/carEx-services/__tests__/_helpers/` (1 file)
- `../backend-services/carEx-services/server.js` (targeted greps for mount + ensureBaseline references)

**Files scanned (Read):** 14 source/test files in backend repo, 1 phase context file in mobile repo.
**Pattern extraction date:** 2026-05-28
