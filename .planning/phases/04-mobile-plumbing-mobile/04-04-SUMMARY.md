---
phase: 04-mobile-plumbing-mobile
plan: 04
subsystem: auth-context
tags: [auth-context, refresh, dedupe, cooldown, token-provider, interceptor-wiring]

# Dependency graph
requires:
  - phase: 04-mobile-plumbing-mobile
    plan: 01
    provides: "setTokenProvider + setModerationRefreshListener + apiClient + _skipModerationInterceptor declaration-merge — AuthContext wires into all four"
provides:
  - "AuthContext.refreshUser is deduped via module-level refreshInFlightRef promise (D-15)"
  - "AuthContext.refreshUser enforces a 30s cooldown via lastRefreshAtRef, shared between AppState + 403-interceptor paths"
  - "AuthContext.refreshUser is a no-op when user is null (D-16)"
  - "AuthContext registers setTokenProvider(() => currentIdTokenRef.current) on mount so the request interceptor has synchronous idToken access"
  - "AuthContext registers setModerationRefreshListener with a closure that sets _skipModerationInterceptor=true on the refresh path (D-11) — the 2-of-2 grep-bait occurrence"
  - "currentIdTokenRef is kept in sync via login / signup / loadStorageData; cleared FIRST in logout"
  - "AuthService.getBackendUser accepts optional config?: AxiosRequestConfig second parameter (Plan 04-05 coordination; forwarded to axios.get as a safe no-op until 04-05 migrates to apiClient)"
affects:
  - 04-05  # AuthService migration onto apiClient — the getBackendUser config param is already in place
  - 04-06  # AppState hook consumes AuthContext.refreshUser (dedupe + cooldown already wired)
  - 04-07  # Integration harness verifies the 403 → listener → refresh cycle end-to-end

# Tech tracking
tech-stack:
  added: []  # no new runtime deps; all behavior built on React useRef + existing apiClient
  patterns:
    - "Module-level ref (useRef) for cross-call state inside a React provider — synchronous reads, no batching delay; parallel promise reuse via Promise<T> | null pointer (D-15)"
    - "Shared-state policy point: a single refreshUserInternal({ skipInterceptor }) encapsulates dedupe + cooldown + logged-out skip so both AppState and 403-interceptor entry points converge on one implementation"
    - "Mirror-ref pattern (userRef) for capturing freshest state inside a long-lived closure registered on mount — avoids re-registering the listener on every user-state change"
    - "Pre-emptive interface extension (AuthService.getBackendUser config param) with a TODO comment pointing at the consuming plan — lets Wave 2 plans land in parallel even when they only logically depend on each other's types"

key-files:
  created:
    - "src/context/__tests__/AuthContext.test.tsx (~320 lines) — 8 Jest tests covering listener registration, dedupe, cooldown, logged-out skip, skip-flag propagation, and token-ref lifecycle"
  modified:
    - "src/context/AuthContext.tsx — +~100 lines net: 4 refs, mount effect rewritten, refreshUser split into refreshUser + refreshUserInternal, token-ref synced across login/signup/loadStorageData/logout"
    - "src/services/AuthService.ts — +6 lines: AxiosRequestConfig import, optional config param on getBackendUser, axios.get forwards it"

