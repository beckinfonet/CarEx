---
phase: 13-fcm-push-transport-native
plan: 03
subsystem: infra
tags: [fcm, push-notifications, react-native-firebase, firebase, apns, cocoapods, gradle, android-manifest]

# Dependency graph
requires:
  - phase: 13-01 (spike)
    provides: "iOS static-frameworks linkage (use_frameworks! :linkage => :static + $RNFirebaseAsStaticFramework), FollyConvert→React-utils fix, Stripe/fmt post_install hooks — the proven base that lets RNFB pods link cleanly"
provides:
  - "@react-native-firebase/app + /messaging installed at exactly 24.1.0 (locked-step, no caret float)"
  - "iOS Firebase SDK 12.11.0 (Core + Messaging) + RNFBApp/RNFBMessaging pods linking statically; Stripe 25.9.0 / fmt 11.0.2 intact"
  - "Android google-services plugin (4.4.4) applied + processing com.carex.market client JSON"
  - "POST_NOTIFICATIONS permission (runtime-gated, targetSdk 36) + default FCM channel meta-data (id: carex_default)"
  - "Push-capable app shell — pending mobile receive/route wiring in 13-04"
affects: [13-04, 13-05, 13-HUMAN-UAT]

# Tech tracking
tech-stack:
  added:
    - "@react-native-firebase/app@24.1.0"
    - "@react-native-firebase/messaging@24.1.0"
    - "Firebase iOS SDK 12.11.0 (Core/Messaging) via CocoaPods"
    - "com.google.gms:google-services:4.4.4 (Android Gradle plugin)"
  patterns:
    - "Locked-step RNFB versioning: app + messaging pinned to identical exact version; node check fails build on drift"
    - "RNFB iOS install incantation: RCT_USE_PREBUILT_RNCORE=0 pod install under static frameworks"
    - "Default FCM channel declared in manifest; channel itself created in-JS (13-04/05)"
    - "Push-tap routing handled in-JS (navigationRef), NOT via carex://search intent-filter (Pitfall 5)"

key-files:
  created:
    - "android/app/google-services.json (gitignored, operator-placed — local-only)"
  modified:
    - "package.json — RNFB app+messaging pinned to 24.1.0 (exact)"
    - "package-lock.json — RNFB dependency tree"
    - "ios/Podfile.lock — RNFBApp/RNFBMessaging + Firebase 12.11.0 pods"
    - "ios/carEx.xcodeproj/project.pbxproj — RNFB Core Configuration build phase (pod integration only)"
    - "ios/carEx/PrivacyInfo.xcprivacy — aggregated required-reason API entries from Firebase pods"
    - "android/build.gradle — google-services classpath"
    - "android/app/build.gradle — apply google-services plugin (bottom)"
    - "android/app/src/main/AndroidManifest.xml — POST_NOTIFICATIONS + default channel meta-data"

key-decisions:
  - "Default Android notification channel id = carex_default (referenced by 13-04/13-05; channel created in-JS)"
  - "Removed npm's auto-added ^ caret from RNFB deps — plan mandates exact 24.1.0 locked-step"
  - "No @notifee/react-native (D-03: RNFB built-in display for param-free lock-screen pushes)"
  - "Version-bump churn (android/version.properties, ios project.pbxproj MARKETING/CURRENT_PROJECT_VERSION) stashed during work, restored after — kept out of plan commits"

patterns-established:
  - "RNFB locked-step install: identical exact versions for app+messaging, verified by node check + Podfile.lock grep"
  - "google-services verification via :app:processDebugGoogleServices (proves JSON client matches applicationId without a full build)"

requirements-completed: [NPUSH-02, NPUSH-03]

# Metrics
duration: 4 min
completed: 2026-06-07
---

# Phase 13 Plan 03: RNFB Install + Android/iOS Push Config Summary

**RNFB app+messaging 24.1.0 installed locked-step under proven iOS static frameworks (Firebase 12.11.0, Stripe intact), Android google-services plugin wired + processing the com.carex.market client, POST_NOTIFICATIONS + carex_default channel declared.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-07T06:56:22Z
- **Completed:** 2026-06-07T07:00:23Z
- **Tasks:** 2 auto (Task 3 human-action checkpoint pre-satisfied by operator)
- **Files modified:** 7 tracked + 1 gitignored (google-services.json)

