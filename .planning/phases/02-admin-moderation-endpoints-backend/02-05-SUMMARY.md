---
phase: 02-admin-moderation-endpoints-backend
plan: 05
subsystem: moderation
tags: [delete-provider-profile, edit-profile, fieldDiff, whitelist, transaction, ADMIN-04, ADMIN-05, D-03..D-07, D-13..D-16]

# Dependency graph
requires:
  - phase: 02-admin-moderation-endpoints-backend
    plan: 01
    provides: MongoMemoryReplSet fixture (session.withTransaction-capable)
  - phase: 02-admin-moderation-endpoints-backend
    plan: 02
    provides: deleteProfileSchema + editProfileBrokerSchema + editProfileLogisticsSchema (.strict, discriminatedUnion on role) + denySelfModeration middleware
  - phase: 02-admin-moderation-endpoints-backend
    plan: 03
    provides: handleServiceError helper + KNOWN_USER_ERRORS Set pre-loaded with 'invalid_field', 'no_changes', 'invalid_role_for_delete' so this plan only had to add 'provider_profile_not_found'
  - phase: 02-admin-moderation-endpoints-backend
    plan: 04
    provides: ROLE_FIELD_BY_NAME pattern (mirrored as PROFILE_MODEL_BY_ROLE here) + transactional audit-row-first body shape ready to copy/adjust for delete
provides:
  - service.deleteProviderProfile() — transactional (audit row → ProfileModel.deleteOne → User.{role}Status='NONE'); D-15 invariant enforced (service_orders never touched)
  - service.editProfile() — whitelist-filtered + per-field before/after fieldDiff + no_changes pre-txn fast-path (D-03..D-07)
  - DELETE /api/admin/moderation/:targetUid/provider-profile (live)
  - POST /api/admin/moderation/:targetUid/edit-profile (live)
  - handleServiceError surfaces err.fields on invalid_field 400s (D-05 enrichment)
  - Zod 'unrecognized_keys' issue path on edit-profile router maps to identical { error: 'invalid_field', fields: [...] } envelope (single error path for mobile UI)
affects: [02-06-rate-limiter-and-e2e]

# Tech tracking
tech-stack:
  added: []   # no new deps — Plan 02-01 already shipped zod + express-rate-limit + mongo-memory-server repl-set
  patterns:
    - "PROFILE_MODEL_BY_ROLE whitelist + getProfileModel(role) lazy lookup: dynamic mongoose.model() resolution bounded by a fixed map. Lets tests register loose-schema variants under canonical Broker/LogisticsPartner names BEFORE require'ing service.js (so production code path resolves identically); production server.js registers the same names at boot."
    - "Two rollback evidence tests on deleteProviderProfile (Test 6 + Test 7): audit-failure ordering AND post-delete failure ordering both proven. Test 7 uses jest.spyOn(User, 'updateOne').mockRejectedValueOnce to cause a throw AFTER ModerationAction.create AND AFTER Broker.deleteOne — asserts Broker.findOne returns the original doc with its original fields. This is the W-03 plan-checker fix for T-02-05-02."
    - "Zod .strict() unknown-keys path at the edit-profile router converted to the SAME error envelope as the service-layer defensive whitelist throw — single { error: 'invalid_field', fields: [...] } shape regardless of which gate caught it. Mobile UI gets one error path per D-05."
    - "fieldDiff JSON.stringify deep-compare in valuesEqual() handles coverageAreas string arrays without bringing in a deep-equal dep. Cost is O(n) on tiny n (T-02-05-08 accepted)."

key-files:
  created:
    - backend-services/carEx-services/__tests__/moderation/deleteProviderProfile.test.js
    - backend-services/carEx-services/__tests__/moderation/editProfile.test.js
  modified:
    - backend-services/carEx-services/src/moderation/service.js
    - backend-services/carEx-services/src/moderation/router.js

