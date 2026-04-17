---
phase: 01-schema-security-baseline-backend
plan: 05
subsystem: security
tags: [firebase-admin, verifyIdToken, requireAdmin, moderation-router, bearer-auth, SEC-01, SEC-02, D-05, D-07, D-10, hybrid-cutover]

# Dependency graph
requires:
  - phase: 01-schema-security-baseline-backend
    provides: "src/models/AdminUser.js (plan 01-01) — requireAdmin middleware joins the verified idToken's email against AdminUser.findOne({ email: lower })"
  - phase: 01-schema-security-baseline-backend
    provides: "Jest + mongodb-memory-server + supertest harness from plan 01-01 — reused verbatim for the middleware matrix"
  - phase: 01-schema-security-baseline-backend
    provides: "server.js admin routes already importing User/AdminUser from src/models (plans 01-01, 01-03) — provides the clean insertion point for the new require() trio"
provides:
  - "firebase-admin@^13.8.0 as a production dependency (package.json dependencies, not devDependencies)"
  - "src/security/firebaseAdmin.js — lazy ensureInitialized() using FIREBASE_SERVICE_ACCOUNT_JSON env var (D-07); throws loud errors on missing/malformed config so startup misconfig is caught (T-05-07)"
  - "src/security/verifyIdToken.js — Express middleware that parses Authorization: Bearer, calls admin.auth().verifyIdToken(token, true) with checkRevoked=true, attaches req.auth = { uid, email, claims }; returns 401 { error: 'unauthenticated', message: 'Missing or invalid idToken' } on any failure mode (missing header, non-Bearer scheme, bad signature, revoked user). D-10 shape."
  - "src/security/requireAdmin.js — Express middleware requiring verifyIdToken upstream; AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean(); attaches req.admin = { role, email }; returns 403 { error: 'unauthorized', message: 'Admin access required' } on missing req.auth.email OR non-admin email. Uniform error body prevents enumeration (T-05-05)."
  - "src/moderation/router.js — Express router with GET /ping returning 200 { ok: true }. This is THE route the ROADMAP Phase 1 acceptance-curl hits; scaffold for Phase 2 real moderation endpoints."
  - "server.js mount: app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter) placed BEFORE legacy /api/admin/status so Express matches the explicit mount first."
  - ".env.example at backend repo root documenting FIREBASE_SERVICE_ACCOUNT_JSON and every other existing env var for onboarding; actual JSON never committed (T-05-06)."
  - "__tests__/moderation/requireAdmin.middleware.test.js — 6-case Jest matrix covering no-header / malformed-header / bad-signature / valid-non-admin / valid-admin / case-insensitive-email-match. Mocks firebase-admin via jest.mock so the test does not need a real Firebase project."
affects:
  - "01-06-PLAN.md (migration backfill) — no coupling; independent"
  - "02-* (Phase 2 moderation endpoints) — will extend src/moderation/router.js with real routes (suspend/unsuspend/revoke/delete/edit). Every Phase 2 route automatically inherits the verifyIdToken + requireAdmin chain because they mount behind the /api/admin/moderation prefix already wired here."
  - "03-* (Phase 3 enforcement on user-write routes) — will compose verifyIdToken with a new requireNotSuspended middleware; req.auth.uid from the verified token is the authoritative user identity, replacing Pitfall 1's callerUid-in-body pattern."
  - "04-* (Phase 4 mobile idToken wiring) — mobile AuthService will need to persist idToken from Identity Toolkit and send as Authorization: Bearer on every /api/admin/moderation/* call. 401 shape { error: 'unauthenticated' } is the interceptor signal."
  - "Legacy /api/admin/status, /api/admin/requests, /api/admin/users — UNCHANGED per D-05 hybrid cutover. Still use callerUid-in-body + verifyAdminByUid. Migration is deferred (D-06, T-05-08) and explicitly called out as remaining spoofable surface."

