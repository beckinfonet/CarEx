---
phase: 05
plan: 0b
type: execute
wave: 0
depends_on: []
files_modified:
  - backend-services/carEx-services/src/admin/router.js
  - backend-services/carEx-services/__tests__/admin/searchUsers.test.js
autonomous: false
requirements: [UI-02]

must_haves:
  truths:
    - "Backend repo (backend-services/carEx-services) exposes GET /api/admin/users/search"
    - "Route is admin-only (verifyIdToken + getAdminStatus) — non-admin requests 403"
    - "Supports email substring (regex-escaped, ReDoS-safe) AND Firebase UID prefix matching"
    - "Supports role + state filters (validated against allowlists)"
    - "Cursor-based pagination, returns { items: UserListItem[], nextCursor: string | null }"
    - "Uses Mongo indexes on moderationStatus.state + role-status fields per RESEARCH §Index Use"
    - "Validates query length ≤ 128 chars to prevent abuse"
    - "Backend tests pass via jest in the backend repo"
  artifacts:
    - path: "backend-services/carEx-services/src/admin/router.js"
      provides: "GET /api/admin/users/search mounted on existing admin router"
      contains: "router.get('/users/search'"
    - path: "backend-services/carEx-services/__tests__/admin/searchUsers.test.js"
      provides: "supertest jest coverage of admin gate, q substring, UID prefix, role/state filters, cursor pagination, ReDoS escape"
      contains: "describe('GET /api/admin/users/search'"
  key_links:
    - from: "src/services/moderation/ModerationService.ts (mobile, Plan 05-03)"
      to: "GET /api/admin/users/search"
      via: "axios GET with { q, role, state, cursor, limit } params"
      pattern: "/api/admin/users/search"
    - from: "backend route handler"
      to: "User Mongoose model"
      via: "find().sort().limit()"
      pattern: "User\\.find\\("
---

<objective>
Wave 0 backend plan #2 — implement the `GET /api/admin/users/search` route in the **separate backend repo** (`backend-services/carEx-services`). This route is locked by CONTEXT.md D-16.2 and is consumed by mobile Plan 05-03 (`ModerationService.searchUsers`) + Plan 05-07 (`AdminModerationScreen`) + Plan 05-09 (repurposed `AdminManagementScreen`).

Per CLAUDE.md the backend lives outside this repo at `backend-services/carEx-services`. **Plan is autonomous: false** because the mobile executor cannot run backend tests; the developer (or a parallel backend-aware agent) must execute these tasks in the backend repo before mobile Wave 3 plans run.

Purpose: ship the search endpoint that powers admin discovery + filtering of approved users.
Output: 1 router file extended + 1 jest test file added in the backend repo.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md
@.planning/phases/05-admin-moderation-ui-mobile/05-RESEARCH.md
@.planning/phases/05-admin-moderation-ui-mobile/05-VALIDATION.md
@CLAUDE.md

<interfaces>
<!-- Existing backend admin router pattern -->

The backend repo `backend-services/carEx-services` already has:
- `src/middleware/auth.js` — exports `verifyIdToken`
- `src/middleware/admin.js` — exports `getAdminStatus`
- `src/admin/router.js` — Phase 1 admin router (admin status, approval flow); mounted at `/api/admin` in `src/app.js`
- `src/models/User.js` — Mongoose User model with fields: `_id` (firebaseUid), `email`, `firstName?`, `lastName?`, `sellerStatus?`, `brokerStatus?`, `logisticsStatus?`, `isAdmin`, `moderationStatus.state`, `createdAt`

<!-- Mobile contract from Plan 05-03 / Plan 05-07 -->

`ModerationService.searchUsers({ q?, role?, state?, cursor?, limit? }, { signal? })`:
- Calls `GET /api/admin/users/search?q=&role=&state=&cursor=&limit=`
- Expects: `{ users: SearchUserItem[], nextCursor: string | null }`
- Accepts AbortSignal for cancellation (mobile-side; no backend change)

NOTE: mobile field name in response was `users` (not `items`) per Plan 05-03 / 05-07 — keep this name to avoid mobile churn.

<!-- Index requirements from RESEARCH §Index Use -->

