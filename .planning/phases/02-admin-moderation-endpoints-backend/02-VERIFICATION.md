---
phase: 02-admin-moderation-endpoints-backend
verified: 2026-04-17T18:15:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: none
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: Admin Moderation Endpoints (Backend) — Verification Report

**Phase Goal:** Admins can suspend, unsuspend, revoke role, delete provider profile, and edit provider profile via rate-limited HTTP endpoints, each writing an audit row atomically.
**Verified:** 2026-04-17T18:15:00Z
**Status:** passed
**Re-verification:** No — initial verification.
**Cross-repo note:** Phase-2 implementation lives in sibling repo `backend-services/carEx-services/`; `.planning/` lives in the carEx mobile repo.

---

## Goal Achievement

### Observable Truths (ROADMAP.md §Phase 2 Success Criteria 1–5 + plan-level must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /:targetUid (action='suspend') updates User.moderationStatus + appends ModerationAction in ONE Mongoose transaction; PATCH /unsuspend returns user to 'active' and appends a new audit row (originals never mutated). `lastActionId` back-link set. | VERIFIED | `service.js:68` and `service.js:165` both use `session.withTransaction`. `ModerationAction.create([...], { session })` array form appears 6× (one per action + 1 comment). `lastActionId: action._id` set at `service.js:110` (suspend) and `service.js:185` (unsuspend). `suspend.test.js` re-suspend test asserts both audit rows persist + `lastActionId` flips. `ModerationAction.append-only.test.js` enforces audit immutability at the schema layer (Phase 1). All 6 suspend + 2 unsuspend tests green. |
| 2 | POST /:targetUid (action='revoke_role') strips `User.{role}Status` to 'NONE'; Broker/LogisticsPartner doc remains. | VERIFIED | `service.js:223-293` wraps $set roleField='NONE' + audit-row insert in `withTransaction`. Negative grep on the revokeRole function body: 0 matches for `deleteOne\|Broker\.\|LogisticsPartner\.` (no provider-doc mutation). `revokeRole.test.js` tests 2+3 explicitly assert the Broker/LogisticsPartner doc still exists after revoke. Test 6 asserts `moderationStatus` untouched (D-12 orthogonality). All 6 revoke tests green. |
| 3 | DELETE /:targetUid/provider-profile hard-deletes Broker/LogisticsPartner doc; ServiceOrder.providerSnapshot preserved (service_orders NEVER touched). | VERIFIED | `service.js:322-408` runs audit insert + `ProfileModel.deleteOne({ ownerUid })` + `User.updateOne $set roleField='NONE'` in one `withTransaction`. Body contains only a single reference to `service_orders` — a comment explicitly stating "EXPLICITLY do NOT touch service_orders". `deleteProviderProfile.test.js` test 1 seeds a ServiceOrder with populated providerSnapshot, runs delete, asserts order + snapshot survive unchanged. Also includes rollback tests (audit-failure rollback + post-delete rollback via User.updateOne throwing mid-txn). 7 tests green. |
| 4 | POST /:targetUid/edit-profile applies whitelisted field changes + writes audit row with per-field `fieldDiff {before, after}`; unchanged fields untouched. | VERIFIED | `service.js:438-530` enforces `EDIT_WHITELIST_BY_ROLE` (broker: 3 fields, logistics: 5) with defensive service-layer check that throws `invalid_field` + `err.fields` before any DB I/O. Zod `.strict()` at `schemas.js:56,64` enforces the same whitelist at router level. fieldDiff shape confirmed at `service.js:477` (`fieldDiff[key] = { before: before ?? null, after }`) — test assertion `expect(result.fieldDiff).toEqual({ companyName: { before: 'Old', after: 'New' } })` at editProfile.test.js:66. `no_changes` thrown when filter produces empty diff (service.js:482). 8 editProfile tests green (whitelist, no_changes, invalid_field, coverageAreas array diff, role_not_assigned, moderationStatus untouched). |
| 5 | Self-moderation → 400 cannot_moderate_self; last-active-admin → 400 last_admin_protected; >30/15min → 429. | VERIFIED | `denySelfModeration.js:14-33` returns 400 `{ error: 'cannot_moderate_self' }` when `req.params.targetUid === req.admin.uid`. `rateLimit.js:22-51` enforces 30/15min keyed on `admin:${req.admin.uid}` and returns 429 with `{ error: 'rate_limited', retryAfter }` + `Retry-After` header. Last-admin guard at `service.js:85-99` runs `AdminUser.distinct('email')` + `User.countDocuments({ email: {$in: emails}, 'moderationStatus.state': 'active' }).session(session)` INSIDE the suspend transaction — throws `last_admin_protected` when target is an active admin and post-mutation count would drop to 0. `acceptance.test.js` has 3 describe blocks for Criterion #5: part 1 (cannot_moderate_self, 4 tests across all 4 mutating routes), part 2 (last_admin_protected through wired router), part 3 (30→200 + 31st→429 + per-admin keying with 2nd admin unblocked). All 7+ acceptance tests green. `router.js:29` mounts `router.use(moderationRateLimiter)` BEFORE any route definition (positional check: use-line=29, first route=64 → OK). |