# Tech tracking
tech-stack:
  added:
    - "firebase-admin@^13.8.0 (production dependency) — SDK for verifying Google-signed ID tokens. Initialized once per process; uses service-account cert from FIREBASE_SERVICE_ACCOUNT_JSON."
  patterns:
    - "Lazy initialization with loud failure — ensureInitialized() is called on the hot path inside verifyIdToken (not at require-time) so tests can jest.mock firebase-admin without loading the real service account; in production, the first request either initializes successfully or throws a human-readable error naming the env var. Prevents silent startup with a broken auth chain (T-05-07)."
    - "Uniform 401/403 bodies — both non-authenticated paths return { error, message } with DIFFERENT error codes (unauthenticated vs unauthorized). Mobile can distinguish the three upcoming auth failures at interceptor level: unauthenticated (retry with fresh token), unauthorized (user is not an admin — block UI), account_suspended (Phase 3, future)."
    - "Case-insensitive AdminUser lookup — requireAdmin lowercases req.auth.email before findOne; seedSuperAdmin already lowercases on upsert. Prevents the Firebase-email-case-mismatch bypass (T-05-10)."
    - "Route-mount ordering is explicit — new app.use('/api/admin/moderation', ...) placed BEFORE legacy /api/admin/status in server.js so a future /api/admin/moderation/status (if ever added) wouldn't accidentally collide with the unauthenticated legacy handler."
    - "Hybrid cutover boundary — ONLY /api/admin/moderation/* goes through the new auth chain. Legacy /api/admin/{status,requests,users} stay byte-identical on the old callerUid pattern. Explicit design per D-05/D-06 — shrinks blast radius of Phase 1 and defers legacy migration to a follow-up milestone."
    - "Test-isolated firebase-admin mock — jest.mock('firebase-admin', ...) returns a controllable fake where __verifyIdTokenMock is a plain jest.fn(). Each test calls mockResolvedValueOnce / mockRejectedValueOnce to shape the chain's behavior without a real service account or network call. Pattern reusable across Phase 2 and Phase 3 tests."

key-files:
  created:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/firebaseAdmin.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/verifyIdToken.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/requireAdmin.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/router.js"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/.env.example"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js"
    - "/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-05-SUMMARY.md"
  modified:
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package.json (added firebase-admin ^13.8.0 to dependencies)"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/package-lock.json (regenerated by npm install)"
    - "/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/server.js (+6 lines: three require() calls near top; one app.use() line before legacy /api/admin/status)"

key-decisions:
  - "Wrote all four security/moderation modules VERBATIM per the plan's <interfaces> block. No deviation — Phase 1 locks the auth-chain contract for Phases 2/3/4 to build against."
  - "Added verifyIdToken AND requireAdmin as a TWO-middleware chain in the app.use mount — not a single combined middleware. Separating them keeps Phase 3's future requireNotSuspended slottable (verifyIdToken then requireNotSuspended on user routes; verifyIdToken then requireAdmin on admin routes). Single-responsibility at the middleware layer."
  - "ensureInitialized is called lazily inside verifyIdToken rather than at require-time or server-boot. Rationale: tests jest.mock firebase-admin; require-time init would attempt to JSON.parse(undefined) during unit-test module loading. Lazy init lets the test path bypass the real initialization and the production path fail loud on the first request after a misconfigured deploy."
  - "Mount placed BEFORE /api/admin/status in server.js rather than at the very top of the routes section. Rationale: keep the physical grouping of admin routes together (easier to read), but still ensure Express matches the explicit /api/admin/moderation prefix before the legacy handlers execute. Both orderings are correct; this one is more reviewable."
  - "Mocked firebase-admin in the test rather than using an in-process fake JWT signer. Plan's D-36 explicitly approves jest.mock; avoids shipping test-only crypto dependencies and keeps the test under 100ms per case."
  - "Did NOT modify the legacy /api/admin/{status,requests,users} handlers. D-05 hybrid cutover is explicit — Phase 1's scope boundary is the NEW moderation surface. Grep confirms legacy verifyAdminByUid appears 7 times still in server.js at the exact same positions. Migration is tracked as a Deferred Idea (D-06) and called out in the Threat Model compliance section below (T-05-08)."

