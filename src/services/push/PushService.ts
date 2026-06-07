// PushService — mobile wrapper around Phase 13's device-token REST surface
// (the /api/notifications/device-tokens routes shipped in 13-02).
//
// MOB-01 guardrail (CLAUDE.md / PROJECT DEBT-01): these methods live in a NEW
// domain module, NOT in AuthService. The grep
//   grep -i -E 'device-?token|registerToken|unregisterToken' src/services/AuthService.ts
// must return 0 (excluding comments) during and after this milestone. This
// module mirrors the NotificationService / ModerationService split precedent
// exactly.
//
// Every method delegates to `apiClient` from `../http/client`, which owns:
//   - Bearer idToken injection (request interceptor, Plan 04-01 D-02/D-04) —
//     the backend derives the caller uid from the verified token, so the client
//     NEVER sends a uid in the body or params (IDOR mitigation, T-13-04-03).
//   - 401 idToken refresh + single retry (Plan 05-12).
// So method bodies stay as thin "verb + path + body" wrappers. The catch
// blocks log + re-throw whatever the interceptor produced.
//
// LOGOUT-ORDERING TRAP (NPUSH-04 / Pitfall 4): unregisterToken takes the FCM
// token as an explicit argument and depends on NOTHING else. AuthContext.logout
// captures the FCM token and calls unregisterToken BEFORE currentIdTokenRef
// clears (line ~439) so the request interceptor still has a valid Bearer to
// attach to the DELETE. Keeping the token an explicit parameter is what makes
// the ordering fix testable in isolation — this service never reads the idToken
// ref itself.
//
// DELETE: the device-token route encodes the token in the URL path (uid is
// derived from the Bearer), so no request body is needed. axios DELETE takes
// config as the second argument; if a body were ever required it would go via
// `config.data` (see NotificationService.ts:23-24).

import { apiClient } from '../http/client';

/** Register-token body (POST /api/notifications/device-tokens). No uid — the
 * backend derives it from the verified Bearer (IDOR-safe). */
export interface RegisterTokenBody {
  // The FCM registration token from RNFB messaging().getToken().
  token: string;
  // Platform.OS at register time — backend platform enum is 'ios' | 'android'.
  platform: string;
  // App marketing version (Platform-reported) so the backend can attribute
  // tokens to an app build for future debugging.
  appVersion: string;
}

export const PushService = {
  /**
   * POST /api/notifications/device-tokens — upsert this device's FCM token for
   * the authenticated user. Body carries NO uid (backend derives it from the
   * Bearer). Called on login/signup (when permission is already granted) and on
   * onTokenRefresh.
   */
  registerToken: async (body: RegisterTokenBody) => {
    try {
      const response = await apiClient.post(
        '/api/notifications/device-tokens',
        body,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to register device token', error);
      throw error;
    }
  },

  /**
   * DELETE /api/notifications/device-tokens/:token — remove this device's FCM
   * token so a logged-out device stops receiving the prior user's pushes
   * (T-13-04-01). The token is passed explicitly so logout() can CAPTURE it and
   * fire this BEFORE the idToken ref clears (NPUSH-04 / Pitfall 4) — the
   * interceptor still attaches a valid Bearer at that point.
   */
  unregisterToken: async (token: string) => {
    try {
      const response = await apiClient.delete(
        `/api/notifications/device-tokens/${token}`,
      );
      return response.data;
    } catch (error) {
      console.error('Failed to unregister device token', error);
      throw error;
    }
  },
};
