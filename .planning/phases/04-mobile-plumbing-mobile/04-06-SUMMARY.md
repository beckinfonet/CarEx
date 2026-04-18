---
phase: 04
plan: 06
subsystem: mobile
tags:
  - app-tsx
  - appstate
  - integration
  - authprovider
  - wiring
requires:
  - src/hooks/useAppStateRefresh (Plan 04-03)
  - src/context/AuthContext.refreshUser + dedupe + cooldown (Plan 04-04)
provides:
  - AppStateRefreshEffect wrapper mounted inside AuthProvider subtree
  - End-to-end AppState foreground → AuthContext.refreshUser → AuthService.getBackendUser wiring
affects:
  - App.tsx (adds 2 imports + 1 wrapper component + 1 JSX mount)
  - jest.config.js (extends transformIgnorePatterns + absolute-path setupFiles for worktree)
  - jest.setup.js (NEW — mocks RN native modules for test loading)
tech-stack:
  added: []
  patterns:
    - wrapper-component-uses-context (mirrors OfflineNotice / useNetwork)
    - exported-for-test (AppStateRefreshEffect exported so tests can import without App tree)
key-files:
  created:
    - __tests__/AppStateRefresh.integration.test.tsx
    - jest.setup.js
  modified:
    - App.tsx
    - jest.config.js
    - .planning/phases/04-mobile-plumbing-mobile/deferred-items.md