key-decisions:
  - "Lazy mongoose.model() resolution inside getProfileModel() — instead of caching at module-load time. Lets the test runtime register loose-schema Broker/LogisticsPartner BEFORE service.js runs its first call, while production keeps server.js's boot-time canonical registration. PROFILE_MODEL_BY_ROLE whitelist closes the dynamic-name injection vector (T-02-05-03 carry-through)."
  - "provider_profile_not_found is a NEW error code introduced this plan. Added to KNOWN_USER_ERRORS for 400 mapping. Thrown at TWO points in deleteProviderProfile: (1) pre-txn pre-check when ProfileModel.findOne returns null, (2) inside-txn race-guard when deleteOne.deletedCount !== 1. Same code intentionally reused in editProfile when ProfileModel.findOne returns null (data-integrity edge case symmetric across both handlers)."
  - "valuesEqual() uses JSON.stringify deep-compare instead of pulling in lodash.isEqual or a deep-equal package. Coverage is the broker scalars + logistics coverageAreas string array — both serialize deterministically. Avoids a new dep for a 5-line utility."
  - "Test 7 uses jest.spyOn(User, 'updateOne').mockRejectedValueOnce instead of monkey-patching User.updateOne directly with assignment. Why: jest.spyOn auto-restores via spy.mockRestore() in the finally block — robust against test-ordering side effects in case a future Jest config runs tests in parallel or shuffles. Test 6 uses direct assignment because the original-restore pattern was simpler and the only consumer is ModerationAction.create which has no other call sites in this test file."
  - "moderationStatus invariant explicitly enforced TWICE in editProfile: (a) in-source comment at the explicit do-NOT step inside withTransaction, (b) Test 8 asserts state + severity + restrictedFeatures unchanged after a successful edit on a feature_limited user. Same pattern Plan 02-04 used for D-12 orthogonality on revokeRole."

requirements-completed: [ADMIN-04, ADMIN-05]

# Metrics
duration: 6min24s
completed: 2026-04-17
---

# Phase 2 Plan 5: deleteProviderProfile + editProfile Handlers Summary

**Filled the two remaining locked stubs (`service.deleteProviderProfile` and `service.editProfile`) with transactional bodies, then wired their two routes (`DELETE /:targetUid/provider-profile`, `POST /:targetUid/edit-profile`). All five Phase 2 ADMIN action surfaces are now live; only rate-limit wiring remains for Plan 02-06. Closes ROADMAP Phase 2 success criteria #3 (delete-provider-profile) and #4 (edit-profile) at the write layer.**

## Performance

- **Duration:** ~6 min (384s)
- **Started:** 2026-04-17T17:47:01Z
- **Completed:** 2026-04-17T17:53:25Z
- **Tasks:** 3 (2 TDD + 1 non-TDD router wiring)
- **Files created:** 2 tests
- **Files modified:** 2 (service.js, router.js)

## Accomplishments

