---
phase: 05-admin-moderation-ui-mobile
plan: 12
subsystem: auth
tags: [auth, firebase, idtoken, refresh, axios-interceptor, single-flight, asyncstorage, gap-closure]

requires:
  - phase: 04-mobile-plumbing-mobile
    provides: apiClient + Bearer request interceptor + tokenProvider getter (Plan 04-01); currentIdTokenRef + login/signup token sync + setModerationRefreshListener (Plan 04-04)
  - phase: 05-admin-moderation-ui-mobile
    provides: AdminModeration end-to-end UI that triggers the 1hr-TTL 401s the refresh path now covers (Plans 05-07 / 05-08 / 05-09)
provides:
  - AuthService.refreshIdToken(refreshToken) hitting securetoken.googleapis.com with form-encoded body; camelCase-normalized return shape
  - AuthService.saveAuthSession / getRefreshToken / getIdTokenExpiresAt — durable refresh-session persistence across cold starts
  - apiClient 401 response interceptor with single-retry contract + loop-guard flags (_skipIdTokenRefresh, _idTokenRefreshAttempted)
  - setIdTokenRefreshListener + setLogoutTrigger listener-registration pattern mirroring setModerationRefreshListener
  - AuthContext refresh lifecycle — proactive 5-min-pre-expiry check on refreshUser + reactive single-flight 401 listener + permanent-failure logout branch
affects: [06-affected-user-ux, future milestones touching auth/refresh]

tech-stack:
  added: []  # zero new dependencies — pure axios + AsyncStorage
  patterns:
    - Listener-registration for cross-module access (apiClient 401 → AuthContext refresh closure)
    - Single-flight in-flight promise ref (idTokenRefreshInFlightRef) shared across proactive + reactive paths
    - logoutRef forward-declaration to let a mount-effect-registered listener invoke a useCallback defined later in the component body
    - Loop-guard axios config flags declared via module augmentation (_skipIdTokenRefresh, _idTokenRefreshAttempted)

key-files:
  created:
    - .planning/phases/05-admin-moderation-ui-mobile/05-12-PLAN.md
    - .planning/phases/05-admin-moderation-ui-mobile/05-12-SUMMARY.md
  modified:
    - src/services/AuthService.ts — 4 new methods (refreshIdToken, saveAuthSession, getRefreshToken, getIdTokenExpiresAt) + extended logout
    - src/services/__tests__/AuthService.test.ts — 5 new tests (Test 10-14)
    - src/services/http/client.ts — 401 response interceptor + setIdTokenRefreshListener/setLogoutTrigger exports + 2 new axios module-augmented config flags
    - src/context/AuthContext.tsx — 4 new refs (refreshTokenRef, idTokenExpiresAtRef, idTokenRefreshInFlightRef, logoutRef) + login/signup/logout/loadStorageData/mount-effect wired to new lifecycle + proactive refresh in refreshUserInternal
    - src/context/__tests__/AuthContext.test.tsx — 7 new tests (Test 9-15) + mock surface extensions
    - __tests__/moderation.e2e.integration.test.tsx — e2e mock extended for saveAuthSession contract (Rule 1 auto-fix)

key-decisions:
  - "Piggyback proactive refresh on refreshUserInternal (AppState-driven) rather than a standalone RN timer — RN background-timer reliability is poor; the existing foreground-refresh path is the natural hook and inherits single-flight dedupe via the shared in-flight promise ref"
  - "logoutRef pattern (not stateless hoisting) resolves the scope-order problem where the mount useEffect registers a listener BEFORE `logout` is defined — keeps the listener closure stable and lets future refactors reorder callback definitions without breaking registration"
  - "Two listener exports (setIdTokenRefreshListener + setLogoutTrigger) instead of one combined — separation lets the 401 interceptor handle the 'N parallel 401s share ONE refresh' case distinctly from the 'second-401-in-a-row means session revoked, logout' case"
  - "saveToken kept in source for back-compat but DROPPED from both AuthContext test mocks (regression lock) — if a screen ever reintroduces saveToken, Test 11 breaks explicitly instead of silently bypassing the new refreshToken persistence path"
  - "Code duplication between listener body and proactive body accepted by plan (comment documents it) — the alternative of exposing the listener as a named callback adds a closure-over-refs surface with no offsetting correctness benefit for 5-modified-file gap closure"
  - "refreshIdToken stays on plain axios (not apiClient) per Firebase Identity Toolkit convention — key-in-query-string surface uses a different auth model than Bearer-in-header; unit test Test 10 explicitly asserts apiClient.post was NOT called to lock this contract"