The User collection should have indexes:
- `{ email: 1 }` — supports email substring scans (regex-anchored or full table scan; index helps with EXACT matches but not necessarily substring; document the tradeoff)
- `{ moderationStatus.state: 1 }` — supports state filter
- Compound `{ isAdmin: 1, moderationStatus.state: 1 }` — supports common (role=admin OR all) + state combinations
- `{ brokerStatus: 1 }`, `{ sellerStatus: 1 }`, `{ logisticsStatus: 1 }` — for role filters

If indexes are missing, the test setup should add them via the model schema. Adding new indexes is a write-path change; existing collection migrations must be verified out-of-band by the developer (this plan does not migrate prod data).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add GET /users/search route to the admin router with q/role/state filters + cursor pagination</name>
  <files>backend-services/carEx-services/src/admin/router.js</files>
  <read_first>
    - backend-services/carEx-services/src/admin/router.js (existing — for the Phase 1 mount pattern)
    - backend-services/carEx-services/src/models/User.js (model fields + existing indexes)
    - backend-services/carEx-services/src/middleware/auth.js + admin.js
    - .planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md (D-16.2 — endpoint shape)
    - .planning/phases/05-admin-moderation-ui-mobile/05-RESEARCH.md (§Pitfall 7, §Index Use)
  </read_first>
  <behavior>
    - Route handles `GET /users/search` (mounted at `/api/admin` so full path = `/api/admin/users/search`)
    - Middleware chain: `verifyIdToken`, `getAdminStatus`
    - Query params: `q?` (string, ≤128 chars), `role?` ∈ {buyer, seller, broker, logistics, admin}, `state?` ∈ {active, feature_limited, blocked_with_review, permanently_banned}, `cursor?`, `limit?` (default 25, clamped to [1, 100])
    - Validation: `q` length capped at 128, role/state values checked against allowlists; invalid → 400 with descriptive error code
    - `q` matching: case-insensitive email substring OR Firebase UID (`_id`) prefix; regex pattern is ALWAYS escaped via a `escapeRegex()` helper (no user-supplied regex special chars)
    - Role filter: maps role keyword → mongo predicate (e.g. `role: 'broker'` → `{ brokerStatus: 'APPROVED' }`; `role: 'admin'` → `{ isAdmin: true }`; `role: 'buyer'` → no provider role status set)
    - State filter: `{ 'moderationStatus.state': state }`
    - Cursor: same encoded `(createdAt, _id)` shape as Plan 05-0a (consistency reduces mobile-side branching)
    - Sort: `createdAt: -1, _id: -1` (newest signups first; admins typically scan recent activity)
    - Response: `{ users: UserListItem[], nextCursor: string | null }` where each user includes `_id` (renamed to `localId` for mobile compatibility — see SearchUserItem in mobile types), `email`, `firstName?`, `lastName?`, `sellerStatus?`, `brokerStatus?`, `logisticsStatus?`, `isAdmin?`, `moderationStatus`
    - Use `lean()` for read efficiency
    - Project only the fields mobile needs (avoid leaking backend-only fields)
  </behavior>
  <action>
Locate the existing admin router (`backend-services/carEx-services/src/admin/router.js`). Append a new route handler.

