---
phase: 04-mobile-plumbing-mobile
plan: 02
subsystem: api
tags: [moderation, admin, http-client, axios, typescript]

# Dependency graph
requires:
  - phase: 04-mobile-plumbing-mobile/04-01
    provides: "apiClient (shared axios instance with Bearer request interceptor + 403 account_suspended → ModerationError response interceptor)"
  - phase: 04-mobile-plumbing-mobile/04-01
    provides: "ModerationError class at src/services/moderation/errors.ts"
  - phase: 02-admin-moderation-endpoints-backend
    provides: "backend routes under /api/admin/moderation/* (suspend, unsuspend, revoke-role, restore-role, edit-profile, provider-profile)"
provides:
  - "src/services/moderation/ModerationService.ts — the single mobile-side surface for all admin moderation writes"
  - "6 admin-write method wrappers (suspend, unsuspend, revokeRole, restoreRole, editProviderProfile, deleteProviderProfile)"
  - "1 getHistory stub method that throws until Phase 5 adds the backend /history route"
  - "6 exported body-shape interfaces (SuspendBody, UnsuspendBody, RevokeRoleBody, RestoreRoleBody, EditProfileBody, DeleteProfileBody) + 4 literal-union types (Severity, ReasonCategory, ProviderRole, RevokableRole) for Plan 05 admin-screen consumers"
affects: [04-04-apiClient-wiring, 04-05-AppState-handler, 05-admin-moderation-screens, 05-admin-management-screen-extension, 06-affected-user-banner]

# Tech tracking
tech-stack:
  added: []  # Zero new deps — reuses axios via apiClient from Plan 04-01
  patterns:
    - "Object-module service export (matches existing AuthService shape per CLAUDE.md §Module Design)"
    - "Service methods delegate to shared apiClient — no direct axios calls outside src/services/http/client.ts"
    - "DELETE with request body passes payload via axios config.data (for endpoints that disambiguate via body, not path)"
    - "Stub-then-replace pattern: getHistory throws a Phase-5-specific sentinel error now; body will be swapped to a 2-line apiClient.get call when Phase 5 ships the route"

key-files:
  created:
    - src/services/moderation/ModerationService.ts
    - src/services/moderation/__tests__/ModerationService.test.ts
  modified: []  # MOB-01 guardrail: AuthService.ts is byte-identical to its pre-04-02 state

key-decisions:
  - "Fully honored MOB-01 guardrail — zero moderation methods added to AuthService.ts (grep 'suspend|revoke|moderation' in AuthService still returns 0)"
  - "Kept getHistory as a live Promise-returning stub (throws with exact plan-specified error message) rather than omitting it, so Plan 05 admin screens can type-check the full 7-method surface today and fail loudly if called before Phase 5"
  - "DELETE deleteProviderProfile passes body via `apiClient.delete(path, { data: body })` per axios docs + 02-CONTEXT D-14 backend contract"
  - "Unsuspend body default `= {}` at the method signature — removes a branch and matches 02 D-21 'empty body is valid'"

patterns-established:
  - "Moderation HTTP surface lives in src/services/moderation/ — parallel to the backend's src/moderation/ folder for cross-repo discoverability"
  - "Per-method try/catch logs via console.error + re-throws — the apiClient response interceptor has already converted 403 account_suspended into ModerationError before this catch runs, so plain `throw error` surfaces the right class to callers"
  - "Body-shape interfaces are exported alongside the service object — Plan 05 screens import both without pulling a full DTO layer"

requirements-completed:
  - MOB-01

# Metrics
duration: 3min
completed: 2026-04-18
---

# Phase 04 Plan 02: Mobile ModerationService Module Summary

**Consolidated mobile wrapper (`src/services/moderation/ModerationService.ts`) for the 6 Phase-2 admin moderation write endpoints plus a typed getHistory stub — every call inherits Bearer auth and 403-account_suspended normalization from the shared `apiClient` without modifying `AuthService.ts`.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-18T07:36:22Z
- **Completed:** 2026-04-18T07:39:01Z
- **Tasks:** 1 (TDD — RED + GREEN, no REFACTOR needed)
- **Files created:** 2 (ModerationService.ts + its Jest test)
- **Files modified:** 0 (AuthService.ts byte-identical)

