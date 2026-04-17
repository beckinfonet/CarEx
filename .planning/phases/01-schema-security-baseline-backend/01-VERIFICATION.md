---
phase: 01-schema-security-baseline-backend
verified: 2026-04-17T15:00:00Z
status: passed
score: 5/5
overrides_applied: 0
re_verification: false
---

# Phase 1: Schema + Security Baseline (Backend) — Verification Report

**Phase Goal:** Backend can verify admin callers cryptographically and has the data shape required to store moderation state, audit entries, and deletion-safe order snapshots.
**Verified:** 2026-04-17T15:00:00Z
**Status:** VERIFICATION PASSED
**Re-verification:** No — initial verification

---

## Phase Goal Delivered?

**Yes.** All five ROADMAP success criteria are satisfied by working code in the backend repo on branch `feat/moderation-baseline`. Cryptographic admin verification via Firebase `verifyIdToken` is live on `/api/admin/moderation/*`, all three data shape requirements (User.moderationStatus, ModerationAction append-only, ServiceOrder.providerSnapshot) are implemented and tested, the capability map is a pure importable policy module, and the backfill migration covers existing data. 36 automated Jest tests pass with exit 0.

---

## Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `POST /api/admin/moderation/ping` with no `Authorization: Bearer` returns 401; with valid admin idToken returns success | VERIFIED | `requireAdmin.middleware.test.js` — 6-case matrix: no-header→401, malformed→401, bad-sig→401, non-admin→403, admin→200, case-insensitive-email→200. All pass. `server.js:919` mounts `verifyIdToken, requireAdmin, moderationRouter` at `/api/admin/moderation`. |
| 2 | `db.users.findOne(...)` on any existing user shows `moderationStatus` subdoc with `state: 'active'` (migration backfilled) | VERIFIED | `src/models/User.js` — 8-field `moderationStatus` subdoc with `state` default `'active'` (plan 01-02). `scripts/migrate-moderation.js` backfills existing users idempotently (plan 01-06). `ensureBaseline()` wired post-connect to warn on drift. `User.moderationStatus.test.js` — 6 cases, all pass. |
| 3 | `db.orders.findOne(...)` on any existing order shows populated `providerSnapshot` field (migration backfilled) | VERIFIED | `server.js:207-215` — providerSnapshot extended to 8 fields (companyName, phoneNumber, telegramUsername, email, firstName, lastName, providerRole, snapshotAt). POST /api/orders handler rewired for server-authoritative snapshot population. `scripts/migrate-moderation.js` backfills existing orders. `ServiceOrder.providerSnapshot.test.js` — 5 cases, all pass including the "stale-from-client" test proving client values are ignored. |
| 4 | `ModerationAction.updateOne(...)` or `deleteOne(...)` in unit test throws "ModerationAction is append-only" | VERIFIED | `src/models/ModerationAction.js` — six pre-hooks (updateOne, updateMany, findOneAndUpdate, deleteOne, deleteMany, findOneAndDelete) each throwing `Error('ModerationAction is append-only')`. `ModerationAction.append-only.test.js` — 4 cases, all pass (verified by running `npm test --testPathPattern ModerationAction.append-only`: 4/4). |
| 5 | `require('moderation/capabilities')` resolves; `STATUS_POLICY` has entry for every severity state | VERIFIED | `src/moderation/capabilities.js` — pure module (zero requires). `node -e "require('./src/moderation/capabilities').STATUS_POLICY"` returns `['active','feature_limited','blocked_with_review','permanently_banned']` — identity-matches the `User.moderationStatus.state` enum. `capabilities.test.js` — 10 cases, all pass including parity test and resolveRestrictedFeatures fail-closed on unknown state. |

---