```javascript
// At top of file (only add if not already present):
const { verifyIdToken } = require('../middleware/auth');
const { getAdminStatus } = require('../middleware/admin');
const User = require('../models/User');

// Helper — escape regex special chars to prevent ReDoS via crafted q
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper — encode/decode the same cursor shape as Plan 05-0a (mobile-side consistency)
function encodeCursor(item) {
  if (!item) return null;
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt.toISOString(), _id: item._id.toString() }),
    'utf8',
  ).toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.createdAt || !parsed._id) throw new Error('missing fields');
    return { createdAt: new Date(parsed.createdAt), _id: parsed._id };
  } catch (err) {
    return undefined;
  }
}

const ALLOWED_ROLES = new Set(['buyer', 'seller', 'broker', 'logistics', 'admin']);
const ALLOWED_STATES = new Set(['active', 'feature_limited', 'blocked_with_review', 'permanently_banned']);
const MAX_Q_LEN = 128;

const PROJECTION = {
  _id: 1,
  email: 1,
  firstName: 1,
  lastName: 1,
  sellerStatus: 1,
  brokerStatus: 1,
  logisticsStatus: 1,
  isAdmin: 1,
  'moderationStatus.state': 1,
  'moderationStatus.severity': 1,
  'moderationStatus.reasonCategory': 1,
  createdAt: 1,
};

router.get(
  '/users/search',
  verifyIdToken,
  getAdminStatus,
  async (req, res) => {
    try {
      const { q: qRaw, role, state, cursor: cursorRaw } = req.query;
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 25;

      // ---- validation ----
      if (qRaw !== undefined && typeof qRaw !== 'string') {
        return res.status(400).json({ error: 'invalid_q' });
      }
      if (qRaw && qRaw.length > MAX_Q_LEN) {
        return res.status(400).json({ error: 'q_too_long' });
      }
      if (role !== undefined && !ALLOWED_ROLES.has(role)) {
        return res.status(400).json({ error: 'invalid_role' });
      }
      if (state !== undefined && !ALLOWED_STATES.has(state)) {
        return res.status(400).json({ error: 'invalid_state' });
      }

      const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
      if (cursorRaw && cursor === undefined) {
        return res.status(400).json({ error: 'invalid_cursor' });
      }

      // ---- query construction ----
      const filter = {};

      if (qRaw && qRaw.trim().length > 0) {
        const escaped = escapeRegex(qRaw.trim());
        // Match email substring (case-insensitive) OR _id prefix (case-sensitive — Firebase UIDs are case-sensitive)
        filter.$or = [
          { email: { $regex: escaped, $options: 'i' } },
          { _id: { $regex: '^' + escaped } },
        ];
      }

      if (role === 'admin') {
        filter.isAdmin = true;
      } else if (role === 'broker') {
        filter.brokerStatus = 'APPROVED';
      } else if (role === 'seller') {
        filter.sellerStatus = 'APPROVED';
      } else if (role === 'logistics') {
        filter.logisticsStatus = 'APPROVED';
      } else if (role === 'buyer') {
        // Buyer = no approved provider role and not admin
        filter.$and = (filter.$and || []).concat([
          { $or: [{ brokerStatus: { $ne: 'APPROVED' } }, { brokerStatus: { $exists: false } }] },
          { $or: [{ sellerStatus: { $ne: 'APPROVED' } }, { sellerStatus: { $exists: false } }] },
          { $or: [{ logisticsStatus: { $ne: 'APPROVED' } }, { logisticsStatus: { $exists: false } }] },
          { $or: [{ isAdmin: { $ne: true } }, { isAdmin: { $exists: false } }] },
        ]);
      }

      if (state) {
        filter['moderationStatus.state'] = state;
      }

      if (cursor) {
        const cursorPredicate = {
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
          ],
        };
        filter.$and = (filter.$and || []).concat(cursorPredicate);
      }

      const rows = await User
        .find(filter, PROJECTION)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      // Map _id → localId for mobile compatibility (SearchUserItem.localId)
      const users = items.map((u) => {
        const { _id, ...rest } = u;
        return { localId: _id.toString(), ...rest };
      });

      const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

      return res.status(200).json({ users, nextCursor });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /admin/users/search] error', err);
      return res.status(500).json({ error: 'internal' });
    }
  },
);
```

