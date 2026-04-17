---
phase: 02-admin-moderation-endpoints-backend
plan: 04
subsystem: moderation
tags: [revoke-role, transaction, broker, logistics, seller, ADMIN-03, D-08, D-11, D-12, D-28]

# Dependency graph
requires:
  - phase: 02-admin-moderation-endpoints-backend
    plan: 01
    provides: MongoMemoryReplSet fixture (session.withTransaction-capable)
  - phase: 02-admin-moderation-endpoints-backend
    plan: 02
    provides: revokeRoleSchema (.strict, discriminator branch on action='revoke_role') + denySelfModeration middleware
  - phase: 02-admin-moderation-endpoints-backend
    plan: 03
    provides: Two-step audit-row-first transactional pattern + KNOWN_USER_ERRORS Set already containing 'role_not_assigned' + dispatchSchema mounted on POST /:targetUid + handleServiceError() helper
provides:
  - service.revokeRole() — transactional (audit row → User.{role}Status → 'NONE'); Broker / LogisticsPartner doc explicitly preserved (D-08)
  - POST /api/admin/moderation/:targetUid (revoke_role branch of dispatchSchema) live end-to-end (no more 501)
affects: [02-05-delete-edit-profile, 02-06-rate-limiter-and-e2e]

# Tech tracking
tech-stack:
  added: []   # no new deps — Plan 02-01 already shipped zod + express-rate-limit + mongo-memory-server repl-set
  patterns:
    - "ROLE_FIELD_BY_NAME whitelist map at module top: dynamic $set on User.{sellerStatus|brokerStatus|logisticsStatus} guarded by a fixed lookup so direct service callers cannot write to arbitrary fields via the role parameter (T-02-04-06 mitigation)"
    - "Negative invariants enforced as test assertions: 'Broker doc still exists after revoke' (D-08) + 'moderationStatus.state unchanged after revoke' (D-12 orthogonality) — invariants live BOTH as code comments at the explicit do-NOT step AND as toEqual assertions in revokeRole.test.js"
    - "role_not_assigned thrown BEFORE the transaction opens (Test 4 + 5 assert audits.length === 0 after the throw) — symmetric with Plan 02-03's already_at_severity / not_suspended fast-path discipline"

key-files:
  created:
    - backend-services/carEx-services/__tests__/moderation/revokeRole.test.js
  modified:
    - backend-services/carEx-services/src/moderation/service.js
    - backend-services/carEx-services/src/moderation/router.js

key-decisions:
  - "Defensive invalid_role throw at the service boundary even though Zod's roleEnumAll already gates at the router — protects direct service callers (tests, future internal callers, Plan 02-05's deleteProviderProfile when it inevitably copies this shape) from bypassing the dynamic-$set whitelist via an unknown role string"
  - "Last-admin guard explicitly NOT wired into revokeRole per D-28 — admin-ness lives in AdminUser collection (joined by email), not in User.{role}Status fields. An admin who loses their brokerStatus is still an admin. Documented in-source so future readers don't 'add safety' by copy-pasting suspend's guard"
  - "Test file uses Broker_testseed_revoke / LogisticsPartner_testseed_revoke loose-schema models (not the canonical Broker / LogisticsPartner from server.js) — server.js inlines these schemas (Phase 1 D-02), the test deliberately avoids importing server.js to stay hermetic. Distinct model names per test file avoid Mongoose's 'cannot overwrite model' error if any other suite has registered the canonical models in the same Jest process"
  - "Tests call service.revokeRole directly (not via Express/supertest) — same convention as Plan 02-03 suspend/unsuspend tests. Router-layer concerns (denySelfModeration gate, Zod payload validation, 400-vs-500 envelope) get exercised end-to-end by Plan 02-06's acceptance test"

requirements-completed: [ADMIN-03]

# Metrics
duration: 3min
completed: 2026-04-17
---

# Phase 2 Plan 4: revoke_role Handler Summary