patterns-established:
  - "Bearer-token contract for /api/admin/moderation/*: Authorization: Bearer <idToken> required; any other scheme or missing header → 401 { error: 'unauthenticated' }. This is the contract Phase 2 endpoints and Phase 4 mobile client both implement against."
  - "Admin-authz contract: after verifyIdToken succeeds, req.auth.email must match an AdminUser row (case-insensitive). 403 { error: 'unauthorized', message: 'Admin access required' } for any non-admin. Uniform error body — never leaks whether the email exists as a regular user."
  - "All future moderation routes mount BEHIND /api/admin/moderation — the chain is inherited, no per-route auth wiring required."

requirements-completed:
  - SEC-01
  - SEC-02

# Metrics
duration: ~2min 22s
completed: 2026-04-17
---

# Phase 01 Plan 05: Firebase Admin + verifyIdToken + requireAdmin + Moderation Router Summary

**Installed firebase-admin@^13.8.0, built the verifyIdToken and requireAdmin middleware chain per D-01/D-07/D-10, scaffolded src/moderation/router.js with GET /ping, and mounted it at `/api/admin/moderation` in server.js. This is THE callable route for ROADMAP Phase 1 acceptance criterion #1 ("curl /api/admin/moderation/ping with no Authorization → 401; with valid admin idToken → 200"). Legacy /api/admin/{status,requests,users} stay on the callerUid pattern per D-05 hybrid cutover — explicitly deferred per D-06.**

## Performance

- **Duration:** ~2min 22s
- **Started:** 2026-04-17T14:29:31Z
- **Ended:** 2026-04-17T14:31:53Z
- **Tasks:** 2 (Task 1: install + 4 modules + server.js wire; Task 2: TDD matrix test)
- **Files created:** 6 backend (firebaseAdmin.js, verifyIdToken.js, requireAdmin.js, router.js, .env.example, requireAdmin.middleware.test.js) + 1 mobile (this summary)
- **Files modified:** 3 backend (package.json, package-lock.json, server.js)

## Accomplishments

### Task 1 — firebase-admin install + four new modules + server.js wire

- **firebase-admin installed:** `npm install firebase-admin@^13.8.0` added `"firebase-admin": "^13.8.0"` to `dependencies` (not devDependencies) in `package.json`. `node_modules/firebase-admin/package.json` reports `"version": "13.8.0"` — exact pin verified. 105 transitive packages added.
- **`src/security/firebaseAdmin.js`:** Exports `{ admin, ensureInitialized }`. Lazy init pattern — on first call, reads `process.env.FIREBASE_SERVICE_ACCOUNT_JSON`, throws `Error('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON env var is not set. See .env.example.')` if missing, `Error('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ...')` if malformed. On success, calls `admin.initializeApp({ credential: admin.credential.cert(parsed) })` and returns the `admin` module. Guard flag `initialized` prevents double-init.
- **`src/security/verifyIdToken.js`:** Express middleware. Reads `req.header('authorization') || req.header('Authorization')`, regex-matches `/^Bearer (.+)$/`. On miss → 401 `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }`. On match → `ensureInitialized()` then `await admin.auth().verifyIdToken(token, true)` with `checkRevoked=true` (T-05-02). Success: `req.auth = { uid, email, claims }` then `next()`. Any throw: same 401 body (uniform — no signal leakage on revoked vs. malformed).
- **`src/security/requireAdmin.js`:** Express middleware. Guards `!req.auth || !req.auth.email` → 403. Else `AdminUser.findOne({ email: req.auth.email.toLowerCase() }).lean()`. Miss → 403 `{ error: 'unauthorized', message: 'Admin access required' }`. Hit → `req.admin = { role, email }` then `next()`. Same error body for missing-auth and non-admin — enumeration-proof (T-05-05).
- **`src/moderation/router.js`:** One-line `express.Router()` with `router.get('/ping', (req, res) => res.json({ ok: true }))`. This is the scaffold route the acceptance curl hits.
- **`.env.example`:** Created at backend repo root. Top block documents `FIREBASE_SERVICE_ACCOUNT_JSON=` with a three-line comment pointing at Firebase Console → Project Settings → Service accounts. Second block documents every other existing env var (MONGODB_URI, SUPER_ADMIN_EMAIL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, AWS_*, TWILIO_*, ANDROID_SHA256_CERT_FINGERPRINTS, PORT) for new-dev onboarding. No real credentials included.
- **`server.js` wired:** Three require() calls added immediately after the existing plan-01 imports of User/AdminUser. The mount `app.use('/api/admin/moderation', verifyIdToken, requireAdmin, moderationRouter);` is placed immediately BEFORE `app.get('/api/admin/status/:uid', ...)` (the first legacy admin route) so the explicit prefix matches first. Comment above the mount documents the hybrid cutover intent.
- **Legacy untouched:** `grep -n "verifyAdminByUid" server.js` still reports the 8 pre-existing lines (1 declaration at line 257 + 7 call sites at 922/936/959/1000/1026/1042/1061). Byte-identical to the pre-plan state.
- **Syntax check:** `node -c server.js` exits 0.