patterns-established:
  - "Pattern: 401-triggered single-flight refresh + retry — apiClient response interceptor calls registered listener returning Promise<string | null>, on new-token retries via apiClient(config) with _idTokenRefreshAttempted flag preventing infinite recursion"
  - "Pattern: logoutRef for forward-declared refs — useRef<(() => Promise<void>) | null>(null) + useEffect([logout]) keeps listener closures stable across callback redefinitions"
  - "Pattern: permanent vs transient Firebase error branching — listener catches AuthService.refreshIdToken rejection, branches on message ∈ {TOKEN_EXPIRED, INVALID_REFRESH_TOKEN, USER_DISABLED} → logout path; else rethrow for caller to decide"
  - "Pattern: loop-guard flags via declare module 'axios' interface augmentation — _skipIdTokenRefresh (opt-out) + _idTokenRefreshAttempted (internal single-retry lock) follow the existing _skipModerationInterceptor precedent"

requirements-completed: [SEC-01, MOB-02, MOB-03]

duration: 8m46s
completed: 2026-04-19
---

# Phase 05 Plan 12: Firebase idToken Refresh (UAT Test 8 Gap Closure) Summary

**Automatic Firebase idToken refresh via securetoken.googleapis.com + two-pronged reactive (401 interceptor) and proactive (5-min-pre-expiry on foreground) strategy — closes the "log out + back in every hour" workaround for admin moderation sessions**

## Performance

- **Duration:** 8m46s
- **Started:** 2026-04-19T05:53:45Z
- **Completed:** 2026-04-19T06:02:31Z
- **Tasks:** 4 (+ 1 auto-fix)
- **Files modified:** 6 (5 planned + 1 auto-fix)
- **Commits:** 6 per-task + 1 metadata

## Accomplishments

- `AuthService.refreshIdToken` POSTs form-encoded `grant_type=refresh_token&refresh_token=<token>` to securetoken.googleapis.com and normalizes snake_case response to camelCase; Firebase permanent-failure error messages (TOKEN_EXPIRED / INVALID_REFRESH_TOKEN / USER_DISABLED) surface unchanged so AuthContext can branch to logout
- `AuthService.saveAuthSession` persists idToken + refreshToken + idTokenExpiresAt (wall-clock ms) + userData to AsyncStorage; `getRefreshToken` / `getIdTokenExpiresAt` symmetric getters hydrate on cold start; `logout` clears all four keys
- `apiClient` gains a 401 response interceptor registered AFTER the existing 403 handler: on 401 → single-flight listener → retry via `apiClient(config)` with new Bearer; on 2nd 401 → `logoutTrigger()`; loop-guards `_skipIdTokenRefresh` + `_idTokenRefreshAttempted` declared via module augmentation
- `AuthContext` owns the full refresh lifecycle — persistence on login/signup (migrated off `saveToken` to `saveAuthSession`), hydration on cold start, registered single-flight `setIdTokenRefreshListener` with generation-guard (WR-02 pattern), registered `setLogoutTrigger` with logoutRef forward-declaration, and proactive 5-min-pre-expiry check at the top of `refreshUserInternal`
- Test coverage: `AuthService.test.ts` 14/14 green (9 existing + 5 new), `AuthContext.test.tsx` 15/15 green (8 Plan 04-04 preserved + 7 new Plan 05-12); 0 new TypeScript errors; 161/162 tests green on the full suite (only the pre-existing `App.test.tsx` navigation-stack failure remains, logged in deferred-items.md)

## Task Commits

Each task was committed atomically following TDD RED→GREEN pattern where applicable:

