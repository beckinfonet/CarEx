---
phase: 05
plan: 0a
type: execute
wave: 0
depends_on: []
files_modified:
  - backend-services/carEx-services/src/moderation/router.js
  - backend-services/carEx-services/__tests__/moderation/history.test.js
autonomous: false
requirements: [UI-03, UI-04]

must_haves:
  truths:
    - "Backend repo (backend-services/carEx-services) exposes GET /api/admin/moderation/:targetUid/history"
    - "Route is admin-only (verifyIdToken + getAdminStatus middleware) — non-admin requests 403"
    - "Cursor-based pagination, most recent first (sort by createdAt DESC, _id DESC tiebreak)"
    - "Returns { items: ModerationAction[], nextCursor: string | null }"
    - "Backend tests pass via jest in the backend repo"
    - "Mobile ModerationService.getHistory (Phase 4 stub) can call this route without 404"
  artifacts:
    - path: "backend-services/carEx-services/src/moderation/router.js"
      provides: "GET /api/admin/moderation/:targetUid/history mounted on existing admin moderation router"
      contains: "router.get('/:targetUid/history'"
    - path: "backend-services/carEx-services/__tests__/moderation/history.test.js"
      provides: "supertest jest coverage of admin gate, pagination, sort order"
      contains: "describe('GET /api/admin/moderation/:targetUid/history'"
  key_links:
    - from: "src/services/moderation/ModerationService.ts (mobile, Plan 05-03)"
      to: "GET /api/admin/moderation/:targetUid/history"
      via: "axios GET with { limit, cursor } params"
      pattern: "/api/admin/moderation/.*/history"
    - from: "backend route handler"
      to: "ModerationAction Mongoose model"
      via: "find().sort({ createdAt: -1, _id: -1 }).limit(N+1)"
      pattern: "sort.*createdAt.*-1"
---

<objective>
Wave 0 backend plan #1 — implement the `GET /api/admin/moderation/:targetUid/history` route in the **separate backend repo** (`backend-services/carEx-services`). This route is locked by CONTEXT.md D-16.1 and is consumed by mobile Plan 05-03 (`ModerationService.getHistory`) + Plan 05-08 (`AdminUserDetailScreen` history list).

Per CLAUDE.md the backend lives outside this repo at `backend-services/carEx-services`. **Plan is autonomous: false** because the mobile executor cannot run backend tests; the developer (or a parallel backend-aware agent) must execute these tasks in the backend repo before mobile Wave 3 plans run.

Purpose: ship the read endpoint that powers the per-user moderation history panel.
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
<!-- Existing backend admin router pattern (Phase 2) -->

The backend repo `backend-services/carEx-services` already has:
- `src/middleware/auth.js` — exports `verifyIdToken(req, res, next)` (decodes Firebase Identity Toolkit token via Google REST, attaches `req.user`)
- `src/middleware/admin.js` — exports `getAdminStatus(req, res, next)` (looks up `req.user.uid` against admin collection; 403s if not admin)
- `src/middleware/rateLimit.js` — exports `adminRateLimiter` (Phase 2 — already applied to write routes)
- `src/moderation/router.js` — Phase 2 admin moderation write router; mounted at `/api/admin/moderation` in `src/app.js`
- `src/models/ModerationAction.js` — Mongoose model with fields: `_id`, `action`, `severity?`, `targetUid`, `adminUid`, `adminEmail`, `reasonCategory?`, `note?`, `createdAt`

Existing route shape (from Phase 2 — for pattern mirroring):
```javascript
router.post('/:targetUid/suspend',
  verifyIdToken, getAdminStatus, adminRateLimiter,
  async (req, res) => { ... });
```

<!-- Cursor format -->

Cursor: opaque base64 of `{ createdAt: ISO, _id: hex }` (last item of previous page). Use this format because (a) round-trip safe via JSON+base64; (b) the (createdAt, _id) compound is unique and sort-stable; (c) backend-only opaque token — mobile treats as a string.

<!-- Mobile contract from Plan 05-03 -->

