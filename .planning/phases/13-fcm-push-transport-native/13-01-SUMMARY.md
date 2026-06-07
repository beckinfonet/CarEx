---
phase: 13-fcm-push-transport-native
plan: 01
subsystem: infra
tags: [ios, cocoapods, static-frameworks, stripe, react-native-firebase, apns, spike]

requires:
  - phase: 12-notification-domain-in-app-center
    provides: in-app notification center as the guaranteed fallback channel if push aborts
provides:
  - iOS static-frameworks linkage (use_frameworks! :linkage => :static) proven Stripe-intact under Release
  - $RNFirebaseAsStaticFramework declared so RNFB pods will link statically in 13-03
  - aps-environment entitlement + remote-notification background mode
  - committed pre-frameworks rollback checkpoint
  - 13-SPIKE-RESULT.md (working incantation, A2/A3 findings, D-03 decision, PASS record)
affects: [13-03-rnfb-install, 13-04-pushservice-wiring, 13-05-permission-ui]

tech-stack:
  added: []
  patterns: [static-frameworks linkage with RCT_USE_PREBUILT_RNCORE=0 source-built React-Core; FollyConvert header re-point to React-utils]

key-files:
  created:
    - .planning/phases/13-fcm-push-transport-native/13-SPIKE-RESULT.md
  modified:
    - ios/Podfile
    - ios/carEx/carEx.entitlements
    - ios/carEx/Info.plist
    - App.tsx

key-decisions:
  - "D-03: RNFB built-in notification display, NO @notifee/react-native (Phase 13 sends only generic param-free pushes)"
  - "RCT_USE_PREBUILT_RNCORE=0 + pod deintegrate is the required incantation for RN 0.83 static frameworks"
  - "FollyConvert.h resolves via the React-utils pod (not React-Core) under RN 0.83"

patterns-established:
  - "Static-frameworks Release compile can be proven by orchestrator xcodebuild (no signing/device); device-only bars (Stripe checkout) go to TestFlight"
  - "Pre-frameworks rollback checkpoint committed BEFORE any native linkage change (D-02 safety)"

requirements-completed: [NPUSH-01]

duration: ~2.5h (incl. human device gate + Stripe key fix)
completed: 2026-06-06
---

# Phase 13 Plan 01: iOS Static-Frameworks Spike Summary

**The `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework` switch produces a Stripe-intact Release build that compiles, runs on a real iPhone via TestFlight, and completes a Stripe test checkout — milestone risk #1 retired, Phase 13 waves 2–4 unlocked.**

## Outcome: ✅ SPIKE PASSED

Both D-02 bars met:
- **Bar #1 — Release static-frameworks compile:** orchestrator-run `xcodebuild -configuration Release -destination generic/platform=iOS ... CODE_SIGNING_ALLOWED=NO` → `BUILD SUCCEEDED`, 0 errors, FollyConvert resolved, `stripe-react-native` + `fmt` compiled, `carEx.app` produced + `validate-for-store` passed.
- **Bar #2 — real device + Stripe:** TestFlight (Release-signed) build runs on a real iPhone; Stripe TEST checkout completed ("Payment successful! Your booking is confirmed."; listing → Booked).
- **D-03:** RNFB built-in display, no notifee.

## Task Commits
1. **Task 1: pre-frameworks rollback checkpoint** — `78aae01` (docs)
2. **Task 2: static frameworks + push entitlements + 3 landmines** — `7543a51` (feat)
3. **Task 3 (human gate): device + Stripe verification** — Stripe key-account fix `a8cf5ee` (fix); spike PASS recorded `67d26e2` / closeout commit (docs)

## Files Created/Modified
- `ios/Podfile` — `linkage => :static`, `$RNFirebaseAsStaticFramework = true`, preserved fmt/Stripe `post_install` hooks, added React-utils header path for FollyConvert
- `ios/carEx/carEx.entitlements` — `aps-environment` (development)
- `ios/carEx/Info.plist` — `UIBackgroundModes` → `remote-notification`
- `App.tsx` — Stripe publishable key aligned to the `51LaViqJ` test account (matches Railway test secret)
- `13-SPIKE-RESULT.md` — full spike record

## Key Findings
- **A2 (confirmed):** `RCT_USE_PREBUILT_RNCORE=0` + `pod deintegrate` resolves RN 0.83 prebuilt-core vs static linkage; `React-Core-prebuilt` count 0.
- **A3:** AppDelegate (`RCTReactNativeFactory` Swift shape) needs no manual APNs forwarding — RNFB `+load` swizzling handles it (re-confirm token delivery on device in 13-03/04).
- **FollyConvert (Pitfall 1):** header lives in the React-utils pod under RN 0.83; stripe-react-native HEADER_SEARCH_PATHS re-pointed there.
- **Xcode 26.4 note:** the Stripe `-Wno-error=enum-redeclared-with-different-underlying-type` hook flag is now an unknown-warning no-op (harmless; removable later).

## Follow-ups (not blocking)
- ⚠️ `App.tsx` ships a TEST Stripe publishable key in all builds (pre-existing CONCERNS.md). Swap to `pk_live_…` + matching Railway `sk_live_…` before a real prod release.
- 13-03 will add `@react-native-firebase/app` + `/messaging` at 24.1.0 (they link statically via `$RNFirebaseAsStaticFramework`), and needs `google-services.json` + APNs `.p8` from Firebase Console.

## Next
Wave 2 → **13-03** (RNFB install + native config). Requires Firebase Console artifacts (`google-services.json`, APNs `.p8`).
