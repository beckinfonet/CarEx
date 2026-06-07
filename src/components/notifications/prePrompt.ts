// prePrompt — the contextual permission pre-prompt helper (NPRF-06,
// CTX D-04/D-05/D-06).
//
// WHY A SHARED HELPER: the soft in-app pre-prompt must fire EXACTLY ONCE across
// BOTH conversion controls — WatchButton and SaveSearchBar (D-04, "single ask
// covers both"). Centralising the fire-once flag + the request/register flow
// here is what makes "a Watch fired it ⇒ a later Save-search does not re-show"
// true without the two components coordinating. It also confines the
// spike-gated RNFB `messaging()` surface (requestPermission) to one place,
// alongside the read-only 13-04 `pushPermission.ts`.
//
// HARD ANTI-PATTERN (RESEARCH §Anti-Patterns / D-04): NEVER request OS
// permission on launch/mount. This module requests permission ONLY inside
// acceptPrePrompt(), which a component calls after the user taps "Включить" in
// the soft modal — which itself only appears after a SUCCESSFUL subscription.
//
// FIRE-ONCE SEMANTICS (D-05): the AsyncStorage flag is set on ANY resolution —
// accept (Включить) OR decline (Не сейчас) OR an OS deny — so the prompt fires
// exactly once and never auto-re-asks. The denied-permission RECOVERY path
// (deep-link to OS Settings) lives on NotificationSettingsScreen (13-05 Task 2),
// not here.

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { PushService } from '../../services/push/PushService';

/** AsyncStorage flag — set on any resolution so the pre-prompt fires once. */
export const PRE_PROMPT_SEEN_KEY = 'push_preprompt_seen';

/** App version sent with the token (opaque backend metadata; RN exposes no
 * marketing version without a native module, and CLAUDE.md forbids new libs). */
const APP_VERSION = 'unknown';

/**
 * True when the soft pre-prompt has NOT yet been shown/resolved. Read on every
 * successful subscription by both WatchButton and SaveSearchBar — the shared
 * flag is what makes the single ask cover both controls (D-04).
 */
export async function shouldShowPrePrompt(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(PRE_PROMPT_SEEN_KEY);
    return seen == null;
  } catch (error) {
    // On a storage read error, do NOT spam the prompt — treat as already seen.
    console.error('Failed to read pre-prompt flag', error);
    return false;
  }
}

/** Persist the seen flag so the pre-prompt never auto-re-asks (D-05). */
export async function markPrePromptSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRE_PROMPT_SEEN_KEY, '1');
  } catch (error) {
    console.error('Failed to persist pre-prompt flag', error);
  }
}

/** True when an RNFB authorization status counts as granted (D-11). */
function isGranted(status: number): boolean {
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * "Не сейчас" — decline the soft pre-prompt. Persists the seen flag and does
 * NOT touch OS permission (D-05: never auto-re-ask; no OS dialog on decline).
 */
export async function declinePrePrompt(): Promise<void> {
  await markPrePromptSeen();
}

/**
 * "Включить" — accept the soft pre-prompt: trigger the OS permission dialog
 * (RNFB requestPermission + Android POST_NOTIFICATIONS on API 33+), and on a
 * grant acquire the FCM token and register it with the backend. Persists the
 * seen flag on ANY resolution (grant or deny) so the prompt fires exactly once
 * (D-04/D-05). Best-effort: never throws so a failure can't break the
 * conversion flow.
 */
export async function acceptPrePrompt(): Promise<void> {
  try {
    // Android 13+ (targetSdk 36) gates notifications behind the runtime
    // POST_NOTIFICATIONS permission; request it first so the RNFB grant sticks.
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
      } catch (androidError) {
        console.error('POST_NOTIFICATIONS request failed', androidError);
      }
    }

    const status = await messaging().requestPermission();
    if (isGranted(status)) {
      const token = await messaging().getToken();
      if (token) {
        await PushService.registerToken({
          token,
          platform: Platform.OS,
          appVersion: APP_VERSION,
        });
      }
    }
  } catch (error) {
    console.error('Failed to accept push pre-prompt', error);
  } finally {
    // Resolve exactly once regardless of grant/deny outcome (D-05).
    await markPrePromptSeen();
  }
}
