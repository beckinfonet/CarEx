# Phase 04 — Deferred Items

Out-of-scope discoveries surfaced during plan execution, logged for later triage.

## From Plan 04-01 (shared http client + ModerationError)

### Pre-existing test infra: `__tests__/App.test.tsx` fails under Jest

- **Status:** Pre-existing (confirmed by stashing Plan 04-01 changes and re-running)
- **Error:** `TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found`
- **Root cause:** `react-native-gesture-handler` TurboModule spec is not mocked in the default `react-native` Jest preset; the App-level smoke test imports `GestureHandlerRootView` unconditionally.
- **Impact on Plan 04-01:** None. All 13 Plan 04-01 tests pass; the failure is isolated to the App smoke test and exists on `c14932a` (phase baseline) before any Plan 04-01 file was touched.
- **Possible fixes (deferred):**
  1. Add `jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'View' }))` in a shared setup file.
  2. Drop the App smoke test in favor of provider-stack unit tests.
- **Why deferred:** Scope boundary rule — this is not directly caused by Plan 04-01 changes.

### Pre-existing TypeScript errors in `src/services/AuthService.ts`

- **Status:** Pre-existing (10 errors, all `implicitly has 'any' type` / `'error' is of type 'unknown'`)
- **Impact on Plan 04-01:** None. New files (`src/services/http/client.ts`, `src/services/moderation/errors.ts`, and both `__tests__/*.test.ts`) typecheck cleanly under the project's `tsconfig.json`.
- **Why deferred:** Tracked separately under Tech Debt → "Replace `user: any` typing in AuthContext / AuthService" (STATE.md — deferred at 2026-04-17). Plan 04-05 (AuthService migration) is the natural place to address types incrementally.
