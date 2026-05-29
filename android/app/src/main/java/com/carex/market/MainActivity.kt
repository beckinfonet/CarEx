package com.carex.market

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Discard any saved Android fragment state on activity recreation.
   *
   * react-native-screens fragments cannot be restored by the Android framework: when the OS
   * recreates the activity (process death, "Don't keep activities", or an unhandled config
   * change) it calls FragmentManager.restoreSaveStateInternal, which throws
   * `IllegalStateException: Screen fragments should never be restored`
   * (com.swmansion.rnscreens.ScreenFragment). Passing `null` to super.onCreate drops the saved
   * fragment state so React Navigation rebuilds the navigation stack from JS instead.
   *
   * Fixes the production crash on version 49 (1.0.48). Do NOT forward `savedInstanceState`.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "carEx"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