Notes:
- `escapeRegex` defends against ReDoS by escaping every regex special char before passing to mongo `$regex`. The remaining risk is one-time worst-case scans across the email index, which is bounded by `limit + 1`.
- The buyer-role predicate is the most complex: a buyer is ANY user without an APPROVED provider role and not an admin. `$exists: false` clauses cover users whose status fields were never set.
- `_id → localId` rename is critical for mobile-side compatibility — `SearchUserItem.localId` is the existing canonical field across the codebase.
- The `PROJECTION` object explicitly enumerates the fields returned. Backend-only fields (e.g. `passwordResetToken` if present) are NOT projected.
- Indexes referenced in RESEARCH §Index Use should already exist in the User schema; if not, the developer must add `userSchema.index({ ... })` definitions in `src/models/User.js` and run `User.syncIndexes()` before deploying. This plan does not modify the schema (out of scope) but the test should still pass against either an indexed or unindexed collection.
  </action>
  <verify>
    <automated>cd backend-services/carEx-services && grep -c "router.get(\\s*'/users/search'" src/admin/router.js</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend-services/carEx-services && grep -c "router.get(\\s*'/users/search'" src/admin/router.js` returns 1
    - `cd backend-services/carEx-services && grep -c "escapeRegex" src/admin/router.js` returns ≥3 (definition + 1+ call site + comment)
    - `cd backend-services/carEx-services && grep -c "ALLOWED_ROLES" src/admin/router.js` returns ≥2
    - `cd backend-services/carEx-services && grep -c "ALLOWED_STATES" src/admin/router.js` returns ≥2
    - `cd backend-services/carEx-services && grep -c "MAX_Q_LEN" src/admin/router.js` returns ≥2
    - `cd backend-services/carEx-services && grep -c "createdAt: -1, _id: -1" src/admin/router.js` returns 1
    - `cd backend-services/carEx-services && grep -c "limit + 1" src/admin/router.js` returns 1
    - `cd backend-services/carEx-services && grep -c "localId" src/admin/router.js` returns ≥2 (mapping)
    - `cd backend-services/carEx-services && grep -c "verifyIdToken" src/admin/router.js` returns ≥2
    - `cd backend-services/carEx-services && grep -c "getAdminStatus" src/admin/router.js` returns ≥2
    - `cd backend-services/carEx-services && node -e "require('./src/admin/router')"` exits 0
  </acceptance_criteria>
  <done>Search route mounted; admin gate + filters + cursor pagination + ReDoS escape all in place; mobile-friendly response shape.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add jest+supertest tests for admin gate, q matching, role/state filters, cursor pagination, ReDoS safety, validation 400s</name>
  <files>backend-services/carEx-services/__tests__/admin/searchUsers.test.js</files>
  <read_first>
    - backend-services/carEx-services/__tests__/ (existing patterns — supertest + mongodb-memory-server)
    - backend-services/carEx-services/src/admin/router.js (post-Task-1)
    - backend-services/carEx-services/src/models/User.js (User shape for seed data)
    - .planning/phases/05-admin-moderation-ui-mobile/05-VALIDATION.md (§Wave 0 Requirements — backend test row)
  </read_first>
  <behavior>
    - Seeds an admin caller plus a mix of users (buyer / seller / broker / logistics / admin, with various moderation states)
    - Tests: admin → 200; non-admin → 403; missing token → 401; q matches email substring; q matches UID prefix; role filter narrows correctly; state filter narrows correctly; combined role+state filters AND together; ReDoS payload doesn't crash or hang; q > 128 chars → 400; invalid role → 400; cursor pagination round-trips
  </behavior>
  <action>
Create `backend-services/carEx-services/__tests__/admin/searchUsers.test.js`. Use the EXACT shape below.

```javascript
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app');
const User = require('../../src/models/User');

jest.mock('../../src/middleware/auth', () => ({
  verifyIdToken: (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    req.user = { uid: token === 'admin-token' ? 'admin-uid' : 'user-uid' };
    next();
  },
}));

jest.mock('../../src/middleware/admin', () => ({
  getAdminStatus: (req, res, next) => {
    if (req.user.uid !== 'admin-uid') return res.status(403).json({ error: 'forbidden' });
    next();
  },
}));

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

async function seedUsers() {
  const baseTime = Date.now();
  const users = [
    { _id: 'admin-uid', email: 'admin@x.com', isAdmin: true, moderationStatus: { state: 'active' }, createdAt: new Date(baseTime - 1000) },
    { _id: 'broker-uid', email: 'alice.broker@example.com', brokerStatus: 'APPROVED', moderationStatus: { state: 'active' }, createdAt: new Date(baseTime - 2000) },
    { _id: 'logistics-uid', email: 'bob.logi@example.com', logisticsStatus: 'APPROVED', moderationStatus: { state: 'feature_limited' }, createdAt: new Date(baseTime - 3000) },
    { _id: 'seller-uid', email: 'carol.sale@example.com', sellerStatus: 'APPROVED', moderationStatus: { state: 'active' }, createdAt: new Date(baseTime - 4000) },
    { _id: 'buyer-uid', email: 'dave.buyer@example.com', moderationStatus: { state: 'blocked_with_review' }, createdAt: new Date(baseTime - 5000) },
  ];
  await User.insertMany(users);
}

