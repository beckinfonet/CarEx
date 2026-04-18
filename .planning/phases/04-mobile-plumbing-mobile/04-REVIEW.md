---
phase: 04-mobile-plumbing-mobile
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - App.tsx
  - __tests__/AppStateRefresh.integration.test.tsx
  - __tests__/moderation.e2e.integration.test.tsx
  - jest.config.js
  - jest.setup.js
  - src/context/AuthContext.tsx
  - src/context/__tests__/AuthContext.test.tsx
  - src/hooks/__tests__/useAppStateRefresh.test.tsx
  - src/hooks/useAppStateRefresh.ts
  - src/services/AuthService.ts
  - src/services/__tests__/AuthService.test.ts
  - src/services/http/__tests__/client.test.ts
  - src/services/http/client.ts
  - src/services/moderation/ModerationService.ts
  - src/services/moderation/__tests__/ModerationService.test.ts
  - src/services/moderation/__tests__/errors.test.ts
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 4 delivers the mobile plumbing for admin moderation: a shared axios `apiClient` with request/response interceptors, a `ModerationService` module with 7 endpoints, a deduped + cooldown-guarded `AuthContext.refreshUser`, and an `AppState` foreground-refresh hook wired at the `AuthProvider` subtree root. The MOB-01 guardrail ("no moderation methods in AuthService") holds — `grep -iE 'suspend|revoke|moderation' src/services/AuthService.ts` returns zero. The two-file invariant for `_skipModerationInterceptor` (client.ts + AuthContext.tsx) holds. Test coverage is strong at both unit and E2E integration levels, with grep-stable describe blocks mapping tests back to ROADMAP success criteria.

The implementation is cleanly layered and the separation between `apiClient` (backend-only, Bearer-injecting) and plain `axios` (Firebase Identity Toolkit) is correct per D-01.

However, there is one critical correctness issue: a potential **deadlock in the refresh path** when a non-skip `refreshUser()` call hits a 403. The circular await (public refresh → getBackendUser → interceptor → listener → awaits in-flight refresh → which is still awaiting the 403 response) is not caught by existing tests because they only exercise the listener path in isolation or skip-flag paths. Three warning-level issues around cooldown interference with user-initiated actions, stale-closure / non-memoized callbacks causing excessive `AppState` re-subscription, and a mid-refresh logout race. Info items cover design clarifications and test strictness.

## Critical Issues

### CR-01: Deadlock risk when non-skip `refreshUser()` triggers a 403

**File:** `src/context/AuthContext.tsx:73-115` and `src/services/http/client.ts:68-96`

**Issue:** The refresh path has a circular `await` chain if the public `refreshUser()` (which runs with `skipInterceptor: false`) encounters a 403 `account_suspended` response:

1. Caller invokes `refreshUser()` → `refreshUserInternal({ skipInterceptor: false })`.
2. `refreshInFlightRef.current` is set to the in-flight IIFE promise P.
3. P awaits `AuthService.getBackendUser(uid, undefined)` → `apiClient.get(...)` returns 403.
4. Response interceptor fires with no skip flag → `await moderationRefreshListener?.()`.
5. Listener calls `refreshUserInternal({ skipInterceptor: true })`.
6. Inside that call, the dedupe guard sees `refreshInFlightRef.current` (P) is set and does `await refreshInFlightRef.current`.
7. P is still waiting for the interceptor to resolve, which is waiting for the listener, which is awaiting P → **circular await**.

The IIFE's `finally` only runs when the inner `await` resolves, so `refreshInFlightRef.current` never clears; the call chain hangs until axios's request timeout (if any) fires. The comment on lines 117-121 ("One-level recursion bounded by design") describes the intended design, but the *dedupe* path (not the cooldown path) defeats it: the listener wants to short-circuit via dedupe but ends up waiting on the same promise that triggered it.

In practice this can happen any time a screen (or `requestSeller/Broker/Logistics`) calls `refreshUser()` while the logged-in user has just been suspended on the backend. `getBackendUser` actually catches the ModerationError and returns `null` (AuthService.ts:80-87), which partially masks the issue — but the `await apiClient.get(...)` inside `getBackendUser` only returns AFTER the interceptor resolves, which requires the listener to resolve, which requires P to resolve. Deadlock.

**Fix:** Make the listener-path refresh bypass the dedupe guard when it's called *from* the interceptor, or detect reentrance. Simplest option — in the listener path, don't dedupe; just perform a direct fetch:

```typescript
setModerationRefreshListener(async () => {
  const currentUser = userRef.current;
  if (!currentUser?.localId) return;
  // Listener path bypasses dedupe AND cooldown to avoid circular await
  // with the caller-initiated refresh that triggered the 403 interceptor.
  try {
    const backendUser = await AuthService.getBackendUser(currentUser.localId, {
      _skipModerationInterceptor: true,
    });
    if (backendUser) {
      setUser({ ...userRef.current, ...backendUser });
      await checkAdminStatus(currentUser.localId);
    }
    lastRefreshAtRef.current = Date.now();
  } catch (err) {
    console.error('Moderation refresh listener fetch failed', err);
  }
});
```