`ModerationService.getHistory(targetUid, { limit?, cursor? })` calls:
```
GET /api/admin/moderation/{targetUid}/history?limit={N}&cursor={opaque}
```
Expects response: `{ items: ModerationAction[], nextCursor: string | null }` where each `ModerationAction` matches the Mongoose model serialization.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add GET /:targetUid/history route to the admin moderation router</name>
  <files>backend-services/carEx-services/src/moderation/router.js</files>
  <read_first>
    - backend-services/carEx-services/src/moderation/router.js (existing — for the Phase 2 mount pattern: verifyIdToken + getAdminStatus + adminRateLimiter chain)
    - backend-services/carEx-services/src/middleware/auth.js (verifyIdToken signature)
    - backend-services/carEx-services/src/middleware/admin.js (getAdminStatus signature)
    - backend-services/carEx-services/src/models/ModerationAction.js (model fields + indexes)
    - .planning/phases/05-admin-moderation-ui-mobile/05-CONTEXT.md (D-16.1 — endpoint shape)
    - .planning/phases/05-admin-moderation-ui-mobile/05-RESEARCH.md (§Pitfall 7 — wave ordering rationale)
  </read_first>
  <behavior>
    - Route handles `GET /:targetUid/history` (mounted at `/api/admin/moderation` so full path = `/api/admin/moderation/:targetUid/history`)
    - Middleware chain (in order): `verifyIdToken`, `getAdminStatus`, no rate limit needed for read (Phase 2 limiter applies to mutations only — but harmless to add if convention demands; default: omit)
    - Query params: `limit` (default 25, max 100), `cursor` (opaque base64 string, optional)
    - Validation: `limit` is integer in [1, 100]; `cursor`, if present, decodes to `{ createdAt, _id }` JSON
    - Sort: `createdAt: -1, _id: -1` (most recent first, _id as deterministic tiebreak)
    - Pagination: fetch `limit + 1` rows; if N+1 returned, slice to N and emit `nextCursor` from the LAST kept item (NOT the dropped one)
    - Return shape: `{ items: ModerationAction[], nextCursor: string | null }`
    - On invalid cursor: 400 with `{ error: 'invalid_cursor' }` — do NOT silently return page 1 (would loop on mobile)
    - On non-admin: 403 emitted by `getAdminStatus` (existing behavior — no extra code needed)
  </behavior>
  <action>
Locate the existing admin moderation router (`backend-services/carEx-services/src/moderation/router.js`). Append a new route handler. Use the EXACT shape below (adapt import paths to match the actual repo conventions; if the repo uses CommonJS `require`, mirror that style — this file follows the repo's existing module style).

```javascript
// At top of file (only add if not already present):
const { verifyIdToken } = require('../middleware/auth');
const { getAdminStatus } = require('../middleware/admin');
const ModerationAction = require('../models/ModerationAction');

// Helper — encode/decode cursor (top of file or separate util)
function encodeCursor(item) {
  if (!item) return null;
  return Buffer.from(JSON.stringify({ createdAt: item.createdAt.toISOString(), _id: item._id.toString() }), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed.createdAt || !parsed._id) throw new Error('missing fields');
    return { createdAt: new Date(parsed.createdAt), _id: parsed._id };
  } catch (err) {
    return undefined; // sentinel — caller emits 400
  }
}

// Route: GET /api/admin/moderation/:targetUid/history
router.get(
  '/:targetUid/history',
  verifyIdToken,
  getAdminStatus,
  async (req, res) => {
    try {
      const { targetUid } = req.params;
      const rawLimit = parseInt(req.query.limit, 10);
      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(rawLimit, 1), 100)
        : 25;
      const cursorRaw = req.query.cursor;
      const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
      if (cursorRaw && cursor === undefined) {
        return res.status(400).json({ error: 'invalid_cursor' });
      }

      // Build query — most recent first, with cursor-based skip
      const query = { targetUid };
      if (cursor) {
        // Items strictly BEFORE the cursor in (createdAt DESC, _id DESC) order
        query.$or = [
          { createdAt: { $lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
        ];
      }

      // Fetch limit+1 to detect if more pages exist
      const rows = await ModerationAction
        .find(query)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
        .lean();

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? encodeCursor(items[items.length - 1]) : null;

      return res.status(200).json({ items, nextCursor });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /admin/moderation/:targetUid/history] error', err);
      return res.status(500).json({ error: 'internal' });
    }
  },
);
```

Notes:
- Use `lean()` for read-only output — skips Mongoose hydration overhead and returns plain JS objects suitable for direct JSON response.
- The cursor's `(createdAt, _id)` pair is fully ordered — no ties. The `$or` predicate plus the matching sort order guarantees consistent next-page boundaries.
- Do NOT add a rate limiter to this route unless the repo's admin convention explicitly mounts one on read routes. Read endpoints under admin middleware are inherently low-volume.
- Per D-16.1 the route is admin-only — `getAdminStatus` middleware handles the 403 path; no extra check needed in handler.
  </action>
  <verify>
    <automated>cd backend-services/carEx-services && grep -c "router.get(\\s*'/:targetUid/history'" src/moderation/router.js</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend-services/carEx-services && grep -c "router.get(\\s*'/:targetUid/history'" src/moderation/router.js` returns 1
    - `cd backend-services/carEx-services && grep -c "verifyIdToken" src/moderation/router.js` returns ≥2 (existing routes + new route)
    - `cd backend-services/carEx-services && grep -c "getAdminStatus" src/moderation/router.js` returns ≥2
    - `cd backend-services/carEx-services && grep -c "encodeCursor\\|decodeCursor" src/moderation/router.js` returns ≥4 (2 helpers + 2 call sites)
    - `cd backend-services/carEx-services && grep -c "createdAt: -1, _id: -1" src/moderation/router.js` returns 1
    - `cd backend-services/carEx-services && grep -c "limit + 1" src/moderation/router.js` returns 1
    - `cd backend-services/carEx-services && node -e "require('./src/moderation/router')"` exits 0 (no syntax errors)
  </acceptance_criteria>
  <done>History route mounted on the existing admin moderation router; admin gate + cursor pagination + sort order all in place.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add jest+supertest tests covering admin gate, sort order, cursor pagination, invalid cursor handling</name>
  <files>backend-services/carEx-services/__tests__/moderation/history.test.js</files>
  <read_first>
    - backend-services/carEx-services/__tests__/ (any existing moderation test for the supertest + mongodb-memory-server pattern)
    - backend-services/carEx-services/src/moderation/router.js (post-Task-1)
    - backend-services/carEx-services/src/models/ModerationAction.js (for seed data shape)
    - .planning/phases/05-admin-moderation-ui-mobile/05-VALIDATION.md (§Wave 0 Requirements — backend test row)
  </read_first>
  <behavior>
    - Uses the project's existing test harness (mongodb-memory-server + supertest + jest, per Phase 2 conventions); if not yet wired in this file, follow the pattern from Phase 2 admin tests
    - Seeds 30+ ModerationAction rows for one targetUid with descending createdAt
    - Tests: admin → 200 + N items in correct order; non-admin → 403; missing token → 401; invalid cursor → 400; cursor round-trip returns next page; final page has nextCursor === null
  </behavior>
  <action>
Create `backend-services/carEx-services/__tests__/moderation/history.test.js`. Use the EXACT shape below (adapt to repo's existing harness — if the repo uses a setup file like `tests/setup.js`, mirror it).

```javascript
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../src/app');
const ModerationAction = require('../../src/models/ModerationAction');

// Mock auth middlewares to inject a known caller
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
  await ModerationAction.deleteMany({});
});

