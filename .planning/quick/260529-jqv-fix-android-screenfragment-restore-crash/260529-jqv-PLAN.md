---
phase: quick-260529-jqv
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - android/app/src/main/java/com/carex/market/MainActivity.kt
autonomous: true
requirements:
  - QUICK-260529-jqv
must_haves:
  truths:
    - "MainActivity.onCreate passes null to super.onCreate, discarding any saved Android fragment state"
    - "Backgrounding and reopening the app under 'Don't keep activities' no longer crashes with the ScreenFragment restore IllegalStateException"
  artifacts:
    - path: "android/app/src/main/java/com/carex/market/MainActivity.kt"
      provides: "onCreate(Bundle?) override calling super.onCreate(null) plus android.os.Bundle import"
      contains: "super.onCreate(null)"
  key_links:
    - from: "MainActivity.onCreate"
      to: "ReactActivity.onCreate"
      via: "super.onCreate(null)"
      pattern: "super\\.onCreate\\(null\\)"
---

<objective>
Fix the Play Store crash `java.lang.IllegalStateException: Screen fragments should never be restored` (com.swmansion.rnscreens.ScreenFragment) affecting 22 users / 13% on version 49 (1.0.48).

Root cause (confirmed by orchestrator diagnosis): Android recreates the activity on process death, "Don't keep activities", or unhandled config change and tries to restore the saved react-native-screens fragment state via `FragmentManager.restoreSaveStateInternal`. react-native-screens fragments cannot be restored by Android — React Navigation must rebuild the stack from JS. Because `MainActivity` does not override `onCreate`, it inherits `ReactActivity.onCreate` which forwards the real `savedInstanceState` to super, allowing the doomed restore.

Canonical fix (per react-native-screens guidance): override `onCreate` in `MainActivity` to call `super.onCreate(null)`, discarding the saved fragment state so React Navigation rebuilds the stack fresh.

Purpose: Eliminate a production crash hitting 13% of an app version.
Output: Single-file edit to `MainActivity.kt` adding the `android.os.Bundle` import and the `onCreate(Bundle?)` override.

NOTE: This is a NATIVE Android change. There is no JS / OTA path — it only reaches users via a new signed release build (`npm run android:archive`) submitted to the Play Store. Shipping the build is OUT OF SCOPE for this plan.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<interfaces>
Current MainActivity.kt (the full file — edit in place):

```kotlin
package com.carex.market

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "carEx"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
```

`onCreate(savedInstanceState: Bundle?)` is an overridable method on `ReactActivity` (via `AppCompatActivity`); `Bundle` lives in `android.os.Bundle`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Override onCreate to discard saved fragment state</name>
  <files>android/app/src/main/java/com/carex/market/MainActivity.kt</files>
  <action>Edit MainActivity.kt to prevent Android from restoring react-native-screens fragments on activity recreation.

  1. Add the import `import android.os.Bundle` to the import block (keep imports grouped with the existing `com.facebook.react.*` imports; place the `android.os.Bundle` import before them so the block stays alphabetically ordered).

  2. Inside the `MainActivity` class body, add an `onCreate` override that calls `super.onCreate(null)` instead of forwarding `savedInstanceState`. Place it as the first method in the class (before `getMainComponentName`).

  3. Add a KDoc/inline comment explaining WHY: react-native-screens fragments cannot be restored by Android (FragmentManager.restoreSaveStateInternal throws IllegalStateException "Screen fragments should never be restored"); passing `null` discards the saved fragment state so React Navigation rebuilds the navigation stack from JS. Reference the crash this fixes.

  The added method must be exactly:
  - signature `override fun onCreate(savedInstanceState: Bundle?)`
  - body `super.onCreate(null)`

  Do NOT call `super.onCreate(savedInstanceState)`. Do NOT add any other logic, state restoration, or extra lifecycle work. This is a single-purpose, minimal native fix.</action>
  <verify>
    <automated>cd /Users/beckmaldinVL/development/mobileApps/carEx && grep -q 'super.onCreate(null)' android/app/src/main/java/com/carex/market/MainActivity.kt && grep -q 'import android.os.Bundle' android/app/src/main/java/com/carex/market/MainActivity.kt && grep -q 'override fun onCreate(savedInstanceState: Bundle?)' android/app/src/main/java/com/carex/market/MainActivity.kt && echo OK</automated>
  </verify>
  <done>MainActivity.kt imports android.os.Bundle and overrides onCreate(savedInstanceState: Bundle?) calling super.onCreate(null), with a comment explaining the react-native-screens restore crash. No call to super.onCreate(savedInstanceState) remains.</done>
</task>

</tasks>

<verification>
- `grep` checks in Task 1 confirm the import, override signature, and `super.onCreate(null)` body are present.
- Kotlin compiles as part of the next Android build (`npm run android` or `npm run android:archive`); no separate compile step is required for this plan since the change is a single trivial override.

Manual verification (no instrumented Android test harness exists in this project for activity lifecycle):
1. Enable Developer Options on an Android device/emulator → turn ON "Don't keep activities".
2. Launch the app (`npm run android`) and navigate a few screens deep (e.g. Home → CarDetails).
3. Background the app (Home button), then reopen it from Recents.
4. Confirm the app reopens WITHOUT the `IllegalStateException: Screen fragments should never be restored` crash. The navigation stack rebuilding from the root (or losing deep in-memory screen state) is the expected and acceptable behavior of this fix.
5. Turn OFF "Don't keep activities" when done.
</verification>

<success_criteria>
- MainActivity.kt overrides onCreate(Bundle?) and calls super.onCreate(null).
- android.os.Bundle is imported.
- A comment documents why null is passed (react-native-screens fragment restore crash).
- App no longer crashes with the ScreenFragment restore IllegalStateException under "Don't keep activities" (manual verification).
- Reaching users requires a new signed Android release build + Play Store submission (out of scope for this plan, noted for the operator).
</success_criteria>

<output>
After completion, create `.planning/quick/260529-jqv-fix-android-screenfragment-restore-crash/260529-jqv-SUMMARY.md`.
</output>