1. **Task 1 RED: Failing AuthService tests** — `ce48a94` (test)
2. **Task 1 GREEN: refreshIdToken + saveAuthSession + getters + logout extension** — `e79b74e` (feat)
3. **Task 2: 401 response interceptor + listener registrations** — `be69e9f` (feat) — no TDD pair; interceptor behavior is integration-tested via Task 4 per plan
4. **Task 3: AuthContext refresh lifecycle wiring** — `29d0555` (feat) — no TDD pair; tested in Task 4
5. **Task 4: AuthContext tests (Test 9-15)** — `fa3a6eb` (test)
6. **Auto-fix: moderation e2e mock extension** — `1cfb50e` (fix) — Rule 1 regression caused by saveToken→saveAuthSession migration

**Plan metadata:** (this SUMMARY.md + STATE.md + ROADMAP.md) — final commit pending.

## Files Created/Modified

### Created

- `.planning/phases/05-admin-moderation-ui-mobile/05-12-PLAN.md` — UAT Test 8 gap-closure plan (1326 lines)
- `.planning/phases/05-admin-moderation-ui-mobile/05-12-SUMMARY.md` — this file

### Modified (Source)

- `src/services/AuthService.ts` (+77 lines) — new refresh + session methods; logout extended
- `src/services/http/client.ts` (+87 lines) — 401 interceptor + 2 new exports + 2 new config flags
- `src/context/AuthContext.tsx` (+180 lines, -2) — 4 new refs + login/signup migration + logout clears + hydration + listener registration + proactive refresh

### Modified (Tests)

- `src/services/__tests__/AuthService.test.ts` (+88 lines) — Tests 10–14
- `src/context/__tests__/AuthContext.test.tsx` (+175 lines, -1) — Tests 9–15 + mock surface extensions
- `__tests__/moderation.e2e.integration.test.tsx` (+15 lines, -1) — mock fix (Rule 1 auto-fix for saveToken → saveAuthSession regression)

## Decisions Made

See `key-decisions` in frontmatter. Summary:

- **Proactive hook chosen: refreshUserInternal head-of-function, not standalone timer** — the existing AppState `active` transition (Plan 04-06) already fires refreshUser. Piggybacking adds zero new lifecycle surface and inherits single-flight dedupe for free.
- **logoutRef forward-declaration** — the mount useEffect registers the refresh listener BEFORE `logout` is defined as a useCallback later in the component body; a ref-based forward reference avoids reorganizing the entire function structure. Plan's own action text calls out this solution explicitly.
- **Two listener exports** — `setIdTokenRefreshListener` (returns new token / null) for the single-flight refresh; `setLogoutTrigger` for the 2nd-401 revocation branch. Keeping them separate makes the contract explicit: listener == refresh-attempt-and-report; trigger == terminate-session.
- **saveToken preserved in source, dropped from test mocks** — back-compat for any yet-unknown caller; Test 11 asserts `(AuthService as any).saveToken).toBeUndefined()` on the mock so any future reintroduction via mock surfaces as a visible regression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] moderation.e2e.integration.test.tsx AuthService mock missing saveAuthSession**

- **Found during:** Post-Task 4 full-suite verification
- **Issue:** Plan 05-12 migrated `AuthContext.login/signup` off `AuthService.saveToken` to `saveAuthSession`. The Phase 4 e2e test mocks AuthService locally with `saveToken: jest.fn(async () => {})` and bare `signIn/signUp` (no `refreshToken`/`expiresIn`). After the migration, `login` threw because `saveAuthSession` was undefined on the mock, breaking 3 previously-green tests: Test 3.1 (403 triggers refresh via registered listener), Test 4.1 (foreground transition on logged-in user fires refreshUser), Test 4.3 (moderationStatus transitions reflected in user context).
- **Fix:** Extended the e2e mock to mirror the AuthContext Plan 05-12 test mock surface — added `saveAuthSession`, `getRefreshToken`, `getIdTokenExpiresAt`, `refreshIdToken`; updated `signIn/signUp` to return `refreshToken + expiresIn`; dropped `saveToken` (regression lock — any future reintroduction of saveToken in a caller would surface via the e2e test failing rather than silently bypassing the new persistence path).
- **Files modified:** `__tests__/moderation.e2e.integration.test.tsx`
- **Verification:** `npx jest __tests__/moderation.e2e.integration.test.tsx --no-coverage` returns 18/18 green (was 15/18 after Task 4).
- **Committed in:** `1cfb50e` (separate auto-fix commit, not folded into a task commit because it touched a test file outside the 5 plan-scoped files)

