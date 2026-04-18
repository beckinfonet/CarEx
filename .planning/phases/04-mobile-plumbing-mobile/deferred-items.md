# Phase 04 Deferred Items

Items discovered during Phase 4 execution that are out of scope for the current plans.

## Pre-existing (NOT introduced by Phase 4)

### `__tests__/App.test.tsx` fails at baseline

- **Discovered during:** Plan 04-03 execution (test suite run)
- **Symptom:** `TurboModuleRegistry.getEnforcing('RNGestureHandlerModule')` throws — native module not mocked for Jest.
- **Confirmed pre-existing:** Fails at `HEAD` even without any Plan 04-03 changes. Unrelated to the useAppStateRefresh hook or its tests.
- **Fix owner:** A future mobile test-infra cleanup phase (add a Jest setup file that mocks react-native-gesture-handler, react-native-reanimated, etc.).
- **Scope boundary:** Rule not applied — this is a pre-existing failure in unrelated files, not caused by Plan 04-03's changes.