**Score:** 5/5 truths verified.

### Required Artifacts (plan frontmatter must_haves across 6 plans)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/security/requireAdmin.js` | `req.admin.uid = req.auth.uid` propagation | VERIFIED | `requireAdmin.js:18` — `req.admin = { uid: req.auth.uid, role: admin.role, email: admin.email }`. requireAdmin.middleware.test.js includes the uid-propagation test. |
| `package.json` deps | `zod@^3.24.0` + `express-rate-limit@^8.3.0` | VERIFIED | `require('zod')` and `require('express-rate-limit')` load successfully in the module graph; full suite imports both cleanly. |
| `__tests__/_helpers/mongoReplSet.js` | `startReplSet` + `stopReplSet` exporting MongoMemoryReplSet fixture | VERIFIED | File exists; contains 3 `MongoMemoryReplSet` references; consumed by 6 transaction-heavy test files. |
| `src/moderation/schemas.js` | All per-action Zod schemas in `.strict()` with enum parity to Mongoose models | VERIFIED | 8 schemas exported (reasonCategoryEnum, severityEnum, roleEnumAll, roleEnumProfileDeletable, suspend, revoke, dispatch, unsuspend, deleteProfile, editProfileBroker, editProfileLogistics, editProfile). `.strict()` applied at every object-level schema. `schemas.test.js` (18+ cases) all green. |
| `src/moderation/denySelfModeration.js` | Middleware rejecting self-moderation 400 | VERIFIED | Exports `denySelfModeration` (router.js imports and applies it to all 4 mutating routes — POST, PATCH, DELETE, POST edit-profile). Dedicated test file green. |
| `src/moderation/rateLimit.js` | Per-admin limiter keyed on `req.admin.uid`, 30/15min, 429 `{ error, retryAfter }` + Retry-After header | VERIFIED | keyGenerator returns `admin:${req.admin.uid}` primary, `admin-email:...` fallback, `unauthenticated` bucket for last resort. WINDOW_MS=900_000, MAX_REQUESTS=30. Custom handler sets Retry-After header + JSON body. |
| `src/moderation/service.js` | All 5 service functions filled with `session.withTransaction`, no NotImplementedError throws | VERIFIED | 5 `session.withTransaction` blocks (lines 68, 165, 250, 358, 488). `NotImplementedError` class still exported (harmless — defensive) but never thrown by any code path. All 5 functions have full bodies + audit-first-then-mutation pattern. |
| `src/moderation/router.js` | 5 routes (GET /ping + 4 mutating) + rate limiter mounted before routes + `denySelfModeration` on every mutating route | VERIFIED | Routes present: GET /ping, POST /:targetUid (dispatch), PATCH /unsuspend, DELETE /provider-profile, POST /edit-profile. `router.use(moderationRateLimiter)` at line 29; first route at line 64 (positional awk check passes). `denySelfModeration` applied to all 4 mutating routes. `handleServiceError` includes `invalid_field` enrichment with `err.fields`. |
| `__tests__/moderation/suspend.test.js` | 6 suspend behaviors + `lastActionId` back-link | VERIFIED | File exists (164 lines); 6 tests green including re-suspend flips lastActionId + last-admin-protected + target_not_found + restrictedFeatures derived from capabilities.js. |
| `__tests__/moderation/unsuspend.test.js` | 2 unsuspend behaviors | VERIFIED | File exists (87 lines); 2 tests green (happy path, not_suspended). |
| `__tests__/moderation/revokeRole.test.js` | 3 role paths + role_not_assigned + provider-doc preservation | VERIFIED | File exists (194 lines); 6 tests green (seller/broker/logistics paths + NONE rejection + PENDING rejection + moderationStatus orthogonality). |
| `__tests__/moderation/deleteProviderProfile.test.js` | Happy paths + rollback scenarios + providerSnapshot preservation | VERIFIED | File exists (237 lines); 7 tests green including W-03 post-delete rollback (User.updateOne throws mid-txn → Broker.findOne still returns original doc). |
| `__tests__/moderation/editProfile.test.js` | Whitelist + invalid_field + no_changes + fieldDiff shape + role_not_assigned | VERIFIED | File exists (233 lines); 8 tests green. fieldDiff asserted in per-field `{ before, after }` shape at multiple sites. |
| `__tests__/moderation/acceptance.test.js` | 3 describe blocks (cannot_moderate_self × 4 routes, last_admin_protected via wired router, 30→429 + per-admin keying) | VERIFIED | File exists (331 lines); 3 describe blocks present, 7 tests across them. Uses `moderationRateLimiter.resetKey(key)` for intra-file bucket isolation (avoids `jest.resetModules()` OverwriteModelError trap). Retry-After header assertion present: `res.headers['retry-after']` matches `/^\d+$/`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `requireAdmin.js` | `req.auth.uid` | `req.admin = { uid: req.auth.uid, ... }` | VERIFIED | Line 18. requireAdmin.middleware.test.js locks the contract. |
| `service.suspend()` | `ModerationAction.create([...], { session })` | array form inside `withTransaction`, captures `_id`, writes `lastActionId` into user subdoc | VERIFIED | service.js:71-80 + 110. Test: re-suspend flips `lastActionId`. |
| `service.suspend()` last-admin guard | `AdminUser.distinct('email')` + `User.countDocuments({...}).session(session)` | inside transaction | VERIFIED | service.js:85-99. acceptance.test.js block 2 proves end-to-end. |
| `service.revokeRole()` | NO `Broker.deleteOne` / `LogisticsPartner.deleteOne` / moderationStatus write | negative invariant | VERIFIED | Function body grep: 0 deleteOne matches, 0 moderationStatus writes (only 2 comments asserting the negative). revokeRole.test.js tests 2,3,6 assert the invariant. |
| `service.deleteProviderProfile()` | NO service_orders write | negative invariant | VERIFIED | Function body grep: only 1 service_orders mention, which is a comment. deleteProviderProfile.test.js test 1 seeds ServiceOrder + providerSnapshot + asserts survival. |
| `service.editProfile()` | `fieldDiff[key] = { before, after }` per-field | changed-only post-filter | VERIFIED | service.js:477. editProfile.test.js assertions confirm shape. |
| `router.js` | `rateLimit.js::moderationRateLimiter` | `router.use(moderationRateLimiter)` at line 29 BEFORE first route at line 64 | VERIFIED | Positional awk check: use=29, first-route=64, ordering OK. |
| `router.js` | `denySelfModeration` applied per-route | not router-wide (allows future non-mutating GET routes to skip guard) | VERIFIED | Applied to POST /:targetUid, PATCH /unsuspend, DELETE /provider-profile, POST /edit-profile. |
| `acceptance.test.js` | `moderationRateLimiter.resetKey(\`admin:${uid}\`)` | top-level beforeEach clears per-admin buckets | VERIFIED | Line 90. Avoids `jest.resetModules()` trap (would trigger mongoose OverwriteModelError). |