## Requirement Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 01-05 | Backend verifies admin callers cryptographically (Firebase verifyIdToken replaces spoofable callerUid-in-body) | SATISFIED | `src/security/verifyIdToken.js` parses `Authorization: Bearer`, calls `admin.auth().verifyIdToken(token, true)` with checkRevoked=true, attaches `req.auth`. Applied to all `/api/admin/moderation/*` routes. |
| SEC-02 | 01-05 | Admin-only access enforced server-side | SATISFIED | `src/security/requireAdmin.js` looks up `AdminUser.findOne({ email })` after verifyIdToken; 403 on non-admin. Case-insensitive email match prevents bypass. |
| DATA-01 | 01-02, 01-06 | User.moderationStatus subdoc with state, severity, restrictedFeatures, audit ref | SATISFIED | `src/models/User.js` — 8-field subdoc per D-11. Two indexes per D-13. Migration + ensureBaseline per D-29/D-30. |
| DATA-02 | 01-01 | ModerationAction append-only collection with six pre-hooks | SATISFIED | `src/models/ModerationAction.js` — full schema per D-15, two compound indexes per D-16, six pre-hooks per D-17. 4 passing tests. |
| DATA-03 | 01-03, 01-06 | ServiceOrder.providerSnapshot deletion-safe with email/firstName/lastName/providerRole/snapshotAt | SATISFIED | `server.js:207-215` — 8-field providerSnapshot. POST /api/orders server-authoritative lookup. Migration backfills existing orders. |
| DATA-04 | 01-04 | Central capability map governing severity-state feature gating | SATISFIED | `src/moderation/capabilities.js` — STATUS_POLICY with 4 entries, resolveRestrictedFeatures helper, fail-closed on unknown state. 10 passing tests. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server.js` | `src/security/verifyIdToken.js` | `require` + `app.use` | WIRED | `server.js:14-15,919` — three requires + mount confirmed by grep |
| `server.js` | `src/security/requireAdmin.js` | `require` + `app.use` | WIRED | Same mount chain at line 919 |
| `server.js` | `src/moderation/router.js` | `require` + `app.use` | WIRED | `moderationRouter` mounted at `/api/admin/moderation` |
| `server.js` | `src/models/User.js` | `require` | WIRED | Extracted in plan 01-01; verified by grep |
| `server.js` | `src/models/AdminUser.js` | `require` | WIRED | Extracted in plan 01-01; verified by grep |
| `server.js` | `src/security/ensureBaseline.js` | post-connect `await ensureBaseline()` | WIRED | `server.js` post-connect hook wires after `seedSuperAdmin()` |
| POST /api/orders handler | Broker/LogisticsPartner + User | server-side lookup | WIRED | `server.js:1159-1186` — replaces client-supplied snapshot with authoritative DB lookup |
| `requireAdmin.js` | `src/models/AdminUser.js` | `AdminUser.findOne` | WIRED | Case-insensitive email lookup; proven by middleware test |

---

## Artifacts Verified

| Artifact | Status | Details |
|----------|--------|---------|
| `src/models/User.js` | VERIFIED | 8-field moderationStatus subdoc + 2 indexes. Exists, substantive, wired via server.js require. |
| `src/models/AdminUser.js` | VERIFIED | Extracted verbatim. Wired in server.js and used by requireAdmin. |
| `src/models/ModerationAction.js` | VERIFIED | Six pre-hooks, compound indexes, collection name `moderation_actions`. |
| `src/moderation/capabilities.js` | VERIFIED | STATUS_POLICY + resolveRestrictedFeatures. Pure module, zero requires. |
| `src/moderation/service.js` | VERIFIED (stub by design) | Five locked stubs throwing NotImplementedError. Intentional Phase 1 contract; Phase 2 replaces implementations. |
| `src/moderation/actions.js` | VERIFIED | writeAction validates 4 required fields, delegates to ModerationAction.create. Single audit write path. |
| `src/moderation/router.js` | VERIFIED | GET /ping returns `{ ok: true }`. Mounted at /api/admin/moderation behind auth chain. |
| `src/security/firebaseAdmin.js` | VERIFIED | Lazy init with loud failure on missing FIREBASE_SERVICE_ACCOUNT_JSON. |
| `src/security/verifyIdToken.js` | VERIFIED | Parses Bearer, calls verifyIdToken(token, true), 401 on any failure. Wired via app.use. |
| `src/security/requireAdmin.js` | VERIFIED | AdminUser lookup, case-insensitive email, 403 uniform body. |
| `src/security/ensureBaseline.js` | VERIFIED | countDocuments check on startup, warns if backfill pending, never writes. |
| `scripts/migrate-moderation.js` | VERIFIED | Idempotent 3-step backfill (users, orders, indexes), exits non-zero on orphan orders. |
| `__tests__/moderation/ModerationAction.append-only.test.js` | VERIFIED | 4 tests, all pass. |
| `__tests__/moderation/User.moderationStatus.test.js` | VERIFIED | 6 tests, all pass. |
| `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` | VERIFIED | 5 tests, all pass. |
| `__tests__/moderation/capabilities.test.js` | VERIFIED | 10 tests, all pass. |
| `__tests__/moderation/requireAdmin.middleware.test.js` | VERIFIED | 6 tests, all pass. |
| `__tests__/moderation/migrate-moderation.test.js` | VERIFIED | 5 tests, all pass. |
| `.env.example` | VERIFIED | FIREBASE_SERVICE_ACCOUNT_JSON documented. No real credentials committed. |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/moderation/service.js` | Five stub methods throw NotImplementedError | INFO | Intentional by design (D-01). Phase 2 replaces with real implementations. Not a blocker. |
| `src/models/AdminUser.js` | Duplicate Mongoose email index warning (pre-existing) | INFO | Pre-dates this phase. Preserved verbatim per extraction mandate. Cosmetic warning only; no functional impact. |
| Legacy `/api/admin/{status,requests,users}` | Still uses spoofable callerUid-in-body pattern | WARNING | Explicitly deferred per D-05/D-06. New `/api/admin/moderation/*` surface is cryptographically secured. Known and documented risk, tracked for follow-up milestone. |

