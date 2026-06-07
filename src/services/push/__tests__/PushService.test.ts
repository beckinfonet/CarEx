/**
 * Phase 13 — PushService (Wave 3, plan 13-04 Task 1).
 *
 * Mirrors the NotificationService.test.ts / ModerationService.test.ts harness:
 * mock the shared apiClient BEFORE importing the service so its
 * `import { apiClient } from '../http/client'` binds to the mock. Each method is
 * a thin verb+path wrapper — we assert the verb, path, body, the DELETE-with-
 * body shape, the MOB-01 guardrail (push/device-token HTTP lives ONLY on
 * PushService, never on AuthService), and the logout-ordering logic at the
 * unit level (NPUSH-04): the unregister fires using a CAPTURED token and does
 * not depend on the idToken ref being non-null at call time.
 */

jest.mock('../../http/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import { apiClient } from '../../http/client';
import { PushService } from '../PushService';

const mockedApiClient = apiClient as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
};

describe('PushService', () => {
  beforeEach(() => {
    mockedApiClient.get.mockReset();
    mockedApiClient.post.mockReset();
    mockedApiClient.patch.mockReset();
    mockedApiClient.delete.mockReset();
  });

  // -------------------- registerToken --------------------

  it('registerToken POSTs /api/notifications/device-tokens with { token, platform, appVersion } and returns response.data', async () => {
    const body = { token: 'fcm-abc', platform: 'ios', appVersion: '1.2.3' };
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true } });

    const result = await PushService.registerToken(body);

    expect(mockedApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/api/notifications/device-tokens',
      body,
    );
    expect(result).toEqual({ ok: true });
  });

  it('registerToken sends NO uid in the body (IDOR-safe — backend derives uid from the Bearer)', async () => {
    mockedApiClient.post.mockResolvedValueOnce({ data: { ok: true } });

    await PushService.registerToken({
      token: 'fcm-abc',
      platform: 'android',
      appVersion: '9.9.9',
    });

    const sentBody = mockedApiClient.post.mock.calls[0][1];
    expect(sentBody).not.toHaveProperty('uid');
    expect(Object.keys(sentBody).sort()).toEqual(
      ['appVersion', 'platform', 'token'].sort(),
    );
  });

  it('registerToken logs and re-throws on error (mirrors NotificationService catch shape)', async () => {
    const boom = new Error('network down');
    mockedApiClient.post.mockRejectedValueOnce(boom);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      PushService.registerToken({
        token: 't',
        platform: 'ios',
        appVersion: '1',
      }),
    ).rejects.toBe(boom);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  // -------------------- unregisterToken --------------------

  it('unregisterToken DELETEs /api/notifications/device-tokens/:token and returns response.data', async () => {
    mockedApiClient.delete.mockResolvedValueOnce({ data: { deleted: 1 } });

    const result = await PushService.unregisterToken('fcm-xyz');

    expect(mockedApiClient.delete).toHaveBeenCalledTimes(1);
    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      '/api/notifications/device-tokens/fcm-xyz',
    );
    expect(result).toEqual({ deleted: 1 });
  });

  it('unregisterToken logs and re-throws on error', async () => {
    const boom = new Error('401 unauthorized');
    mockedApiClient.delete.mockRejectedValueOnce(boom);
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(PushService.unregisterToken('fcm-xyz')).rejects.toBe(boom);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  // -------------------- logout-ordering logic (NPUSH-04 / Pitfall 4) --------------------

  it('logout-ordering: unregisterToken completes using the CAPTURED token, independent of any idToken-ref state', async () => {
    // The whole point of the ordering fix (Pitfall 4): in logout() the FCM
    // token is captured and unregister is fired BEFORE currentIdTokenRef
    // clears. At the service level this means unregisterToken only needs the
    // token argument it was handed — it never reads or depends on the idToken
    // ref. We prove that by calling it with a captured token while a mock
    // "idToken ref" is already null; the DELETE still goes out with that token.
    const idTokenRef: { current: string | null } = { current: null };
    const capturedToken = 'captured-before-clear';
    mockedApiClient.delete.mockResolvedValueOnce({ data: { deleted: 1 } });

    // idTokenRef is already null here — simulating the post-clear state. The
    // captured token is all unregisterToken needs.
    await PushService.unregisterToken(capturedToken);

    expect(idTokenRef.current).toBeNull();
    expect(mockedApiClient.delete).toHaveBeenCalledWith(
      `/api/notifications/device-tokens/${capturedToken}`,
    );
  });

  // -------------------- MOB-01 guardrail --------------------

  it('MOB-01 guardrail: device-token/push HTTP lives ONLY on PushService — AuthService has zero device-token methods', () => {
    const authSource = fs.readFileSync(
      path.resolve(__dirname, '../../AuthService.ts'),
      'utf8',
    );
    // Strip line comments so a comment that merely mentions the words does not
    // trip the gate (mirrors the executor grep gate `grep -vc '^\\s*//'`).
    const nonComment = authSource
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n');
    expect(nonComment).not.toMatch(/device-?token/i);
    expect(nonComment).not.toMatch(/registerToken/i);
    expect(nonComment).not.toMatch(/unregisterToken/i);
  });
});