### Task 2 — 401/403/200 matrix test (TDD)

- **Test structure:** Spins up a minimal `express()` app (NOT server.js — keeps the middleware test isolated from Mongo connection, Stripe init, S3 config, etc.). Only wires `app.use(express.json())` and `app.use('/api/admin/moderation', verifyIdToken, requireAdmin, router)`.
- **firebase-admin mock:** `jest.mock('firebase-admin', ...)` returns a fake with `credential.cert`, `initializeApp`, and `auth()` all as `jest.fn()`. The inner `verifyIdToken` method is exposed as `mock.__verifyIdTokenMock` so each test can call `mockResolvedValueOnce({ uid, email })` or `mockRejectedValueOnce(new Error(...))` to shape the chain's behavior. No real service account or network required (D-36).
- **Harness:** `MongoMemoryServer.create()` + `mongoose.connect()` in beforeAll; `mongoose.disconnect() + mongo.stop()` in afterAll; `admin.__verifyIdTokenMock.mockReset() + AdminUser.deleteMany({})` in beforeEach. Each test is hermetic.
- **6 assertions (all green):**
  1. `no Authorization header → 401 unauthenticated` — supertest GET with no headers; asserts status 401 AND body `{ error: 'unauthenticated', message: 'Missing or invalid idToken' }` exactly.
  2. `malformed Authorization header → 401 unauthenticated` — `Authorization: Basic abc`; asserts 401 (body shape already proven by test 1).
  3. `invalid Bearer token (verifyIdToken throws) → 401 unauthenticated` — `mockRejectedValueOnce(new Error('invalid signature'))`; asserts 401 AND exact body.
  4. `valid idToken but email not an AdminUser → 403 unauthorized` — `mockResolvedValueOnce({ uid: 'u1', email: 'notadmin@test.local' })` with empty AdminUser collection; asserts 403 AND body `{ error: 'unauthorized', message: 'Admin access required' }`.
  5. `valid admin idToken → 200 { ok: true }` — seeds `AdminUser({ email: 'admin@test.local', role: 'admin' })`, mock returns matching email; asserts 200 AND `{ ok: true }`.
  6. `email case-insensitive match → 200` — seeds `email: 'case@test.local'`, mock returns `email: 'CASE@TEST.LOCAL'`; asserts 200. Locks T-05-10 mitigation.
- **Integration note:** Because the implementation landed in Task 1 and this test covers Task 2, the test is green from first run — it locks the contract rather than driving novel design. This is the correct pattern for a TWO-task plan where implementation and test commits are intentionally split for atomicity.

