---
phase: quick-260529-jqv
plan: 01
subsystem: android-native
tags: [android, react-native-screens, crash-fix, lifecycle]
requires: []
provides:
  - "MainActivity.onCreate(Bundle?) override that discards saved fragment state via super.onCreate(null)"
affects:
  - android/app/src/main/java/com/carex/market/MainActivity.kt
tech-stack:
  added: []
  patterns:
    - "Override onCreate(null) on the React host activity to prevent Android from restoring react-native-screens fragments"
key-files:
  created: []
  modified:
    - android/app/src/main/java/com/carex/market/MainActivity.kt
decisions:
  - "Pass null to super.onCreate (not savedInstanceState) so React Navigation rebuilds the stack from JS — the canonical react-native-screens fix"
metrics:
  duration: ~3min
  completed: 2026-05-29
requirements:
  - QUICK-260529-jqv
---

# Quick Task 260529-jqv: Fix Android ScreenFragment Restore Crash Summary

Override `MainActivity.onCreate(Bundle?)` to call `super.onCreate(null)`, discarding Android's saved react-native-screens fragment state so the OS no longer attempts a doomed fragment restore that crashes 13% of v49 users with `IllegalStateException: Screen fragments should never be restored`.

## What Was Done

**Task 1 — Override onCreate to discard saved fragment state** (commit `6d3f59c`)

- Added `import android.os.Bundle` to `MainActivity.kt`, placed before the `com.facebook.react.*` imports to keep the block alphabetically ordered.
- Added an `override fun onCreate(savedInstanceState: Bundle?)` as the first method in the class body, with a single statement: `super.onCreate(null)`.
- Added a KDoc comment explaining WHY `null` is passed: react-native-screens fragments cannot be restored by Android's `FragmentManager.restoreSaveStateInternal`; passing `null` discards the saved fragment state so React Navigation rebuilds the navigation stack from JS. The comment references the production crash on version 49 (1.0.48) and explicitly warns against forwarding `savedInstanceState`.

The previous behavior inherited `ReactActivity.onCreate`, which forwarded the real `savedInstanceState` to super — allowing Android to attempt the fragment restore on process death, "Don't keep activities", or an unhandled config change.

## Verification

Automated grep checks from the plan all pass:
- `super.onCreate(null)` present
- `import android.os.Bundle` present
- `override fun onCreate(savedInstanceState: Bundle?)` present
- No remaining `super.onCreate(savedInstanceState)` call

Kotlin compiles as part of the next Android build; no separate compile step is required for this trivial single-method override.

Manual verification (deferred to operator — no instrumented Android lifecycle test harness exists in this project): enable "Don't keep activities" in Developer Options, navigate a few screens deep, background and reopen the app, and confirm no `IllegalStateException: Screen fragments should never be restored` crash. The navigation stack rebuilding from the root is the expected and acceptable behavior of this fix.

## Deviations from Plan

None - plan executed exactly as written.

(The actual `MainActivity.kt` carried pre-existing KDoc comments on `getMainComponentName` and `createReactActivityDelegate` that were not shown in the plan's interface snippet; these were preserved verbatim. This is not a deviation — the edit was additive and matched the prescribed structure.)

## Out of Scope / Operator Action Required

This is a NATIVE Android change. There is no JS / OTA path — it only reaches users via a new signed Android release build (`npm run android:archive`) submitted to the Play Store. Shipping that build is OUT OF SCOPE for this plan and must be performed by the operator.

## Self-Check: PASSED

- FOUND: android/app/src/main/java/com/carex/market/MainActivity.kt
- FOUND: commit 6d3f59c
