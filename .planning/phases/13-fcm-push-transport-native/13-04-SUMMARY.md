---
phase: 13-fcm-push-transport-native
plan: 04
subsystem: mobile-push-transport
tags: [fcm, push, rnfb, auth-lifecycle, deeplink, navigation]
requires: [13-01, 13-02, 13-03]
provides:
  - "PushService (device-token register/unregister via apiClient, MOB-01-compliant)"
  - "AuthContext FCM token lifecycle (register on login/signup, refresh, unregister-before-clear on logout)"
  - "index.js background message handler at module scope"
  - "App.tsx 3-state push-tap routing via navigationRef through the existing linking whitelist"
affects: [src/context/AuthContext.tsx, App.tsx, index.js, jest.setup.js]
tech-stack:
  added: []
  patterns:
    - "Domain-split service (MOB-01): device-token HTTP on PushService, never AuthService"
    - "RNFB messaging surface isolated in pushPermission.ts (mockable, best-effort)"
    - "In-JS navigationRef.navigate push routing (sidesteps carex://search manifest gap, Pitfall 5)"
key-files:
  created:
    - src/services/push/PushService.ts
    - src/services/push/pushPermission.ts
    - src/services/push/__tests__/PushService.test.ts
  modified:
    - src/context/AuthContext.tsx
    - index.js
    - App.tsx
    - jest.setup.js
key-decisions:
  - "unregisterToken takes the FCM token as an explicit arg (not read from a ref) so the logout-ordering fix is testable in isolation and the DELETE carries a still-valid Bearer."
  - "RNFB calls confined to pushPermission.ts; AuthContext/App.tsx only call thin helpers — keeps the native dependency in one place and Jest-mockable."
  - "appVersion sent as 'unknown' placeholder: no device-info lib exists and CLAUDE.md forbids adding one this milestone; backend treats appVersion as opaque metadata."
  - "Push taps route via navigationRef.navigate (not Linking.openURL) to sidestep the missing carex://search Android intent-filter (Pitfall 5)."
requirements-completed: [NPUSH-04, NPUSH-06, NPUSH-07]
duration: ~35 min
completed: 2026-06-07
---

# Phase 13 Plan 04: Mobile FCM Transport Wiring Summary

Wired the client half of FCM push: a MOB-01-compliant `PushService` for device-token HTTP, the AuthContext token lifecycle (register on login/signup gated on already-granted permission, `onTokenRefresh` re-register, and the logout unregister firing **before** `currentIdTokenRef` clears so the DELETE keeps a valid Bearer), the `index.js` background message handler at module scope, and a 3-state (`getInitialNotification`/`onNotificationOpenedApp`/`onMessage`) tap-routing effect in `App.tsx` that parses `data.deeplink` and navigates via `navigationRef` through the existing `CarDetails`/`SearchResults` linking whitelist only.

## Tasks

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 (RED) | Failing PushService test | `f55425b` | src/services/push/__tests__/PushService.test.ts |
| 1 (GREEN) | PushService impl | `ceec024` | src/services/push/PushService.ts |
| 2 | AuthContext token lifecycle | `08b0200` | src/context/AuthContext.tsx, src/services/push/pushPermission.ts, jest.setup.js |
| 3 | index.js bg handler + App.tsx 3-state routing | `4ab5803` | index.js, App.tsx |

## Verification Results (actual output)

- **PushService test:** `7 passed, 7 total` (`npx jest src/services/push/__tests__/PushService.test.ts`).
- **MOB-01 grep gate:** `grep -i -E 'device-?token|registerToken|unregisterToken' src/services/AuthService.ts | grep -vc '^[[:space:]]*//'` → **`0`** (clean).
- **awk logout-ordering:** `unregisterToken` (line 475) appears BEFORE `currentIdTokenRef.current = null` → **PASS**.
- **index.js:** `grep -q setBackgroundMessageHandler index.js` → OK; handler is at module scope, ordered BEFORE `AppRegistry.registerComponent` (awk order check PASS).
- **App.tsx:** `getInitialNotification` + `onNotificationOpenedApp` + `onMessage` + `navigationRef.navigate` all present.
- **Full mobile suite (`npm test`):** `526 passed, 17 failed` (543 total). Baseline before this plan was `519 passed, 17 failed`. The +7 passing = the new PushService suite; the **17 failures and 5 failing suites are identical to baseline** (pre-existing, unrelated to push — see Pre-Existing Failures). No regressions.
- **tsc (`npx tsc --noEmit`):** error count unchanged at **102** before and after (no new production-file type errors; the only push-related tsc errors are `fs`/`path`/`__dirname` in the new test file, an identical pre-existing pattern shared by `NotificationService.test.ts` — babel strips these and Jest runs them green).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Added @react-native-firebase/messaging Jest mock**
- **Found during:** Task 2
- **Issue:** AuthContext (and App.tsx) now import RNFB `messaging`, whose native module throws at module-load time inside Jest. Without a mock, every suite that imports AuthContext/App would break — a regression.
- **Fix:** Added a `jest.mock('@react-native-firebase/messaging', ...)` stub to `jest.setup.js` covering the surface the codebase uses (`getToken`, `hasPermission`, `onTokenRefresh`, `onMessage`, `onNotificationOpenedApp`, `getInitialNotification`, `setBackgroundMessageHandler`, `AuthorizationStatus`). Defaults to NOT_DETERMINED permission + stub token.
- **Files modified:** jest.setup.js
- **Verification:** Full suite stayed at 17 pre-existing failures (no new); AuthContext/integration suites green (39 + 13 passing).
- **Commit:** `08b0200`

