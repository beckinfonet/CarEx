# Phase 13 Spike Result — iOS static-frameworks (NPUSH-01)

**Spike:** `use_frameworks! :linkage => :static` + `$RNFirebaseAsStaticFramework = true` on RN 0.83 with Stripe intact.
**Gate (D-02):** PASS only when a **Release archive runs on a real iOS device AND a Stripe TEST checkout completes**. Simulator/Debug do NOT count (Pitfall 3).
**Status:** IN PROGRESS — automated `pod install` portion (Task 1 + Task 2) executed by agent; **real-device Release gate (Task 3) pending human verification.**

---

## Rollback Checkpoint (pre-frameworks, committed BEFORE any linkage change)

This is the clean known-good revert target established before touching iOS linkage (D-02).

| Item | Value |
|------|-------|
| Branch | `feature/notifications-system` |
| Pre-frameworks git SHA | `5d6c02452d1899b7dc637a3e1d9588fa6c377692` (`5d6c024`) |
| `ios/Podfile.lock` sha256 | `52f23de8da2d8bcd65ebfb941d9b536c43b4188659c04a46b5aad7454b7f0c0c` |
| `ios/Podfile.lock` PODFILE CHECKSUM | `7d248f31ee12180f8faccacc61f937db160dfdbb` |
| CocoaPods | `1.16.2` |
| Xcode | `26.4` |
| Pre-switch Podfile toggle state | `linkage = ENV['USE_FRAMEWORKS']` — dynamic by default; static frameworks NOT yet enabled (no env var set; `USE_FRAMEWORKS` unset in shell) |
| `$RNFirebaseAsStaticFramework` | NOT present (pre-switch) |
| Timebox START (D-01, 2 days) | `2026-06-07T03:54:25Z` |
| Timebox DEADLINE (hard abort) | `2026-06-09T03:54:25Z` |
| Parked unrelated churn | `android/version.properties`, `ios/carEx.xcodeproj/project.pbxproj` stashed (`stash@{0}: phase13-spike: park version-bump churn`) so the checkpoint is clean version-bump-free |

### Exact revert command (run if spike ABORTS — D-02)

```bash
# 1. Restore the pre-frameworks Podfile + lockfile from the checkpoint SHA
git checkout 5d6c02452d1899b7dc637a3e1d9588fa6c377692 -- ios/Podfile ios/Podfile.lock

# 2. Also restore entitlements / Info.plist if they were modified by the spike
git checkout 5d6c02452d1899b7dc637a3e1d9588fa6c377692 -- ios/carEx/carEx.entitlements ios/carEx/Info.plist

# 3. Fully tear down and reinstall pods at the pre-frameworks (dynamic) linkage
cd ios && pod deintegrate && pod install && cd ..

# 4. Confirm Podfile.lock matches the checkpoint
shasum -a 256 ios/Podfile.lock   # expect 52f23de8da2d8bcd65ebfb941d9b536c43b4188659c04a46b5aad7454b7f0c0c
```

On abort, ship Phase-12's in-app notification center as the **only** channel for this milestone and re-attempt native push in a future milestone (do NOT extend the timebox, do NOT pivot transports — D-02).

---

## Working Incantation (Task 2 — static-frameworks `pod install`)

The exact, reproducible sequence that produced a clean static-frameworks `pod install`:

```bash
# 1. Podfile edits (committed):
#    - $RNFirebaseAsStaticFramework = true   (global, before target block)
#    - linkage defaults to :static; literal `use_frameworks! :linkage => :static`
#    - post_install: PRESERVED fmt c++17 + stripe enum-redeclared hooks
#    - post_install: ADD stripe-react-native HEADER_SEARCH_PATHS -> React-utils
#      framework Headers (FollyConvert fix, Pitfall 1)

# 2. Deintegrate is REQUIRED when toggling linkage (dynamic -> static):
cd ios && pod deintegrate

# 3. Install with prebuilt React-Core DISABLED (Pitfall 2 / A2):
RCT_USE_PREBUILT_RNCORE=0 pod install
```

Result: `Pod installation complete! 91 dependencies, 102 total pods.` Exit 0.

### Post-install state (post-static)