key-decisions:
  - "Single refreshUserInternal({ skipInterceptor }) encapsulates all three policy concerns (dedupe + cooldown + D-16) so the two entry points (public refreshUser and listener) cannot drift. Public refreshUser is a thin wrapper that passes skipInterceptor:false; listener passes skipInterceptor:true. Dedupe/cooldown are identical on both paths by construction."
  - "userRef mirror was added (not in the plan action block) because the moderationRefreshListener is registered ONCE on mount and closes over refreshUserInternal, which itself must read the latest user. Without userRef, a listener fired after user changed would evaluate against the stale user captured at registration time. This is a correctness fix, not a deviation: the plan's success criteria include 'refreshUser returns early when user?.localId is falsy' — accurate evaluation requires reading the current user, not the mount-time user."
  - "Grep-bait scope narrowed to non-test source files. Plan's literal statement 'exactly 2 files codebase-wide contain _skipModerationInterceptor' conflicts with Plan 04-01 which already added the flag to src/services/http/__tests__/client.test.ts for behavior verification. The operationally correct invariant (and the one Plan 04-01 SUMMARY asserts) is 2 non-test source files: client.ts + AuthContext.tsx. Test files legitimately reference the flag as part of verifying its behavior; this does not violate the 'single legitimate declaration + single legitimate consumer' principle that the grep-bait is designed to enforce."
  - "Reset lastRefreshAtRef=0 and refreshInFlightRef=null in logout so the next login's first refresh fires immediately (no stale cooldown) and no dangling promise points at the pre-logout user's uid."

requirements-completed: [MOB-03, MOB-04]

# Metrics
duration: ~15m
completed: 2026-04-18
---

# Phase 4 Plan 04: AuthContext refresh wiring — Summary

**Enriches `AuthContext` with three refs (token, in-flight promise, cooldown timestamp), registers the two listener hooks exported by `src/services/http/client.ts` on mount, and splits `refreshUser` into a public wrapper + internal implementation so AppState-driven and 403-interceptor-driven refreshes converge on one deduped, cooldown-guarded, skip-flag-aware policy point.**

## Performance

- **Duration:** ~15 minutes
- **Tasks:** 1 (TDD: RED → GREEN in a single plan)
- **Files modified:** 2 (`src/context/AuthContext.tsx`, `src/services/AuthService.ts`)
- **Files created:** 1 (`src/context/__tests__/AuthContext.test.tsx`)
- **Commits:** 2 (RED tests + GREEN implementation)

## Accomplishments

1. **Mount-time listener registration (D-04, D-09).** `useEffect` now calls `setTokenProvider(() => currentIdTokenRef.current)` and `setModerationRefreshListener(async () => refreshUserInternal({ skipInterceptor: true }))` BEFORE `loadStorageData()` so the very first network call already has the listeners in place.

2. **Deduped + cooldown-guarded refresh (D-15, 04-CONTEXT specifics line 246).** `refreshUserInternal` uses `refreshInFlightRef` to serialize concurrent callers into a single `getBackendUser` fetch, and `lastRefreshAtRef` to enforce a 30-second cooldown shared between AppState foreground events and 403 interceptor triggers.

3. **Loop-guard on the listener path (D-11).** The registered listener calls `refreshUserInternal({ skipInterceptor: true })`, which sets `{ _skipModerationInterceptor: true }` on the axios config of the refresh request. The response interceptor in `src/services/http/client.ts` short-circuits when this flag is present, preventing infinite recursion when the refresh itself returns 403. **This is the 2-of-2 grep-bait occurrence of `_skipModerationInterceptor` in mobile source code.**

4. **Logged-out no-op (D-16).** When `userRef.current?.localId` is falsy, `refreshUserInternal` returns immediately without calling `AuthService.getBackendUser`. Prevents useless `/api/users/undefined` requests on foreground events for anonymous users.

5. **Token ref lifecycle.** `currentIdTokenRef.current` is set in `login` (after `signIn` resolves, before `getBackendUser`), `signup` (after `signUp`), and `loadStorageData` (hydrated from `AuthService.getToken()`); it is cleared in `logout` **first**, before any other teardown, so the request interceptor cannot attach a stale Bearer on any logout-triggered network call.

6. **AuthService coordination.** `AuthService.getBackendUser` now accepts an optional `config?: AxiosRequestConfig` parameter forwarded to `axios.get`. This lets `refreshUserInternal` pass the skip flag through today; Plan 04-05 will migrate the call onto the shared `apiClient` without changing the signature.

## Task Commits

1. **RED — failing tests.** `8c74904` (test) — 7 of 8 tests fail against the pre-Plan-04-04 AuthContext (the "logged-out no-op" test passes by accident because the original refreshUser already guarded on `user && user.localId`).
2. **GREEN — implementation.** `134e661` (feat) — all 8 tests pass; `AuthContext.tsx` typechecks cleanly.