describe('GET /api/admin/users/search', () => {
  test('returns 401 when no token', async () => {
    const res = await request(app).get('/api/admin/users/search');
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller is not admin', async () => {
    const res = await request(app)
      .get('/api/admin/users/search')
      .set('Authorization', 'Bearer non-admin');
    expect(res.status).toBe(403);
  });

  test('returns 200 + all users for empty query (admin caller)', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBe(5);
    expect(res.body.users[0].localId).toBeDefined();
  });

  test('q matches email substring case-insensitively', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?q=ALICE')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].email).toBe('alice.broker@example.com');
  });

  test('q matches Firebase UID prefix', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?q=broker-')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('broker-uid');
  });

  test('role=broker narrows to APPROVED brokers only', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?role=broker')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('broker-uid');
  });

  test('role=admin narrows to admins only', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?role=admin')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('admin-uid');
  });

  test('role=buyer excludes provider roles and admins', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?role=buyer')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('buyer-uid');
  });

  test('state filter narrows to matching moderation state', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?state=feature_limited')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('logistics-uid');
  });

  test('combined role + state filters AND together', async () => {
    await seedUsers();
    const res = await request(app)
      .get('/api/admin/users/search?role=logistics&state=feature_limited')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.users.length).toBe(1);
    expect(res.body.users[0].localId).toBe('logistics-uid');

    const noMatch = await request(app)
      .get('/api/admin/users/search?role=broker&state=feature_limited')
      .set('Authorization', 'Bearer admin-token');
    expect(noMatch.body.users.length).toBe(0);
  });

  test('q with regex special chars is escaped (ReDoS-safe)', async () => {
    await seedUsers();
    // Crafted ReDoS payload — would catastrophically backtrack in an unescaped regex
    const evilQ = '(a+)+$';
    const start = Date.now();
    const res = await request(app)
      .get(`/api/admin/users/search?q=${encodeURIComponent(evilQ)}`)
      .set('Authorization', 'Bearer admin-token');
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(1000); // proves no catastrophic backtrack
    expect(res.body.users.length).toBe(0); // literal string match returns nothing
  });

  test('returns 400 when q exceeds 128 chars', async () => {
    const longQ = 'a'.repeat(129);
    const res = await request(app)
      .get(`/api/admin/users/search?q=${longQ}`)
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('q_too_long');
  });

  test('returns 400 on invalid role', async () => {
    const res = await request(app)
      .get('/api/admin/users/search?role=superhero')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_role');
  });

  test('returns 400 on invalid state', async () => {
    const res = await request(app)
      .get('/api/admin/users/search?state=on_holiday')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_state');
  });

  test('cursor pagination round-trips', async () => {
    // Seed 30 users
    const baseTime = Date.now();
    const docs = Array.from({ length: 30 }, (_, i) => ({
      _id: `u${String(i).padStart(3, '0')}`,
      email: `u${i}@example.com`,
      moderationStatus: { state: 'active' },
      createdAt: new Date(baseTime - i * 1000),
    }));
    await User.insertMany(docs);

    const page1 = await request(app)
      .get('/api/admin/users/search?limit=10')
      .set('Authorization', 'Bearer admin-token');
    expect(page1.body.users.length).toBe(10);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/admin/users/search?limit=10&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set('Authorization', 'Bearer admin-token');
    expect(page2.body.users.length).toBe(10);
    // Continuity
    expect(page2.body.users[0].localId).not.toBe(page1.body.users[9].localId);
  });

  test('returns 400 on garbage cursor', async () => {
    const res = await request(app)
      .get('/api/admin/users/search?cursor=garbage')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_cursor');
  });
});
```

Notes:
- The ReDoS test uses an `(a+)+$` payload — classic catastrophic-backtrack input. With `escapeRegex` it becomes the literal substring `\(a\+\)\+\$` which matches nothing but doesn't hang.
- Pagination test uses 30 fully-distinct users with monotonically decreasing `createdAt` for deterministic ordering.
- Combined-filter test verifies AND semantics by also asserting an empty result when filters can't both match.
  </action>
  <verify>
    <automated>cd backend-services/carEx-services && npx jest __tests__/admin/searchUsers.test.js --silent 2>&1 | tail -3 | grep -q "passed"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend-services/carEx-services && npx jest __tests__/admin/searchUsers.test.js --silent` exits 0 with all tests green
    - File contains ≥14 test cases (`grep -c "test(" __tests__/admin/searchUsers.test.js` ≥ 14)
    - File contains the ReDoS payload assertion (`grep -c "(a+)+\\$" __tests__/admin/searchUsers.test.js` returns 1)
    - File contains the q_too_long assertion (`grep -c "q_too_long" __tests__/admin/searchUsers.test.js` returns 1)
    - File contains all 5 ALLOWED_ROLES test paths (`grep -c "role=" __tests__/admin/searchUsers.test.js` ≥ 5)
  </acceptance_criteria>
  <done>Backend search route is verified by 14+ jest tests covering auth, q matching, filters, validation, ReDoS safety, and cursor pagination.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mobile client → backend route | Untrusted Authorization header + query params; verifyIdToken + getAdminStatus enforce auth/authz |