## Accomplishments

- New module `src/services/moderation/ModerationService.ts` (179 lines) owns every moderation HTTP call from the mobile side
- 7 methods exported as a single object-module (matches CLAUDE.md §Module Design pattern used by AuthService)
- All 10 Jest test cases pass — each method's verb + path + body payload is asserted end-to-end against a mocked apiClient
- MOB-01 guardrail verified: `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` returns 0
- Zero new runtime dependencies — reuses axios via the `apiClient` instance Wave 1 produced in Plan 04-01

## Task Commits

1. **Task 1 RED: failing tests for ModerationService** — `59ebad2` (test)
2. **Task 1 GREEN: ModerationService implementation** — `3db12b8` (feat)

_TDD cycle: `test(04-02)` commit contained 10 failing tests; `feat(04-02)` made all 10 green. No REFACTOR commit — the implementation matches the plan's action-block template verbatim._

## Files Created

- `src/services/moderation/ModerationService.ts` — 7 method wrappers + 6 body-shape interfaces + 4 literal-union types; all methods delegate to `apiClient` from `../http/client`
- `src/services/moderation/__tests__/ModerationService.test.ts` — 10 Jest tests covering all 7 methods, unsuspend-no-body default, DELETE-with-body axios config.data shape, ModerationError passthrough, and raw-axios-error passthrough

## Exported Surface

### Methods (7)

| Method | HTTP | Path (relative to apiClient.baseURL = API_URL) |
|--------|------|-------------------------------------------------|
| `suspend(uid, body)` | POST | `/api/admin/moderation/:uid/suspend` |
| `unsuspend(uid, body?)` | PATCH | `/api/admin/moderation/:uid/unsuspend` |
| `revokeRole(uid, body)` | POST | `/api/admin/moderation/:uid/revoke-role` |
| `restoreRole(uid, body)` | POST | `/api/admin/moderation/:uid/restore-role` |
| `editProviderProfile(uid, body)` | POST | `/api/admin/moderation/:uid/edit-profile` |
| `deleteProviderProfile(uid, body)` | DELETE | `/api/admin/moderation/:uid/provider-profile` (body via `config.data`) |
| `getHistory(uid)` | GET (Phase 5) | stub — throws `Error('Not implemented — Phase 5 adds the /history route')` |

### Types (10)

- Literal unions: `Severity`, `ReasonCategory`, `ProviderRole`, `RevokableRole`
- Body interfaces: `SuspendBody`, `UnsuspendBody`, `RevokeRoleBody`, `RestoreRoleBody`, `EditProfileBody`, `DeleteProfileBody`

