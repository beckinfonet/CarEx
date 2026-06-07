// pushPermission — the single place that touches the RNFB messaging native
// surface for the device-token lifecycle (NPUSH-04). Isolating these calls here
// (rather than scattering messaging() through AuthContext) keeps AuthContext
// mockable in Jest and confines the spike-gated native dependency to one file.
//
// IMPORTANT — NO OS DIALOG HERE (13-04 hard requirement). These helpers only
// READ the live permission status (hasPermission) and acquire a token when
// permission is ALREADY granted. They MUST NOT call requestPermission() — the
// contextual pre-prompt that triggers the OS dialog ships in 13-05. Requesting
// permission on login/launch is a banned anti-pattern (RESEARCH §Anti-Patterns).

import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { PushService } from './PushService';

/** App version string sent with the token (debugging attribution only). RN does
 * not expose the marketing version without a native module, and CLAUDE.md
 * forbids adding new libs for this milestone — so we send a best-effort
 * placeholder. The backend treats appVersion as opaque metadata. */
const APP_VERSION = 'unknown';

/**
 * True when push permission is ALREADY granted (AUTHORIZED or PROVISIONAL).
 * Reads live OS status without prompting. Returns false (never throws) on any
 * error so a permission read can never block the auth flow.
 */
export async function isPushPermissionGranted(): Promise<boolean> {
  try {
    const status = await messaging().hasPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error('Failed to read push permission status', error);
    return false;
  }
}

/**
 * Register this device's FCM token with the backend — but ONLY if push
 * permission is already granted (no OS dialog). Safe to call on login/signup
 * and from onTokenRefresh. Best-effort: a failure here logs and returns without
 * throwing so it never breaks login/signup.
 */
export async function registerDeviceTokenIfPermitted(): Promise<void> {
  try {
    const granted = await isPushPermissionGranted();
    if (!granted) {
      // Permission not yet granted — registration happens later, after the
      // 13-05 contextual pre-prompt grants it. Do NOT prompt here.
      return;
    }
    const token = await messaging().getToken();
    if (!token) return;
    await PushService.registerToken({
      token,
      platform: Platform.OS,
      appVersion: APP_VERSION,
    });
  } catch (error) {
    console.error('Failed to register device token', error);
  }
}

/**
 * Capture the current FCM token. Used by logout() to grab the token BEFORE the
 * idToken ref clears (NPUSH-04 / Pitfall 4). Returns null (never throws) if the
 * token cannot be read, so logout teardown always proceeds.
 */
export async function getDeviceTokenSafe(): Promise<string | null> {
  try {
    return await messaging().getToken();
  } catch (error) {
    console.error('Failed to read device token for unregister', error);
    return null;
  }
}

/**
 * Subscribe to FCM token rotation. RNFB fires onTokenRefresh when the token
 * changes; we re-register (gated by permission) on each fire. Returns the RNFB
 * unsubscribe function. Subscribe ONCE on mount (mirrors the existing
 * subscribe-once listener precedent in AuthContext).
 */
export function subscribeTokenRefresh(): () => void {
  try {
    return messaging().onTokenRefresh(() => {
      void registerDeviceTokenIfPermitted();
    });
  } catch (error) {
    console.error('Failed to subscribe to token refresh', error);
    return () => {};
  }
}