**2. [Rule 2 - Missing critical] Isolated RNFB calls in pushPermission.ts helper**
- **Found during:** Task 2
- **Issue:** The plan's `<action>` puts `messaging().getToken()`/permission checks inline in AuthContext. Inlining the native surface across login/signup/logout/mount would scatter spike-gated RNFB calls through core auth and make them hard to mock/guard.
- **Fix:** Created `src/services/push/pushPermission.ts` exposing `registerDeviceTokenIfPermitted`, `getDeviceTokenSafe`, `subscribeTokenRefresh`, `isPushPermissionGranted` — all best-effort (log + swallow, never throw) so a push failure can never break auth. AuthContext calls only these thin helpers. This is the same domain-isolation spirit as the MOB-01 PushService split.
- **Files modified:** src/services/push/pushPermission.ts (new), src/context/AuthContext.tsx
- **Verification:** awk ordering PASS; AuthContext tests green.
- **Commit:** `08b0200`

**Total deviations:** 2 auto-fixed (1 blocker, 1 missing-critical/isolation). **Impact:** Both strengthen testability and regression-safety; no behavioral divergence from the plan's intent. No architectural (Rule 4) changes.

## Pre-Existing Failures (NOT caused by this plan — out of scope)

These 5 suites / 17 tests were already failing on the pre-plan baseline (verified before any edits) and are logged for the verifier, not fixed (scope boundary):
- `__tests__/App.test.tsx` — `TypeError: Cannot use 'in' operator to search for 'usesNewAndroidHeaderHeightImplementation' in undefined` (native-stack header, unrelated to push; the RNFB mock loads fine).
- `__tests__/coverage-manifest.audit.test.ts` — `scripts/generate-coverage-manifest.sh` fails (manifest tooling).
- `__tests__/moderation.e2e.integration.test.tsx`
- `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx`
- `__tests__/_fixtures/listingStatusFixtures.ts`

## Threat Model Coverage

- **T-13-04-01 (Info Disclosure, logout unregister):** mitigated — `unregisterToken` fires before `currentIdTokenRef` clears (awk PASS), so the DELETE carries a valid Bearer; a logged-out device's token is removed server-side.
- **T-13-04-02 (Tampering, deeplink routing):** mitigated — `routeDeeplink` only maps to `CarDetails`/`SearchResults`; unknown targets are ignored. Linking config not widened.
- **T-13-04-03 (IDOR, registerToken):** mitigated — no uid in the register body (asserted in test); backend derives uid from the verified Bearer via the shared `apiClient` interceptor.

## Deferred to 13-HUMAN-UAT (created in 13-05)

Real-device-only behaviors that cannot be unit-tested (RESEARCH §Validation):
- **NPUSH-06:** foreground/background/quit 3-state taps on a real device.
- **NPUSH-07:** cold-start tap → CarDetails (and search tap → SearchResults), including the Android `carex://search` in-JS routing path.
- Token register/refresh/unregister against a live FCM token + backend.

## Notes for Downstream

- `navigationRef` is now exported from `App.tsx` and attached to `NavigationContainer` — 13-05 (and any future deep-link work) can reuse it.
- `pushPermission.ts` deliberately does **not** call `requestPermission()`; the contextual pre-prompt + OS dialog is 13-05's job. Registration only happens when permission is already granted.
- The 2 unrelated version-bump files (`android/version.properties`, `ios/carEx.xcodeproj/project.pbxproj`) were stashed during execution and restored after; they are NOT part of any 13-04 commit.

## Self-Check: PASSED

- `src/services/push/PushService.ts` — FOUND
- `src/services/push/pushPermission.ts` — FOUND
- `src/services/push/__tests__/PushService.test.ts` — FOUND
- Commits `f55425b`, `ceec024`, `08b0200`, `4ab5803` — all present in `git log`.
- MOB-01 gate `0`, awk ordering PASS, PushService 7/7 green, no suite/tsc regressions.