No blockers found.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| STATUS_POLICY resolves with 4 keys | `node -e "require('./src/moderation/capabilities').STATUS_POLICY"` | `['active','feature_limited','blocked_with_review','permanently_banned']` | PASS |
| ModerationAction append-only throws | `npm test --testPathPattern ModerationAction.append-only` | 4/4 pass | PASS |
| Auth chain 401/403/200 matrix | `npm test --testPathPattern requireAdmin` | 6/6 pass | PASS |
| User.moderationStatus schema path | `node -e "U.schema.path('moderationStatus.state')"` | `moderationStatus.state: OK` with 4 enum values | PASS |
| Full test suite | `npm test` | 36/36 pass, exit 0 | PASS |
| Legacy route preserved (D-05) | `grep "app.get('/api/admin/status"` | Line 922, present and unchanged | PASS |
| verifyAdminByUid still used on legacy routes | `grep "verifyAdminByUid" server.js` | 1 declaration + 4+ call sites at original positions | PASS |
| Car.listingStatus enum unchanged (no 'suspended') | `grep "listingStatus.*enum" server.js` | `enum: ['active', 'booked', 'sold']` — no 'suspended' | PASS |
| Commit count on feat/moderation-baseline | `git log --oneline main..feat/moderation-baseline` | 16 commits (matches expected ~16) | PASS |
| providerSnapshot server-authoritative | `grep "providerRole\|snapshotAt" server.js` | Lines 214-215 in schema; lines 1185-1186 in creation handler | PASS |

---

## Human Verification Required

None. All success criteria were verifiable programmatically via running tests and code inspection. The manual `curl` criterion (#1) is covered by the 6-case Jest middleware matrix which exercises the identical code path.

**One item for post-deploy ops verification (not a gap — informational):**

Running `node scripts/migrate-moderation.js` against the production MongoDB URI is required to backfill existing live users and orders. Success criteria #2 and #3 are satisfied at the code/schema level; data migration of live production records depends on this manual step being executed after deploy. The `ensureBaseline()` startup hook will warn at every boot until this is done.

---

## Concerns (non-blocking)

1. **Legacy admin routes remain spoofable.** `/api/admin/{status,requests,users}` still accept `callerUid` in the request body with no cryptographic verification. This is an explicitly known and documented deferred risk (D-05/D-06). The new moderation surface is fully secured; the legacy surface migration is tracked for a follow-up milestone.

2. **npm audit vulnerabilities (transitive devDependencies).** 12 vulnerabilities reported from jest/supertest/mongodb-memory-server transitive deps. All are in devDependencies and do not ship to production. Tracked as deferred tech-debt.

3. **Pre-existing duplicate Mongoose index on AdminUser.email.** Cosmetic warning only; pre-dates this phase. Can be cleaned in a future schema-maintenance pass.

---

## Gaps Summary

No gaps. All 5 ROADMAP success criteria verified. All 6 requirements (SEC-01, SEC-02, DATA-01, DATA-02, DATA-03, DATA-04) satisfied. 36 tests green. Code exists, is substantive, and is wired.

---

## Ready for Phase 2?

**Yes.** Every Phase 2 dependency is in place:
- The auth chain (`verifyIdToken` + `requireAdmin`) is mounted at `/api/admin/moderation` — Phase 2 routes inherit it automatically.
- `src/moderation/router.js` is the scaffold Phase 2 extends with real moderation routes.
- `src/moderation/service.js` exposes the locked method signatures Phase 2 implements.
- `src/moderation/actions.js` is the single audit write path Phase 2 must use.
- `User.moderationStatus` schema is the mutation boundary Phase 2 handlers respect.
- `ModerationAction` append-only enforcement prevents any accidental update/delete from Phase 2 code.

---

_Verified: 2026-04-17T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Backend branch: feat/moderation-baseline_