**Filled the locked service.revokeRole stub with a transactional body that strips User.{role}Status → 'NONE' while preserving the Broker / LogisticsPartner profile document intact (D-08 historical-lookup contract), and replaced the Plan 02-03 501 stub on POST /:targetUid revoke_role with the live service call. Closes ROADMAP Phase 2 success criterion #2 at the write layer; Phase 3's pre(/^find/) middleware will close the matching read-layer hide.**

## Performance

- **Duration:** ~3 min (156s)
- **Started:** 2026-04-17T17:39:53Z
- **Completed:** 2026-04-17T17:42:29Z
- **Tasks:** 2 (1 TDD + 1 non-TDD router wiring)
- **Files created:** 1 test
- **Files modified:** 2 (service.js, router.js)

## Accomplishments

- **service.revokeRole() is fully transactional and preservation-respecting.** Pre-txn validation throws `role_not_assigned` BEFORE opening a session when target's `{role}Status !== 'APPROVED'` (covers both `NONE` and `PENDING` cases — Tests 4 + 5 assert no audit row lands on rejection). Inside `withTransaction`: insert the audit row first (action='revoke_role', severity='none', roleAffected=<role>) → strip the role via dynamic `$set` on a whitelisted field (looked up from `ROLE_FIELD_BY_NAME` to prevent injection per T-02-04-06). Two negative invariants enforced explicitly: NO `Broker.deleteOne` / `LogisticsPartner.deleteOne` (D-08 preservation, Pitfall 9) and NO `moderationStatus` write (D-12 orthogonality).
- **Router POST /:targetUid is now live for both branches of dispatchSchema.** The 501 stub from Plan 02-03 is removed; revoke_role flows through `service.revokeRole({ adminUid, adminEmail, targetUid, role, reasonCategory, note })`. The KNOWN_USER_ERRORS Set already contained `role_not_assigned` from Plan 02-03's pre-registration, so service throws map to 400 automatically without any router-side amendment. Suspend dispatch, denySelfModeration middleware, and PATCH /unsuspend remain unchanged.
- **6 new tests, 0 regressions.** Full backend suite: 76 passed across 11 suites (was 70/10 before this plan; this plan adds 1 suite × 6 tests). The three role paths (seller/broker/logistics) each verified end-to-end. Tests 2 + 3 carry the load-bearing D-08 assertion: `expect(brokerDoc).not.toBeNull()` AFTER revoke + `expect(brokerDoc.companyName).toBe('Acme Brokers')` to confirm the doc isn't just present but UNCHANGED. Test 6 carries the D-12 orthogonality assertion: a suspended seller (moderationStatus.state='feature_limited' + restrictedFeatures=['create_listing']) can have their seller role revoked WITHOUT mutating the suspension state.
- **Last-admin guard correctly skipped per D-28.** Documented in-source with a comment block at the top of revokeRole so a future reader doesn't copy-paste suspend's guard "for safety". Admin-ness lives in AdminUser, not in User role fields; revoking a broker role from an admin still leaves them an admin.

## Task Commits

All tasks committed atomically to the **backend repo** (`backend-services/carEx-services`, branch `feat/moderation-baseline`):

1. **Task 1: Fill service.revokeRole + revokeRole.test.js** — `646d09e` (feat)
   - TDD flow: wrote revokeRole.test.js FIRST → `npx jest --testPathPattern revokeRole` → 6 failed, all throwing `NotImplementedError` (RED). Filled service.js revokeRole body → same command → 6 passed (GREEN).
2. **Task 2: Replace 501 stub in router with service.revokeRole call** — `ac92145` (feat)
   - Non-TDD — plan prescribes this. Verified via node -c + 6 grep contract assertions (live call present, stub gone, parsed.data fields propagated, suspend/unsuspend regression-free) + full test suite (76 passed).

**Plan metadata commit (carEx repo):** to be created by the execution flow's final commit step after this SUMMARY is staged.

## Files Created/Modified