### Data-Flow Trace (Level 4)

Phase 2 is backend-only (no UI rendering). Dynamic data flows confirmed:
- Suspend/unsuspend/revoke/delete/edit responses include `user`, `fieldDiff`, and `action` objects populated directly from Mongoose `.updateOne()` results + freshly-inserted audit-row docs — verified via happy-path tests that parse the returned payload (e.g., `expect(result.user.moderationStatus.state).toBe('feature_limited')`, `expect(updated.moderationStatus.lastActionId.toString()).toBe(result.action._id)`).
- No static returns, no empty-object responses, no hardcoded stubs.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full backend test suite | `cd ../backend-services/carEx-services && npm test` | 14 suites passed, 98 tests passed, 0 failed | PASS |
| Node syntax check: service.js | (implicit via test load) | loads cleanly | PASS |
| Node syntax check: router.js | (implicit via test load) | loads cleanly | PASS |
| Rate limiter mount position | `awk` positional check on router.js | use@29 < first route@64 | PASS |
| `revokeRole` does not delete provider profiles | `awk` function-body grep for `deleteOne\|Broker\.\|LogisticsPartner\.` | 0 matches | PASS |
| `deleteProviderProfile` does not touch service_orders | function-body grep for `service_orders\|ServiceOrder` | 1 match (comment-only explicitly stating the negative) | PASS |
| `revokeRole` does not mutate `moderationStatus` | function-body grep | 2 matches (both in comments stating the negative) | PASS |

