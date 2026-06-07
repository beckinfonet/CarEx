package com.carex.market

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Phase 13 (260607-c2i): register the branded carex_default notification
    // channel BEFORE loadReactNative so the very first push renders on it. The
    // manifest declares com.google.firebase.messaging.default_notification_channel_id
    // = "carex_default", but on Android 8+ (API 26 / O) a channel must exist before
    // use — without this every FCM push downgraded to the unbranded fallback channel
    // (notifee was rejected in the D-03 spike, so the channel is created natively here).
    // createNotificationChannel is idempotent: a no-op when the id already exists.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel =
        NotificationChannel(
          "carex_default",
          getString(R.string.app_name),
          NotificationManager.IMPORTANCE_DEFAULT,
        )
      val manager = getSystemService(NotificationManager::class.java)
      manager?.createNotificationChannel(channel)
    }
    loadReactNative(this)
  }
}