### Created (backend repo — all in `backend-services/carEx-services/`)

- `__tests__/moderation/revokeRole.test.js` — 192 lines, 6 test cases per the plan's `<behavior>` enumeration:
  1. revoke seller (sellerStatus → NONE, audit row appended, moderationStatus untouched)
  2. revoke broker (brokerStatus → NONE, Broker doc preserved — D-08 key assertion)
  3. revoke logistics (logisticsStatus → NONE, LogisticsPartner doc preserved — D-08 key assertion)
  4. role_not_assigned on NONE (rejects, no audit row)
  5. role_not_assigned on PENDING (rejects, no audit row)
  6. moderationStatus orthogonality (D-12 — suspended seller's moderationStatus survives revoke unchanged)

  Uses MongoMemoryReplSet fixture from Plan 02-01 (`startReplSet` / `stopReplSet`). Loose-schema seeds for Broker / LogisticsPartner with distinct model names (`Broker_testseed_revoke`, `LogisticsPartner_testseed_revoke`) to avoid model-overwrite collisions across the Jest run.

### Modified (backend repo)

- `src/moderation/service.js` — Replaced the `revokeRole` `NotImplementedError` stub (Plan 02-03's locked signature) with the filled transactional body + a `ROLE_FIELD_BY_NAME` whitelist constant immediately above the function. `deleteProviderProfile` and `editProfile` remain `NotImplementedError` stubs — Plan 02-05 fills them. The top-of-file comment block documenting the writeAction-bypass + two-step audit-first pattern is unchanged (still applies to revokeRole). Module exports unchanged (Plan 02-03 already exported `revokeRole`).
- `src/moderation/router.js` — Surgical edit: replaced the 4-line 501 placeholder block (`return res.status(501).json({ error: 'not_implemented', ... })`) with a 9-line live call (`const result = await service.revokeRole({ ... }); return res.json(result);`). Zero changes anywhere else in the file — `KNOWN_USER_ERRORS`, `denySelfModeration` mounts, suspend dispatch, PATCH unsuspend, /ping all preserved.

### Not modified

- `server.js` — verified unchanged. Router mount at `server.js:919` is a stable contract; routes added inside the exported `router` flow through automatically.
- `src/moderation/schemas.js` — `revokeRoleSchema` (and its `dispatchSchema` discriminator branch) was authored by Plan 02-02; no change needed for the live wiring.
- `src/moderation/actions.js` — bypassed inside the transaction per the writeAction-bypass note in service.js; module itself unchanged.
- `src/moderation/capabilities.js`, `src/moderation/denySelfModeration.js`, `src/moderation/rateLimit.js` — consumed (denySelfModeration via the inherited router mount), not edited.

## Decisions Made

- **Defensive `invalid_role` throw at the service boundary.** Even though Zod's `roleEnumAll` at the router rejects unknown roles before the service is called, the service has its own check via the `ROLE_FIELD_BY_NAME` map lookup. Rationale: direct service callers (these tests, future internal jobs, Plan 02-05's deleteProviderProfile when it inevitably copies this shape) bypass the router entirely. Belt-and-braces — and the cost is one map lookup per call. T-02-04-06 mitigation.
- **`role_not_assigned` precondition checked OUTSIDE the transaction.** Symmetric with Plan 02-03's `already_at_severity` / `not_suspended` fast-path. Avoids opening a session for a request that's destined to 400. Tests 4 + 5 assert `audits.length === 0` after the rejection — proves no orphan audit row leaks. Acknowledged TOCTOU edge (T-02-04-04: a concurrent approve between the precondition read and the txn open would let a stale state pass) accepted at single-operator scale per the threat model.
- **Last-admin guard NOT wired (per D-28).** Skipping is safe because admin-ness is determined by `AdminUser` collection membership joined by email, not by any `User.{role}Status` field. Revoking a broker role from a User who is also in `AdminUser` leaves them in `AdminUser`. Comment block at the top of revokeRole spells this out so a future "add safety" PR doesn't copy-paste suspend's guard.
- **Loose-schema seeds with distinct names.** `BrokerSeed`/`LogisticsPartnerSeed` use `_testseed_revoke` suffixes — different from migrate-moderation.test.js's `_testseed` suffix — so the Jest model registry doesn't collide if both suites run in the same process. Uses the `mongoose.models.X || mongoose.model(X, ...)` idempotent pattern in case Jest's --testPathPattern reruns the file.
- **Tests call `service.revokeRole` directly, not via supertest.** Same convention Plan 02-03 established. Decouples this plan's tests from router wiring; router-layer concerns (Zod payload validation rejecting unknown roles, denySelfModeration gate behavior, 400 envelope shape) get end-to-end coverage in Plan 02-06's acceptance test. This keeps revokeRole.test.js hermetic — no firebase-admin mock needed.

## Deviations from Plan

None — plan executed exactly as written.

The action body in the plan provided the function code in full and matches what landed in service.js character-for-character (modulo formatting that prettier would normalize). Test file matches the plan's prescribed source.

**Note on KNOWN_USER_ERRORS:** Verified before editing — `role_not_assigned` was already in the Set (Plan 02-03 pre-registration line: `'role_not_assigned',         // Plan 02-04 / 02-05`), so no router-error-mapping amendment was needed. This was the explicit hand-off Plan 02-03's summary called out for Plan 02-04.

## Issues Encountered

- **Pre-existing Mongoose duplicate-index warning** still surfaces during test runs (`Duplicate schema index on {"email":1}` on User and AdminUser). Same warning Plan 02-03 documented; predates this plan's diff. Not auto-fixed because it's outside the scope of the revoke_role task (Rule scope boundary).

## TDD Gate Compliance

**Task 1 (`tdd="true"`):**
- **RED:** Wrote `revokeRole.test.js` FIRST → `npx jest --testPathPattern revokeRole` → 1 test suite failed, 6/6 tests failed. Failure output confirmed: `NotImplementedError: ModerationService.revokeRole is not yet implemented (Phase 2)` thrown from the stub. Tests ran but failed against the stub — valid RED.
- **GREEN:** Filled `service.js` revokeRole body → same command → 1 test suite passed, 6/6 tests passed.

**Task 2 (`tdd="false"`):** Plan prescribed non-TDD because the underlying service has full coverage from Task 1 and the router's behavior gets end-to-end coverage in Plan 02-06's acceptance test. Verified via `node -c` (syntax) + 6 grep contract assertions + full suite still green (76/76).

Task 1 consolidates the RED test file + GREEN service-body change into a single `feat(02-04)` commit, matching the Plan 02-01 / 02-02 / 02-03 consolidation convention documented in those summaries. A strict-TDD split would put `test(...)` and `feat(...)` in separate commits; followed established project convention instead.

## User Setup Required

None — all changes are source-only, no environment variables, no service configuration, no migrations.

## Next Phase Readiness

- **Plan 02-05 (delete + edit)** can copy the same shape this plan established — it adds two new routes (`DELETE /:targetUid/provider-profile`, `POST /:targetUid/edit-profile`). KNOWN_USER_ERRORS already includes `invalid_field`, `no_changes`, `invalid_role_for_delete` from Plan 02-03's pre-registration. The `deleteProviderProfile` service contract per D-13 is symmetric to revokeRole at the User-side mutation step but ALSO hard-deletes the Broker / LogisticsPartner doc inside the same transaction — explicit inverse of D-08, easy to copy-and-adjust from this plan's body.
- **Plan 02-06 (rate limiter wiring + e2e tests)** mounts `moderationRateLimiter` at the router level + adds the supertest-based acceptance test that exercises the full chain end-to-end including 429 + Retry-After. The acceptance test will exercise revoke_role through the full Express stack (verifyIdToken → requireAdmin → denySelfModeration → dispatchSchema → service.revokeRole), giving the first router-layer test coverage of this plan's wiring.
- **No new blockers.** STATE.md's open Phase 2 blockers (Atlas M10+, Railway instance count, audit-note visibility) remain. None block Plan 02-05; Plan 02-06 touches the Railway-instance-count question.

## Known Stubs

- `service.deleteProviderProfile`, `service.editProfile` still throw `NotImplementedError` — intentional, filled by Plan 02-05. Documented in service.js with the `// --- stubs still owned by Plan 02-05` comment block.

These stubs do not affect Plan 02-04's success criteria (revoke_role is fully wired across all three roles).

## Threat Flags

None. All seven `mitigate`-dispositioned threats in the plan's `<threat_model>` have in-source enforcement + test coverage:

- **T-02-04-01** (revoke deletes Broker/LogisticsPartner) — service body explicitly has no `deleteOne` on Broker or LogisticsPartner. Negative grep `awk '/async function revokeRole/,/^}$/' src/moderation/service.js | grep -c "deleteOne"` returns 0. Tests 2 + 3 assert provider doc still present after revoke.
- **T-02-04-02** (revoke mutates moderationStatus) — service body has no `$set: { moderationStatus: ... }` in revokeRole. Test 6 explicitly asserts `moderationStatus.state` and `moderationStatus.restrictedFeatures` are unchanged after revoking the seller role of a `feature_limited` user.
- **T-02-04-03** (self-mod bypass) — `denySelfModeration` middleware applied to POST /:targetUid in router (inherited from Plan 02-03). Revoke flows through the same gate.
- **T-02-04-05** (revoke without audit row) — audit row inserted FIRST inside withTransaction; mongoose rolls both back if either step fails. Tests 4 + 5 assert no audit row exists when role_not_assigned returns (correct because we throw BEFORE the txn opens — there's nothing to roll back).
- **T-02-04-06** (dynamic field-name injection) — `roleField` is a whitelisted lookup from `ROLE_FIELD_BY_NAME`; unknown roles throw `invalid_role` before the `$set`. Zod enum at the router is the upstream gate; the service-side check is defense-in-depth for direct callers.

T-02-04-04 (TOCTOU on role_not_assigned) and T-02-04-07 (existence-leak via role_not_assigned) stay `accept` per the plan.

## Self-Check: PASSED

Verification of artifacts claimed in SUMMARY:

| Check | Result |
|-------|--------|
| `src/moderation/service.js` contains `action: 'revoke_role'` | FOUND (1 live use) |
| `src/moderation/service.js` contains `ROLE_FIELD_BY_NAME` | FOUND (2 references — declaration + lookup) |
| `src/moderation/service.js` contains `role_not_assigned` | FOUND |
| revokeRole body does NOT call `deleteOne` (negative check) | PASSED (count=0) |
| `src/moderation/router.js` contains `service.revokeRole` | FOUND |
| `src/moderation/router.js` contains `not_implemented` (must be 0) | PASSED (count=0 — stub removed) |
| `src/moderation/router.js` contains `role: parsed.data.role` | FOUND |
| `src/moderation/router.js` preserves `service.suspend` | FOUND (2 refs) |
| `src/moderation/router.js` preserves `service.unsuspend` | FOUND (2 refs) |
| `__tests__/moderation/revokeRole.test.js` exists + 6 test cases | FOUND (192 lines, 6 tests) |
| Backend commit `646d09e` (Task 1) on `feat/moderation-baseline` | FOUND |
| Backend commit `ac92145` (Task 2) on `feat/moderation-baseline` | FOUND |
| `npx jest --testPathPattern revokeRole` — 6 passed | PASSED |
| `npm test` — 76 passed / 0 failed (70 previous + 6 new) | PASSED |
| `node -c src/moderation/service.js` exits 0 | PASSED |
| `node -c src/moderation/router.js` exits 0 | PASSED |

---

*Phase: 02-admin-moderation-endpoints-backend*
*Completed: 2026-04-17*