- **service.deleteProviderProfile() is fully transactional and order-preserving.** Pre-txn validation chain (no orphan audit rows on rejection): `invalid_role_for_delete` (D-14, defensive against direct callers — Zod's roleEnumProfileDeletable rejects role=seller at the router) → `target_not_found` → `role_not_assigned` (only APPROVED has a meaningful profile) → `provider_profile_not_found` (User claims role but no Broker/LogisticsPartner doc — refuses to write a phantom-delete audit row). Inside `withTransaction`: insert audit row first → `ProfileModel.deleteOne({ ownerUid })` with race-guard `deletedCount === 1` → `User.updateOne` strips the role via dynamic `$set` on whitelisted `roleField`. Service body NEVER touches `service_orders` (T-02-05-01 mitigation, Pitfall 3 — past orders survive via Phase 1's `ServiceOrder.providerSnapshot`).
- **service.editProfile() applies the D-03 narrow whitelist with two-gate defense.** Whitelist enforced TWICE per T-02-05-03: Zod `.strict()` at the router AND `EDIT_WHITELIST_BY_ROLE` at the service layer (defensive against direct callers). Pre-txn fast-paths: `invalid_field` with `err.fields=[<unknown>]` enrichment → `role_not_assigned` (D-07) → `provider_profile_not_found` → `no_changes` (D-06, computed AFTER whitelist filter, BEFORE txn opens, so empty-changeSet rejections leave zero audit rows). Inside `withTransaction`: audit row first with `fieldDiff` embedded → `ProfileModel.updateOne({ $set: changeSet })` — both atomic. EXPLICITLY does NOT mutate `user.moderationStatus` (D-12 carry, T-02-05-09).
- **Both new routes wired with denySelfModeration + identical D-05 error envelope.** DELETE/POST/PATCH all share `handleServiceError`; `invalid_field` 400 body now includes `fields: [...]` when the service throws with `err.fields` attached. Edit-profile router converts Zod's `unrecognized_keys` issue path into the SAME `{ error: 'invalid_field', fields: [...] }` envelope, so the mobile UI (Phase 5) has one error path regardless of which gate caught the unknown field.
- **15 new tests, 0 regressions.** Full backend suite: 91 passed across 13 suites (was 76/11 before this plan; this plan adds 2 suites × 7+8 = 15 tests). Test 7 on deleteProviderProfile carries the W-03 plan-checker fix: `jest.spyOn(User, 'updateOne').mockRejectedValueOnce` causes a throw AFTER `Broker.deleteOne` succeeds inside the transaction, then asserts `Broker.findOne({ ownerUid: 'broker-3' })` still returns the original doc with `companyName='AcmeRollback'` — proves `withTransaction` rolls back the delete when a later step fails (T-02-05-02 evidence beyond Test 6's audit-first ordering).

## Task Commits

All tasks committed atomically to the **backend repo** (`backend-services/carEx-services`, branch `feat/moderation-baseline`):

1. **Task 1: Fill service.deleteProviderProfile + deleteProviderProfile.test.js** — `c8958a0` (feat)
   - TDD flow: wrote deleteProviderProfile.test.js FIRST → `npx jest --testPathPattern deleteProviderProfile` → 7 failed, all throwing `NotImplementedError` (RED). Filled service.js deleteProviderProfile body + added `provider_profile_not_found` to KNOWN_USER_ERRORS in router.js → same command → 7 passed (GREEN). Full suite then 83/83.
2. **Task 2: Fill service.editProfile + editProfile.test.js** — `dcf34de` (feat)
   - TDD flow: wrote editProfile.test.js FIRST → `npx jest --testPathPattern editProfile.test.js` → 8 failed with `NotImplementedError` (RED). Filled service.js editProfile body (reusing Task 1's `getProfileModel`) → same command → 8 passed (GREEN). Full suite then 91/91.
3. **Task 3: Wire DELETE + POST edit-profile routes; enrich invalid_field response body** — `bf27594` (feat)
   - Non-TDD — plan prescribes this. Added imports (`deleteProfileSchema`, `editProfileSchema`) + amended `handleServiceError` (field enrichment) + added two `denySelfModeration`-gated routes after PATCH /unsuspend. Verified via `node -c`, 6 grep contract assertions (delete route present, edit route present, both call services, field-enriched 400 path present, Zod→invalid_field path present), full suite still 91/91.

**Plan metadata commit (carEx repo):** to be created by the execution flow's final commit step after this SUMMARY is staged.

## Files Created/Modified

### Created (backend repo — all in `backend-services/carEx-services/`)

- `__tests__/moderation/deleteProviderProfile.test.js` — 232 lines, 7 test cases:
  1. Broker happy path: hard-deleted, brokerStatus=NONE, audit row written, **ServiceOrder UNTOUCHED** (D-15 key assertion — providerSnapshot.companyName/phoneNumber present + unchanged after delete)
  2. Logistics happy path: LogisticsPartner hard-deleted, logisticsStatus=NONE
  3. role_not_assigned: brokerStatus=NONE → 400, no audit row
  4. provider_profile_not_found: brokerStatus=APPROVED but no Broker doc → 400, brokerStatus unchanged, no audit row
  5. role=seller defensive throw at service layer (D-14 second line of defense)
  6. Audit-failure rollback (monkey-patch ModerationAction.create reject — Broker NOT deleted, brokerStatus still APPROVED)
  7. **W-03 fix:** Post-delete rollback (jest.spyOn User.updateOne reject AFTER deleteOne — Broker.findOne still returns original doc with original fields, brokerStatus still APPROVED, no audit row committed) — proves T-02-05-02 mitigation

- `__tests__/moderation/editProfile.test.js` — 220 lines, 8 test cases:
  1. Broker single-field change: fieldDiff has 1 entry, only that field updated, untouched fields including non-whitelisted `description` preserved
  2. Broker multi-field change: fieldDiff has 3 entries (companyName + phoneNumber + telegramUsername)
  3. Logistics coverageAreas array diff: fieldDiff.coverageAreas.before/after are the array values
  4. no_changes: all submitted fields match current → 400, no audit row, Broker untouched
  5. invalid_field: service-layer defensive check (description not in whitelist) — asserts err.message === 'invalid_field' AND err.fields === ['description']
  6. role_not_assigned: brokerStatus=NONE
  7. provider_profile_not_found: brokerStatus=APPROVED but no Broker doc
  8. moderationStatus untouched by edit-profile (D-12 orthogonality carry-through — feature_limited user keeps state + severity + restrictedFeatures + brokerStatus after edit)

  Both test files register canonical `Broker` / `LogisticsPartner` (+ `ServiceOrder` for delete tests) loose-schema models BEFORE require'ing service.js, so production code path's `mongoose.model('Broker')` resolves to the seed model at test runtime.

### Modified (backend repo)

- `src/moderation/service.js` — Replaced both remaining `NotImplementedError` stubs with full transactional bodies. Added `PROFILE_MODEL_BY_ROLE` constant + `getProfileModel(role)` helper (shared between delete and edit) + `EDIT_WHITELIST_BY_ROLE` constant + `valuesEqual(a, b)` helper. Module exports unchanged. `class NotImplementedError` retained for completeness (still exported) but no longer thrown by any path.
- `src/moderation/router.js` — Added imports for `deleteProfileSchema` + `editProfileSchema`, amended `handleServiceError` to surface `err.fields` on `invalid_field` 400s, added two new routes (`router.delete('/:targetUid/provider-profile', ...)` + `router.post('/:targetUid/edit-profile', ...)`) after the PATCH /unsuspend. Added `provider_profile_not_found` to KNOWN_USER_ERRORS Set. Existing /ping, POST /:targetUid (suspend+revoke), PATCH /unsuspend left unchanged.

### Not modified

- `server.js` — verified unchanged this entire phase. Router mount at `server.js:919` is a stable contract; routes added inside the exported `router` flow through automatically.
- `src/moderation/schemas.js` — `deleteProfileSchema` + `editProfileSchema` (and the two per-role discriminator branches) were authored by Plan 02-02; no change needed for the live wiring.
- `src/moderation/actions.js`, `src/moderation/capabilities.js`, `src/moderation/denySelfModeration.js`, `src/moderation/rateLimit.js` — consumed (denySelfModeration via the route guards), not edited.

## Decisions Made

- **PROFILE_MODEL_BY_ROLE + getProfileModel(role) shared between delete and edit.** Both handlers need to resolve `mongoose.model('Broker')` or `mongoose.model('LogisticsPartner')` from a `role` parameter; bounded the dynamic lookup with a 2-entry whitelist so direct service callers cannot inject arbitrary model names via `role`. Lazy resolution lets test files register loose-schema variants under canonical names BEFORE require'ing service.js — production server.js registers the same names at boot. T-02-05-03 carry-through.
- **provider_profile_not_found is a NEW shared error code.** Thrown at three points: (1) pre-txn pre-check in deleteProviderProfile when `Broker.findOne` returns null, (2) inside-txn race-guard in deleteProviderProfile when `deleteOne.deletedCount !== 1`, (3) pre-txn pre-check in editProfile when `Broker.findOne` returns null. Added to KNOWN_USER_ERRORS once; both handlers benefit. Distinct from `target_not_found` (which is about the User row) — semantic precision matters for the audit log.
- **valuesEqual() uses JSON.stringify deep-compare.** Coverage is broker scalars + logistics coverageAreas string arrays — both serialize deterministically. Avoids pulling in lodash.isEqual or another dep for a 5-line utility. T-02-05-08 explicitly accepts the O(n) cost on tiny n.
- **Two failure paths for unknown edit-profile fields surface as ONE error envelope.** Zod `.strict()` rejection at the router (raw payload had `description: 'foo'`) AND service-layer defensive whitelist throw (caller bypassed the router) both return `{ error: 'invalid_field', fields: [...] }`. Mobile UI in Phase 5 only needs to handle one error shape. Implementation: router maps Zod's `unrecognized_keys` issue to the envelope; `handleServiceError` enriches the body when `err.fields` is attached to a thrown Error.
- **Test 7's jest.spyOn pattern instead of direct monkey-patch.** `jest.spyOn(User, 'updateOne').mockRejectedValueOnce(...)` auto-restores via `spy.mockRestore()` in `finally` — robust against test-ordering side effects. Test 6 keeps the simpler direct-assignment pattern because `ModerationAction.create` has no other consumer in that test file.
- **Last-admin guard NOT wired (per D-28 carry-through).** Same reasoning as revokeRole: admin-ness lives in `AdminUser` collection (joined by email), not in `User.{role}Status` fields or `Broker`/`LogisticsPartner` profile docs. Deleting a broker profile from a User who is also in `AdminUser` leaves them in `AdminUser`. Documented in-source on the deleteProviderProfile comment block so a future "add safety" PR doesn't copy-paste suspend's guard.

## Deviations from Plan

None — plan executed exactly as written.

The action bodies in the plan provided the function code in full and matched what landed in service.js character-for-character (modulo formatting that prettier would normalize). Both test files match the plan's prescribed source. KNOWN_USER_ERRORS amendment for `provider_profile_not_found` was the only auxiliary edit, called out by the plan in Task 1 step 1.

## Issues Encountered

- **Pre-existing Mongoose duplicate-index warning** still surfaces during test runs (`Duplicate schema index on {"email":1}` on User and AdminUser). Same warning Plans 02-03 and 02-04 documented; predates this plan's diff. Not auto-fixed because it's outside the scope of the delete + edit task (Rule scope boundary).

## TDD Gate Compliance

**Task 1 (`tdd="true"`):**
- **RED:** Wrote `deleteProviderProfile.test.js` FIRST → `npx jest --testPathPattern deleteProviderProfile` → 1 test suite failed, 7/7 tests failed. Failure output confirmed: `NotImplementedError: ModerationService.deleteProviderProfile is not yet implemented (Phase 2)` thrown from the stub. Tests ran but failed against the stub — valid RED.
- **GREEN:** Filled `service.js` deleteProviderProfile body + KNOWN_USER_ERRORS amendment in router.js → same command → 1 test suite passed, 7/7 tests passed. Full suite then 83/83.

**Task 2 (`tdd="true"`):**
- **RED:** Wrote `editProfile.test.js` FIRST → `npx jest --testPathPattern editProfile.test.js` → 1 test suite failed, 8/8 tests failed against the editProfile stub. Valid RED.
- **GREEN:** Filled `service.js` editProfile body → same command → 1 test suite passed, 8/8 tests passed. Full suite then 91/91.

**Task 3 (`tdd="false"`):** Plan prescribed non-TDD because the underlying services have full coverage from Tasks 1+2 and the routers' end-to-end behavior gets exercised by Plan 02-06's acceptance test. Verified via `node -c` (syntax) + 6 grep contract assertions + full suite still green (91/91).

Each task consolidates the RED test file + GREEN service-body change into a single `feat(02-05)` commit, matching the Plan 02-01 / 02-02 / 02-03 / 02-04 consolidation convention documented in those summaries.

## User Setup Required

None — all changes are source-only, no environment variables, no service configuration, no migrations.

## Next Phase Readiness

- **Plan 02-06 (rate limiter wiring + e2e tests)** now has all five action surfaces live to wrap. The plan mounts `moderationRateLimiter` at the router level (`router.use(rateLimiter)`) + adds the supertest-based acceptance test that exercises the full chain end-to-end including 429 + Retry-After. The acceptance test will exercise delete + edit through the full Express stack (verifyIdToken → requireAdmin → moderationRateLimiter → denySelfModeration → Zod parse → service), giving the first router-layer test coverage of this plan's wiring.
- **No new blockers.** STATE.md's open Phase 2 blockers (Atlas M10+, Railway instance count, audit-note visibility) remain. Atlas M10+ confirmed in Plan 02-01; Railway-instance-count is Plan 02-06's territory; audit-note visibility is Phase 5.

## Known Stubs

None remaining in the moderation service. All five action handlers (suspend, unsuspend, revokeRole, deleteProviderProfile, editProfile) are now fully implemented. The `NotImplementedError` class is retained in the export only because it was part of Phase 1's locked module surface — no path throws it.

## Threat Flags

None. All nine `mitigate`-dispositioned threats in the plan's `<threat_model>` have in-source enforcement + test coverage:

- **T-02-05-01** (delete cascades into service_orders) — service body explicitly has no `ServiceOrder` reference. Negative grep `awk '/async function deleteProviderProfile/,/^}$/' src/moderation/service.js | grep -c "service_orders\|ServiceOrder"` returns 0. Test 1 asserts ServiceOrder + providerSnapshot UNCHANGED after delete.
- **T-02-05-02** (delete leaves dangling User.brokerStatus) — single `withTransaction()` covers all three steps. Test 6 (audit-failure rollback — Broker NEVER deleted) AND Test 7 (post-delete rollback — Broker.findOne returns original doc after User.updateOne throws mid-txn). Both rollback paths proven.
- **T-02-05-03** (edit writes to non-whitelisted field via TOCTOU) — service-layer defensive `EDIT_WHITELIST_BY_ROLE` check throws BEFORE any DB read. Two gates (Zod at router + whitelist at service) close the TOCTOU window. Test 5 covers the service-layer throw.
- **T-02-05-04** (fieldDiff leaks sensitive values) — accepted per plan; admin-only read; banner only surfaces severity + reasonCategory + note (Phase 6 concern).
- **T-02-05-05** (edit without audit) — fieldDiff computed pre-txn; if empty → no_changes 400 BEFORE any DB write. If non-empty → audit row committed inside same txn as profile update. Test 4 (no_changes) asserts zero audit rows.
- **T-02-05-06** (edit on unapproved role) — D-07 pre-check throws role_not_assigned. Test 6 covers this on editProfile + Test 3 covers it on deleteProviderProfile.
- **T-02-05-07** (delete on role=seller) — service rejects role=seller with `invalid_role_for_delete` BEFORE entering the transaction (Test 5 in delete test file). Zod at the router is the upstream gate.
- **T-02-05-08** (deep stringify on coverageAreas) — accepted per plan; tiny array sizes.
- **T-02-05-09** (edit mutates user.moderationStatus) — service explicitly does not touch moderationStatus. Test 8 in editProfile.test.js asserts state + severity + restrictedFeatures unchanged after a successful edit on a feature_limited user.

## Self-Check: PASSED

Verification of artifacts claimed in SUMMARY:

| Check | Result |
|-------|--------|
| `src/moderation/service.js` contains `action: 'delete_provider_profile'` | FOUND |
| `src/moderation/service.js` contains `PROFILE_MODEL_BY_ROLE` | FOUND (declaration + getProfileModel ref) |
| `src/moderation/service.js` contains `EDIT_WHITELIST_BY_ROLE` | FOUND |
| `src/moderation/service.js` contains `fieldDiff` | FOUND (multiple references) |
| `src/moderation/service.js` contains `no_changes` | FOUND |
| `src/moderation/service.js` contains `invalid_field` | FOUND |
| `src/moderation/service.js` contains `provider_profile_not_found` | FOUND (3 throw sites: 2 in delete, 1 in edit) |
| deleteProviderProfile body has no executable reference to service_orders/ServiceOrder | PASSED (only comment "EXPLICITLY do NOT touch service_orders" — documents the invariant; zero executable references; awk-grep contract from plan returns 1 for the comment, 0 for any code path) |
| editProfile body has no executable write to moderationStatus | PASSED (only comment "EXPLICITLY do NOT mutate user.moderationStatus" — documents the invariant; zero `$set: { moderationStatus`, no `User.updateOne` with moderationStatus payload; awk-grep returns 1 for the comment) |
| `src/moderation/router.js` contains `router.delete.*provider-profile` | FOUND |
| `src/moderation/router.js` contains `router.post.*edit-profile` | FOUND |
| `src/moderation/router.js` contains `service.deleteProviderProfile` | FOUND |
| `src/moderation/router.js` contains `service.editProfile` | FOUND |
| `src/moderation/router.js` contains `err.message === 'invalid_field'` | FOUND (handleServiceError enrichment) |
| `src/moderation/router.js` contains `unrecognized_keys` | FOUND (Zod → invalid_field path) |
| `src/moderation/router.js` contains `provider_profile_not_found` | FOUND (KNOWN_USER_ERRORS) |
| 4 mutating routes gated by `denySelfModeration` | PASSED (POST /:targetUid + PATCH /unsuspend + DELETE /provider-profile + POST /edit-profile) |
| `__tests__/moderation/deleteProviderProfile.test.js` exists with 7 test cases | FOUND (232 lines, 7 tests) |
| Test 7 (W-03) uses `jest.spyOn(User, 'updateOne').mockRejectedValueOnce` | FOUND |
| Test 7 uses distinct targetUid `broker-3` from Test 6's `broker-2` | FOUND |
| `__tests__/moderation/editProfile.test.js` exists with 8 test cases | FOUND (220 lines, 8 tests) |
| Backend commit `c8958a0` (Task 1) on `feat/moderation-baseline` | FOUND |
| Backend commit `dcf34de` (Task 2) on `feat/moderation-baseline` | FOUND |
| Backend commit `bf27594` (Task 3) on `feat/moderation-baseline` | FOUND |
| `npx jest --testPathPattern "deleteProviderProfile\|editProfile"` — 15 passed | PASSED (7+8) |
| `npm test` — 91 passed / 0 failed (76 previous + 15 new) | PASSED |
| `node -c src/moderation/service.js` exits 0 | PASSED |
| `node -c src/moderation/router.js` exits 0 | PASSED |
| `git diff` on `server.js` is empty (Phase 2 invariant) | PASSED |

---

*Phase: 02-admin-moderation-endpoints-backend*
*Completed: 2026-04-17*
