---
phase: 04-mobile-plumbing-mobile
fixed_at: 2026-04-18T00:00:00Z
review_path: .planning/phases/04-mobile-plumbing-mobile/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-04-18
**Source review:** `.planning/phases/04-mobile-plumbing-mobile/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 Critical + 3 Warning; Info findings excluded per `fix_scope=critical_warning`)
- Fixed: 4
- Skipped: 0

All in-scope findings were applied cleanly. `src/context/__tests__/AuthContext.test.tsx`
continued to pass after every commit (32 tests). A full `npx jest` run (excluding
the pre-existing broken `__tests__/App.test.tsx`, documented in `deferred-items.md`)
reports 71/71 passing across 8 suites.

## Fixed Issues

### CR-01: Deadlock risk when non-skip `refreshUser()` triggers a 403

**Files modified:** `src/context/AuthContext.tsx`
**Commit:** `4b3a75f`
**Applied fix:** Rewrote the `setModerationRefreshListener` callback to fetch
`AuthService.getBackendUser` directly with the `_skipModerationInterceptor` flag
instead of delegating to `refreshUserInternal`. This bypasses the dedupe guard
in the listener path so the listener no longer `await`s the same in-flight
promise that the caller is waiting on. Also bypasses the 30s cooldown in the
listener path because a 403 is authoritative evidence that the cached user
state is stale. The public `refreshUser()` can now safely fire a request that
the interceptor converts into a listener call without creating a circular
`await`.

### WR-01: `refreshUser()` 30s cooldown silently swallows user-initiated refreshes

**Files modified:** `src/context/AuthContext.tsx`
**Commit:** `9ab10b9`
**Applied fix:** Added an optional `force` parameter to `refreshUserInternal`
that bypasses the 30s cooldown while still honoring dedupe and the logged-out
guard. Introduced a new `refreshUserForced` helper and switched the four
user-initiated paths — `requestSeller`, `requestBroker`, `requestLogistics`,
and `verifyPhone` — to call it. Passive callers (AppState foreground,
interceptor listener) continue to honor the cooldown.

### WR-02: Mid-refresh `logout()` leaves pending `setUser` that can revive pre-logout data

**Files modified:** `src/context/AuthContext.tsx`
**Commit:** `25d772d`
**Applied fix:** Introduced a monotonic `refreshGenerationRef` counter.
`logout()` increments the counter BEFORE any `await`, so every in-flight
refresh (both the `refreshUserInternal` IIFE and the moderation listener)
snapshots the generation before the network await and compares afterward.
If the generation advanced during the await, the refresh skips its `setUser`
call instead of resurrecting the logged-out user via the `{ ...userRef.current,
...backendUser }` spread.

### WR-03: Non-memoized context callbacks cause unnecessary `AppState` re-subscription

**Files modified:** `src/context/AuthContext.tsx`
**Commit:** `5df2c44`
**Applied fix:** Wrapped all AuthContext public callbacks with `useCallback`
(`login`, `signup`, `logout`, `refreshUser`, `refreshUserForced`,
`refreshUserInternal`, `requestSeller`, `requestBroker`, `requestLogistics`,
`sendPhoneOtp`, `verifyPhone`, `deleteAccount`, `checkAdminStatus`,
`loadStorageData`). Wrapped the `AuthContext.Provider` value with `useMemo`.
Ref/setter-only callbacks use empty dependency arrays; user-reading callbacks
list `[user]` so their identity only changes when `user` changes (still orders
of magnitude fewer rebuilds than the previous "every render" pattern). This
stops `useAppStateRefresh` in `App.tsx` from repeatedly tearing down and
re-adding its `AppState` event listener, and keeps every `useAuth()` consumer
from re-rendering on every `AuthProvider` render.

---

_Fixed: 2026-04-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
