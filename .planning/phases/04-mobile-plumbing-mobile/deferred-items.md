# Phase 04 — Deferred Items

Out-of-scope discoveries surfaced during plan execution, logged for later triage.

## From Plan 04-01 (shared http client + ModerationError)

### Pre-existing test infra: `__tests__/App.test.tsx` fails under Jest

- **Status:** Pre-existing (confirmed by stashing Plan 04-01 changes and re-running; also independently confirmed by Plan 04-03)
- **Error:** `TurboModuleRegistry.getEnforcing(...): 'RNGestureHandlerModule' could not be found`
- **Root cause:** `react-native-gesture-handler` TurboModule spec is not mocked in the default `react-native` Jest preset; the App-level smoke test imports `GestureHandlerRootView` unconditionally.
- **Impact on Plan 04-01:** None. All 13 Plan 04-01 tests pass; the failure is isolated to the App smoke test and exists on `c14932a` (phase baseline) before any Plan 04-01 file was touched.
- **Impact on Plan 04-03:** None. All 8 useAppStateRefresh tests pass; failure reproduces at HEAD without any Plan 04-03 changes.
- **Possible fixes (deferred):**
  1. Add `jest.mock('react-native-gesture-handler', () => ({ GestureHandlerRootView: 'View' }))` in a shared setup file.
  2. Also mock `react-native-reanimated` and other native modules surfaced by the App provider stack.
  3. Drop the App smoke test in favor of provider-stack unit tests.
- **Why deferred:** Scope boundary rule — this is not directly caused by any Phase 4 plan. Fix owner: a future mobile test-infra cleanup phase.

### Pre-existing TypeScript errors in `src/services/AuthService.ts`

- **Status:** Pre-existing (10 errors, all `implicitly has 'any' type` / `'error' is of type 'unknown'`)
- **Impact on Plan 04-01:** None. New files (`src/services/http/client.ts`, `src/services/moderation/errors.ts`, and both `__tests__/*.test.ts`) typecheck cleanly under the project's `tsconfig.json`.
- **Why deferred:** Tracked separately under Tech Debt → "Replace `user: any` typing in AuthContext / AuthService" (STATE.md — deferred at 2026-04-17). Plan 04-05 (AuthService migration) is the natural place to address types incrementally.

## From Plan 04-06 (AppState handler wiring in App.tsx)

### Pre-existing `__tests__/App.test.tsx` still fails after partial jest setup

- **Status:** Pre-existing (confirmed by stashing Plan 04-06 changes on base `a9671cd` and re-running).
- **Plan 04-06 action:** Added `jest.config.js` + `jest.setup.js` with mocks for `react-native-gesture-handler`, `react-native-reanimated`, `react-native-screens` (shallow), `react-native-safe-area-context`, `react-native-svg`, `lucide-react-native`, `react-native-fast-image`, `@stripe/stripe-react-native`, `@react-native-community/netinfo`, `@react-native-async-storage/async-storage`, `react-native-image-picker`, `@likashefqet/react-native-image-zoom`. This unblocks Plan 04-06's integration tests (load `App.tsx` at module level).
- **Still failing (App smoke test only):** `@react-navigation/native-stack/views/NativeStackView.native.tsx` dereferences `compatibilityFlags.usesNewAndroidHeaderHeightImplementation`, which comes from `react-native-screens/src/flags.ts`. A full smoke-test pass requires deeper mocking of `react-native-screens` internals (flags module, native screen components) and possibly `@react-navigation/elements` (FrameSize). This is beyond Plan 04-06's surgical scope (App.tsx + integration test).
- **Covered by Plan 04-06 instead:** The "Test 5 regression sentinel" intent of App.test.tsx is functionally covered by the structural acceptance-criteria grep checks (provider stack integrity unchanged) AND by Test 4 (end-to-end AuthProvider + AppStateRefreshEffect harness that exercises the real AuthContext.refreshUser → AuthService.getBackendUser path).
- **Possible follow-up:** A dedicated test-infrastructure plan can harden the App smoke test by mocking `react-native-screens/src/flags.ts` + the `Screen*` component tree. Not required for Phase 4 correctness.