## Accomplishments
- @react-native-firebase/app + /messaging installed at **exactly 24.1.0** (locked-step; npm's `^` caret stripped to enforce the pin), `RCT_USE_PREBUILT_RNCORE=0 pod install` succeeded under static frameworks: RNFBApp (24.1.0), RNFBMessaging (24.1.0), Firebase iOS SDK 12.11.0 (Core + Messaging). Stripe 25.9.0 / fmt 11.0.2 / stripe-react-native 0.62.0 all intact; FollyConvert React-utils header path preserved. No notifee (D-03).
- Android google-services plugin (4.4.4) classpath added + applied at bottom of app build.gradle; POST_NOTIFICATIONS permission and `carex_default` default-channel meta-data declared in the manifest.
- **Verified end-to-end:** `:app:processDebugGoogleServices` → BUILD SUCCESSFUL against the `com.carex.market` client (no "No matching client found"); autolinked RNFB Android modules (app + messaging, 24.1.0) recognized by Gradle.
- Pitfall 5 honored: no `carex://search` intent-filter added — push-tap routing is handled in-JS in 13-04.

## Task Commits

1. **Task 1: Install RNFB 24.1.0 + pod install under static frameworks** — `2e1b1e9` (feat)
2. **Task 2: Android google-services plugin + POST_NOTIFICATIONS + default channel** — `4f147c0` (feat)
3. **Task 3: Place google-services.json + upload APNs .p8** — human-action checkpoint, **pre-satisfied by operator** (no commit; google-services.json is gitignored)

**Plan metadata:** (this SUMMARY commit)

## Files Created/Modified
- `package.json` / `package-lock.json` — RNFB app+messaging at exact 24.1.0
- `ios/Podfile.lock` — RNFBApp/RNFBMessaging (24.1.0) + Firebase 12.11.0 (Core/Messaging) pods, static-linked
- `ios/carEx.xcodeproj/project.pbxproj` — RNFB Core Configuration build phase (pod-integration only; no version bumps)
- `ios/carEx/PrivacyInfo.xcprivacy` — required-reason API entries aggregated from Firebase pods
- `android/build.gradle` — `com.google.gms:google-services:4.4.4` classpath
- `android/app/build.gradle` — `apply plugin: "com.google.gms.google-services"` at bottom
- `android/app/src/main/AndroidManifest.xml` — POST_NOTIFICATIONS + default FCM channel (`carex_default`)
- `android/app/google-services.json` — operator-placed, **gitignored (local-only)**; presence proven by the successful google-services build task

## Decisions Made
- **Default channel id `carex_default`** — chosen for the manifest default-channel meta-data; 13-04/13-05 must create this channel in-JS and may reference the id.
- **Stripped `^` caret from RNFB deps** — npm auto-pinned `^24.1.0`; plan mandates exact `24.1.0` locked-step, so package.json was edited to bare `24.1.0` and reinstalled to refresh the lockfile.
- **No notifee** — per spike D-03 (RNFB built-in display covers Phase-13 param-free lock-screen pushes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm pinned RNFB with `^` caret instead of exact version**
- **Found during:** Task 1 (RNFB install)
- **Issue:** `npm install @react-native-firebase/app@24.1.0 …` wrote `^24.1.0` to package.json, which floats — violating the plan's locked-step "exactly 24.1.0" requirement (and would fail the plan's own node verify check).
- **Fix:** Edited package.json to bare `24.1.0` for both packages, re-ran `npm install` to refresh package-lock.json; verified installed versions are 24.1.0 and the plan's node check passes.
- **Files modified:** package.json, package-lock.json
- **Verification:** `node -e "…app!=='24.1.0'||messaging!=='24.1.0'…"` exits 0; installed package versions both report 24.1.0.
- **Committed in:** `2e1b1e9` (Task 1 commit)

**2. [Rule 3 - Blocking] Gradle google-services task name differed from plan**
- **Found during:** Task 2 (Android build verification)
- **Issue:** Plan suggested `:app:processDebugGoogleServicesProvider`; the actual available task on this AGP version is `:app:processDebugGoogleServices`.
- **Fix:** Discovered the real task via `:app:tasks --all` and ran `:app:processDebugGoogleServices`.
- **Files modified:** none (verification only)
- **Verification:** BUILD SUCCESSFUL, no "No matching client found" for `com.carex.market`.
- **Committed in:** n/a (verification step)

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact on plan:** Both essential to satisfy the plan's own acceptance criteria/verification. No scope creep — no extra deps, no manifest/source changes beyond the plan's spec.

## Issues Encountered
None blocking. EBADENGINE npm warning (node v20.19.1 < required 20.19.4) is pre-existing and harmless for this install. Stash/pop of the pre-existing version-bump churn (`android/version.properties`, `ios project.pbxproj`) was clean — those files were kept out of the task commits and restored intact afterward.

## User Setup Required
Operator console artifacts for Task 3 were **already completed** before execution:
- `android/app/google-services.json` placed (client `com.carex.market`) — gitignored, local-only; build reads it locally.
- APNs `.p8` auth key uploaded to Firebase (Cloud Messaging → Apple app config). iOS `GoogleService-Info.plist` present (BUNDLE_ID `com.carex.app`).

Real-device APNs/FCM delivery (NPUSH-03) is verified later in 13-04 / 13-HUMAN-UAT after the mobile receive/route wiring — not provable at this config layer.

## Next Phase Readiness
- App is **push-capable at the config layer**: RNFB installed, iOS pods link statically, Android google-services processes the client JSON, permission + channel declared.
- **13-04** can now wire RNFB messaging (token registration, foreground/background/quit handlers, in-JS tap routing) and must **create the `carex_default` notification channel in-JS** to match the manifest default-channel meta-data.
- Watch item carried from spike A3: APNs token forwarding relies on RNFB `+load`-time swizzling on the Swift `RCTReactNativeFactory` AppDelegate — only confirmable on a real device; if the FCM token never resolves, add explicit `didRegisterForRemoteNotificationsWithDeviceToken` forwarding (documented RNFB fallback).

## Self-Check: PASSED

All created/modified files present on disk (package.json, ios/Podfile.lock, android build.gradle ×2, AndroidManifest.xml, android/app/google-services.json, 13-03-SUMMARY.md). Both task commits found in git log: `2e1b1e9` (Task 1), `4f147c0` (Task 2). Plan verify commands pass: RNFB pinned to exact 24.1.0 + Podfile.lock references RNFB; google-services classpath/plugin + POST_NOTIFICATIONS + default_notification_channel_id present; `:app:processDebugGoogleServices` BUILD SUCCESSFUL.

---
*Phase: 13-fcm-push-transport-native*
*Completed: 2026-06-07*