### Requirements Coverage (cross-referenced against REQUIREMENTS.md)

| Requirement | Source Plan(s) | Description (abridged) | Status | Evidence |
|-------------|---------------|------------------------|--------|----------|
| SEC-03 | 01, 02, 03, 06 | Backend rejects self-moderation + last-admin (backend authoritative) | SATISFIED | denySelfModeration middleware + last-admin guard inside suspend txn; acceptance.test.js blocks 1 & 2 prove end-to-end. |
| SEC-04 | 01, 02, 06 | 30/15min per-admin rate limit via express-rate-limit | SATISFIED | rateLimit.js (uid-keyed, 30/15min, 429 + Retry-After); mounted at router.js:29 before routes; acceptance.test.js block 3 proves 30→200 + 31st→429 + per-admin keying. |
| ADMIN-01 | 03 | Suspend with severity + reason + note, atomic status-mutation + audit write | SATISFIED | service.suspend() + suspend.test.js (6 green). |
| ADMIN-02 | 03 | Unsuspend returns user to active + appends audit row (originals never mutated) | SATISFIED | service.unsuspend() + unsuspend.test.js (2 green) + ModerationAction.append-only.test.js. |
| ADMIN-03 | 04 | Revoke provider role; provider profile record preserved | SATISFIED | service.revokeRole() + revokeRole.test.js (6 green); negative-invariant tests 2,3 (profile doc preserved) + test 6 (moderationStatus orthogonal). |
| ADMIN-04 | 05 | Delete broker/logistics profile; past orders survive via providerSnapshot | SATISFIED | service.deleteProviderProfile() + deleteProviderProfile.test.js (7 green); test 1 asserts providerSnapshot survival; tests 6,7 prove both rollback paths. |
| ADMIN-05 | 05 | Edit provider profile with fieldDiff audit | SATISFIED | service.editProfile() + editProfile.test.js (8 green); fieldDiff shape `{before, after}` per field; whitelist enforced at Zod + service layer. |

No orphaned requirements — every phase-2 requirement ID from REQUIREMENTS.md is covered by at least one plan's `requirements:` frontmatter, and every plan-declared requirement is satisfied by implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/moderation/service.js` | 22–27 | `NotImplementedError` class defined but never thrown (all 5 functions are fully implemented) | Info | Harmless carry-over from Phase 1 scaffold. Class is exported. Can be removed in a cleanup pass; does not affect behavior. |

No blocker anti-patterns. No TODO/FIXME/XXX markers in moderation source files. No empty handlers, no stubbed returns, no placeholder data.

### Human Verification Required

None. Phase 2 is backend-only with no UI surface. All behaviors (transactional atomicity, middleware composition, rate-limit key isolation, last-admin guard inside transaction) are fully covered by automated tests running against MongoMemoryReplSet with real mongoose transactions. `acceptance.test.js` exercises the full Express middleware chain (`verifyIdToken → requireAdmin → moderationRateLimiter → denySelfModeration → handler`) end-to-end, proving Criterion #5 composes correctly through the wired router.

### Gaps Summary

None. All 5 ROADMAP success criteria are satisfied; all 13 PLAN-level must_have artifacts exist and pass the 3-level verification (exists, substantive, wired); all 9 key links are wired; all 7 phase-2 requirements (SEC-03, SEC-04, ADMIN-01..05) have implementation evidence; the full backend test suite reports 14 suites / 98 tests passing with zero regressions. Phase 2 is goal-achieved and ready for Phase 3.

---

_Verified: 2026-04-17T18:15:00Z_
_Verifier: Claude (gsd-verifier)_