## Acceptance Criteria Verification

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "export const ModerationService" ModerationService.ts` | 1 | **1** |
| `grep -c "from '../http/client'" ModerationService.ts` | 1 | **1** |
| `grep -Ec "(suspend\|unsuspend\|revokeRole\|restoreRole\|editProviderProfile\|deleteProviderProfile\|getHistory):" ModerationService.ts` | 7 | **7** |
| `grep -c "/api/admin/moderation/" ModerationService.ts` | ≥ 6 | **8** (6 endpoints + 2 in Phase-5 replacement comment) |
| `grep -c "apiClient" ModerationService.ts` | ≥ 7 | **9** (1 import + 6 active call sites + 2 in Phase-5 replacement comment) |
| Plain `axios` import or call site in ModerationService.ts | 0 | **0** (the word `axios` appears only in 3 explanatory comments — see note below) |
| `grep -c "Not implemented — Phase 5 adds the /history route"` | 1 | **1** |
| **MOB-01 guardrail:** `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` | 0 | **0** |
| Jest test cases pass | 10 | **10 ✓** |
| New TS errors in src/services/moderation/** or src/services/http/** | 0 | **0** (pre-existing AuthService.ts errors unchanged and out of scope) |

**Note on `axios` grep count (3 non-zero):** The plan's raw `grep -c "axios"` returns 3, but all 3 matches are inside explanatory comments (lines 14, 16, 154) that describe axios behavior. There is zero `import axios`, zero `from 'axios'`, and zero `axios.*` call site — the spirit of the criterion ("methods must use apiClient, not plain axios") is satisfied. Tightened check `grep -cE "\\baxios\\.|import.*axios"` returns 0.

## Decisions Made

1. **Used plan's action block verbatim.** The plan provided a complete template; no Claude's-Discretion substitutions were needed.
2. **Jest mock via `jest.mock('../../http/client')` (module mock) rather than axios-mock-adapter on the apiClient instance.** Rationale: this is a UNIT test — `ModerationService` should not care what `apiClient` does internally; the only contract is "call `apiClient.<verb>(path, body)` and return `response.data`". The client-interceptor behavior is already exercised by Plan 04-01's own test file. Mocking at the module boundary keeps the two plans' tests independent.
3. **Kept default-empty-object for `unsuspend`.** `unsuspend: async (targetUid, body: UnsuspendBody = {}) => …` — matches 02 D-21 ("empty body is valid") and avoids an `if (body) ...` branch inside the method.

## Deviations from Plan

None — plan executed exactly as written. The plan's action block was a complete, executable template and produced passing tests on first compile.

## Issues Encountered

None. TDD cycle was clean: RED failed for the expected reason (module not found), GREEN passed all 10 tests on first run.

## Known Stubs

**`ModerationService.getHistory(targetUid)`** — intentional stub, documented in the plan (04-CONTEXT D-05 + Claude's Discretion).

- **File:** `src/services/moderation/ModerationService.ts:172-174`
- **Reason:** Phase 5 adds the backend `GET /api/admin/moderation/:targetUid/history` route; the mobile stub exists now so Plan 05 admin screens can type-check against the full 7-method surface.
- **Resolved by:** Phase 5 — replace the `throw` with the commented-out 2-line `apiClient.get` call already present inside the method body.
- **Not a blocker:** No current consumer of the method exists; accidental call before Phase 5 fails loudly with the exact sentinel error.

## Threat Surface Scan

Reviewed — this plan's files (`ModerationService.ts` + its test) introduce no new network endpoint, no new auth path, no new file access, and no schema changes outside what was already enumerated in the plan's `<threat_model>`. All surface described is fully covered by T-04-02-01..06. No `threat_flag` section needed.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **Ready for Plan 04-04:** apiClient wiring inside AuthContext (registers tokenProvider + moderationRefreshListener). ModerationService's methods already route through apiClient, so once 04-04 wires the token provider, admin calls will carry Bearer idToken automatically.
- **Ready for Plan 05:** admin moderation screens can now `import { ModerationService, SuspendBody, ... } from '../services/moderation/ModerationService'` and have the full 6-method write surface typed. `getHistory` is available as a typed stub that will fail loudly if called before Phase 5's route lands.
- **No open blockers.**

## Self-Check

- [x] `src/services/moderation/ModerationService.ts` exists and is 179 lines
- [x] `src/services/moderation/__tests__/ModerationService.test.ts` exists and has 10 `it(...)` tests (all passing)
- [x] Commit `59ebad2` (test — RED) present in `git log`
- [x] Commit `3db12b8` (feat — GREEN) present in `git log`
- [x] AuthService.ts guardrail: `grep -c 'suspend\|revoke\|moderation' src/services/AuthService.ts` returns 0
- [x] Jest invocation succeeds: `npx jest src/services/moderation/__tests__/ModerationService.test.ts` → 10/10 passing
- [x] ESLint clean on both new files (zero output)
- [x] No new TypeScript errors in `src/services/moderation/` or `src/services/http/` (`npx tsc --noEmit | grep -E '^src/services/(moderation|http)'` → empty)

## Self-Check: PASSED

---
*Phase: 04-mobile-plumbing-mobile*
*Plan: 02*
*Completed: 2026-04-18*