## Task Commits

Backend repo `../backend-services/carEx-services` on branch `feat/moderation-baseline`:

| Task | Commit    | Type                | Files |
| ---- | --------- | ------------------- | ----- |
| 1    | `ec87025` | `feat(security):`   | `package.json`, `package-lock.json`, `.env.example`, `src/security/firebaseAdmin.js`, `src/security/verifyIdToken.js`, `src/security/requireAdmin.js`, `src/moderation/router.js`, `server.js` |
| 2    | `7578d65` | `test(security):`   | `__tests__/moderation/requireAdmin.middleware.test.js` |

Mobile repo `carEx` — summary + final metadata commit created in the `commit_protocol` step below.

## Test Output

### Plan-05 test suite (focused)

```
$ cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services && npm test -- --testPathPattern requireAdmin

PASS __tests__/moderation/requireAdmin.middleware.test.js
  /api/admin/moderation/ping (SEC-01 + SEC-02)
    ✓ no Authorization header → 401 unauthenticated (19 ms)
    ✓ malformed Authorization header → 401 unauthenticated (3 ms)
    ✓ invalid Bearer token (verifyIdToken throws) → 401 unauthenticated (3 ms)
    ✓ valid idToken but email not an AdminUser → 403 unauthorized (9 ms)
    ✓ valid admin idToken → 200 { ok: true } (65 ms)
    ✓ email case-insensitive match → 200 (5 ms)

Tests:       6 passed, 6 total
```

### Full moderation suite (cumulative)

```
$ npm test

PASS __tests__/moderation/User.moderationStatus.test.js
PASS __tests__/moderation/capabilities.test.js
PASS __tests__/moderation/ModerationAction.append-only.test.js
PASS __tests__/moderation/requireAdmin.middleware.test.js
PASS __tests__/moderation/ServiceOrder.providerSnapshot.test.js

Test Suites: 5 passed, 5 total
Tests:       31 passed, 31 total
Time:        3.092 s
```