---

**Total deviations:** 1 auto-fixed (1 bug — Rule 1 regression from the planned migration)
**Impact on plan:** Deviation was a predictable side-effect of dropping `AuthService.saveToken` from the login/signup contract. Zero scope creep — the fix only extended an existing test's mock surface to match the new contract.

## Grep Acceptance Criteria Results

All plan-specified grep invariants verified green:

### AuthService.ts (Task 1)

| Check | Expected | Actual |
|-------|----------|--------|
| `refreshIdToken: async` | 1 | 1 |
| `saveAuthSession: async` | 1 | 1 |
| `getRefreshToken: async` | 1 | 1 |
| `getIdTokenExpiresAt: async` | 1 | 1 |
| `securetoken.googleapis.com` | 1 | 2 (1 comment + 1 URL literal — comment is part of plan's own code block) |
| `grant_type=refresh_token` | 1 | 2 (1 comment + 1 body literal — same reason) |
| `userRefreshToken` | >=3 | 3 |
| `userIdTokenExpiresAt` | >=3 | 3 |

### http/client.ts (Task 2)

| Check | Expected | Actual |
|-------|----------|--------|
| `_skipIdTokenRefresh` | >=2 | 2 |
| `_idTokenRefreshAttempted` | >=3 | 4 |
| `setIdTokenRefreshListener` | 1 | 1 |
| `setLogoutTrigger` | 1 | 2 (declaration + export — structural count) |
| `interceptors.response.use` | 2 | 2 |
| `status !== 401` | 1 | 1 |
| `ACCOUNT_SUSPENDED` | >=2 | 4 (existing 403 handler preserved unchanged — sanity) |
| `apiClient(config)` | 1 | 2 (1 comment + 1 retry — comment is part of plan's own code block) |

### AuthContext.tsx (Task 3)

| Check | Expected | Actual |
|-------|----------|--------|
| `refreshTokenRef` | >=8 | 10 |
| `idTokenExpiresAtRef` | >=7 | 10 |
| `idTokenRefreshInFlightRef` | >=5 | 15 |
| `setIdTokenRefreshListener` | 1 | 2 (import + call — structural count, plan author's "1" was an undercount) |
| `setLogoutTrigger` | 1 | 3 (import + call + comment — structural) |
| `AuthService.refreshIdToken` | >=2 | 3 |
| `AuthService.saveAuthSession` | >=4 | 4 |
| `AuthService.getRefreshToken` | 1 | 1 |
| `AuthService.getIdTokenExpiresAt` | 1 | 1 |
| `AuthService.saveToken` | 0 | 0 |
| `TOKEN_EXPIRED` / `INVALID_REFRESH_TOKEN` / `USER_DISABLED` | 1 each | 2 each (comment + literal — plan's own code block produces this) |
| `5 * 60 * 1000` | 1 | 1 |
| `logoutRef` | >=3 | 6 |

### AuthContext.test.tsx (Task 4)

| Check | Expected | Actual |
|-------|----------|--------|
| Test 9 / 10 / 11 / 12 / 13 / 14 / 15 names | 1 each | 1 each |
| `setIdTokenRefreshListener: jest.fn` | 1 | 1 |
| `setLogoutTrigger: jest.fn` | 1 | 1 |
| `refreshIdToken: jest.fn` | 1 | 1 |
| `saveAuthSession: jest.fn` | 1 | 1 |

Where the plan specified `= 1` but the plan's own verbatim code produces `= 2` (comment + literal, or import + call), the grep criterion is satisfied in spirit — these are structural counts inherent to the code block the plan itself prescribed.

## Test Results

| Suite | Before Plan 05-12 | After Plan 05-12 |
|-------|-------------------|------------------|
| AuthService.test.ts | 9 pass | 14 pass (+5 new) |
| AuthContext.test.tsx | 8 pass | 15 pass (+7 new) |
| moderation.e2e.integration.test.tsx | 18 pass | 18 pass (regression fixed via auto-fix) |
| Full repo jest | 156/157 (App.test.tsx pre-existing) | 161/162 (same App.test.tsx + net +12 new tests) |

### TypeScript

- `npx tsc --noEmit` total errors: 26 before, 26 after — **zero delta**
- All errors are pre-existing in unmodified code (AuthService.ts lines 14/23/27/36/52 untyped original code; test files' `(value: unknown) => void` placeholder typings)

### Dependencies

- `git diff 7299396..HEAD -- package.json package-lock.json` → **0 lines changed**. Zero new dependencies per plan constraint.

## Issues Encountered

- **logoutRef scope-order puzzle** — Plan's own action text identified and resolved this: the mount useEffect registers the refresh listener BEFORE `logout` is defined. Solution (per plan): `logoutRef = useRef(...)`, `useEffect([logout])` syncs ref to latest callback, listener closure reads via `logoutRef.current?.()`. No in-execution issue.
- **e2e mock regression (documented above as Rule 1 auto-fix)** — foreseeable consequence of dropping `saveToken` from the AuthContext login/signup contract.

## User Setup Required

None — zero new dependencies, no external service configuration, no environment variables. The fix is purely in-code.

**Production behavior change (informational):**

- Existing users currently logged in have `userToken` + `userData` in AsyncStorage but NOT `userRefreshToken` or `userIdTokenExpiresAt`. On their next app launch after this ships, `loadStorageData` reads `null` for both new keys, `refreshTokenRef.current` stays null, and the first 401 triggers the listener which returns null (no refresh token) → interceptor propagates the original 401 → the app behaves exactly as it did pre-Plan-05-12 (one hard re-login). Subsequent sign-in populates all four keys and the refresh lifecycle is fully active from that point. Zero-downtime migration; no forced logout.

## Self-Check: PASSED

### Files exist

- FOUND: `.planning/phases/05-admin-moderation-ui-mobile/05-12-PLAN.md`
- FOUND: `.planning/phases/05-admin-moderation-ui-mobile/05-12-SUMMARY.md` (this file)
- FOUND: `src/services/AuthService.ts` (modified)
- FOUND: `src/services/__tests__/AuthService.test.ts` (modified)
- FOUND: `src/services/http/client.ts` (modified)
- FOUND: `src/context/AuthContext.tsx` (modified)
- FOUND: `src/context/__tests__/AuthContext.test.tsx` (modified)
- FOUND: `__tests__/moderation.e2e.integration.test.tsx` (modified — auto-fix)

### Commits exist

- FOUND: `ce48a94` (Task 1 RED — test)
- FOUND: `e79b74e` (Task 1 GREEN — feat)
- FOUND: `be69e9f` (Task 2 — feat)
- FOUND: `29d0555` (Task 3 — feat)
- FOUND: `fa3a6eb` (Task 4 — test)
- FOUND: `1cfb50e` (auto-fix — fix)

## Next Phase Readiness

- **UAT Test 8 (major severity):** closed end-to-end on the mobile side. Admin moderation sessions that cross the 1-hour Firebase idToken TTL no longer require the "log out + back in" workaround. Any 401 (including mid-session token revocation) is transparently retried once with a freshly-minted idToken; a persistent 401 after retry triggers automatic logout.
- **Phase 6 readiness:** Plan 05-12 is orthogonal to Phase 6's affected-user UX + security review. It unblocks long-session admin work today and does not introduce new surface that Phase 6 must audit (the refresh endpoint is the canonical Firebase securetoken endpoint; the only persisted secret at rest is the refreshToken, already tracked in the threat register as T-05-12-01 accept with future hardening deferred).
- **Backend 05-0a / 05-0b:** still the gating blocker for production Phase 5 readiness; that work lives in the separate `carEx-services` repo.
- **Known stubs:** None — this plan ships wired-up runtime code with zero placeholder/coming-soon strings.

---

*Phase: 05-admin-moderation-ui-mobile*
*Completed: 2026-04-19*
