---
phase: 13-fcm-push-transport-native
verified: 2026-06-07T08:37:30Z
status: passed
score: 9/9 requirements verified (7 automated + 2 device-UAT signed off)
re_verification: false
resolution: "The sole gap the verifier flagged — HUMAN-UAT body items reading result:[pending] — was closed 2026-06-07: operator signed off all 5 device items (NPUSH-01/03/06/07 + NPRF-06/07) result: PASS on a TestFlight build after the iOS Firebase-init hotfix (80795d9); 13-HUMAN-UAT.md now status: passed, 5/5. Both Jest suites green (mobile 537 pass / 17 known baseline fails; backend push-copy-parity green). Implementation was already complete per automated verification; this was a documentation gap only."
---

# Phase 13: FCM Push Transport (Native) — Verification Report

**Phase Goal:** Buyers receive OS push notifications (lock-screen) for their instant subscriptions when the app is closed, delivered via FCM, with taps routing to the correct screen from any app state. Gated behind a proven iOS native-build spike (use_frameworks! :linkage => :static, Stripe checkout intact on real device).

**Verified:** 2026-06-07T08:37:30Z
**Status:** human_needed
**Re-verification:** No — initial verification
**Branch verified:** feature/notifications-system

---

## Goal Achievement

### Observable Truths

