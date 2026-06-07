# Phase 14 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (not fixed — pre-existing, unrelated to the current task's changes).

| Discovered in | Item | Detail | Disposition |
|---------------|------|--------|-------------|
| 14-01 (full backend suite run) | `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` — 2 failing tests | Pre-existing failure documented in STATE.md (Phase 13: "pre-existing ServiceOrder.providerSnapshot failure untouched"). Last touched by unrelated moderation commit `889b831`. NOT caused by node-cron install or digest/translations changes. | Out of scope — left untouched (SCOPE BOUNDARY rule). Not a Phase 14 concern. |
| 14-05 (App.tsx edit → ran App.test.tsx regression sentinel) | `__tests__/App.test.tsx` "renders correctly" — 1 failing test | `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` at `@react-navigation/native-stack` NativeStackView. Confirmed pre-existing via `git stash` (fails identically without the 14-05 deeplink/linking change). A native-stack/react-native-screens test-harness gap, unrelated to routeDeeplink/linking-config. | Out of scope — left untouched (SCOPE BOUNDARY rule). 14-05's own unit test (`digestDeeplink.test.tsx`) is green; this is a separate full-tree render harness issue. |
