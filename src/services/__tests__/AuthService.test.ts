/**
 * Plan 04-05: AuthService migration to shared apiClient.
 *
 * Tests verify:
 *   - Backend calls route through apiClient (AxiosInstance from http/client.ts)
 *   - Identity Toolkit calls (signUp, signIn, sendPasswordResetEmail, and the
 *     :delete leg of deleteAccount) KEEP using plain axios with API_KEY
 *   - getBackendUser accepts an optional AxiosRequestConfig second param
 *   - MOB-01 guardrail: no moderation methods added to AuthService
 *
 * Mocking strategy: jest.mock both 'axios' (for Identity Toolkit calls) and
 * '../http/client' (for the shared apiClient). Each mock method returns a
 * canned response so AuthService code under test executes without a real
 * network call. Each test then asserts which mock was invoked with which args.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('axios');
jest.mock('../http/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
  setTokenProvider: jest.fn(),
  setModerationRefreshListener: jest.fn(),
}));

// eslint-disable-next-line import/first
import { AuthService } from '../AuthService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { apiClient } = require('../http/client');

beforeEach(() => {
  jest.clearAllMocks();
  const okResponse = { data: { ok: true } };
  (axios.get as jest.Mock).mockResolvedValue(okResponse);
  (axios.post as jest.Mock).mockResolvedValue(okResponse);
  (axios.put as jest.Mock).mockResolvedValue(okResponse);
  (axios.delete as jest.Mock).mockResolvedValue(okResponse);
  (axios.patch as jest.Mock).mockResolvedValue(okResponse);
  (apiClient.get as jest.Mock).mockResolvedValue(okResponse);
  (apiClient.post as jest.Mock).mockResolvedValue(okResponse);
  (apiClient.put as jest.Mock).mockResolvedValue(okResponse);
  (apiClient.delete as jest.Mock).mockResolvedValue(okResponse);
  (apiClient.patch as jest.Mock).mockResolvedValue(okResponse);
});

describe('AuthService — apiClient migration (Plan 04-05)', () => {
  it('Test 1: getBackendUser uses apiClient.get with path-only URL', async () => {
    await AuthService.getBackendUser('uid-1');

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/uid-1', undefined);
    // Critical: plain axios must NOT be called for a backend read.
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('Test 2: getBackendUser forwards optional AxiosRequestConfig second param', async () => {
    await AuthService.getBackendUser('uid-1', {
      _skipModerationInterceptor: true,
    } as any);

    expect(apiClient.get).toHaveBeenCalledWith('/api/users/uid-1', {
      _skipModerationInterceptor: true,
    });
  });

  it('Test 3: signIn stays on plain axios and hits identitytoolkit.googleapis.com', async () => {
    await AuthService.signIn('e@x.com', 'pw');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url] = (axios.post as jest.Mock).mock.calls[0];
    expect(url).toMatch(/identitytoolkit\.googleapis\.com/);
    expect(url).toMatch(/:signInWithPassword/);
    expect(url).toMatch(/key=/);
    // Critical: the shared apiClient (which would attach Bearer) must NOT be
    // used for Identity Toolkit calls.
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('Test 4: createBackendUser migrates to apiClient.post with path-only URL', async () => {
    await AuthService.createBackendUser('uid-1', 'e@x.com');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/api/users', {
      firebaseUid: 'uid-1',
      email: 'e@x.com',
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('Test 5: uploadAvatar preserves multipart Content-Type header on apiClient', async () => {
    await AuthService.uploadAvatar('uid-1', {
      uri: 'file:///tmp/a.jpg',
      type: 'image/jpeg',
      fileName: 'a.jpg',
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/users/uid-1/avatar');
    expect(body).toBeDefined(); // FormData instance
    expect(config).toEqual({
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });

  it('Test 6: deleteAccount calls apiClient.delete for backend AND axios.post for Identity Toolkit :delete', async () => {
    await AuthService.deleteAccount('idtoken-xyz', 'uid-1');

    // Backend leg — migrated
    expect(apiClient.delete).toHaveBeenCalledWith('/api/users/uid-1');

    // Identity Toolkit leg — still on plain axios
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = (axios.post as jest.Mock).mock.calls[0];
    expect(url).toMatch(/identitytoolkit\.googleapis\.com/);
    expect(url).toMatch(/:delete/);
    expect(url).toMatch(/key=/);
    expect(body).toEqual({ idToken: 'idtoken-xyz' });
  });

  it('Test 7: createPaymentIntent preserves 30s timeout option on apiClient.post', async () => {
    await AuthService.createPaymentIntent('usd', 'car-1', 'uid-1');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/payments/create-payment-intent');
    expect(body).toEqual({ currency: 'usd', carId: 'car-1', buyerUid: 'uid-1' });
    expect(config).toEqual({ timeout: 30000 });
  });

  it('Test 8: no backend method still uses ${API_URL}/api/ template (source-level grep)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // Resolve AuthService.ts relative to CWD (jest always runs from repo root).
    const src = fs.readFileSync('src/services/AuthService.ts', 'utf8');
    const matches = src.match(/\$\{API_URL\}\/api\//g) || [];
    expect(matches.length).toBe(0);
  });

  it('Test 9: MOB-01 guardrail — no moderation method names in AuthService export', () => {
    const keys = Object.keys(AuthService);
    const forbidden = keys.filter((k) =>
      /(suspend|revoke|moderation)/i.test(k),
    );
    expect(forbidden).toEqual([]);
  });

  // -------------------- Test 10: refreshIdToken — Plan 05-12 --------------------

  it('Test 10: refreshIdToken POSTs form-encoded body to securetoken.googleapis.com and returns camelCase shape', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({
      data: {
        id_token: 'new-id-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: '3600',
      },
    });

    const result = await AuthService.refreshIdToken('the-refresh-token');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = (axios.post as jest.Mock).mock.calls[0];
    expect(url).toMatch(/^https:\/\/securetoken\.googleapis\.com\/v1\/token\?key=/);
    expect(body).toBe('grant_type=refresh_token&refresh_token=the-refresh-token');
    expect(config.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    expect(result).toEqual({
      idToken: 'new-id-token',
      refreshToken: 'rotated-refresh-token',
      expiresIn: '3600',
    });

    // Critical: apiClient (which would attach Bearer) must NOT be used here.
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('Test 11: refreshIdToken throws the Firebase error.message on HTTP 400', async () => {
    const err: any = new Error('Request failed with status code 400');
    err.response = { status: 400, data: { error: { message: 'TOKEN_EXPIRED' } } };
    (axios.post as jest.Mock).mockRejectedValueOnce(err);

    await expect(
      AuthService.refreshIdToken('expired-token'),
    ).rejects.toEqual({ message: 'TOKEN_EXPIRED' });
  });

  it('Test 12: refreshIdToken URL-encodes the refresh token', async () => {
    (axios.post as jest.Mock).mockResolvedValueOnce({
      data: { id_token: 'x', refresh_token: 'y', expires_in: '3600' },
    });

    // Tokens with special chars must round-trip correctly through the form body.
    await AuthService.refreshIdToken('a/b+c=d');

    const [, body] = (axios.post as jest.Mock).mock.calls[0];
    expect(body).toBe('grant_type=refresh_token&refresh_token=a%2Fb%2Bc%3Dd');
  });

  it('Test 13: saveAuthSession persists token + refreshToken + expiresAt to AsyncStorage', async () => {
    const AS = require('@react-native-async-storage/async-storage');
    AS.setItem.mockClear();

    // Freeze time so expiresAt is deterministic.
    const fixedNow = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    await AuthService.saveAuthSession(
      'new-id-token',
      'new-refresh-token',
      '3600',
      { localId: 'uid-1', email: 'a@b.com' },
    );

    const calls = AS.setItem.mock.calls;
    const map = Object.fromEntries(calls);
    expect(map.userToken).toBe('new-id-token');
    expect(map.userRefreshToken).toBe('new-refresh-token');
    expect(map.userIdTokenExpiresAt).toBe(String(fixedNow + 3600 * 1000));
    expect(JSON.parse(map.userData)).toEqual({ localId: 'uid-1', email: 'a@b.com' });

    (Date.now as jest.Mock).mockRestore();
  });

  it('Test 14: logout clears userRefreshToken + userIdTokenExpiresAt in addition to userToken/userData', async () => {
    const AS = require('@react-native-async-storage/async-storage');
    AS.removeItem.mockClear();

    await AuthService.logout();

    const removed = AS.removeItem.mock.calls.map((c: any[]) => c[0]).sort();
    expect(removed).toEqual(
      ['userData', 'userIdTokenExpiresAt', 'userRefreshToken', 'userToken'].sort(),
    );
  });
});