decisions:
  - Export AppStateRefreshEffect from App.tsx so unit tests can import it without rendering the full App provider tree (keeps the component declaration in App.tsx per plan's `files` field while enabling focused testing).
  - Test 4 uses a focused AuthProvider + AppStateRefreshEffect harness rather than rendering `<App />`; this avoids jest.resetModules() React-instance duplication and keeps the end-to-end wiring test deterministic. Covered by deferred-items note.
  - Added minimal jest.setup.js mocks for native modules (gesture-handler, reanimated, screens, svg, stripe, etc.) so App.tsx can be loaded at module level by Jest. This was Rule 3 blocking — my own tests couldn't load otherwise.
metrics:
  duration: ~22 minutes (wall clock)
  completed: 2026-04-18
  tasks_completed: 1
  files_changed: 5
---

# Phase 04 Plan 06: App.tsx AppState Wiring Summary

**One-liner:** Mount `AppStateRefreshEffect` wrapper inside `<AuthProvider>` so foreground transitions call `AuthContext.refreshUser()` — completes the Phase 4 MOB-04 AppState plumbing.

## What Was Built

`App.tsx` now mounts a thin `AppStateRefreshEffect` child component as the first child of `<AuthProvider>`, above `<CartProvider>`. That child:

1. Reads `{ user, refreshUser }` from `useAuth()`.
2. Calls `useAppStateRefresh(user?.localId ? refreshUser : null, { cooldownMs: 30_000 })`.
3. Returns `null` (side-effect only, no UI).

The net effect: when a logged-in user backgrounds the app and returns to foreground, `useAppStateRefresh` catches the transition and invokes `refreshUser()`, which calls `AuthService.getBackendUser()` — propagating any admin-initiated moderation changes into the session without an app restart. When logged out, `null` is passed so the hook skips transitions entirely (D-16).

Line delta in `App.tsx`: +22 LOC (2 imports + 17 lines for component definition/comment + 1 JSX tag + 2 blank/structural).

## Files

### Created
- `__tests__/AppStateRefresh.integration.test.tsx` — 5 tests (unit × 4 + end-to-end × 1) covering the wrapper contract and the real AuthProvider → AppState → refreshUser → getBackendUser flow.
- `jest.setup.js` — Mocks for native modules (gesture-handler, reanimated, screens, svg, stripe, netinfo, async-storage, image-picker, safe-area-context, lucide, fast-image, image-zoom). Required so App.tsx is loadable by Jest without TurboModule-registry errors.

### Modified
- `App.tsx` — Added imports for `useAppStateRefresh` and `useAuth`; defined and exported `AppStateRefreshEffect`; mounted it as first child of `<AuthProvider>`.
- `jest.config.js` — Extended preset with absolute-path `setupFiles` entries (the worktree has no local `node_modules`), and an enlarged `transformIgnorePatterns` that covers `@react-navigation/*`, `@stripe/stripe-react-native`, and other RN-ecosystem ESM packages.
- `.planning/phases/04-mobile-plumbing-mobile/deferred-items.md` — Documented why `__tests__/App.test.tsx` still fails after Plan 04-06's partial jest setup (deeper `react-native-screens/flags.ts` + navigator mocking required).

## Structural Acceptance Criteria (from PLAN)

| Criterion | Check | Result |
|-----------|-------|--------|
| `import { useAppStateRefresh }` present | `grep -c` | 1 |
| `import { useAuth }` present | `grep -c` | 1 |
| `const AppStateRefreshEffect` defined | `grep -c` | 1 |
| `<AppStateRefreshEffect />` mounted | `grep -c` | 1 |
| `useAppStateRefresh(user?.localId ? refreshUser : null` call | `grep -c` | 1 |
| `cooldownMs: 30_000` option passed | `grep -c` | 1 |
| `<AppStateRefreshEffect />` positioned between `<AuthProvider>` and `<CartProvider>` | `awk` positional | 1 |
| `<OfflineNotice />` still present (regression) | `grep -c` | 1 |
| Provider stack order unchanged (6 providers each appear once) | `grep -c` each | 1 each (GestureHandlerRootView, SafeAreaProvider, AuthProvider, CartProvider, StripeProvider, LanguageProvider, NavigationContainer) |

## Test Results

```
PASS __tests__/AppStateRefresh.integration.test.tsx
  AppStateRefreshEffect — unit
    ✓ Test 1: renders null (side-effect wrapper, no UI output)
    ✓ Test 2: passes refreshUser and { cooldownMs: 30_000 } when logged in
    ✓ Test 3: passes null as refresh when logged out (user = null)
    ✓ Test 3b: passes null as refresh when user object exists but has no localId
  AppStateRefreshEffect — end-to-end foreground refresh
    ✓ Test 4: background→active triggers AuthService.getBackendUser when logged in

Tests: 5 passed, 5 total
```

Plan 04-03 hook tests (regression): 8/8 still pass.

## Commits

| Commit   | Type | Scope | Message                                                        |
|----------|------|-------|----------------------------------------------------------------|
| f022fa4  | test | 04-06 | add AppStateRefreshEffect integration tests                    |
| 37fa031  | feat | 04-06 | mount AppStateRefreshEffect inside AuthProvider subtree        |

Two-commit TDD cadence: RED (test + jest infra) → GREEN (App.tsx wiring).

## Deviations from Plan

### Rule 3 - Blocking issue: missing jest native-module mocks

- **Found during:** Task 1 first test run
- **Issue:** My integration test (and the existing `__tests__/App.test.tsx` regression sentinel) failed at module load with `TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found`. This is a pre-existing gap — the project had no `jest.setup.js`, and the default `react-native` preset does not stub `react-native-gesture-handler` / `react-native-reanimated` / `react-native-screens` native specs. Confirmed pre-existing by stashing my changes on base `a9671cd` and re-running `App.test.tsx` (same failure).
- **Fix:** Added `jest.setup.js` with official mocks per each library's Jest guidance, and updated `jest.config.js` to wire it + extend `transformIgnorePatterns` for `@react-navigation/*` and ESM packages.
- **Files modified:** `jest.config.js`, `jest.setup.js` (new)
- **Commit:** f022fa4

### Rule 3 - Blocking issue: Test 4 strategy pivot

- **Found during:** Task 1 second test run
- **Issue:** Plan's Test 4 strategy (`jest.resetModules()` + `require('../App')`) triggered React-instance duplication (`Cannot read properties of null (reading 'useState')`) because `react-test-renderer` was already bound to one React instance while `jest.resetModules` cloned a second. This is a known limitation of combining `resetModules` + `react-test-renderer` in the same test file.
- **Fix:** Refactored Test 4 to render a focused `<RealAuthProvider><RealAppStateRefreshEffect /></RealAuthProvider>` harness using `jest.unmock` + `jest.requireActual` (no module-graph reset). Still covers the same wiring contract: real AuthProvider loads, AppState transition fires, AuthService.getBackendUser is invoked.
- **Commit:** f022fa4 (included in test commit)

### Deferred: `__tests__/App.test.tsx` still fails

- **Not a deviation from my work** — this test was already broken on base commit `a9671cd` (confirmed by stash/reset test).
- Plan 04-06's partial jest setup (`jest.config.js` + `jest.setup.js`) moved it PAST gesture-handler / `@react-navigation/native` ESM / `SafeAreaInsetsContext` failures, but it now fails inside `@react-navigation/native-stack NativeStackView.native.tsx` at `compatibilityFlags.usesNewAndroidHeaderHeightImplementation`. Full fix requires mocking `react-native-screens/flags.ts` + the internal screen components, which is beyond this plan's scope.
- **Documented in:** `deferred-items.md` under "From Plan 04-06".
- **Why acceptable:** Plan 04-06's regression intent (provider stack integrity) is covered by the structural `awk`/`grep` acceptance criteria AND by the end-to-end Test 4 that renders the real AuthProvider.

## Threat Surface Scan

No new network endpoints, auth paths, or file-access surfaces introduced. The wrapper component reads context and calls an existing hook — all surface is in-process. Threat model in PLAN (T-04-06-01 through T-04-06-05) all mitigated:

| Threat ID | Mitigation verified |
|-----------|---------------------|
| T-04-06-01 (useAuth throws outside AuthProvider → DoS) | Structural `awk` positional check confirms wrapper is child of `<AuthProvider>`. Test 1 renders the wrapper under a mocked AuthProvider and confirms no throw. |
| T-04-06-02 (logged-out spam refreshes) | Test 3 + 3b confirm `null` is passed when `user.localId` is absent. Hook's own D-16 null-guard is defense-in-depth. |
| T-04-06-03 (InfoDisclosure) | `accept` per PLAN — user object stays in-process. |
| T-04-06-04 (Provider reordering) | Acceptance `awk` between-AuthProvider-and-CartProvider positional check confirms placement. |
| T-04-06-05 (Stale closure on re-render) | `accept` — hook's `useEffect([refresh])` dep array handles re-registration. |

No new threat flags discovered.

## Verification

ROADMAP Success #4 wiring complete: "Suspending a logged-in user, backgrounding the app, and returning to foreground causes AuthContext.refreshUser() to fire via the AppState handler in App.tsx and user.moderationStatus transitions." Plan 04-07 runs the end-to-end simulation; this plan delivered the wiring that 04-07 depends on.

## Known Stubs

None. The wrapper is not a stub — it is the final implementation.

## Self-Check: PASSED

- [x] App.tsx changes present (`<AppStateRefreshEffect />` mounted inside `<AuthProvider>`)
- [x] Integration test file created and all 5 tests pass
- [x] jest.config.js + jest.setup.js created and wired
- [x] deferred-items.md updated
- [x] Two commits present: f022fa4 (test), 37fa031 (feat)
- [x] No accidental file deletions
- [x] TypeScript project compiles (no new errors introduced; pre-existing AuthService.ts `any` warnings documented under Plan 04-01 deferred items)
- [x] Provider stack integrity preserved (all 6 providers, OfflineNotice intact)