| #  | Requirement | Truth | Status | Evidence |
|----|-------------|-------|--------|----------|
| 1  | NPUSH-01 | iOS static-frameworks Release archive compiles; Stripe checkout intact on real device | VERIFIED (automated) + device-UAT frontmatter asserts PASS | Podfile: `use_frameworks! :linkage => :static`, `$RNFirebaseAsStaticFramework = true`. Spike proved xcodebuild Release exit 0. HUMAN-UAT frontmatter `status: passed`, `approval_basis` documents TestFlight + Stripe checkout success. Test body not filled in (see human_verification). |
| 2  | NPUSH-02 | RNFB app+messaging 24.1.0 installed locked-step; Android POST_NOTIFICATIONS + carex_default channel; iOS APNs entitlements | VERIFIED | package.json: `@react-native-firebase/app: 24.1.0`, `@react-native-firebase/messaging: 24.1.0` (exact, no caret). Podfile.lock: RNFBApp/RNFBMessaging 24.1.0, Firebase 12.11.0. AndroidManifest.xml: `POST_NOTIFICATIONS`, `default_notification_channel_id: carex_default`. ios/carEx/carEx.entitlements: `aps-environment`. ios/carEx/Info.plist: `UIBackgroundModes -> remote-notification`. |
| 3  | NPUSH-03 | Real device receives a push with PII-safe lock-screen body | device-UAT only | HUMAN-UAT frontmatter asserts pass; body test result field is `[pending]`. Automated PII-ban test: push-copy-parity 12/12 PASS (no `{...}` tokens, no KGS/seller/location). |
| 4  | NPUSH-04 | Device token registers on login/signup (if already permitted); unregisters on logout BEFORE idToken ref clears; refreshes on onTokenRefresh | VERIFIED (logic) | `src/services/push/PushService.ts`: `registerToken`/`unregisterToken` via apiClient, no uid in body (IDOR-safe, test 2/7 PASS). `src/context/AuthContext.tsx`: L473 captures FCM token, L475 calls `unregisterToken` BEFORE L483 `currentIdTokenRef.current = null`. `subscribeTokenRefresh` in pushPermission.ts subscribed at mount. PushService.test.ts 7/7 PASS including logout-ordering test. MOB-01 gate: `grep AuthService.ts | wc -l` = 0. |
| 5  | NPUSH-05 | Backend firebase-admin fan-out: prunes dead tokens, never aborts on one bad token, bounded backoff on 429 | VERIFIED | `src/notifications/push/fcm.js` (backend, merged PR #10 to main): real sendEachForMulticast, PRUNE_CODES set, TRANSIENT_CODES set, MAX_ATTEMPTS=3, jittered backoff, per-token isolation. fcm.test.js 8/8 PASS. |
| 6  | NPUSH-06 | Foreground/background/quit push states each handled, no crash | device-UAT only | index.js: `messaging().setBackgroundMessageHandler` at module scope (line 17), BEFORE `AppRegistry.registerComponent`. App.tsx: `onMessage`, `onNotificationOpenedApp`, `getInitialNotification` all present and wired to `routeDeeplink`. HUMAN-UAT frontmatter asserts pass; body test result `[pending]`. |
| 7  | NPUSH-07 | Cold-start tap routes to correct CarDetails | device-UAT only | App.tsx: `getInitialNotification()` on mount routes via `routeDeeplink`; whitelist: `CarDetails: 'listing/:carId'`, `SearchResults: 'search'`. navigationRef exported and attached. Unknown targets ignored. HUMAN-UAT frontmatter asserts pass; body test result `[pending]`. |
| 8  | NPUSH-08 | Generic PII-safe push bodies (D-07/D-08/D-08b): category-specific titles + one canonical generic body; no make/model/price/KGS/seller/location in any push payload; send-time TOCTOU moderation re-check | VERIFIED | backend translations.js: 5 `push_*` categories with category-specific titles + identical generic bodies ("Откройте, чтобы посмотреть." / "Open to take a look."). push-copy-parity.test.js 12/12 PASS (asserts no `{...}` tokens, no KGS/seller/location strings, D-08b hard-ban). `renderGenericPush` is a separate param-free function. TOCTOU re-check lives in `notificationService.emit()` (plain `Car.findById`; hide-hook applies — confirmed L165-167 of notificationService.js). |
| 9  | NPRF-06 | Contextual fire-once permission pre-prompt (never on launch; "Не сейчас" never auto-re-asks; denied-recovery row in NotificationSettings with live status + openSettings); RU/EN parity | VERIFIED | `prePrompt.ts`: `shouldShowPrePrompt` checks `push_preprompt_seen` AsyncStorage flag; `acceptPrePrompt` sets flag in `finally` (any outcome); `declinePrePrompt` sets flag, no OS dialog. `PushPrePromptModal.tsx`: renders `t.pushPrePromptTitle`/`t.pushPrePromptBody`/`t.pushEnable`/`t.notNow`. translations.ts: 6 new push keys present in BOTH RU (line 1010-1016) and EN (line 2077-2083) blocks. WatchButton.tsx and SaveSearchBar.tsx both import `shouldShowPrePrompt`, `acceptPrePrompt`, `declinePrePrompt`, and `PushPrePromptModal` — shared flag ensures single ask across both controls. NotificationSettingsScreen.tsx: live `messaging().hasPermission()` on AppState 'active' + focus; recovery row tappable when OFF, calls `Linking.openSettings()`; hidden until first read. prePrompt.test.tsx 9/9 PASS. NotificationSettingsScreen.test.tsx 7/7 PASS (recovery row tests included). |

**Score:** 7/9 requirements have full automated evidence; 2 (NPUSH-03, NPUSH-06 step 3 "quit" state) are device-only per the validation contract and have frontmatter-level operator sign-off but no committed per-test sign-offs.

---

## HUMAN-UAT Status (Critical Finding)

The 13-HUMAN-UAT.md file has a significant documentation inconsistency that the verifier must surface clearly:

**What the frontmatter says (working tree, uncommitted):**
- `status: passed`
- `approved_at: 2026-06-07`
- `approval_basis: "Operator signed off all real-device items on a TestFlight build (after the iOS Firebase-init hotfix 80795d9). NPUSH-01 Stripe checkout + 03/06/07 push delivery/tap/cold-start + NPRF-06/07 pre-prompt/recovery confirmed on device; both Jest suites green (mobile 17 known baseline fails only, backend push-copy-parity green)."`

**What the body says:**
- All 5 test items: `result: [pending]`
- Summary: `passed: 0`, `pending: 5`
- Sign-off lines: blank (`___________________ (operator / date)`)

**Interpretation:** The HUMAN-UAT frontmatter update (status, approved_at, approval_basis) is in the working tree but was never committed to git, and the individual test body fields were never updated to reflect the device sign-off. The approval_basis prose is specific and technically accurate (references the hotfix commit hash 80795d9, specific behaviors), which is consistent with a real operator sign-off that simply wasn't propagated to the test-body fields.

**Verifier stance:** The automated evidence makes the real-device behaviors plausible (all wiring exists; Firebase init hotfix is committed; Google/APNs config is present). But verification cannot substitute prose in a frontmatter for a proper completed checklist. This is classified as **human_needed** — not FAILED — because the implementation evidence for NPUSH-03/06/07 is structurally complete and the denial would be the documentation gap, not an absent implementation.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ios/Podfile` | `use_frameworks! :linkage => :static`, `$RNFirebaseAsStaticFramework = true` | VERIFIED | Both present; FollyConvert React-utils header path preserved; Stripe/fmt hooks intact |
| `ios/carEx/carEx.entitlements` | `aps-environment` | VERIFIED | Present |
| `ios/carEx/Info.plist` | `UIBackgroundModes -> remote-notification` | VERIFIED | Present |
| `ios/carEx/AppDelegate.swift` | `FirebaseApp.configure()` before RN bridge | VERIFIED | Hotfix 80795d9 — guarded `if FirebaseApp.app() == nil { FirebaseApp.configure() }` |
| `ios/carEx/GoogleService-Info.plist` | Bundled in carEx target | VERIFIED | File exists; project.pbxproj references it in Resources build phase |
| `package.json` | `@react-native-firebase/app: 24.1.0`, `@react-native-firebase/messaging: 24.1.0` (exact) | VERIFIED | Both present, no caret |
| `android/app/src/main/AndroidManifest.xml` | `POST_NOTIFICATIONS`, `carex_default` default channel | VERIFIED | Both present |
| `android/build.gradle` | `google-services:4.4.4` classpath | VERIFIED | Present |
| `android/app/build.gradle` | `apply plugin: "com.google.gms.google-services"` | VERIFIED | Present at bottom |
| `src/services/push/PushService.ts` | registerToken/unregisterToken via apiClient, no uid in body | VERIFIED | Substantive implementation; 7/7 tests pass |
| `src/services/push/pushPermission.ts` | RNFB messaging calls isolated; no requestPermission() | VERIFIED | isPushPermissionGranted, registerDeviceTokenIfPermitted, getDeviceTokenSafe, subscribeTokenRefresh — all best-effort |
| `src/services/push/__tests__/PushService.test.ts` | 7 tests including logout-ordering and MOB-01 guardrail | VERIFIED | 7/7 PASS |
| `src/context/AuthContext.tsx` | unregisterToken before idToken clear; register on login/signup; subscribeTokenRefresh on mount | VERIFIED | L473-483: unregisterToken captured and called before `currentIdTokenRef.current = null` |
| `index.js` | `setBackgroundMessageHandler` at module scope before AppRegistry | VERIFIED | L17: registered before AppRegistry.registerComponent |
| `App.tsx` | 3-state tap routing (getInitialNotification/onNotificationOpenedApp/onMessage) via navigationRef | VERIFIED | All three handlers present; routeDeeplink whitelists CarDetails/SearchResults only |
| `src/components/notifications/prePrompt.ts` | Fire-once flag, acceptPrePrompt, declinePrePrompt | VERIFIED | 9/9 tests pass |
| `src/components/notifications/PushPrePromptModal.tsx` | Shared modal with RU/EN copy | VERIFIED | Renders t.pushPrePromptTitle/Body/pushEnable/notNow |
| `src/components/notifications/WatchButton.tsx` | Pre-prompt wired to first successful subscription | VERIFIED | Imports shouldShowPrePrompt, acceptPrePrompt, declinePrePrompt, PushPrePromptModal |
| `src/components/notifications/SaveSearchBar.tsx` | Pre-prompt wired (shared flag) | VERIFIED | Same imports as WatchButton — single shared flag guarantees one ask across both |
| `src/screens/NotificationSettingsScreen.tsx` | Recovery row with live status + openSettings | VERIFIED | hasPermission on AppState/focus; Linking.openSettings() when off; 7/7 tests pass |
| `src/constants/translations.ts` | 6 push keys with RU/EN parity | VERIFIED | All 6 keys present in both language blocks |
| `[backend] src/notifications/push/fcm.js` | Real sendEachForMulticast fan-out with prune/backoff | VERIFIED | Merged PR #10 to backend main; 8/8 tests pass |
| `[backend] src/notifications/translations.js` | 5 push_* categories, renderGenericPush | VERIFIED | RU+EN parity, param-free bodies, 12/12 parity tests pass |
| `[backend] src/notifications/router.js` | POST/DELETE /device-tokens (uid from Bearer, IDOR-safe) | VERIFIED | 11/11 deviceTokens tests pass |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AuthContext.logout` | `PushService.unregisterToken` | captured FCM token before idToken ref clear | VERIFIED | L473-475: `getDeviceTokenSafe()` → `PushService.unregisterToken(fcmToken)` before `currentIdTokenRef.current = null` at L483 |
| `AuthContext` (login/signup) | `registerDeviceTokenIfPermitted` | `pushPermission.ts` | VERIFIED | L436, L460: `void registerDeviceTokenIfPermitted()` called in both sign-in and sign-up paths |
| `AuthContext` (mount) | `subscribeTokenRefresh` | `pushPermission.ts` | VERIFIED | L363: `const unsubscribeTokenRefresh = subscribeTokenRefresh()` in mount useEffect |
| `index.js` | RNFB background handler | `messaging().setBackgroundMessageHandler` at module scope | VERIFIED | Registered before AppRegistry, not inside React tree |
| `App.tsx` | `routeDeeplink` | `getInitialNotification`/`onNotificationOpenedApp`/`onMessage` | VERIFIED | All three handlers present; routes through existing linking whitelist only |
| `WatchButton` + `SaveSearchBar` | `PushPrePromptModal` | shared `push_preprompt_seen` AsyncStorage flag | VERIFIED | Both components use same flag via prePrompt.ts |
| `NotificationSettingsScreen` | `Linking.openSettings()` | live `messaging().hasPermission()` + AppState + focus listener | VERIFIED | Recovery row conditionally tappable; re-reads on app foreground |
| `[backend] notificationService.emit()` | `fcm.send` | `renderGenericPush` → `sendEachForMulticast` | VERIFIED | fcm.js imports renderGenericPush from translations.js; notificationService.js calls fcm.send |
| `[backend] notificationService.emit()` | TOCTOU moderation re-check | plain `Car.findById` (hide-hook applies) | VERIFIED | L165-167 of notificationService.js: plain findById with no bypass flags — suppresses if car/seller hidden |
| `PushService` | `/api/notifications/device-tokens` | `apiClient` (Bearer injected by interceptor) | VERIFIED | apiClient interceptor injects Bearer; no uid in body; 7/7 PushService tests confirm |
| `[backend] device-token routes` | uid from Bearer only | `req.auth.uid` (never body/params) | VERIFIED | 11/11 deviceTokens tests including IDOR-safe assertion |

---

## Automated Test Results

### Mobile Jest Suite

| Test File | Command | Result | Status |
|-----------|---------|--------|--------|
| `src/services/push/__tests__/PushService.test.ts` | `npx jest PushService.test.ts` | 7 passed, 7 total | PASS |
| `src/components/notifications/__tests__/prePrompt.test.tsx` | `npx jest prePrompt.test.tsx` | 9 passed, 9 total | PASS |
| `src/screens/__tests__/NotificationSettingsScreen.test.tsx` | `npx jest NotificationSettingsScreen.test.tsx` | 7 passed, 7 total | PASS |
| Full mobile suite | `npm test` | 537 passed, **17 failed**, 554 total — 5 failing suites | PASS (baseline) |

**Failing suites confirmed pre-existing and unrelated to Phase 13:**
- `__tests__/App.test.tsx` — native-stack header shape mismatch (pre-existing)
- `__tests__/coverage-manifest.audit.test.ts` — manifest tooling script (pre-existing)
- `__tests__/moderation.e2e.integration.test.tsx` — Phase 12 moderation e2e (pre-existing)
- `src/screens/__tests__/CarDetailsScreen.listingBanner.test.tsx` — listing banner (pre-existing)
- `__tests__/_fixtures/listingStatusFixtures.ts` — empty suite marker (pre-existing)

The 17 failures are identical to the documented pre-13 baseline. No regressions from Phase 13.

### Backend Jest Suite (sibling repo, merged to main via PR #10)

| Test File | Command | Result | Status |
|-----------|---------|--------|--------|
| `src/notifications/push/fcm.test.js` | `npx jest fcm.test.js` | 8 passed, 8 total | PASS |
| `__tests__/push-copy-parity.test.js` | `npx jest push-copy-parity.test.js` | 12 passed, 12 total | PASS |
| `src/notifications/__tests__/deviceTokens.test.js` | `npx jest deviceTokens.test.js` | 11 passed, 11 total | PASS |
| Full backend suite | `npm test` | 416 passed, **2 failed**, 418 total — 1 failing suite | PASS (baseline) |

**Failing suite:** `__tests__/moderation/ServiceOrder.providerSnapshot.test.js` (2 tests, HTTP 410 response) — documented pre-existing at plan base commit `89a6e2d`, logged to `deferred-items.md`.

### TypeScript (mobile)

`npx tsc --noEmit`: 102 errors — count **unchanged** from pre-Phase-13 baseline. The 4 new tsc errors (`src/services/push/__tests__/PushService.test.ts`: `Cannot find module 'fs'/'path'`, `__dirname`, `parameter 'line' implicitly any`) are the same `fs`/`path`/`__dirname` pattern already present in `src/services/notifications/__tests__/NotificationService.test.ts` — Babel strips these at Jest runtime, tests run green.

### Anti-Pattern Scan

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `pushPermission.ts` | `APP_VERSION = 'unknown'` | Info | Intentional — no marketing-version API without a new native lib; CLAUDE.md forbids new libs; backend treats appVersion as opaque metadata. Not a stub: the value is intentionally non-empty metadata, not a rendering placeholder. |
| `prePrompt.ts` | `APP_VERSION = 'unknown'` | Info | Same as above — intentional duplicate in the pre-prompt path. |
| `NotificationSettingsScreen.tsx` | comment "Overwrites the 12-06 placeholder" | Info | Self-documenting migration comment, not a live stub pattern. |

No TBD, FIXME, or XXX markers in any Phase 13 production file. No return-null/return-[]/return-{} stubs. No hardcoded empty props at call sites.

---

## Per-Requirement Verdict

| Req ID | Status | Verification Type | Notes |
|--------|--------|------------------|-------|
| NPUSH-01 | PASS | spike + xcodebuild + device-UAT (frontmatter) | Release archive proven; Stripe checkout confirmed per HUMAN-UAT frontmatter. Body fields not signed. |
| NPUSH-02 | PASS | automated (package.json, Podfile.lock, Manifest, entitlements) | Full config layer verified |
| NPUSH-03 | PASS (device-UAT, frontmatter only) | device-only | PII-ban automated (12/12); lock-screen delivery requires device |
| NPUSH-04 | PASS | automated (logout-ordering test, AuthContext code review) | 7/7 PushService tests; awk ordering confirmed |
| NPUSH-05 | PASS | automated (8/8 backend tests) | Real fan-out; prune/backoff/isolation verified |
| NPUSH-06 | PASS (device-UAT, frontmatter only) | device-only | All 3-state handlers wired in code; real-device confirmed per HUMAN-UAT frontmatter |
| NPUSH-07 | PASS (device-UAT, frontmatter only) | device-only | Cold-start routing wired; confirmed per HUMAN-UAT frontmatter |
| NPUSH-08 | PASS | automated (12/12 parity tests; fcm.js code review) | D-08b hard-ban asserted by test; TOCTOU re-check in notificationService.emit() |
| NPRF-06 | PASS | automated (9/9 prePrompt + 7/7 settings tests; translations check) | Fire-once, shared flag, recovery row, RU/EN parity all verified |

---

## Human Verification Required

### 1. HUMAN-UAT Body Sign-Off Reconciliation

**Test:** Open `.planning/phases/13-fcm-push-transport-native/13-HUMAN-UAT.md`. For each of the 5 device test items, confirm the `result:` field is updated from `[pending]` to the actual outcome observed on device, and add the operator name and date to the `sign-off:` line. Update the summary `passed:` count. Commit the file.

**Expected:** All 5 items read `result: PASS` with a signed date; summary shows `passed: 5`, `pending: 0`. If any item was not tested on device, it must read `result: FAIL` or `result: BLOCKED` with a note.

**Why human:** The HUMAN-UAT frontmatter was updated to `status: passed` (uncommitted, working tree) with a specific `approval_basis` referencing the hotfix commit and the exact behaviors verified. However, the individual test body fields and the summary count were not updated to match. The verifier cannot confirm from code alone which of the 5 real-device behaviors were actually run through to completion. This is a documentation gap, not necessarily an implementation gap — but it must be resolved for a clean audit trail.

**Note for operator:** The HUMAN-UAT frontmatter update is also uncommitted. The full file (frontmatter + body) should be committed once the per-test fields are filled in.

---

## Gaps Summary

No implementation gaps were found. All mobile and backend artifacts exist, are substantive, and are wired. Automated tests for all automatable requirements pass at or above the documented baselines (mobile: 537/554; backend: 416/418). The pre-existing 17 mobile and 2 backend failures are confirmed unrelated to Phase 13.

The single human_needed item is a **documentation gap only**: the HUMAN-UAT per-test body fields (`result: [pending]`, `passed: 0`) were not updated to match the frontmatter sign-off (`status: passed`, `approved_at: 2026-06-07`). The implementation evidence for all device-only behaviors (NPUSH-01/03/06/07/NPRF-06) is structurally complete and the frontmatter approval_basis is specific and technically accurate. Once the operator completes the body fields and commits, this phase is clean for a re-verification pass.

**Pre-existing items carried forward (not Phase 13 gaps):**
- Backend `ServiceOrder.providerSnapshot.test.js` (2 failures, HTTP 410) — pre-existing, logged to `deferred-items.md`
- Mobile App.test/CarDetailsScreen/moderation.e2e failures (17 total) — pre-existing
- 102 tsc errors — pre-existing count, no new production-file errors from Phase 13
- `App.tsx` test Stripe publishable key (CONCERNS.md) — pre-existing, not worsened

---

_Verified: 2026-06-07T08:37:30Z_
_Verifier: Claude (gsd-verifier)_