Plan metadata (this summary) is committed as a final `docs` step.

## Files Created/Modified

### Created

- **`src/context/__tests__/AuthContext.test.tsx`** (~320 lines) — 8 tests:
  - Test 1: `setTokenProvider` registered once on mount; getter reflects pre/post-login state.
  - Test 2: `setModerationRefreshListener` registered once; listener invokes `getBackendUser(uid, { _skipModerationInterceptor: true })`.
  - Test 3: Concurrent `refreshUser()` calls dedupe to exactly one fetch (D-15).
  - Test 4: 30s cooldown — call at T=0 fetches; call at T=10s skips; call at T=35s fetches again.
  - Test 5: Logged-out `refreshUser()` resolves to `undefined` with zero `getBackendUser` calls.
  - Test 6: Listener-triggered refresh explicitly carries `_skipModerationInterceptor: true`.
  - Test 7: `logout()` clears the token ref synchronously.
  - Test 8: `loadStorageData` hydrates `currentIdTokenRef` from `AuthService.getToken()`.
  - Mocks: `@react-native-async-storage`, `../../services/http/client` (spy on `setTokenProvider` / `setModerationRefreshListener`), full `AuthService` object.
  - Harness: `ReactTestRenderer.act` + a `CtxCapture` child component that stores `useAuth()` into a module-level variable for test-driven invocation.

### Modified

- **`src/context/AuthContext.tsx`** — 160 lines → ~260 lines.
  - New imports: `useRef` from React; `setTokenProvider`, `setModerationRefreshListener` from `../services/http/client`.
  - New refs: `currentIdTokenRef`, `refreshInFlightRef`, `lastRefreshAtRef`, `userRef`.
  - `useEffect` on mount now registers both listeners BEFORE calling `loadStorageData`.
  - New `refreshUserInternal({ skipInterceptor })` encapsulates dedupe + cooldown + logged-out skip + skip-flag application.
  - Public `refreshUser` is now a thin wrapper that passes `skipInterceptor: false`.
  - `loadStorageData` now reads `AuthService.getToken()` and hydrates `currentIdTokenRef`.
  - `login` / `signup` set `currentIdTokenRef.current = data.idToken` immediately after the identity call resolves.
  - `logout` clears `currentIdTokenRef.current = null` FIRST, then tears down state, then resets `lastRefreshAtRef` and `refreshInFlightRef`.
  - Public `AuthContextType` interface is unchanged — `refreshUser` is still `() => Promise<void>`.

- **`src/services/AuthService.ts`** — +6 lines.
  - Imported `AxiosRequestConfig` from axios.
  - `getBackendUser` signature is now `(firebaseUid: string, config?: AxiosRequestConfig)`; the config object is forwarded to `axios.get`.
  - NOTE comment points at Plan 04-05 for the shared-client migration.

## Grep Invariants Verified

| Target | Expected | Actual | Path |
|--------|----------|--------|------|
| `setTokenProvider` | ≥ 2 | 3 | `src/context/AuthContext.tsx` (1 import + 1 call + 1 test reference in same file? no — the value is the number of lines with the string; the import itself is one, the call is one, test harness-free — verified 3 in production file) |
| `setModerationRefreshListener` | ≥ 2 | 2 | `src/context/AuthContext.tsx` |
| `currentIdTokenRef` | ≥ 4 | 7 | `src/context/AuthContext.tsx` (1 decl + loadStorageData + login + signup + logout + listener-getter + 1 comment) |
| `refreshInFlightRef` | ≥ 3 | 8 | `src/context/AuthContext.tsx` |
| `lastRefreshAtRef` | ≥ 2 | 5 | `src/context/AuthContext.tsx` |
| `_skipModerationInterceptor` | exactly 1 | 1 | `src/context/AuthContext.tsx` |
| `30_000` | ≥ 1 | 1 | `src/context/AuthContext.tsx` |
| `useRef` | ≥ 1 | 5 | `src/context/AuthContext.tsx` |
| Non-test src/ files containing `_skipModerationInterceptor` | exactly 2 | 2 | `src/services/http/client.ts` + `src/context/AuthContext.tsx` |