| q query param → mongo regex | Untrusted text; MUST be regex-escaped before being passed to `$regex` |
| query params → response shape | Validated before query construction; invalid → 400 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-0b-01 | Spoofing | non-admin user fetches user list | mitigate | `getAdminStatus` middleware emits 403 for non-admins (verified in test) |
| T-05-0b-02 | Tampering | malicious `q` triggers ReDoS via regex backtracking | mitigate | `escapeRegex` strips all regex special chars; ReDoS payload `(a+)+$` becomes a literal string. Verified by latency assertion (<1000ms) in test. |
| T-05-0b-03 | Information Disclosure | response includes backend-only fields (e.g. password hash) | mitigate | Explicit `PROJECTION` object enumerates returned fields; backend-only fields are NEVER in PROJECTION |
| T-05-0b-04 | Denial of Service | admin requests `limit=999999` | mitigate | `limit` clamped to `min(rawLimit, 100)` |
| T-05-0b-05 | Denial of Service | admin sends 100KB `q` | mitigate | `MAX_Q_LEN = 128` enforced before regex construction; > 128 → 400 |
| T-05-0b-06 | Tampering | invalid role/state values bypass allowlist | mitigate | `ALLOWED_ROLES` / `ALLOWED_STATES` Sets enforce strict membership |
| T-05-0b-07 | Tampering | malformed cursor crashes route | mitigate | `decodeCursor` returns `undefined` on parse failure; handler emits 400 |
| T-05-0b-08 | Information Disclosure | UID prefix search lets admin enumerate users by guessing UID prefixes | accept | Admins are authorized to enumerate users; this is the intended capability of an admin tool |
| T-05-0b-09 | Tampering | concurrent inserts/deletes during pagination | mitigate | (createdAt, _id) cursor is total-ordered; new inserts at the head don't affect already-paginated boundaries; deletes mid-page may cause skips, accepted as standard cursor-pagination tradeoff |
| T-05-0b-10 | Repudiation | admin denies running a search | accept | Search is a read endpoint; not logged at audit level (consistent with backend convention) |
</threat_model>

<verification>
- Route file extended with new GET handler; admin middleware in chain
- 14+ jest tests pass in the backend repo
- ReDoS-safe (escapeRegex verified by timing assertion)
- Mobile ModerationService.searchUsers call (Plan 05-03) hits a real route, not 404
</verification>

<success_criteria>
- `GET /api/admin/users/search` returns the documented envelope `{ users, nextCursor }`
- Admin gate enforced, role/state allowlists enforced, q length capped, cursor validated
- All filters (q, role, state) AND together correctly
- Backend tests green
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-moderation-ui-mobile/05-0b-SUMMARY.md`
</output>