Alternatively, split the dedupe state: a separate `listenerInFlightRef` so listener-originated refreshes don't collide with caller-originated ones. The current approach of a single `refreshInFlightRef` combined with a single `lastRefreshAtRef` cannot safely serve both paths when the interceptor sits between them.

Add a regression test that mounts a logged-in user, installs a 403 adapter, calls `refreshUser()` directly (NOT the listener), and asserts the promise settles within a finite time (`expect(...).resolves` under `jest.setTimeout(2000)`). Current E2E test 3.1 invokes `apiClient.get('/api/some/gated')` rather than `capturedCtx.refreshUser()`, which is why the deadlock is not exercised.

## Warnings

### WR-01: `refreshUser()` 30s cooldown silently swallows user-initiated refreshes after request-status mutations

**File:** `src/context/AuthContext.tsx:90-94, 220-239`

**Issue:** After a user taps "Request Seller", `requestSeller()` calls `AuthService.requestSellerStatus(...)` and then `await refreshUser()` to surface the new pending state. But `refreshUser()` runs the shared 30s cooldown check — if another refresh happened within the last 30s (e.g., an earlier `requestBroker()` tap, or the AppState foreground hook fired in the same minute), the refresh is silently skipped and the user's UI never reflects the submitted request until either (a) 30s elapse and another trigger fires, or (b) the app is backgrounded/foregrounded.

The cooldown is appropriate for AppState-driven background refreshes (D-14) and for interceptor-triggered refreshes (avoids storms on suspended accounts), but *explicit user action* should not be bound by it. The current shared-cooldown design doesn't distinguish "passive" from "active" callers.

This also affects `verifyPhone()` (line 247-251) which awaits `refreshUser()` to surface `isPhoneVerified: true`.

**Fix:** Add a `force` option to `refreshUserInternal` that bypasses the cooldown (but still honors dedupe and the logged-out guard), and have `requestSeller/Broker/Logistics` + `verifyPhone` pass it:

```typescript
const refreshUserInternal = async ({
  skipInterceptor,
  force = false,
}: {
  skipInterceptor: boolean;
  force?: boolean;
}): Promise<void> => {
  // ... existing guards ...
  if (!force && now - lastRefreshAtRef.current < 30_000) return;
  // ... rest unchanged ...
};

// New public variant for user-initiated mutations:
const refreshUserForced = () =>
  refreshUserInternal({ skipInterceptor: false, force: true });

// Update request* and verifyPhone to use refreshUserForced.
```

### WR-02: Mid-refresh `logout()` leaves pending `setUser` that can revive pre-logout data

**File:** `src/context/AuthContext.tsx:204-218`

**Issue:** `logout()` clears `currentIdTokenRef.current`, calls `AuthService.logout()`, `setUser(null)`, and resets `lastRefreshAtRef`/`refreshInFlightRef`. But an in-flight refresh IIFE (captured before logout) continues running and, on success, calls `setUser({ ...userRef.current, ...backendUser })` with the stale uid. After logout: `userRef.current` is null (set by the `useEffect` on line 57-59 that syncs userRef to user), so the spread produces `{ ...null, ...backendUser }` which is just `backendUser` — and `setUser(backendUser)` resurrects the logged-out user with only the backend fields.

Even if this narrow race is unlikely, it's a correctness bug that shows up if the user taps Logout while a refresh is in flight. There's no `isMountedRef` or cancellation token.

**Fix:** Tag each refresh with a generation counter; if the counter has advanced past the one captured at refresh start (logout increments it), skip the `setUser` call:

```typescript
const refreshGenerationRef = useRef(0);

// inside refreshUserInternal IIFE:
const myGen = refreshGenerationRef.current;
const backendUser = await AuthService.getBackendUser(uid, config);
if (refreshGenerationRef.current !== myGen) {
  // Logout or explicit invalidation bumped the generation — drop this result.
  return;
}
if (backendUser) { /* ... setUser ... */ }

// inside logout:
refreshGenerationRef.current += 1;
```

Add a regression test: spy on `setUser` via a captured context, trigger a refresh with a slow `getBackendUser` mock, call `logout()` mid-flight, resolve the mock, assert `setUser(null)` was the last call.

### WR-03: Non-memoized context callbacks cause unnecessary `AppState` re-subscription every render

**File:** `src/context/AuthContext.tsx:122-124, 263-265` and `src/hooks/useAppStateRefresh.ts:40`

**Issue:** `refreshUser` (and other callbacks on the AuthContext value) are redefined every render of `AuthProvider`. `useAppStateRefresh` has `refresh` in its `useEffect` deps (`[refresh]`), so every render of `AuthProvider` → new `refreshUser` identity → new effect run → `AppState.removeEventListener` + `AppState.addEventListener`. This is not incorrect (subscriptions are properly torn down) but it churns native bridge calls and can cause a narrow window where a transition fires between `remove` and `add` and is missed.

More importantly, the context `value={{...}}` object is a fresh object each render, so every consumer of `useAuth()` also re-renders on each `AuthProvider` render, not just when relevant state changes.