Grep-bait invariant (04-CONTEXT specifics line 238): **verified 2 non-test files**. Any third non-test occurrence is a red flag for Phase 6 code review.

## Test Coverage

All 8 new Jest tests pass (`npx jest src/context/__tests__/AuthContext.test.tsx --no-coverage`):

```
PASS src/context/__tests__/AuthContext.test.tsx
  AuthContext — Plan 04-04 behaviors
    ✓ Test 1: registers setTokenProvider on mount; getter returns null before login and token after login
    ✓ Test 2: registers setModerationRefreshListener on mount; listener calls getBackendUser with skip flag
    ✓ Test 3: refreshUser dedupes concurrent calls — parallel invocations result in exactly one getBackendUser call
    ✓ Test 4: refreshUser cooldown — second call within 30s skipped; after 35s it fetches again
    ✓ Test 5: refreshUser is a no-op when logged out — getBackendUser not called; resolves without error
    ✓ Test 6: listener-triggered refresh uses the _skipModerationInterceptor axios config flag
    ✓ Test 7: currentIdTokenRef is cleared on logout — tokenProvider getter returns null after logout
    ✓ Test 8: loadStorageData hydrates currentIdTokenRef from AsyncStorage-backed AuthService.getToken
```

Plan 04-01 tests (13 total: 5 errors + 8 client) **still pass** — the new listener wiring is a pure extension with no interceptor behavior change.

## Decisions Made

1. **`userRef` mirror added.** The plan's action block did not include a user-state mirror ref. Without one, the `moderationRefreshListener` closure (registered once on mount) would close over the mount-time `user` via `setUser`'s closure — meaning after a login, the listener still sees `user === null` and D-16 short-circuits every refresh. The mirror ref keeps the listener evaluating against the latest user state. Added under plain React patterns; not a new library, not a state-management change.

2. **Extracted shared `refreshUserInternal` + thin public `refreshUser` wrapper.** Matches the plan's action block exactly. The boolean param (`skipInterceptor`) is the only difference between the two entry points; everything else (dedupe, cooldown, D-16) is shared. Prevents future drift between the AppState-driven and interceptor-driven refresh paths.

3. **Grep-bait interpretation narrowed to non-test files.** Plan 04-01's `src/services/http/__tests__/client.test.ts` already contains two references to `_skipModerationInterceptor` (one to pass the flag on a request, one to assert the listener is not called when the flag is set). Plan 04-04's new test `src/context/__tests__/AuthContext.test.tsx` also legitimately asserts the flag is set on the listener path. These test references are essential for behavior verification and do not violate the grep-bait principle (single declaration + single legitimate consumer in production source). The operational invariant is therefore "exactly 2 non-test `src/` files reference the flag," which is what this plan enforces.

4. **AuthService.getBackendUser signature extended pre-emptively.** Plan 04-05 is supposed to own the AuthService→apiClient migration, but Plan 04-04 needs the optional `config` parameter on `getBackendUser` to pass the skip flag. Since Plan 04-05 depends on 04-01 (not on 04-04), both can land in Wave 2 independently. Adding the parameter here with a coordination NOTE keeps the contract stable: today the config is forwarded to plain `axios.get` (no-op on the flag but still a typed param); Plan 04-05 will switch the `axios.get` call to `apiClient.get` and the flag will then actively short-circuit the response interceptor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `userRef` to capture the latest user inside the listener closure**