| Item | Value |
|------|-------|
| `ios/Podfile.lock` sha256 (post-static) | `7e51c116922a42342149c93753b21475aac7abdf6f518f5cec99161343de70cc` |
| `ios/Podfile.lock` PODFILE CHECKSUM (post-static) | `fcf973b172282566ed6b942d9e56607f407f0bc4` |
| Static frameworks applied | YES — `FRAMEWORK_SEARCH_PATHS` lists per-pod `.framework` build dirs in `Pods-carEx.release.xcconfig` |
| `React-Core-prebuilt` in Podfile.lock | NONE (count 0) — `RCT_USE_PREBUILT_RNCORE=0` forced source build of React-Core |
| Stripe / fmt pods present | `stripe-react-native (0.62.0)`, `Stripe (25.9.0)`, `fmt (11.0.2)` |

### A2 — RN 0.83 prebuilt-core vs static linkage (CONFIRMED workaround)

`RCT_USE_PREBUILT_RNCORE=0 pod install` resolves the RN 0.83 prebuilt-core vs static-frameworks conflict for THIS bare-RN project. Verified: no `React-Core-prebuilt` pod appears in `Podfile.lock`; React-Core (0.83.1) installs from source. No `React-use-frameworks.modulemap`-not-found failure at install time. A `pod deintegrate` before the first static install was required (CocoaPods otherwise reuses the prior dynamic-linkage integration).

### A3 — AppDelegate APNs registration forwarding (FINDING)

`ios/carEx/AppDelegate.swift` is the newer `RCTReactNativeFactory` shape (Swift; `factory.startReactNative(...)`). It contains **NO** `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)` or `application(_:didReceiveRemoteNotification:fetchCompletionHandler:)` methods. RNFB's iOS module registers these via `+load`-time **method swizzling** on `UIApplicationDelegate`, so for the standard case **no manual AppDelegate edits are required** for the static-frameworks build to succeed or for APNs token forwarding to reach RNFB. **However**, this is a build-time/install-time finding only — whether swizzling actually delivers the APNs token to RNFB on this AppDelegate shape can only be confirmed on a **real device** (Task 3). If device testing shows the FCM token never resolves, the remediation is to add explicit `didRegisterForRemoteNotificationsWithDeviceToken` / `didReceiveRemoteNotification` forwarding to RNFB in AppDelegate (documented RNFB fallback). Recorded as a watch item for the device gate.

### FollyConvert fix detail (Pitfall 1)

`stripe-react-native`'s `ios/NewArch/StripeNewArchConversions.h` does
`#if __has_include(<react/utils/FollyConvert.h>)`. In RN 0.83 that header belongs to the
**`React-utils`** pod (source: `node_modules/react-native/ReactCommon/react/utils/platform/ios/react/utils/FollyConvert.h`; the `React-utils` umbrella imports it, so the static `React_utils.framework/Headers` exposes `react/utils/FollyConvert.h`). The post_install fix adds the React-utils framework Headers root to stripe-react-native's `HEADER_SEARCH_PATHS` (verified landed in `Pods.xcodeproj` for both build configs). **Compile-time resolution is proven only by the Task 3 archive build** — `pod install` does not compile, so a clean install does NOT by itself prove FollyConvert resolves. This is the central spike test and remains pending at the human gate.

### Pods staged for the spike

NO RNFB JS packages were installed (that is plan 13-03). The static-frameworks build was reproduced with the EXISTING pod set (Stripe, fmt, React-* from source). `$RNFirebaseAsStaticFramework = true` is declared in the Podfile so that when RNFB pods are added in 13-03 they link statically, but no `@react-native-firebase/*` pod is present yet.

---

## D-03 — notifee vs RNFB built-in display (PENDING human decision at Task 3)

RESEARCH recommends defaulting to **RNFB built-in display (NO `@notifee/react-native`)** for Phase 13's generic background/quit lock-screen pushes. To be confirmed/recorded by the operator at the Task 3 device gate.

---

## Real-Device Release Gate (Task 3) — PENDING

The D-02 pass bar (Release archive on a real iOS device + Stripe TEST checkout works) is a human-verify checkpoint and has NOT been executed by the agent. See plan Task 3 `<how-to-verify>`. PASS/FAIL, the D-03 decision, and (if FAIL) the abort+revert record will be appended here after the operator runs the device test.