describe('GET /api/admin/moderation/:targetUid/history', () => {
  test('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/admin/moderation/user-7/history');
    expect(res.status).toBe(401);
  });

  test('returns 403 when caller is not an admin', async () => {
    const res = await request(app)
      .get('/api/admin/moderation/user-7/history')
      .set('Authorization', 'Bearer non-admin-token');
    expect(res.status).toBe(403);
  });

  test('returns 200 + items in createdAt DESC order for admin caller', async () => {
    const now = Date.now();
    const docs = [];
    for (let i = 0; i < 5; i++) {
      docs.push({
        action: 'suspend',
        severity: 'feature_limited',
        targetUid: 'user-7',
        adminUid: 'admin-uid',
        adminEmail: 'admin@x.com',
        reasonCategory: 'spam',
        createdAt: new Date(now - i * 60_000),
      });
    }
    await ModerationAction.insertMany(docs);

    const res = await request(app)
      .get('/api/admin/moderation/user-7/history')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
    // Most recent first
    for (let i = 1; i < res.body.items.length; i++) {
      const prev = new Date(res.body.items[i - 1].createdAt).getTime();
      const curr = new Date(res.body.items[i].createdAt).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  test('paginates via cursor — second page continues where first left off', async () => {
    const now = Date.now();
    const docs = Array.from({ length: 30 }, (_, i) => ({
      action: 'suspend',
      severity: 'feature_limited',
      targetUid: 'user-7',
      adminUid: 'admin-uid',
      adminEmail: 'admin@x.com',
      reasonCategory: 'spam',
      createdAt: new Date(now - i * 60_000),
    }));
    await ModerationAction.insertMany(docs);

    const page1 = await request(app)
      .get('/api/admin/moderation/user-7/history?limit=10')
      .set('Authorization', 'Bearer admin-token');
    expect(page1.body.items.length).toBe(10);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app)
      .get(`/api/admin/moderation/user-7/history?limit=10&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set('Authorization', 'Bearer admin-token');
    expect(page2.body.items.length).toBe(10);
    expect(page2.body.items[0]._id).not.toBe(page1.body.items[9]._id);
    // Continuity: page 2 first item is older than page 1 last item
    expect(new Date(page2.body.items[0].createdAt).getTime())
      .toBeLessThanOrEqual(new Date(page1.body.items[9].createdAt).getTime());
  });

  test('final page returns nextCursor === null', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({
      action: 'suspend',
      severity: 'feature_limited',
      targetUid: 'user-7',
      adminUid: 'admin-uid',
      adminEmail: 'admin@x.com',
      reasonCategory: 'spam',
      createdAt: new Date(Date.now() - i * 60_000),
    }));
    await ModerationAction.insertMany(docs);

    const res = await request(app)
      .get('/api/admin/moderation/user-7/history?limit=10')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.items.length).toBe(5);
    expect(res.body.nextCursor).toBeNull();
  });

  test('returns 400 on garbage cursor', async () => {
    const res = await request(app)
      .get('/api/admin/moderation/user-7/history?cursor=this-is-not-base64-json')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_cursor');
  });

  test('respects limit parameter (clamped to 100)', async () => {
    const docs = Array.from({ length: 10 }, () => ({
      action: 'suspend',
      severity: 'feature_limited',
      targetUid: 'user-7',
      adminUid: 'admin-uid',
      adminEmail: 'admin@x.com',
      reasonCategory: 'spam',
      createdAt: new Date(),
    }));
    await ModerationAction.insertMany(docs);

    const res = await request(app)
      .get('/api/admin/moderation/user-7/history?limit=5')
      .set('Authorization', 'Bearer admin-token');
    expect(res.body.items.length).toBe(5);
  });
});
```

Notes:
- The auth-middleware mocks isolate this test from real Firebase token verification. Production behavior is preserved because the route still goes through both middlewares.
- `mongodb-memory-server` is the Phase 2 convention — if the repo lacks it as a dev dep, the developer must `npm i -D mongodb-memory-server` in the backend repo (one-time cost).
- Pagination assertion is order-stable because `createdAt` differs by 60s per row — no ties.
  </action>
  <verify>
    <automated>cd backend-services/carEx-services && npx jest __tests__/moderation/history.test.js --silent 2>&1 | tail -3 | grep -q "passed"</automated>
  </verify>
  <acceptance_criteria>
    - `cd backend-services/carEx-services && npx jest __tests__/moderation/history.test.js --silent` exits 0 with all tests green (≥7 tests)
    - File contains all 7 test cases listed above (`grep -c "test(" __tests__/moderation/history.test.js` ≥ 7)
    - File contains `mongodb-memory-server` import (`grep -c "mongodb-memory-server" __tests__/moderation/history.test.js` returns 1)
    - File contains supertest import (`grep -c "supertest" __tests__/moderation/history.test.js` returns 1)
  </acceptance_criteria>
  <done>Backend history route is verified by 7 jest tests covering auth, pagination, sort order, and cursor validation.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| mobile client → backend route | Untrusted Authorization header crosses; verifyIdToken validates; getAdminStatus authorizes |
| query params → mongo query | `targetUid` flows into `find({ targetUid })`; `cursor` is base64-decoded |
| stored audit data → admin response | Read-only; `lean()` returns plain JSON without mutation hooks |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-0a-01 | Spoofing | non-admin requests history of any user | mitigate | `getAdminStatus` middleware emits 403 for non-admins (verified in test 2) |
| T-05-0a-02 | Tampering | mobile fabricates a cursor pointing at arbitrary `_id` to read other users' history | accept | Cursor only constrains pagination boundary; the outer `targetUid` still scopes results to one user. Reading another user's history requires changing `targetUid` in the URL, which is already admin-gated. |
| T-05-0a-03 | Information Disclosure | history payload includes admin's email (audit field) | accept | This is the intended audit-trail behavior; admins viewing history see who took past actions |
| T-05-0a-04 | Tampering | malformed cursor crashes route or skips guard | mitigate | `decodeCursor` returns `undefined` on parse failure; handler emits 400 (verified in test 6) |
| T-05-0a-05 | Denial of Service | admin requests `limit=999999` to exhaust memory | mitigate | `limit` is clamped to `Math.min(rawLimit, 100)` |
| T-05-0a-06 | Tampering | concurrent inserts during pagination cause duplicates or skips | mitigate | Cursor uses (createdAt, _id) compound — both deterministic and total-ordered. New inserts with later createdAt do not affect already-paginated boundaries. |
| T-05-0a-07 | Repudiation | admin denies viewing history | accept | Read endpoints are not logged at audit level; this is consistent with Phase 2 backend convention. Out of scope for Phase 5. |
</threat_model>

<verification>
- Route file extended with new GET handler; admin middleware chain in place
- 7 jest tests pass in the backend repo
- Mobile ModerationService.getHistory call (Plan 05-03) will hit a real route, not 404
</verification>

<success_criteria>
- `GET /api/admin/moderation/:targetUid/history` returns the documented envelope
- Admin gate enforced (403 for non-admins, 401 for missing token)
- Cursor pagination round-trips correctly across page boundaries
- Backend tests green
</success_criteria>

<output>
After completion, create `.planning/phases/05-admin-moderation-ui-mobile/05-0a-SUMMARY.md`
</output>