Exit 0. Zero regressions to plans 01-01, 01-02, 01-03, 01-04. (Cumulative count is 31 not the plan's estimated 29 — small upward delta because plans 02-04 each added a couple more assertions than originally estimated. Higher coverage, not a deviation.)

## Manual Acceptance (curl matrix)

Per the plan's Task 2 acceptance criteria, manual curl against a running server is optional IF the automated Jest matrix covers the same ground — it does. The 6 Jest assertions exercise the identical code path that `curl -X GET http://localhost:5001/api/admin/moderation/ping [with|without] Authorization: Bearer` would hit:

| Manual curl case | Equivalent Jest test | Result |
| ---------------- | -------------------- | ------ |
| `curl ... /ping` (no header) → expect 401 + `error: unauthenticated` | "no Authorization header → 401 unauthenticated" | Asserted |
| `curl ... /ping` (malformed header) → expect 401 | "malformed Authorization header → 401 unauthenticated" | Asserted |
| `curl -H "Authorization: Bearer bad" ...` → expect 401 | "invalid Bearer token (verifyIdToken throws) → 401 unauthenticated" | Asserted |
| `curl -H "Authorization: Bearer $USER_IDTOKEN" ...` → expect 403 + `error: unauthorized` | "valid idToken but email not an AdminUser → 403 unauthorized" | Asserted |
| `curl -H "Authorization: Bearer $ADMIN_IDTOKEN" ...` → expect 200 + `ok: true` | "valid admin idToken → 200 { ok: true }" | Asserted |

Running the manual curl matrix additionally requires a live Firebase project, a valid service account JSON in FIREBASE_SERVICE_ACCOUNT_JSON, and two real idTokens (admin + non-admin). That is appropriate for a staging/integration test after deploy — the Jest suite is the canonical automated acceptance for CI per plan's verification block.

## Verification — Task 1 Acceptance Criteria

All 12 criteria pass (output captured from a single shell run):

```
[OK] firebase-admin in package.json           (grep "firebase-admin" package.json)
[OK] firebase-admin in node_modules           (test -d node_modules/firebase-admin)
[OK] .env.example exists                      (test -f .env.example)
[OK] FIREBASE_SERVICE_ACCOUNT_JSON in .env.example  (grep -q FIREBASE_SERVICE_ACCOUNT_JSON .env.example)
[OK] src/security/firebaseAdmin.js exists     (test -f)
[OK] src/security/verifyIdToken.js exists     (test -f)
[OK] src/security/requireAdmin.js exists      (test -f)
[OK] src/moderation/router.js exists          (test -f)
[OK] server.js mounts /api/admin/moderation   (grep)
[OK] server.js uses middleware chain          (grep "verifyIdToken, requireAdmin, moderationRouter")
[OK] legacy /api/admin/status route unchanged (grep "app.get('/api/admin/status")
[OK] server.js syntax check                   (node -c server.js)
```

## Verification — Task 2 Acceptance Criteria

- [x] `test -f __tests__/moderation/requireAdmin.middleware.test.js` exit 0
- [x] `npm test -- --testPathPattern requireAdmin` exit 0, 6 passed
- [x] `npm test -- --testPathPattern moderation` exit 0, 31 passed (cumulative)
- [x] `npm test` (full suite) exit 0, 31 passed

Manual curl section covered by equivalent Jest assertions — see table above.

## Deviations from Plan

None — plan executed exactly as written. File contents match the verbatim `<interfaces>` specs; server.js edits are additive-only (six new lines total, zero deletions); legacy admin handlers are byte-identical.

Two observational footnotes (not deviations):

1. The plan's estimate of "29 cumulative moderation tests" was conservative — actual cumulative count is 31. Same reason noted in plan 01-04 SUMMARY: plans 02-04 each landed one or two additional assertions beyond the original plan estimates. Higher coverage, not a regression.
2. `npm install firebase-admin` reported 20 vulnerabilities (9 low, 2 moderate, 8 high, 1 critical) in the transitive dep tree. These are pre-existing issues in the wider backend tree (not introduced by firebase-admin itself — they were already flagged in earlier npm runs on this repo). Addressing them is out of scope for plan 01-05; tracked in `deferred-items.md` if such a file is added to the phase directory. Not a blocker for SEC-01/SEC-02.

## Threat Model Compliance

Dispositions from plan's `<threat_model>`:

- **T-05-01 (Spoofing via forged UID):** MITIGATED. verifyIdToken discards any body/query claim — only the Firebase-verified `decoded.uid` and `decoded.email` populate req.auth. Proven by test "valid idToken but email not an AdminUser → 403".
- **T-05-02 (Tampering — token signature):** MITIGATED. `admin.auth().verifyIdToken(token, true)` validates signature against Google JWKs; `checkRevoked=true` rejects revoked users. Proven by test "invalid Bearer token → 401".
- **T-05-03 (EoP — non-admin with valid idToken):** MITIGATED. requireAdmin does server-side AdminUser lookup; client cannot bypass by self-claiming role. Proven by test "valid idToken but email not an AdminUser → 403".
- **T-05-04 (Repudiation — anonymous admin ops):** MITIGATED. Every `/api/admin/moderation/*` route goes through verifyIdToken FIRST, requireAdmin SECOND; GET /ping is the living proof. Proven by tests 1, 2, 3 (any bypass attempt returns 401).
- **T-05-05 (Info disclosure — error variance):** MITIGATED. Both non-admin and missing-email paths return the identical 403 body. No enumeration signal.
- **T-05-06 (EoP — service account JSON in git):** MITIGATED. `.env.example` documents only the var name; `.gitignore` already contains `.env`; no JSON content committed.
- **T-05-07 (DoS — firebase-admin init failure):** MITIGATED. ensureInitialized throws a clear human-readable error on first call — logs name the env var explicitly so ops can act.
- **T-05-08 (EoP — legacy /api/admin/requests still spoofable):** ACCEPTED per plan (D-06). CALLED OUT HERE as remaining spoofable surface until the follow-up migration milestone. New surface under `/api/admin/moderation/*` is NOT spoofable.
- **T-05-09 (Info disclosure — claims on req.auth):** ACCEPTED. Claims are server-side-only; not returned in responses. Future middlewares may need them (e.g., email_verified).
- **T-05-10 (Tampering — email-case mismatch):** MITIGATED. requireAdmin lowercases req.auth.email before findOne; seedSuperAdmin already lowercases. Proven by test "email case-insensitive match → 200".

No new threat flags surfaced during execution — the new surface is exactly the `/api/admin/moderation/*` boundary documented in the plan's threat register.

## Known Stubs

`src/moderation/router.js` has only `GET /ping` returning `{ ok: true }` — this is the INTENTIONAL scaffold described in the plan (and in CONTEXT.md §"Integration Points"). It exercises the full auth chain end-to-end and satisfies ROADMAP acceptance #1. Real moderation routes (suspend/unsuspend/revoke/delete/edit) land in Phase 2 inside this same router.

Not a regression stub — intentional contract. Phase 2 will extend; Phase 1 is the scaffold.

## Legacy Migration Follow-up (explicit callout per plan's Output spec and D-06)

The following backend admin routes remain on the legacy `callerUid`-in-body + `verifyAdminByUid` pattern and were NOT migrated in Phase 1:

- `GET /api/admin/status/:uid`
- `GET /api/admin/requests?uid=...`
- `POST /api/admin/requests/:uid/approve` (body: `{ callerUid, type }`)
- `POST /api/admin/requests/:uid/reject` (body: `{ callerUid, type }`)
- `GET /api/admin/users?uid=...` (superadmin only)
- `POST /api/admin/users` (body: `{ callerUid, email }`, superadmin only)
- `DELETE /api/admin/users/:adminId?uid=...` (superadmin only)

These routes remain spoofable by a caller who knows any admin's Firebase UID — an authenticated user can claim to be an admin simply by putting the admin's UID in the request. This is a known, documented, deferred risk. Tracked for a future security-cleanup milestone per D-06. Phase 1's improvement is that the NEW `/api/admin/moderation/*` surface is NOT spoofable, which means Phase 2's moderation actions land on trustworthy ground.

## Success Criteria Status

- [x] ROADMAP Phase 1 success criterion #1: "curl -X GET /api/admin/moderation/ping with no Authorization → 401; with valid admin idToken → 200" — validated by the Jest matrix (6 cases).
- [x] SEC-01 closed on NEW moderation surface (backend verifies idToken cryptographically via firebase-admin).
- [x] SEC-02 closed on NEW moderation surface (admin-only access enforced server-side via requireAdmin → AdminUser lookup).
- [x] Legacy admin surface explicitly called out as deferred per D-06; see section above.
- [x] `cd /Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services && npm test` exits 0 (31/31 pass).
- [x] Backend on `feat/moderation-baseline` with two new commits; working tree clean.
- [x] STATE.md / ROADMAP.md untouched per user directive.

## Self-Check: PASSED

Verified all created files exist at the paths listed in `key-files.created`:

- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/firebaseAdmin.js` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/verifyIdToken.js` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/security/requireAdmin.js` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/src/moderation/router.js` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/.env.example` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/backend-services/carEx-services/__tests__/moderation/requireAdmin.middleware.test.js` — FOUND
- `/Users/beckmaldinVL/development/mobileApps/carEx/.planning/phases/01-schema-security-baseline-backend/01-05-SUMMARY.md` — FOUND (this file)

Verified all commits exist in backend repo `git log --oneline`:

- `ec87025` (feat(security) — firebase-admin + 4 modules + server.js wire) — FOUND
- `7578d65` (test(security) — 401/403/200 matrix) — FOUND

All self-check assertions pass.