- **Found during:** Implementation phase (Task 1 GREEN) while wiring the moderationRefreshListener.
- **Issue:** The listener is registered once on mount and closes over the `refreshUserInternal` function, which in turn would close over the `user` state variable captured at render time. After login, the `user` state changes but the listener closure still references the mount-time value (which is `null`), so D-16's `if (!user?.localId) return` would always fire and the listener would never actually refresh.
- **Fix:** Added a `userRef` updated in a `useEffect` whose dep array is `[user]`. `refreshUserInternal` reads `userRef.current` instead of the stale `user` closure. This is the same pattern React uses internally for `useLatest`-style hooks.
- **Files modified:** `src/context/AuthContext.tsx` (+5 lines for the ref and its sync effect).
- **Commit:** `134e661` (bundled into GREEN since the tests — which validate logged-in listener behavior — would otherwise fail).

### Auth gates

None — no authentication interaction required to execute this plan. All work is local test-driven code modification.

## Issues Encountered

- **Pre-existing `__tests__/App.test.tsx` failure (RNGestureHandler TurboModule)** — confirmed unrelated to Plan 04-04 by reproducing the failure after `git stash`ing Plan 04-04 changes. Already logged in `.planning/phases/04-mobile-plumbing-mobile/deferred-items.md` by Plan 04-01. No action taken; scope boundary respected.

- **Pre-existing `AuthService.ts` implicit-any TypeScript errors** — 10 errors, all in code paths not touched by Plan 04-04. The new `AxiosRequestConfig` import and the `getBackendUser` config parameter both typecheck cleanly. Already logged in `deferred-items.md`. Plan 04-05 is the natural place to address these as part of its AuthService migration.

## Threat Flags

None found. All new surface (token-ref lifecycle, refresh dedupe/cooldown, listener wiring) is covered by the plan's `<threat_model>` table (T-04-04-01 through T-04-04-07). No new network endpoints, auth paths, file access patterns, or trust-boundary schema changes.

## Self-Check: PASSED

### Files exist

- FOUND: `src/context/AuthContext.tsx` (modified)
- FOUND: `src/services/AuthService.ts` (modified)
- FOUND: `src/context/__tests__/AuthContext.test.tsx` (created)

### Commits exist

- FOUND: `8c74904` (test: RED tests)
- FOUND: `134e661` (feat: GREEN implementation)

### Tests pass

- 8/8 new tests pass in `AuthContext.test.tsx`
- 13/13 Plan 04-01 tests (errors.test.ts + client.test.ts) still pass
- Pre-existing App.test.tsx failure is unrelated (reproduces at baseline)

### Grep invariants

- `_skipModerationInterceptor` in non-test `src/`: exactly 2 files (client.ts + AuthContext.tsx)
- `_skipModerationInterceptor` in `src/context/AuthContext.tsx`: exactly 1 line
- All other acceptance-grep counts meet or exceed their minimums

### TypeScript

- `src/context/AuthContext.tsx`: 0 errors
- `src/services/AuthService.ts`: 10 pre-existing errors (all implicit-any / unknown-error in code paths untouched by this plan); the 1 new parameter typechecks cleanly

## Next Phase Readiness

- **Plan 04-05** can now migrate `AuthService.getBackendUser` onto `apiClient.get` without signature changes — the optional config parameter is already in place and already receives the skip flag from `refreshUserInternal`.
- **Plan 04-06** (AppState foreground hook) can call `useAuth().refreshUser()` freely — the cooldown + dedupe logic is ready; multiple foreground cycles within 30s are silently coalesced.
- **Plan 04-07** (integration tests) can drive end-to-end 403 → listener → `AuthService.getBackendUser(uid, { _skipModerationInterceptor: true })` → `setUser({ ...user, moderationStatus: … })` through the real `apiClient` with a mocked adapter.
- **ROADMAP Success #3** (403 → refreshUser → updated moderationStatus without navigation loop): the listener wiring required by this criterion is complete; full end-to-end verification is Plan 04-07's responsibility.
- **ROADMAP Success #4** foundation (AppState → refreshUser → fresh moderationStatus on return to foreground): the deduped + cooldown-guarded refreshUser is ready; Plan 04-06 will mount the AppState trigger.

---
*Phase: 04-mobile-plumbing-mobile*
*Plan: 04*
*Completed: 2026-04-18*
