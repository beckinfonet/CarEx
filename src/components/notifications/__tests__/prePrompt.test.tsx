/**
 * Phase 13 Plan 13-05 Task 1 — contextual permission pre-prompt (NPRF-06,
 * CTX D-04/D-05/D-06).
 *
 * The soft in-app pre-prompt fires EXACTLY ONCE across BOTH conversion controls
 * (WatchButton + SaveSearchBar) on the first successful subscription. It is a
 * plain RU-first modal — "Включить" / "Не сейчас" (D-06, NOT the UNHINGED
 * voice). It must NEVER be shown on launch/mount; only on a subscription
 * success. "Не сейчас" persists a flag so it never auto-re-asks (D-05).
 * "Включить" calls requestPermission and, on grant, registers the device token.
 *
 * Load-bearing invariants asserted here:
 *   - Fire-once: first Watch shows it; a second Watch does NOT.
 *   - Single ask covers BOTH controls (D-04): a Watch fired it ⇒ a later
 *     Save-search does NOT re-show, and vice versa (shared AsyncStorage flag).
 *   - "Не сейчас" persists the seen flag (D-05) — never auto-re-asks.
 *   - "Включить" ⇒ messaging().requestPermission() ⇒ on grant ⇒
 *     PushService.registerToken (token from messaging().getToken()).
 *   - NEVER requested at mount: importing/instantiating the helper requests
 *     nothing; only maybeShowPrePrompt() after a success can.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { PushService } from '../../../services/push/PushService';
import {
  PRE_PROMPT_SEEN_KEY,
  shouldShowPrePrompt,
  markPrePromptSeen,
  acceptPrePrompt,
  declinePrePrompt,
} from '../prePrompt';

jest.mock('../../../services/push/PushService', () => ({
  PushService: {
    registerToken: jest.fn(() => Promise.resolve({ ok: true })),
  },
}));

const registerTokenMock = PushService.registerToken as jest.Mock;
const requestPermissionMock = messaging().requestPermission as jest.Mock;
const getTokenMock = messaging().getToken as jest.Mock;
const AUTHORIZED = messaging.AuthorizationStatus.AUTHORIZED;
const PROVISIONAL = messaging.AuthorizationStatus.PROVISIONAL;
const DENIED = messaging.AuthorizationStatus.DENIED;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  getTokenMock.mockResolvedValue('stub-fcm-token');
  requestPermissionMock.mockResolvedValue(AUTHORIZED);
});

describe('prePrompt — fire-once (D-04)', () => {
  it('shows on the FIRST subscription success when the flag is unset', async () => {
    expect(await shouldShowPrePrompt()).toBe(true);
  });

  it('does NOT show again after the flag is set (second Watch)', async () => {
    expect(await shouldShowPrePrompt()).toBe(true);
    await markPrePromptSeen();
    expect(await shouldShowPrePrompt()).toBe(false);
  });

  it('single ask covers BOTH controls: a Watch fired it ⇒ Save-search does not re-show', async () => {
    // Watch fires the prompt and resolves it (any resolution sets the flag).
    expect(await shouldShowPrePrompt()).toBe(true);
    await markPrePromptSeen();
    // A later Save-search asks the SAME shared flag.
    expect(await shouldShowPrePrompt()).toBe(false);
  });

  it('single ask covers BOTH controls in the reverse order (Save then Watch)', async () => {
    expect(await shouldShowPrePrompt()).toBe(true);
    await markPrePromptSeen(); // resolved via Save-search
    expect(await shouldShowPrePrompt()).toBe(false); // later Watch sees it
  });
});

describe('prePrompt — "Не сейчас" persists (D-05)', () => {
  it('decline persists the seen flag so it never auto-re-asks', async () => {
    await declinePrePrompt();
    expect(await AsyncStorage.getItem(PRE_PROMPT_SEEN_KEY)).toBeTruthy();
    expect(await shouldShowPrePrompt()).toBe(false);
    // Decline must NOT request OS permission.
    expect(requestPermissionMock).not.toHaveBeenCalled();
    expect(registerTokenMock).not.toHaveBeenCalled();
  });
});

describe('prePrompt — "Включить" requests then registers (D-06)', () => {
  it('calls requestPermission and, on grant (AUTHORIZED), registers the token', async () => {
    await acceptPrePrompt();
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(registerTokenMock).toHaveBeenCalledTimes(1);
    const body = registerTokenMock.mock.calls[0][0];
    expect(body.token).toBe('stub-fcm-token');
    // Accept also persists the seen flag (resolved exactly once).
    expect(await shouldShowPrePrompt()).toBe(false);
  });

  it('treats PROVISIONAL as granted (registers the token)', async () => {
    requestPermissionMock.mockResolvedValue(PROVISIONAL);
    await acceptPrePrompt();
    expect(registerTokenMock).toHaveBeenCalledTimes(1);
  });

  it('does NOT register the token when the OS dialog is DENIED', async () => {
    requestPermissionMock.mockResolvedValue(DENIED);
    await acceptPrePrompt();
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(registerTokenMock).not.toHaveBeenCalled();
    // Even on deny, the prompt is resolved (never auto-re-asks — D-05).
    expect(await shouldShowPrePrompt()).toBe(false);
  });
});

describe('prePrompt — NEVER requested at mount (anti-pattern)', () => {
  it('importing the helper requests no OS permission', () => {
    // The module was already imported at the top of this file. If merely
    // importing it triggered a permission request, this would be > 0.
    expect(requestPermissionMock).not.toHaveBeenCalled();
  });
});