**Fix:** Memoize the public API with `useCallback`/`useMemo`:

```typescript
const refreshUser = useCallback(async () => {
  await refreshUserInternal({ skipInterceptor: false });
}, []); // all deps are refs — no need to list

const contextValue = useMemo(
  () => ({ user, loading, isAdmin, adminRole, login, signup, logout, refreshUser, /* ... */ }),
  [user, loading, isAdmin, adminRole, login, signup, logout, refreshUser, /* ... */],
);

return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
```

Apply the same `useCallback` pattern to `login`, `logout`, `requestSeller`, etc. This is a behavior-preserving perf/correctness improvement.

## Info

### IN-01: `refreshUserInternal` updates `lastRefreshAtRef` even when `backendUser` is falsy

**File:** `src/context/AuthContext.tsx:102-108`

**Issue:** If `getBackendUser` catches an error and returns `null`, the IIFE still executes `lastRefreshAtRef.current = Date.now()`. This means a silently-failed refresh counts toward the 30s cooldown, delaying the next legitimate refresh attempt. Arguably a design choice (we did "try" to refresh), but worth documenting.

**Fix:** If you want failures not to count:

```typescript
const backendUser = await AuthService.getBackendUser(uid, config);
if (backendUser) {
  const updatedUser = { ...userRef.current, ...backendUser };
  setUser(updatedUser);
  await checkAdminStatus(uid);
  lastRefreshAtRef.current = Date.now();
} // else: don't stamp cooldown — let next attempt retry immediately
```

Otherwise, add a comment explaining the intent.

### IN-02: Test 4.4 cooldown assertion is loose

**File:** `__tests__/moderation.e2e.integration.test.tsx:624-626`

**Issue:** The 30s-cooldown assertion uses `expect(...).toBeLessThanOrEqual(1)`, which passes even if zero refreshes happened. A stricter assertion would catch a regression where the cooldown accidentally swallowed the FIRST foreground transition too.

**Fix:**

```typescript
expect(
  (AuthService.getBackendUser as jest.Mock).mock.calls.length,
).toBe(1); // exactly one refresh — subsequent four suppressed by cooldown
```

### IN-03: `getBackendUser` silently consumes `ModerationError`

**File:** `src/services/AuthService.ts:80-88`

**Issue:** The interceptor converts 403 `account_suspended` to `ModerationError`, but `getBackendUser`'s broad `catch` logs and returns `null`, swallowing the typed error. Callers that want to react to moderation status changes during a refresh cannot distinguish "user is suspended" from "network failed" — both surface as `null`. Acceptable for the internal refresh path (which handles nothing anyway), but would be surprising if a screen ever called `getBackendUser` directly expecting the interceptor contract.

**Fix (optional):** Narrow the catch to non-ModerationError failures:

```typescript
getBackendUser: async (firebaseUid, config) => {
  try {
    const response = await apiClient.get(`/api/users/${firebaseUid}`, config);
    return response.data;
  } catch (error) {
    // Let ModerationError propagate so callers can opt into handling it.
    if (error && (error as any).name === 'ModerationError') throw error;
    console.error('Failed to get backend user', error);
    return null;
  }
},
```

Low priority — no current caller does this, and Phase 5/6 will likely add the handling.

### IN-04: `useAppStateRefresh`'s `cooldownMs` option is accepted but unused

**File:** `src/hooks/useAppStateRefresh.ts:17-20`

**Issue:** The `_options` parameter with `cooldownMs` is prefixed-underscore-ignored. The JSDoc explains the reason (cooldown moved into AuthContext.refreshUser), but callers pass `{ cooldownMs: 30_000 }` (App.tsx:60) thinking it has an effect. This "accepted-but-ignored" API is a minor footgun — someone will eventually change the value expecting behavior to change.

**Fix:** Either implement the option (redundant with AuthContext cooldown but defensive) or remove it and update `App.tsx`/tests to stop passing it:

```typescript
// Remove the option, document cooldown is the refresh fn's responsibility.
export const useAppStateRefresh = (refresh: RefreshFn | null | undefined) => { ... };

// In App.tsx:
useAppStateRefresh(user?.localId ? refreshUser : null);
```

### IN-05: Hardcoded magic number `30_000` duplicated across files

**File:** `src/context/AuthContext.tsx:91` and `App.tsx:60`

**Issue:** The 30s cooldown constant lives in three spots: the `< 30_000` check inside `refreshUserInternal`, the `cooldownMs: 30_000` passed from App.tsx (currently a no-op — see IN-04), and several test files that advance system time by matching amounts. If someone changes one, the others drift.

**Fix:** Export a named constant and import it:

```typescript
// In src/context/AuthContext.tsx:
export const REFRESH_COOLDOWN_MS = 30_000;

// Use in the check:
if (now - lastRefreshAtRef.current < REFRESH_COOLDOWN_MS) return;

// In App.tsx (once IN-04 is resolved or for clarity):
import { REFRESH_COOLDOWN_MS } from './src/context/AuthContext';
useAppStateRefresh(user?.localId ? refreshUser : null, { cooldownMs: REFRESH_COOLDOWN_MS });
```

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
